import bcrypt from 'bcryptjs';
import { getPool } from '../db.ts';
import { requireAuth } from '../session.ts';
import { requireRole, requireStoreAccess, HttpError } from '../authz.ts';
import { executeTransition } from '../bookingMachine.ts';

/**
 * GET /admin/dashboard
 * Live KPI counts from Neon PostgreSQL, scoped by role and store.
 */
export async function getDashboardHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN');

    const url = new URL(req.url || '', 'http://localhost');
    let storeId = url.searchParams.get('storeId');
    if (storeId === 'ALL') storeId = null;

    if (storeId && session.role !== 'SUPER_ADMIN') {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== 'SUPER_ADMIN') {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }

    const db = getPool();
    if (!db) {
      return res.status(200).json({
        success: true,
        data: { todayTotal: 0, pending: 0, inRepair: 0, delivered: 0, unassignedCount: 0 },
      });
    }

    const statsRes = await db.query(
      `SELECT 
         COUNT(*)::int as "todayTotal",
         COUNT(*) FILTER (WHERE status = 'PENDING')::int as "pending",
         COUNT(*) FILTER (WHERE status IN ('IN_REPAIR', 'CUSTODY_OTP_SENT'))::int as "inRepair",
         COUNT(*) FILTER (WHERE status = 'DELIVERED')::int as "delivered",
         COUNT(*) FILTER (WHERE assigned_employee_id IS NULL AND status != 'CANCELLED')::int as "unassignedCount"
       FROM bookings
       WHERE ($1::text IS NULL OR store_id = $1)`,
      [storeId]
    );

    return res.status(200).json({
      success: true,
      data: statsRes.rows[0] || { todayTotal: 0, pending: 0, inRepair: 0, delivered: 0, unassignedCount: 0 },
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Dashboard error' } });
  }
}

/**
 * GET /admin/team
 * Live staff directory from Neon DB.
 */
export async function getTeamHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN');

    const url = new URL(req.url || '', 'http://localhost');
    let storeId = url.searchParams.get('storeId');
    if (storeId === 'ALL') storeId = null;

    if (storeId && session.role !== 'SUPER_ADMIN') {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== 'SUPER_ADMIN') {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }

    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });

    const teamRes = await db.query(
      `SELECT 
         u.id, 
         u.name, 
         u.email, 
         u.phone, 
         u.role, 
         u.store_id as "storeId", 
         s.name as "storeName",
         'ACTIVE' as status, 
         (
           SELECT count(*)::int 
           FROM bookings b 
           WHERE (b.assigned_employee_id = u.id OR b.technician_id = u.id) 
             AND b.status NOT IN ('DELIVERED', 'CANCELLED')
         ) as "activeJobsCount",
         u.created_at as "createdAt",
         COALESCE(
           (SELECT json_agg(sa.store_id) FROM store_admins sa WHERE sa.user_id = u.id),
           '[]'::json
         ) as "assignedStoreIds"
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.id
       WHERE u.role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')
         AND (
           $1::text IS NULL 
           OR u.store_id = $1 
           OR EXISTS (SELECT 1 FROM store_admins sa WHERE sa.user_id = u.id AND sa.store_id = $1)
         )
       ORDER BY u.created_at ASC`,
      [storeId]
    );

    return res.status(200).json({ success: true, data: teamRes.rows });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Team error' } });
  }
}

/**
 * PATCH /admin/team/:id/role
 * Updates staff role and store assignment. Requires SUPER_ADMIN.
 */
export async function updateTeamRoleHandler(req: any, res: any, targetUserId: string) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'SUPER_ADMIN');

    const body = req.body || {};
    const newRole = body.role;
    const storeId = body.storeId || null;

    if (!newRole) {
      return res.status(400).json({ error: { message: 'Role is required.' } });
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    await db.query(
      `UPDATE users SET role = $1, store_id = COALESCE($2, store_id), updated_at = NOW() WHERE id = $3`,
      [newRole, storeId, targetUserId]
    );

    return res.status(200).json({ success: true, message: 'Role updated successfully.' });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to update role.' } });
  }
}

/**
 * GET /admin/inventory
 * Live inventory from Neon DB.
 */
