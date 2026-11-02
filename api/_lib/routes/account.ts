import { getPool } from '../db.ts';
import { requireAuth } from '../session.ts';
import { HttpError } from '../authz.ts';

/**
 * GET /account/addresses
 * Fetches all saved addresses for the authenticated user.
 */
export async function getAddressesHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) {
      return res.status(200).json({ success: true, data: [] });
    }

    const addrRes = await db.query(
      `SELECT id, user_id as "userId", label, address, landmark, lat, lng, is_default as "isDefault", created_at as "createdAt"
       FROM saved_addresses 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [session.sub]
    );

    return res.status(200).json({
      success: true,
      data: addrRes.rows,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to fetch addresses.' } });
  }
}

/**
 * POST /account/addresses
 * Creates a new saved address for the authenticated user.
 */
export async function createAddressHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const address = (body.address || '').trim();
    const landmark = (body.landmark || '').trim() || null;
    const label = (body.label || 'Home').trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const isDefault = Boolean(body.isDefault);

    if (!address || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid street address and GPS coordinates (lat, lng) are required.',
        },
      });
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection unavailable.' },
      });
    }

    // If isDefault is true, unset existing defaults
    if (isDefault) {
      await db.query(
        `UPDATE saved_addresses SET is_default = false WHERE user_id = $1`,
        [session.sub]
      );
    }

    const insertRes = await db.query(
      `INSERT INTO saved_addresses (id, user_id, label, address, landmark, lat, lng, is_default, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, user_id as "userId", label, address, landmark, lat, lng, is_default as "isDefault", created_at as "createdAt"`,
      [session.sub, label, address, landmark, lat, lng, isDefault]
    );

    return res.status(201).json({
      success: true,
      data: insertRes.rows[0],
      message: 'Address saved successfully.',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to save address.' } });
  }
}

/**
 * DELETE /account/addresses/:id
 * Deletes a saved address owned by the authenticated user.
 */
export async function deleteAddressHandler(req: any, res: any, addressId: string) {
  try {
    const session = await requireAuth(req);
    const db = getPool();
    if (!db) {
      return res.status(500).json({
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection unavailable.' },
      });
    }

    const delRes = await db.query(
      `DELETE FROM saved_addresses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [addressId, session.sub]
    );

    if (delRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Address not found or not owned by your account.' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully.',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to delete address.' } });
  }
}

/**
 * PATCH /auth/me
 * Updates current authenticated user profile details (name, phone, avatarUrl).
 */
export async function updateMeHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    const body = req.body || {};
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const phone = body.phone !== undefined ? String(body.phone).trim() : undefined;
    const avatarUrl = body.avatarUrl !== undefined ? String(body.avatarUrl).trim() : undefined;

    const db = getPool();
    if (!db) {
      return res.status(500).json({
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection unavailable.' },
      });
    }

    const updateRes = await db.query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           avatar_url = COALESCE($3, avatar_url),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, phone, role, avatar_url as "avatarUrl", store_id as "storeId", created_at as "createdAt", updated_at as "updatedAt"`,
      [name || null, phone || null, avatarUrl || null, session.sub]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User account not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      user: updateRes.rows[0],
      message: 'Profile updated successfully.',
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to update profile.' } });
  }
}
