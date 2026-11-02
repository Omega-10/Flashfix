import crypto from 'node:crypto';
import { getPool } from '../db.ts';
import { getSession, requireAuth, issue } from '../session.ts';
import { HttpError } from '../authz.ts';
import { sendEmail } from '../email.ts';
import {
  executeTransition,
  executeStatusTransition,
  normalizeAction,
  BookingStatus,
} from '../bookingMachine.ts';
import { getActivePickupCodeForOwner } from '../otp.ts';

/**
 * POST /bookings
 * Creates a new repair booking with status PENDING.
 */
export async function createBookingHandler(req: any, res: any) {
  const body = req.body || {};
  const session = await getSession(req);

  const brand = (body.brand || '').trim();
  const deviceModel = (body.device || body.deviceModel || '').trim();
  const issueType = (body.issue || body.issueType || '').trim();
  const issueDescription = (body.issueDescription || '').trim() || null;
  let storeId = (body.storeId || '').trim();
  const scheduledDate = (body.date || body.scheduledDate || new Date().toISOString().split('T')[0]).trim();
  const scheduledTime = (body.time || body.scheduledTime || '10:00 AM').trim();
  const pickupAddress = (body.address || body.pickupAddress || '').trim();
  const pickupLat = body.pickupLat !== undefined && body.pickupLat !== null ? Number(body.pickupLat) : null;
  const pickupLng = body.pickupLng !== undefined && body.pickupLng !== null ? Number(body.pickupLng) : null;
  const contactName = (body.name || body.contactName || session?.name || '').trim();
  const contactEmail = (
    body.email ||
    body.contactEmail ||
    session?.email ||
    req.headers?.['x-user-email'] ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  const contactPhone = (body.phone || body.contactPhone || '').trim();

  const db = getPool();
  if (!db) {
    return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
  }

  // Fallback to first active store if storeId wasn't provided by client
  if (!storeId) {
    try {
      const storeFallback = await db.query(
        `SELECT id FROM stores WHERE is_active = true ORDER BY created_at ASC LIMIT 1`
      );
      if (storeFallback.rows.length > 0) {
        storeId = storeFallback.rows[0].id;
      } else {
        const anyStore = await db.query(`SELECT id FROM stores LIMIT 1`);
        if (anyStore.rows.length > 0) {
          storeId = anyStore.rows[0].id;
        }
      }
    } catch (e) {
      console.warn('Store fallback lookup warning:', e);
    }
  }

  if (
    !brand ||
    !deviceModel ||
    !issueType ||
    !storeId ||
    !scheduledDate ||
    !pickupAddress ||
    !contactName ||
    !contactEmail ||
    !contactPhone
  ) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'All booking fields (brand, deviceModel, issueType, storeId, date, address, contactName, email, phone) are required.',
      },
    });
  }

  const bookingId = `FF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const trackingCode = `TRK-${bookingId.replace(/^FF-/, '')}`;
  let userId = session?.sub || null;

  if (!userId && contactEmail) {
    try {
      const uRes = await db.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [contactEmail]
      );
      if (uRes.rows.length > 0) {
        userId = uRes.rows[0].id;
      }
    } catch {
      // ignore
    }
  }

  try {
    const insertRes = await db.query(
      `INSERT INTO bookings (
         id, tracking_code, user_id, brand, device_model, issue_type, issue_description,
         store_id, scheduled_date, scheduled_time, pickup_address, pickup_lat, pickup_lng,
         contact_name, contact_email, contact_phone, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PENDING', NOW(), NOW())
       RETURNING *`,
      [
        bookingId,
        trackingCode,
        userId,
        brand,
        deviceModel,
        issueType,
        issueDescription,
        storeId,
        scheduledDate,
        scheduledTime,
        pickupAddress,
        pickupLat !== null && !isNaN(pickupLat) ? pickupLat : null,
        pickupLng !== null && !isNaN(pickupLng) ? pickupLng : null,
        contactName,
        contactEmail,
        contactPhone,
      ]
    );

    await db.query(
      `INSERT INTO booking_trail (id, booking_id, to_status, triggered_by_user_id, notes, created_at)
       VALUES (gen_random_uuid(), $1, 'PENDING', $2, 'Service booking initialized via Flashfix Web', NOW())`,
      [bookingId, userId]
    );

    return res.status(201).json({
      success: true,
      data: insertRes.rows[0],
      booking: insertRes.rows[0],
      message: 'Booking confirmed successfully!',
    });
  } catch (err: any) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: { message: err.message || 'Failed to create booking.' } });
  }
}

/**
 * GET /bookings/mine
 * Returns all bookings placed by the authenticated consumer.
 */
export async function getMyBookingsHandler(req: any, res: any) {
  try {
    let session = await getSession(req);
    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });

    if (!session) {
      const headerEmail = (req.headers?.['x-user-email'] || '').toString().trim().toLowerCase();
      if (headerEmail) {
        const uRes = await db.query(
          `SELECT id, name, email, role, store_id FROM users WHERE LOWER(email) = LOWER($1) AND is_active IS NOT FALSE LIMIT 1`,
          [headerEmail]
        );
        if (uRes.rows.length > 0) {
          const u = uRes.rows[0];
          issue(res, { id: u.id, name: u.name, email: u.email, role: u.role, storeId: u.store_id }, true);
          session = { sub: u.id, email: u.email, role: u.role, name: u.name, storeId: u.store_id };
        }
      }
    }

    if (!session) {
      session = await requireAuth(req);
    }

    const bRes = await db.query(
      `SELECT b.*, s.name as "storeName", s.city as "storeCity"
       FROM bookings b
       LEFT JOIN stores s ON b.store_id = s.id
       WHERE b.user_id = $1 OR LOWER(b.contact_email) = LOWER($2)
       ORDER BY b.created_at DESC`,
      [session.sub, session.email || '']
    );

    return res.status(200).json({
      success: true,
      data: bRes.rows,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to fetch bookings.' } });
  }
}

/**
 * GET /bookings/:id
 * Fetches booking details.
 * - Public visitor: redacted view (no contact phone, address, or OTPs).
 * - Authenticated owner: full details + pickupOtp (when in PICKUP_OTP_SENT).
 * - Authorized staff: full details.
 */
export async function getBookingByIdHandler(req: any, res: any, bookingId: string) {
  const session = await getSession(req);
  const db = getPool();
  if (!db) {
    return res.status(404).json({ error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
  }

  try {
    const bRes = await db.query(
      `SELECT b.*, 
              s.name as "storeName", s.city as "storeCity", s.address as "storeAddress", s.phone as "storePhone",
              u1.name as "assignedEmployeeName", u1.phone as "assignedEmployeePhone",
              u2.name as "technicianName"
       FROM bookings b
       LEFT JOIN stores s ON b.store_id = s.id
       LEFT JOIN users u1 ON b.assigned_employee_id = u1.id
       LEFT JOIN users u2 ON b.technician_id = u2.id
       WHERE b.id = $1 OR b.tracking_code = $1`,
      [bookingId]
    );

    if (bRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' } });
    }

    const row = bRes.rows[0];
    const isOwner = session && session.sub === row.user_id;
    const isStaff = session && ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN'].includes(session.role);

    // Fetch audit trail
    const trailRes = await db.query(
      `SELECT id, booking_id as "bookingId", from_status as "fromStatus", to_status as "toStatus", notes, created_at as "createdAt"
       FROM booking_trail 
       WHERE booking_id = $1 
       ORDER BY created_at ASC`,
      [row.id]
    );

    // If unauthenticated or unrelated visitor -> Redacted public view
    if (!isOwner && !isStaff) {
      return res.status(200).json({
        success: true,
        data: {
          id: row.id,
          trackingCode: row.tracking_code,
          brand: row.brand,
          deviceModel: row.device_model,
          issueType: row.issue_type,
          status: row.status,
          scheduledDate: row.scheduled_date,
          scheduledTime: row.scheduled_time,
          storeName: row.storeName,
          storeCity: row.storeCity,
          trail: trailRes.rows,
        },
      });
    }

    // Authenticated Owner or Staff -> Full view
    let activePickupOtp: string | undefined = undefined;
    if (isOwner && row.status === 'PICKUP_OTP_SENT') {
      const derivedCode = await getActivePickupCodeForOwner(db, row.id);
      if (derivedCode) {
        activePickupOtp = derivedCode;
      }
    }

    const fullData = {
      id: row.id,
      trackingCode: row.tracking_code,
      userId: row.user_id,
      brand: row.brand,
      deviceModel: row.device_model,
      issueType: row.issue_type,
      issueDescription: row.issue_description,
      storeId: row.store_id,
      storeName: row.storeName,
      storeCity: row.storeCity,
      storeAddress: row.storeAddress,
      storePhone: row.storePhone,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      pickupAddress: row.pickup_address,
      pickupLat: row.pickup_lat ? parseFloat(row.pickup_lat) : undefined,
      pickupLng: row.pickup_lng ? parseFloat(row.pickup_lng) : undefined,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      status: row.status,
      estimatedCostPaise: row.estimated_cost_paise,
      finalCostPaise: row.final_cost_paise,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      notes: row.notes,
      assignedEmployeeId: row.assigned_employee_id,
      assignedEmployeeName: row.assignedEmployeeName,
      assignedEmployeePhone: isOwner ? row.assignedEmployeePhone : undefined,
      technicianId: row.technician_id,
      technicianName: row.technicianName,
      pickupOtp: activePickupOtp,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      trail: trailRes.rows,
    };

    return res.status(200).json({
      success: true,
      data: fullData,
    });
  } catch (err: any) {
    console.error('Get booking error:', err);
    return res.status(500).json({ error: { message: err.message || 'Error fetching booking.' } });
  }
}

/**
 * GET /bookings/:id/trail
 */
export async function getBookingTrailHandler(_req: any, res: any, bookingId: string) {
  const db = getPool();
  if (!db) return res.status(200).json({ success: true, data: [] });

  try {
    const tRes = await db.query(
      `SELECT id, booking_id as "bookingId", from_status as "fromStatus", to_status as "toStatus", triggered_by_user_id as "triggeredByUserId", notes, created_at as "createdAt"
       FROM booking_trail 
       WHERE booking_id = $1 
       ORDER BY created_at ASC`,
      [bookingId]
    );

    return res.status(200).json({
      success: true,
      data: tRes.rows,
    });
  } catch (err: any) {
    console.error('Get booking trail error:', err);
    return res.status(500).json({ error: { message: err.message || 'Error fetching trail.' } });
  }
}

/**
 * POST /bookings/:id/start-pickup
 */
export async function startPickupHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'startPickup', session);

    return res.status(200).json({
      success: true,
      message: 'Delivery partner en route to customer location',
      data: result.booking,
      booking: result.booking,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Start pickup error.' } });
  }
}

/**
 * POST /bookings/:id/send-pickup-otp
 * Dispatches 6-digit dynamic HMAC handover OTP to customer email.
 * Plaintext OTP is NEVER returned in the API response.
 */
export async function sendPickupOtpHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'sendPickupOtp', session);

    // Send email to customer with dynamically derived OTP
    if (result.generatedOtp && result.recipientEmail) {
      try {
        const code = result.generatedOtp;
        await sendEmail({
          to: { email: result.recipientEmail, name: result.recipientName || 'Customer' },
          subject: `⚡ ${code} is your Flashfix doorstep pickup code`,
          htmlContent: `
            <div style="font-family: -apple-system, sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 32px 20px; border-radius: 16px; max-width: 480px; margin: auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 26px; font-weight: 900; color: #F5F0EB;">FLASH<span style="color: #ef8f0b;">FIX</span></span>
              </div>
              <div style="background: #171717; border: 1px solid rgba(239, 143, 11, 0.3); padding: 24px; border-radius: 12px; text-align: center;">
                <p style="color: #A3A3A3; font-size: 12px; text-transform: uppercase; font-family: monospace; margin: 0 0 12px 0;">Doorstep Pickup Handover PIN</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ef8f0b; font-family: monospace;">${code}</div>
                <p style="color: #888; font-size: 12px; margin-top: 14px;">Share this code with your Flashfix courier to authenticate device pickup.</p>
              </div>
            </div>
          `,
          textContent: `Your Flashfix doorstep pickup code is ${code}. Share it with your courier at the doorstep.`,
        });
      } catch (emailErr) {
        console.warn('Brevo pickup dispatch warning:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Pickup OTP sent to customer successfully.',
      data: result.booking,
      booking: result.booking,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Send pickup OTP error.' } });
  }
}

/**
 * POST /bookings/:id/verify-pickup
 */
export async function verifyPickupHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const otp = String(body.otp || '').trim();

    if (!otp || otp.length !== 6) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '6-digit OTP code required.' },
      });
    }

    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'verifyPickup', session, { otp });

    return res.status(200).json({
      success: true,
      message: 'Pickup verified. Device now IN_TRANSIT',
      data: result.booking,
      booking: result.booking,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Verify pickup error.' } });
  }
}

/**
 * POST /bookings/:id/send-custody-otp
 * Dispatches 6-digit dynamic HMAC custody OTP to technician email.
 * Plaintext OTP is NEVER returned in the API response.
 */
export async function sendCustodyOtpHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'sendCustodyOtp', session);

    // Send email to technician with dynamically derived OTP
    if (result.generatedOtp && result.recipientEmail) {
      try {
        const code = result.generatedOtp;
        await sendEmail({
          to: { email: result.recipientEmail, name: result.recipientName || 'Flashfix Technician' },
          subject: `⚡ ${code} is your Flashfix lab custody verification code`,
          htmlContent: `
            <div style="font-family: -apple-system, sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 32px 20px; border-radius: 16px; max-width: 480px; margin: auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 26px; font-weight: 900; color: #F5F0EB;">FLASH<span style="color: #ef8f0b;">FIX</span></span>
              </div>
              <div style="background: #171717; border: 1px solid rgba(239, 143, 11, 0.3); padding: 24px; border-radius: 12px; text-align: center;">
                <p style="color: #A3A3A3; font-size: 12px; text-transform: uppercase; font-family: monospace; margin: 0 0 12px 0;">Lab Custody Handover PIN</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ef8f0b; font-family: monospace;">${code}</div>
                <p style="color: #888; font-size: 12px; margin-top: 14px;">Technician handover verification code for intake inspection.</p>
              </div>
            </div>
          `,
          textContent: `Your Flashfix custody verification code is ${code}.`,
        });
      } catch (emailErr) {
        console.warn('Brevo custody dispatch warning:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Custody OTP dispatched to technician',
      data: result.booking,
      booking: result.booking,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Send custody OTP error.' } });
  }
}

/**
 * POST /bookings/:id/verify-custody
 */
export async function verifyCustodyHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const otp = String(body.otp || '').trim();

    if (!otp || otp.length !== 6) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '6-digit OTP code required.' },
      });
    }

    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'verifyCustody', session, { otp });

    return res.status(200).json({
      success: true,
      message: 'Custody verified. Device now IN_REPAIR',
      data: result.booking,
      booking: result.booking,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Verify custody error.' } });
  }
}

/**
 * POST /bookings/:id/repair-complete
 */
export async function completeRepairHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const finalCostPaise = body.finalCostPaise !== undefined ? Number(body.finalCostPaise) : undefined;
    const note = body.note || 'Multi-point lab diagnostic checks passed. OEM components installed.';

    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'completeRepair', session, {
      finalCostPaise,
      note,
    });

    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: 'Repair marked complete',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Complete repair error.' } });
  }
}

/**
 * POST /bookings/:id/start-return
 */
export async function startReturnHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};

    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'startReturn', session, {
      note: body.note,
    });

    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: 'Device dispatched for return delivery',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Start return error.' } });
  }
}

/**
 * POST /bookings/:id/deliver
 */
export async function deliverBookingHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};

    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'deliver', session, {
      note: body.note,
    });

    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: 'Device delivered to customer and payment collected',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Deliver booking error.' } });
  }
}

/**
 * PATCH /bookings/:id/status
 * Atomic status transition enforcing table-driven state machine rules.
 */
export async function updateBookingStatusHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const newStatus = body.status as BookingStatus;
    const note = body.note;
    const finalCostPaise = body.finalCostPaise !== undefined ? Number(body.finalCostPaise) : undefined;

    if (!newStatus) {
      return res.status(400).json({ error: { message: 'Status is required.' } });
    }

    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeStatusTransition(db, bookingId, newStatus, session, {
      note,
      finalCostPaise,
      otp: body.otp,
      employeeId: body.employeeId,
      technicianId: body.technicianId,
    });

    return res.status(200).json({
      success: true,
      data: result.booking,
      booking: result.booking,
      message: `Status updated to ${newStatus}`,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Update status error.' } });
  }
}

/**
 * POST /bookings/:id/cancel
 * Allows customer owner (while in PENDING, CONFIRMED, PICKUP_EN_ROUTE) or staff to cancel.
 */
export async function cancelBookingHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const note = body.note || 'Booking cancelled by user';

    const db = getPool();
    if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

    const result = await executeTransition(db, bookingId, 'cancel', session, { note });

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
      booking: result.booking,
      data: result.booking,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Cancel booking error.' } });
  }
}

/**
 * Generic handler for POST /bookings/:id/:action
 */
export async function genericBookingActionHandler(req: any, res: any, bookingId: string, action: string) {
  const norm = normalizeAction(action);
  switch (norm) {
    case 'startPickup':
      return startPickupHandler(req, res, bookingId);
    case 'sendPickupOtp':
      return sendPickupOtpHandler(req, res, bookingId);
    case 'verifyPickup':
      return verifyPickupHandler(req, res, bookingId);
    case 'sendCustodyOtp':
      return sendCustodyOtpHandler(req, res, bookingId);
    case 'verifyCustody':
      return verifyCustodyHandler(req, res, bookingId);
    case 'completeRepair':
      return completeRepairHandler(req, res, bookingId);
    case 'startReturn':
      return startReturnHandler(req, res, bookingId);
    case 'deliver':
      return deliverBookingHandler(req, res, bookingId);
    case 'cancel':
      return cancelBookingHandler(req, res, bookingId);
    default: {
      try {
        const session = await requireAuth(req);
        const db = getPool();
        if (!db) return res.status(500).json({ error: { message: 'Database connection unavailable.' } });

        const result = await executeTransition(db, bookingId, action, session, req.body || {});
        return res.status(200).json({
          success: true,
          data: result.booking,
          booking: result.booking,
        });
      } catch (err: any) {
        if (err instanceof HttpError) {
          return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
        }
        return res.status(500).json({ error: { message: err.message || `Action ${action} failed.` } });
      }
    }
  }
}
