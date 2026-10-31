import { Router, Response, NextFunction } from 'express';
import {
  AdminAssignRoleRequestSchema,
  AdminAssignStoreRequestSchema,
  AdminInviteEmployeeRequestSchema,
  UserRole,
} from '@flashfix/shared';
import { getAuthRepository } from '../db/index.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:3005';

// 1. List users (ADMIN / SUPER_ADMIN)
router.get(
  '/users',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const repo = getAuthRepository();
      const roleFilter = req.query.role as UserRole | undefined;
      const storeIdFilter = (req.query.storeId as string) || (req.user?.role === 'ADMIN' ? req.user.storeId || undefined : undefined);

      const users = await repo.listUsers({
        role: roleFilter,
        storeId: storeIdFilter,
      });

      return res.json({
        success: true,
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Assign Role (SUPER_ADMIN only)
router.patch(
  '/users/:id/role',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AdminAssignRoleRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid role' },
        });
      }

      const repo = getAuthRepository();
      const updated = await repo.updateUser(req.params.id, { role: parsed.data.role });
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      return res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 3. Assign Store (ADMIN or SUPER_ADMIN)
router.patch(
  '/users/:id/store',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AdminAssignStoreRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid storeId' },
        });
      }

      const repo = getAuthRepository();
      const updated = await repo.updateUser(req.params.id, { storeId: parsed.data.storeId });
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      return res.json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 4. Invite Employee / Store Admin (ADMIN or SUPER_ADMIN)
router.post(
  '/users/invite',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = AdminInviteEmployeeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid invitation payload', details: parsed.error.format() },
        });
      }

      const { email, name, role, storeId } = parsed.data;
      const repo = getAuthRepository();

      const user = await repo.upsertUser({
        email,
        name,
        role,
        storeId,
        emailVerified: false,
      });

      // Dispatch invite notification
      try {
        await fetch(`${NOTIFY_URL}/notify/employee-assigned`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            bookingId: 'TEAM-INVITE',
            customerName: name,
            pickupAddress: `Store Hub: ${storeId}`,
            scheduledDate: new Date().toISOString().split('T')[0],
            scheduledTime: 'Immediate',
          }),
        });
      } catch (notifyErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[auth-service] invite notification skipped:', (notifyErr as Error).message);
        }
      }

      return res.status(201).json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