export async function getInventoryHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN', 'TECHNICIAN');

    const url = new URL(req.url || '', 'http://localhost');
    let storeId = url.searchParams.get('storeId');
    if (storeId === 'ALL') storeId = null;

    if (storeId && session.role !== 'SUPER_ADMIN') {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== 'SUPER_ADMIN') {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }

    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });

    const invRes = await db.query(
      `SELECT 
         id, 
         store_id as "storeId", 
         part_name as "partName", 
         sku, 
         compatible_with as "compatibleWith", 
         quantity, 
         min_threshold as "minThreshold", 
         unit_cost_paise as "unitCostPaise", 
         updated_at as "updatedAt"
       FROM inventory_items
       WHERE ($1::text IS NULL OR store_id = $1)
       ORDER BY updated_at DESC`,
      [storeId]
    );

    return res.status(200).json({ success: true, data: invRes.rows });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Inventory error' } });
  }
}

/**
 * GET /admin/stores
 * Protected store list with assigned admins, scoped by role and store.
 * Requires ADMIN or SUPER_ADMIN.
 */
export async function getAdminStoresHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN');

    const url = new URL(req.url || '', 'http://localhost');
    let storeId = url.searchParams.get('storeId');
    if (storeId === 'ALL') storeId = null;

    let allowedStoreIds: string[] | null = null;

    if (session.role !== 'SUPER_ADMIN') {
      const ids = new Set<string>();
      if (session.storeId) ids.add(session.storeId);
      if (Array.isArray(session.storeIds)) {
        for (const sid of session.storeIds) {
          if (sid) ids.add(sid);
        }
      }

      if (storeId) {
        requireStoreAccess(session, storeId);
        allowedStoreIds = [storeId];
      } else {
        allowedStoreIds = Array.from(ids);
      }

      if (allowedStoreIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }
    } else if (storeId) {
      allowedStoreIds = [storeId];
    }

    const db = getPool();
    if (!db) {
      return res.status(200).json({ success: true, data: [] });
    }

    const storesRes = await db.query(
      `SELECT 
         s.id,
         s.slug,
         s.name,
         s.address,
         s.city,
         s.lat,
         s.lng,
         s.phone,
         s.hours,
         s.is_active as "isActive",
         s.rating,
         s.review_count as "reviewCount",
         COALESCE(
           (
             SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role))
             FROM store_admins sa
             JOIN users u ON sa.user_id = u.id
             WHERE sa.store_id = s.id
           ),
           '[]'::json
         ) as "assignedAdmins"
       FROM stores s
       WHERE ($1::text[] IS NULL OR s.id = ANY($1::text[]))
       ORDER BY s.created_at ASC`,
      [allowedStoreIds]
    );

    return res.status(200).json({ success: true, data: storesRes.rows });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to fetch admin stores.' } });
  }
}

/**
 * POST /admin/stores
 * Adds or updates a store. Requires SUPER_ADMIN.
 */
export async function upsertStoreHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'SUPER_ADMIN');

    const body = req.body || {};
    const name = (body.name || '').trim();
    const address = (body.address || '').trim();
    const city = (body.city || 'Bengaluru').trim();
    const phone = (body.phone || '+91 80 4821 7700').trim();
    const hours = (body.hours || '9 AM – 9 PM').trim();
    const lat = body.lat ? String(body.lat) : '12.9352';
    const lng = body.lng ? String(body.lng) : '77.6245';
    const id = body.id || `store-${Date.now().toString(36)}`;
    const slug = body.slug || id;
    const assignedAdminIds: string[] = Array.isArray(body.assignedAdminIds) ? body.assignedAdminIds : [];

    if (!name || !address) {
      return res.status(400).json({ error: { message: 'Store name and address are required.' } });
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const insertRes = await db.query(
      `INSERT INTO stores (id, slug, name, address, city, phone, lat, lng, hours, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
       ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         phone = EXCLUDED.phone,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         hours = EXCLUDED.hours,
         is_active = true
       RETURNING *`,
      [id, slug, name, address, city, phone, lat, lng, hours]
    );

    if (assignedAdminIds.length > 0) {
      await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [id]);
      for (const adminId of assignedAdminIds) {
        await db.query(
          `INSERT INTO store_admins (id, store_id, user_id, created_at)
           VALUES (gen_random_uuid(), $1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [id, adminId]
        );
      }
    }

    return res.status(201).json({
      success: true,
      data: insertRes.rows[0],
      message: 'Store saved successfully.',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to save store.' } });
  }
}

/**
 * POST /admin/stores/:id/toggle
 * Toggles store active state. Requires SUPER_ADMIN.
 */
export async function toggleStoreHandler(req: any, res: any, storeId: string) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'SUPER_ADMIN');

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const toggleRes = await db.query(
      `UPDATE stores SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [storeId]
    );

    if (toggleRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Store not found.' } });
    }

    return res.status(200).json({
      success: true,
      data: toggleRes.rows[0],
      message: `Store ${toggleRes.rows[0].is_active ? 'activated' : 'deactivated'} successfully.`,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to toggle store.' } });
  }
}

/**
 * DELETE /admin/stores/:id
 * Removes a store and unassigns admins. Requires SUPER_ADMIN.
 */
export async function deleteStoreHandler(req: any, res: any, storeId: string) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'SUPER_ADMIN');

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
    const delRes = await db.query(`DELETE FROM stores WHERE id = $1 RETURNING id`, [storeId]);

    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Store not found.' } });
    }

    return res.status(200).json({ success: true, message: 'Store removed successfully.' });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to delete store.' } });
  }
}

