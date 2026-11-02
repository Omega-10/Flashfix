import { Pool } from 'pg';
import { SessionPayload, UserRole, HttpError, requireStoreAccess } from './authz.ts';
import { createOtpRecord, verifyOtpAttempt } from './otp.ts';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PICKUP_EN_ROUTE'
  | 'PICKUP_OTP_SENT'
  | 'IN_TRANSIT'
  | 'CUSTODY_OTP_SENT'
  | 'IN_REPAIR'
  | 'REPAIR_COMPLETE'
  | 'RETURN_EN_ROUTE'
  | 'DELIVERED'
  | 'CANCELLED';

export interface TransitionConfig {
  from: BookingStatus[];
  to: BookingStatus;
  roles: UserRole[];
  assignedOnly?: 'employee' | 'technician';
  requiresOtp?: 'PICKUP' | 'CUSTODY';
  allowOwner?: boolean;
  defaultNote?: string;
}

/**
 * Table-driven valid state transitions conforming to Flashfix v2 specifications.
 */
export const TRANSITIONS: Record<string, TransitionConfig> = {
  assign: {
    from: ['PENDING'],
    to: 'CONFIRMED',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    defaultNote: 'Staff assigned to booking',
  },
  startPickup: {
    from: ['CONFIRMED'],
    to: 'PICKUP_EN_ROUTE',
    roles: ['EMPLOYEE'],
    assignedOnly: 'employee',
    defaultNote: 'Delivery partner en route to customer location',
  },
  sendPickupOtp: {
    from: ['PICKUP_EN_ROUTE'],
    to: 'PICKUP_OTP_SENT',
    roles: ['EMPLOYEE'],
    assignedOnly: 'employee',
    defaultNote: 'Doorstep pickup OTP dispatched to customer',
  },
  verifyPickup: {
    from: ['PICKUP_OTP_SENT'],
    to: 'IN_TRANSIT',
    roles: ['EMPLOYEE'],
    assignedOnly: 'employee',
    requiresOtp: 'PICKUP',
    defaultNote: 'Phone accepted by delivery partner',
  },
  sendCustodyOtp: {
    from: ['IN_TRANSIT'],
    to: 'CUSTODY_OTP_SENT',
    roles: ['EMPLOYEE', 'TECHNICIAN'],
    defaultNote: 'Custody OTP dispatched to lab technician',
  },
  verifyCustody: {
    from: ['CUSTODY_OTP_SENT'],
    to: 'IN_REPAIR',
    roles: ['TECHNICIAN'],
    assignedOnly: 'technician',
    requiresOtp: 'CUSTODY',
    defaultNote: 'Device in repair custody with technician',
  },
  completeRepair: {
    from: ['IN_REPAIR'],
    to: 'REPAIR_COMPLETE',
    roles: ['TECHNICIAN'],
    assignedOnly: 'technician',
    defaultNote: 'Multi-point lab diagnostic checks passed. OEM components installed.',
  },
  startReturn: {
    from: ['REPAIR_COMPLETE'],
    to: 'RETURN_EN_ROUTE',
    roles: ['EMPLOYEE'],
    assignedOnly: 'employee',
    defaultNote: 'Device dispatched for return delivery to customer',
  },
  deliver: {
    from: ['RETURN_EN_ROUTE'],
    to: 'DELIVERED',
    roles: ['EMPLOYEE'],
    assignedOnly: 'employee',
    defaultNote: 'Device delivered to customer and payment collected',
  },
  cancel: {
    from: ['PENDING', 'CONFIRMED', 'PICKUP_EN_ROUTE'],
    to: 'CANCELLED',
    roles: ['CONSUMER', 'ADMIN', 'SUPER_ADMIN'],
    allowOwner: true,
    defaultNote: 'Booking cancelled by user',
  },
};

/**
 * Normalizes action identifiers from URLs or payloads (e.g. 'start-pickup' -> 'startPickup').
 */
