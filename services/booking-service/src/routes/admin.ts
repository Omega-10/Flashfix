import { Router, Request, Response, NextFunction } from 'express';
import { assignHandler } from './bookings.js';
import { getBookingRepository } from '../db/index.js';
import type { BookingStatus } from '@flashfix/shared';

const router = Router();

// PATCH /admin/bookings/:id/assign
router.patch('/bookings/:id/assign', assignHandler);

// GET /admin/bookings
router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
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

export default router;