/**
 * POST /admin/stores/assign-admins
 * Assigns admin users to a store. Requires SUPER_ADMIN.
 */
export async function assignStoreAdminsHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'SUPER_ADMIN');

    const body = req.body || {};
    const storeId = body.storeId;
    const adminUserIds: string[] = Array.isArray(body.adminUserIds) ? body.adminUserIds : [];

    if (!storeId) {
      return res.status(400).json({ error: { message: 'Store ID is required.' } });
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
    for (const userId of adminUserIds) {
      await db.query(
        `INSERT INTO store_admins (id, store_id, user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [storeId, userId]
      );
    }

    return res.status(200).json({ success: true, message: 'Admins assigned successfully.' });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to assign admins.' } });
  }
}

/**
 * POST /admin/bookings/:id/assign
 * Assigns delivery rider and technician to a booking. Requires ADMIN or SUPER_ADMIN.
 */
export async function assignBookingStaffHandler(req: any, res: any, bookingId: string) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN');

    const body = req.body || {};
    const employeeId = body.employeeId || null;
    const technicianId = body.technicianId || null;

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const result = await executeTransition(db, bookingId, 'assign', session, {
      employeeId,
      technicianId,
      note: 'Staff allocated to booking',
    });

    return res.status(200).json({
      success: true,
      message: 'Staff allocated successfully.',
      data: result.booking,
      booking: result.booking,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to assign staff.' } });
  }
}

/**
 * GET /admin/bookings
 * Scoped and searchable booking list for staff.
 */
export async function getAdminBookingsHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN', 'TECHNICIAN', 'EMPLOYEE');

    const url = new URL(req.url || '', 'http://localhost');
    let storeId = url.searchParams.get('storeId');
    if (storeId === 'ALL') storeId = null;

    if (storeId && session.role !== 'SUPER_ADMIN') {
      requireStoreAccess(session, storeId);
    } else if (!storeId && session.role !== 'SUPER_ADMIN') {
      storeId = session.storeId || (session.storeIds?.[0] || null);
    }

    const status = url.searchParams.get('status');
    const filterStatus = status && status !== 'ALL' ? status : null;
    const search = url.searchParams.get('search');
    const filterSearch = search ? `%${search.trim().toLowerCase()}%` : null;

    const db = getPool();
    if (!db) return res.status(200).json({ success: true, data: [] });

    const resDb = await db.query(
      `SELECT 
         b.id,
         b.tracking_code as "trackingCode",
         b.brand,
         b.device_model as "deviceModel",
         b.issue_type as "issueType",
         b.issue_description as "issueDescription",
         b.store_id as "storeId",
         b.scheduled_date as "scheduledDate",
         b.scheduled_time as "scheduledTime",
         b.pickup_address as "pickupAddress",
         b.pickup_lat as "pickupLat",
         b.pickup_lng as "pickupLng",
         b.contact_name as "contactName",
         b.contact_email as "contactEmail",
         b.contact_phone as "contactPhone",
         b.status,
         b.estimated_cost_paise as "estimatedCostPaise",
         b.final_cost_paise as "finalCostPaise",
         b.payment_method as "paymentMethod",
         b.payment_status as "paymentStatus",
         b.notes,
         b.assigned_employee_id as "assignedEmployeeId",
         u1.name as "assignedEmployeeName",
         b.technician_id as "technicianId",
         u2.name as "technicianName",
         b.created_at as "createdAt",
         b.updated_at as "updatedAt"
       FROM bookings b
       LEFT JOIN users u1 ON b.assigned_employee_id = u1.id
       LEFT JOIN users u2 ON b.technician_id = u2.id
       WHERE ($1::text IS NULL OR b.store_id = $1)
         AND ($2::text IS NULL OR b.status = $2)
         AND ($3::text IS NULL OR (
           LOWER(b.id) LIKE $3 OR 
           LOWER(b.contact_name) LIKE $3 OR 
           LOWER(b.contact_phone) LIKE $3 OR 
           LOWER(b.device_model) LIKE $3 OR 
           LOWER(b.brand) LIKE $3
         ))
       ORDER BY b.created_at DESC`,
      [storeId, filterStatus, filterSearch]
    );

    return res.status(200).json({
      success: true,
      data: resDb.rows,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to fetch bookings.' } });
  }
}

/**
 * POST /admin/team (and /admin/team/invite)
 * Creates or updates a staff member with password hash, role, and store assignment.
 */
export async function createTeamMemberHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN');

    const body = req.body || {};
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const phone = (body.phone || '').trim() || null;
    const role = body.role || 'EMPLOYEE';
    let storeId = body.storeId || null;
    if (storeId === 'ALL') storeId = null;

    if (!name || !email) {
      return res.status(400).json({ error: { message: 'Name and email are required.' } });
    }

    if (role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: { message: 'Only Super Admins can create Super Admin accounts.' } });
    }

    if (session.role !== 'SUPER_ADMIN' && storeId) {
      requireStoreAccess(session, storeId);
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const rawPassword = body.password || 'Flashfix@2026';
    const passwordHash = bcrypt.hashSync(rawPassword, 10);

    const existing = await db.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    let row: any;
    if (existing.rows.length > 0) {
      const upd = await db.query(
        `UPDATE users SET name = $1, phone = COALESCE($2, phone), role = $3, store_id = $4, password_hash = COALESCE($5, password_hash), is_active = true, updated_at = NOW()
         WHERE id = $6 RETURNING id, name, email, phone, role, store_id as "storeId", created_at as "createdAt"`,
        [name, phone, role, storeId, body.password ? passwordHash : null, existing.rows[0].id]
      );
      row = upd.rows[0];
    } else {
      const ins = await db.query(
        `INSERT INTO users (id, name, email, phone, role, store_id, password_hash, email_verified, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, true, NOW(), NOW())
         RETURNING id, name, email, phone, role, store_id as "storeId", created_at as "createdAt"`,
        [name, email, phone, role, storeId, passwordHash]
      );
      row = ins.rows[0];
    }

    if (role === 'ADMIN' && storeId) {
      await db.query(
        `INSERT INTO store_admins (id, store_id, user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [storeId, row.id]
      );
    }

    return res.status(201).json({
      success: true,
      data: { ...row, status: 'ACTIVE', activeJobsCount: 0 },
      message: 'Staff member provisioned successfully.',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to provision staff member.' } });
  }
}

/**
 * POST /admin/inventory
 * Creates or updates an inventory item.
 */
export async function upsertInventoryHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN', 'TECHNICIAN');

    const body = req.body || {};
    const storeId = body.storeId || session.storeId || session.storeIds?.[0];
    const partName = (body.partName || '').trim();
    const sku = (body.sku || '').trim();
    const compatibleWith = Array.isArray(body.compatibleWith)
      ? body.compatibleWith
      : typeof body.compatibleWith === 'string'
      ? body.compatibleWith.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const quantity = Number(body.quantity ?? 0);
    const minThreshold = Number(body.minThreshold ?? 5);
    const unitCostPaise = Number(body.unitCostPaise ?? 0);

    if (!storeId || !partName || !sku) {
      return res.status(400).json({ error: { message: 'Store ID, part name, and SKU are required.' } });
    }

    if (session.role !== 'SUPER_ADMIN') {
      requireStoreAccess(session, storeId);
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const id = body.id || `inv-${Date.now().toString(36)}`;
    const resDb = await db.query(
      `INSERT INTO inventory_items (id, store_id, part_name, sku, compatible_with, quantity, min_threshold, unit_cost_paise, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         part_name = EXCLUDED.part_name,
         sku = EXCLUDED.sku,
         compatible_with = EXCLUDED.compatible_with,
         quantity = EXCLUDED.quantity,
         min_threshold = EXCLUDED.min_threshold,
         unit_cost_paise = EXCLUDED.unit_cost_paise,
         updated_at = NOW()
       RETURNING id, store_id as "storeId", part_name as "partName", sku, compatible_with as "compatibleWith", quantity, min_threshold as "minThreshold", unit_cost_paise as "unitCostPaise", updated_at as "updatedAt"`,
      [id, storeId, partName, sku, JSON.stringify(compatibleWith), quantity, minThreshold, unitCostPaise]
    );

    return res.status(201).json({ success: true, data: resDb.rows[0] });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to save inventory item.' } });
  }
}

/**
 * PATCH /admin/inventory/:id/stock
 * Updates inventory quantity.
 */
export async function updateInventoryStockHandler(req: any, res: any, itemId: string) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN', 'TECHNICIAN');

    const quantity = Number(req.body?.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return res.status(400).json({ error: { message: 'Valid non-negative quantity is required.' } });
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const upd = await db.query(
      `UPDATE inventory_items SET quantity = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, store_id as "storeId", part_name as "partName", sku, compatible_with as "compatibleWith", quantity, min_threshold as "minThreshold", unit_cost_paise as "unitCostPaise", updated_at as "updatedAt"`,
      [quantity, itemId]
    );

    if (upd.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Inventory item not found.' } });
    }

    return res.status(200).json({ success: true, data: upd.rows[0] });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to update stock.' } });
  }
}