export function normalizeAction(action: string): string {
  const clean = (action || '').trim();
  const aliasMap: Record<string, string> = {
    'assign': 'assign',
    'start-pickup': 'startPickup',
    'startpickup': 'startPickup',
    'startPickup': 'startPickup',
    'send-pickup-otp': 'sendPickupOtp',
    'sendpickupotp': 'sendPickupOtp',
    'sendPickupOtp': 'sendPickupOtp',
    'verify-pickup': 'verifyPickup',
    'verifypickup': 'verifyPickup',
    'verifyPickup': 'verifyPickup',
    'send-custody-otp': 'sendCustodyOtp',
    'sendcustodyotp': 'sendCustodyOtp',
    'sendCustodyOtp': 'sendCustodyOtp',
    'verify-custody': 'verifyCustody',
    'verifycustody': 'verifyCustody',
    'verifyCustody': 'verifyCustody',
    'complete-repair': 'completeRepair',
    'completerepair': 'completeRepair',
    'repair-complete': 'completeRepair',
    'repaircomplete': 'completeRepair',
    'completeRepair': 'completeRepair',
    'start-return': 'startReturn',
    'startreturn': 'startReturn',
    'startReturn': 'startReturn',
    'deliver': 'deliver',
    'cancel': 'cancel',
  };

  return aliasMap[clean] || clean;
}

export interface TransitionExtraData {
  note?: string;
  otp?: string;
  employeeId?: string;
  technicianId?: string;
  finalCostPaise?: number;
  paymentStatus?: string;
}

export interface TransitionResult {
  booking: any;
  generatedOtp?: string;
  recipientEmail?: string;
  recipientName?: string;
}

/**
 * Executes an atomic booking state transition using Optimistic Concurrency Control (OCC).
 * Enforces table-driven permissions, store scopes, row locks, OTP verification, and audit logging.
 */
