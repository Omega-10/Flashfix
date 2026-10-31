import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import {
  isDisposableEmail,
  CreateBookingRequestSchema,
  VerifyPickupOtpRequestSchema,
  VerifyCustodyOtpRequestSchema,
  UpdateBookingStatusRequestSchema,
  AdminAssignBookingRequestSchema,
  BookingStatus,
} from '@flashfix/shared';
import { getBookingRepository, BookingEntity } from '../db/index.js';

const router = Router();
const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:3005';

// Allowed Status Progression State Machine
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKUP_EN_ROUTE', 'CANCELLED'],
  PICKUP_EN_ROUTE: ['PICKUP_OTP_SENT', 'CANCELLED'],
  PICKUP_OTP_SENT: ['IN_TRANSIT'],
  IN_TRANSIT: ['CUSTODY_OTP_SENT'],
  CUSTODY_OTP_SENT: ['IN_REPAIR'],
  IN_REPAIR: ['REPAIR_COMPLETE'],
  REPAIR_COMPLETE: ['RETURN_EN_ROUTE'],
  RETURN_EN_ROUTE: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

function generateBookingId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FF-${code}`;
}

// 1. Create Booking (POST /bookings)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateBookingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid booking payload', details: parsed.error.format() },
      });
    }

    const data = parsed.data;

    // Check disposable email
    if (isDisposableEmail(data.contactEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: 'DISPOSABLE_EMAIL_NOT_ALLOWED', message: 'Disposable email addresses are not permitted' },
      });
    }

    const repo = getBookingRepository();
    const id = generateBookingId();
    const store = await repo.findStoreById(data.storeId);
    const storeName = store ? store.name : 'Flashfix Service Hub';

    const booking: BookingEntity = {
      id,
      trackingCode: id,
      userId: (req.body.userId as string) || null,
      storeId: data.storeId,
      brand: data.brand,
      deviceModel: data.deviceModel,
      issueType: data.issueType,
      issueDescription: data.issueDescription || null,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      pickupLat: data.pickupLat !== undefined ? data.pickupLat : null,
      pickupLng: data.pickupLng !== undefined ? data.pickupLng : null,
      pickupAddress: data.pickupAddress,
      contactName: data.contactName,
      contactEmail: data.contactEmail.trim().toLowerCase(),
      contactPhone: data.contactPhone,
      status: 'PENDING',
      estimatedCostPaise: req.body.estimatedCostPaise || null,
      finalCostPaise: null,
      paymentMethod: 'QR',
      paymentStatus: 'UNPAID',
      notes: req.body.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.createBooking(booking);

    // Initial audit trail entry
    await repo.addTrailEntry({
      bookingId: id,
      fromStatus: null,
      toStatus: 'PENDING',
      triggeredByUserId: booking.userId || null,
      notes: 'Booking created by consumer',
    });

    // Notify consumer via notify-service
    try {
      await fetch(`${NOTIFY_URL}/notify/booking-confirmed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.contactEmail,
          bookingId: booking.id,
          customerName: booking.contactName,
          deviceModel: booking.deviceModel,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          storeName,
        }),
      });
    } catch (notifyErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[booking-service] confirmation notification skipped:', (notifyErr as Error).message);
      }
    }

    return res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Consumer My Bookings (GET /bookings/mine)