/**
 * DELETE /admin/inventory/:id
 */
export async function deleteInventoryHandler(req: any, res: any, itemId: string) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'ADMIN', 'SUPER_ADMIN');

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    await db.query(`DELETE FROM inventory_items WHERE id = $1`, [itemId]);
    return res.status(200).json({ success: true, message: 'Inventory item removed.' });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to delete inventory item.' } });
  }
}

/**
 * GET /settings (public) & GET /admin/settings
 * Returns support contact settings from system_settings.
 */
export async function getSettingsHandler(_req: any, res: any) {
  const defaults = {
    supportEmail: 'support@flashfix.in',
    supportPhone: '+91 80 4821 7700',
    supportHours: '9 AM – 9 PM, Mon–Sun',
  };

  try {
    const db = getPool();
    if (!db) {
      return res.status(200).json({ success: true, data: defaults });
    }

    const resDb = await db.query(
      `SELECT key, value FROM system_settings WHERE key IN ('support_email', 'support_phone', 'support_hours')`
    );

    const map: Record<string, string> = {};
    for (const row of resDb.rows) {
      map[row.key] = row.value;
    }

    return res.status(200).json({
      success: true,
      data: {
        supportEmail: map.support_email || defaults.supportEmail,
        supportPhone: map.support_phone || defaults.supportPhone,
        supportHours: map.support_hours || defaults.supportHours,
      },
    });
  } catch {
    return res.status(200).json({ success: true, data: defaults });
  }
}

/**
 * PUT /admin/settings
 * Updates support contact settings in system_settings. Requires SUPER_ADMIN.
 */
export async function updateSettingsHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    requireRole(session, 'SUPER_ADMIN');

    const body = req.body || {};
    const supportEmail = (body.supportEmail || '').trim();
    const supportPhone = (body.supportPhone || '').trim();
    const supportHours = (body.supportHours || '9 AM – 9 PM, Mon–Sun').trim();

    if (!supportEmail || !supportPhone) {
      return res.status(400).json({ error: { message: 'Support email and phone are required.' } });
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const entries = [
      ['support_email', supportEmail],
      ['support_phone', supportPhone],
      ['support_hours', supportHours],
    ];

    for (const [k, v] of entries) {
      await db.query(
        `INSERT INTO system_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [k, v, session.sub]
      );
    }

    return res.status(200).json({
      success: true,
      data: { supportEmail, supportPhone, supportHours },
      message: 'Support contact settings updated successfully.',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to update settings.' } });
  }
}