export async function executeTransition(
  db: Pool,
  bookingId: string,
  rawAction: string,
  session: SessionPayload,
  extraData?: TransitionExtraData
): Promise<TransitionResult> {
  const action = normalizeAction(rawAction);
  const config = TRANSITIONS[action];

  if (!config) {
    throw new HttpError(400, 'INVALID_ACTION', `Unknown transition action "${rawAction}".`);
  }

  // 1. Role permission verification
  const isOwner = session.role === 'CONSUMER';
  if (isOwner && !config.allowOwner) {
    throw new HttpError(403, 'FORBIDDEN', 'Consumers cannot execute this action.');
  }
  if (!isOwner && session.role !== 'SUPER_ADMIN' && !config.roles.includes(session.role)) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `Role "${session.role}" not permitted to execute "${rawAction}".`
    );
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 2. Fetch current booking under row lock (SELECT FOR UPDATE)
    const currentRes = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (currentRes.rows.length === 0) {
      throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking does not exist.');
    }
    const booking = currentRes.rows[0];

    // 3. Ownership & Store Scope Checks
    if (isOwner && booking.user_id !== session.sub) {
      throw new HttpError(403, 'FORBIDDEN', 'You do not own this booking.');
    }
    if (!isOwner && session.role !== 'SUPER_ADMIN') {
      requireStoreAccess(session, booking.store_id);
    }
    if (
      config.assignedOnly === 'employee' &&
      booking.assigned_employee_id &&
      booking.assigned_employee_id !== session.sub &&
      session.role !== 'SUPER_ADMIN'
    ) {
      throw new HttpError(403, 'FORBIDDEN', 'You are not the courier assigned to this booking.');
    }
    if (
      config.assignedOnly === 'technician' &&
      booking.technician_id &&
      booking.technician_id !== session.sub &&
      session.role !== 'SUPER_ADMIN'
    ) {
      throw new HttpError(403, 'FORBIDDEN', 'You are not the technician assigned to this booking.');
    }

    // 4. Status OCC check (WHERE status = ANY(config.from))
    if (!config.from.includes(booking.status)) {
      throw new HttpError(
        409,
        'CONFLICT',
        `Cannot transition from "${booking.status}" to "${config.to}". Expected: [${config.from.join(', ')}]`
      );
    }

    // 5. OTP verification if required
    if (config.requiresOtp) {
      await verifyOtpAttempt(client, bookingId, config.requiresOtp, extraData?.otp || '');
    }

    // 6. Generate Dynamic OTP if transitioning to OTP_SENT status
    let generatedOtp: string | undefined = undefined;
    let recipientEmail: string | undefined = undefined;
    let recipientName: string | undefined = undefined;

    if (action === 'sendPickupOtp') {
      recipientEmail = booking.contact_email;
      recipientName = booking.contact_name;
      const otpRec = await createOtpRecord(client, bookingId, 'PICKUP', recipientEmail || '');
      generatedOtp = otpRec.code;
    } else if (action === 'sendCustodyOtp') {
      let techEmail = 'tech@flashfix.in';
      if (booking.technician_id) {
        const techRes = await client.query('SELECT email, name FROM users WHERE id = $1', [booking.technician_id]);
        if (techRes.rows.length > 0) {
          techEmail = techRes.rows[0].email;
          recipientName = techRes.rows[0].name;
        }
      }
      recipientEmail = techEmail;
      const otpRec = await createOtpRecord(client, bookingId, 'CUSTODY', recipientEmail);
      generatedOtp = otpRec.code;
    }

    // 7. Atomic update with optimistic concurrency control
    const updateRes = await client.query(
      `UPDATE bookings 
       SET status = $1::booking_status,
           assigned_employee_id = COALESCE($2::uuid, assigned_employee_id),
           technician_id = COALESCE($3::uuid, technician_id),
           final_cost_paise = COALESCE($4::integer, final_cost_paise),
           payment_status = CASE 
             WHEN $1::text = 'DELIVERED' THEN 'PAID'
             WHEN $5::text IS NOT NULL THEN $5::text
             ELSE payment_status
           END,
           updated_at = NOW()
       WHERE id = $6 AND status = ANY($7::booking_status[])
       RETURNING *`,
      [
        config.to,
        extraData?.employeeId || null,
        extraData?.technicianId || null,
        extraData?.finalCostPaise ?? null,
        extraData?.paymentStatus || null,
        bookingId,
        config.from,
      ]
    );

    if (updateRes.rowCount === 0) {
      throw new HttpError(
        409,
        'CONFLICT',
        'Concurrent state transition detected. Please refresh and retry.'
      );
    }

    const updatedBooking = updateRes.rows[0];

    // 8. Immutable audit trail logging
    const trailNote = extraData?.note || config.defaultNote || `Action "${action}" executed.`;
    await client.query(
      `INSERT INTO booking_trail (id, booking_id, from_status, to_status, triggered_by_user_id, notes, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
      [bookingId, booking.status, config.to, session.sub, trailNote]
    );

    await client.query('COMMIT');

    return {
      booking: updatedBooking,
      generatedOtp,
      recipientEmail,
      recipientName,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback error:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Maps a target status to the corresponding transition action and executes it.
 * Used by PATCH /api/bookings/:id/status to eliminate arbitrary unvalidated updates.
 */
export async function executeStatusTransition(
  db: Pool,
  bookingId: string,
  targetStatus: BookingStatus,
  session: SessionPayload,
  extraData?: TransitionExtraData
): Promise<TransitionResult> {
  const statusToActionMap: Record<BookingStatus, string> = {
    'PENDING': '',
    'CONFIRMED': 'assign',
    'PICKUP_EN_ROUTE': 'startPickup',
    'PICKUP_OTP_SENT': 'sendPickupOtp',
    'IN_TRANSIT': 'verifyPickup',
    'CUSTODY_OTP_SENT': 'sendCustodyOtp',
    'IN_REPAIR': 'verifyCustody',
    'REPAIR_COMPLETE': 'completeRepair',
    'RETURN_EN_ROUTE': 'startReturn',
    'DELIVERED': 'deliver',
    'CANCELLED': 'cancel',
  };

  const action = statusToActionMap[targetStatus];
  if (!action) {
    throw new HttpError(
      400,
      'INVALID_STATUS',
      `Direct transition to status "${targetStatus}" is not supported.`
    );
  }

  return executeTransition(db, bookingId, action, session, extraData);
}
