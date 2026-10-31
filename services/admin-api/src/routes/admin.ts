import { Router, Request, Response, NextFunction } from 'express';
import {
  AdminBookingsQuerySchema,
  AdminAssignBookingRequestSchema,
  AdminInviteEmployeeRequestSchema,
} from '@flashfix/shared';
import { getAdminRepository } from '../db/index.js';

const router = Router();
const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:3005';

// 1. Dashboard Statistics & Operational KPIs
const statsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getAdminRepository();
    const storeId = req.query.storeId as string | undefined;

    const stats = await repo.getStats(storeId);
    const { items: recentBookings } = await repo.listBookings({ storeId, limit: 5 });

    return res.json({
      success: true,
      data: {
        ...stats,
        recentBookings,
      },
    });
  } catch (err) {
    next(err);
  }
};

router.get('/stats', statsHandler);
router.get('/dashboard', statsHandler);

// 2. Filterable Bookings List (GET /admin/bookings)
router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AdminBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: parsed.error.format() },
      });
    }

    const repo = getAdminRepository();
    const { items, total } = await repo.listBookings({
      storeId: parsed.data.storeId,
      status: parsed.data.status,
      search: parsed.data.search,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    return res.json({
      success: true,
      data: items,
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Assign Staff to Booking (POST /admin/assign or POST /admin/bookings/:id/assign)
const assignHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingId = req.params.id || req.body.bookingId;
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' },
      });
    }

    const parsed = AdminAssignBookingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'employeeId is required', details: parsed.error.format() },
      });
    }

    const repo = getAdminRepository();
    const updated = await repo.assignBooking(bookingId, parsed.data.employeeId, parsed.data.technicianId);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
      });
    }

    // Notify employee via notify-service
    try {
      await fetch(`${NOTIFY_URL}/notify/employee-assigned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'delivery.rajesh@flashfix.in',
          bookingId: updated.id,
          customerName: updated.contactName,
          pickupAddress: updated.pickupAddress,
          scheduledDate: updated.scheduledDate,
          scheduledTime: updated.scheduledTime,
        }),
      });
    } catch (notifyErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[admin-api] employee notification skipped:', (notifyErr as Error).message);
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

router.post('/assign', assignHandler);
router.post('/bookings/:id/assign', assignHandler);

// 4. Team Members List (GET /admin/team)
router.get('/team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getAdminRepository();
    const storeId = req.query.storeId as string | undefined;
    const team = await repo.listTeam(storeId);

    return res.json({
      success: true,
      data: team,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Team Invitation (POST /admin/invite or POST /admin/team/invite)
const inviteHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AdminInviteEmployeeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation payload', details: parsed.error.format() },
      });
    }

    const { name, email, role, storeId } = parsed.data;
    const repo = getAdminRepository();
    const member = await repo.inviteMember({ name, email, role, storeId });

    // Notify invitee
    try {
      await fetch(`${NOTIFY_URL}/notify/employee-assigned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          bookingId: 'TEAM-WELCOME',
          customerName: name,
          pickupAddress: `Store Location: ${storeId}`,
          scheduledDate: new Date().toISOString().split('T')[0],
          scheduledTime: 'Immediate',
        }),
      });
    } catch (notifyErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[admin-api] invite notification skipped:', (notifyErr as Error).message);
      }
    }

    return res.status(201).json({
      success: true,
      data: member,
    });
  } catch (err) {
    next(err);
  }
};

router.post('/invite', inviteHandler);
router.post('/team/invite', inviteHandler);

// 6. Parts Inventory (GET /admin/inventory & PATCH /admin/inventory/:id)
router.get('/inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getAdminRepository();
    const storeId = req.query.storeId as string | undefined;
    const items = await repo.listInventory(storeId);

    return res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/inventory/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity } = req.body;
    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Quantity must be a positive number' },
      });
    }

    const repo = getAdminRepository();
    const updated = await repo.updateInventoryStock(req.params.id, quantity);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inventory item not found' },
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