router.get('/mine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
    const email = (req.query.email as string) || (req.headers['x-user-email'] as string);

    const repo = getBookingRepository();
    const bookings = await repo.listBookingsByUser(userId, email);

    return res.json({
      success: true,
      data: bookings,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Get Single Booking (GET /bookings/:id)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
    }

    // Enrich with staff names if assigned
    let assignedEmployeeName = null;
    let technicianName = null;
    if (booking.assignedEmployeeId) {
      const emp = await repo.findUserById(booking.assignedEmployeeId);
      assignedEmployeeName = emp?.name || null;
    }
    if (booking.technicianId) {
      const tech = await repo.findUserById(booking.technicianId);
      technicianName = tech?.name || null;
    }

    return res.json({
      success: true,
      data: {
        ...booking,
        assignedEmployeeName,
        technicianName,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 4. Immutable Audit Trail (GET /bookings/:id/trail)
router.get('/:id/trail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
    }

    const trail = await repo.getTrail(req.params.id);
    return res.json({
      success: true,
      data: trail,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Cancel Booking (PATCH /bookings/:id/cancel)
router.patch('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
    }

    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS_TRANSITION', message: 'Booking cannot be cancelled in its current status' },
      });
    }

    const updated = await repo.updateBooking(booking.id, { status: 'CANCELLED' });
    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'CANCELLED',
      triggeredByUserId: (req.body.userId as string) || booking.userId || null,
      notes: req.body.reason || 'Booking cancelled by consumer',
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Assign Staff (PATCH /bookings/:id/assign or PATCH /admin/bookings/:id/assign)
const assignHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AdminAssignBookingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment payload', details: parsed.error.format() },
      });
    }

    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
    }

    const employee = await repo.findUserById(parsed.data.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Assigned employee not found' },
      });
    }

    const updated = await repo.updateBooking(booking.id, {
      status: 'CONFIRMED',
      assignedEmployeeId: parsed.data.employeeId,
      technicianId: parsed.data.technicianId || null,
    });

    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'CONFIRMED',
      triggeredByUserId: (req.headers['x-user-id'] as string) || null,
      notes: `Staff assigned: Rider ${employee.name}`,
    });

    // Notify employee via notify-service
    try {
      await fetch(`${NOTIFY_URL}/notify/employee-assigned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: employee.email,
          bookingId: booking.id,
          customerName: booking.contactName,
          pickupAddress: booking.pickupAddress,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
        }),
      });
    } catch (notifyErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[booking-service] assignment notification skipped:', (notifyErr as Error).message);
      }
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

router.patch('/:id/assign', assignHandler);

// 7. Doorstep Pickup Handover (start pickup, send pickup OTP, verify pickup)
router.post('/:id/start-pickup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } });
    }

    const updated = await repo.updateBooking(booking.id, { status: 'PICKUP_EN_ROUTE' });
    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'PICKUP_EN_ROUTE',
      triggeredByUserId: booking.assignedEmployeeId || null,
      notes: 'Delivery partner en route to customer location',
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send-pickup-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = bcrypt.hashSync(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await repo.saveOtp({
      email: booking.contactEmail,
      code,
      codeHash,
      purpose: 'PICKUP',
      bookingId: booking.id,
      expiresAt,
    });

    const updated = await repo.updateBooking(booking.id, { status: 'PICKUP_OTP_SENT' });
    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'PICKUP_OTP_SENT',
      triggeredByUserId: booking.assignedEmployeeId || null,
      notes: 'Doorstep pickup OTP sent to customer',
    });

    const employee = booking.assignedEmployeeId ? await repo.findUserById(booking.assignedEmployeeId) : null;
    const employeeName = employee?.name || 'Flashfix Specialist';

    try {
      await fetch(`${NOTIFY_URL}/notify/pickup-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.contactEmail,
          code,
          bookingId: booking.id,
          employeeName,
        }),
      });
    } catch (notifyErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[booking-service] pickup otp notification skipped:', (notifyErr as Error).message);
      }
    }

    return res.json({
      success: true,
      message: 'Pickup OTP sent to customer',
      code: process.env.NODE_ENV !== 'production' ? code : undefined,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/verify-pickup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = VerifyPickupOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '6-digit OTP code required' },
      });
    }

    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } });
    }

    const otp = await repo.findActiveOtp(booking.id, 'PICKUP');
    if (!otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'Pickup OTP has expired or was not requested' },
      });
    }

    if (otp.attempts >= 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded' },
      });
    }

    const isValid = otp.codeHash ? bcrypt.compareSync(parsed.data.otp, otp.codeHash) : otp.code === parsed.data.otp;
    if (!isValid) {
      await repo.incrementOtpAttempts(otp.id);
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_INVALID', message: 'Invalid pickup OTP code' },
      });
    }

    await repo.markOtpVerified(otp.id);
    const updated = await repo.updateBooking(booking.id, { status: 'IN_TRANSIT' });

    const employee = booking.assignedEmployeeId ? await repo.findUserById(booking.assignedEmployeeId) : null;
    const employeeName = employee?.name || 'Flashfix Delivery Partner';

    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: 'PICKUP_OTP_SENT',
      toStatus: 'IN_TRANSIT',
      triggeredByUserId: booking.assignedEmployeeId || null,
      notes: `Phone accepted by ${employeeName}`,
    });

    return res.json({
      success: true,
      message: 'Pickup verified. Device now IN_TRANSIT',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// 8. Service Centre Custody Handover (send custody OTP, verify custody)
router.post('/:id/send-custody-otp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = bcrypt.hashSync(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const technician = booking.technicianId ? await repo.findUserById(booking.technicianId) : null;
    const technicianEmail = technician?.email || 'tech@flashfix.in';
    const technicianName = technician?.name || 'Flashfix Certified Technician';

    await repo.saveOtp({
      email: technicianEmail,
      code,
      codeHash,
      purpose: 'CUSTODY',
      bookingId: booking.id,
      expiresAt,
    });

    const updated = await repo.updateBooking(booking.id, { status: 'CUSTODY_OTP_SENT' });
    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: 'CUSTODY_OTP_SENT',
      triggeredByUserId: booking.assignedEmployeeId || null,
      notes: `Custody OTP dispatched to technician ${technicianName}`,
    });

    try {
      await fetch(`${NOTIFY_URL}/notify/custody-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: technicianEmail,
          code,
          bookingId: booking.id,
          technicianName,
        }),
      });
    } catch (notifyErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[booking-service] custody otp notification skipped:', (notifyErr as Error).message);
      }
    }

    return res.json({
      success: true,
      message: 'Custody OTP dispatched to technician',
      code: process.env.NODE_ENV !== 'production' ? code : undefined,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/verify-custody', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = VerifyCustodyOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '6-digit OTP code required' },
      });
    }

    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } });
    }

    const otp = await repo.findActiveOtp(booking.id, 'CUSTODY');
    if (!otp) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'Custody OTP has expired or was not requested' },
      });
    }

    if (otp.attempts >= 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded' },
      });
    }

    const isValid = otp.codeHash ? bcrypt.compareSync(parsed.data.otp, otp.codeHash) : otp.code === parsed.data.otp;
    if (!isValid) {
      await repo.incrementOtpAttempts(otp.id);
      return res.status(400).json({
        success: false,
        error: { code: 'OTP_INVALID', message: 'Invalid custody OTP code' },
      });
    }

    await repo.markOtpVerified(otp.id);
    const updated = await repo.updateBooking(booking.id, { status: 'IN_REPAIR' });

    const technician = booking.technicianId ? await repo.findUserById(booking.technicianId) : null;
    const technicianName = technician?.name || 'Flashfix Technician';

    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: 'CUSTODY_OTP_SENT',
      toStatus: 'IN_REPAIR',
      triggeredByUserId: booking.technicianId || null,
      notes: `Device in repair custody with ${technicianName}`,
    });

    return res.json({
      success: true,
      message: 'Custody verified. Device now IN_REPAIR',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// 9. Status Transitions (PATCH /bookings/:id/status)
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = UpdateBookingStatusRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status', details: parsed.error.format() },
      });
    }

    const newStatus = parsed.data.status;
    const repo = getBookingRepository();
    const booking = await repo.findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } });
    }

    const updates: Partial<BookingEntity> = { status: newStatus };
    if (req.body.finalCostPaise !== undefined) {
      updates.finalCostPaise = req.body.finalCostPaise;
    }
    if (newStatus === 'DELIVERED') {
      updates.paymentStatus = 'PAID';
    }

    const updated = await repo.updateBooking(booking.id, updates);
    await repo.addTrailEntry({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: newStatus,
      triggeredByUserId: (req.headers['x-user-id'] as string) || null,
      notes: parsed.data.note || `Status transitioned to ${newStatus}`,
    });

    // If repair complete, notify consumer
    if (newStatus === 'REPAIR_COMPLETE') {
      try {
        await fetch(`${NOTIFY_URL}/notify/repair-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: booking.contactEmail,
            bookingId: booking.id,
            customerName: booking.contactName,
            deviceModel: booking.deviceModel,
          }),
        });
      } catch (notifyErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[booking-service] repair complete notification skipped:', (notifyErr as Error).message);
        }
      }
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

// 10. List Bookings with filters (GET /bookings)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getBookingRepository();
    const storeId = req.query.storeId as string | undefined;
    const status = req.query.status as BookingStatus | undefined;
    const search = req.query.search as string | undefined;

    const result = await repo.listBookings({ storeId, status, search });
    return res.json({
      success: true,
      data: result.items,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

export { assignHandler };
export default router;
