import { Pool } from 'pg';

const NEON_DB_URL = process.env.DATABASE_URL || '';

let pool: Pool | null = null;
function getPool(): Pool | null {
  if (!NEON_DB_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: NEON_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const db = getPool();
  if (!db) {
    return res.status(500).json({ error: { message: 'Database pool unavailable.' } });
  }

  try {
    // 1. GET ALL STORES
    if (req.method === 'GET') {
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
         ORDER BY s.created_at ASC`
      );

      return res.status(200).json({ success: true, data: storesRes.rows });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    // 2. POST (ADD / UPSERT STORE)
    if (req.method === 'POST') {
      const action = body.action || 'create';

      if (action === 'toggle') {
        const storeId = body.storeId;
        if (!storeId) return res.status(400).json({ error: { message: 'Store ID required' } });
        const toggleRes = await db.query(
          `UPDATE stores SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
          [storeId]
        );
        return res.status(200).json({ success: true, data: toggleRes.rows[0] });
      }

      if (action === 'delete') {
        const storeId = body.storeId;
        if (!storeId) return res.status(400).json({ error: { message: 'Store ID required' } });
        await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
        await db.query(`DELETE FROM stores WHERE id = $1`, [storeId]);
        return res.status(200).json({ success: true, message: 'Store removed successfully.' });
      }

      if (action === 'assign_admins') {
        const storeId = body.storeId;
        const adminUserIds: string[] = Array.isArray(body.adminUserIds) ? body.adminUserIds : [];
        if (!storeId) return res.status(400).json({ error: { message: 'Store ID required' } });
        await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
        for (const uid of adminUserIds) {
          await db.query(
            `INSERT INTO store_admins (id, store_id, user_id, created_at)
             VALUES (gen_random_uuid(), $1, $2, NOW())
             ON CONFLICT DO NOTHING`,
            [storeId, uid]
          );
        }
        return res.status(200).json({ success: true, message: 'Admins assigned successfully.' });
      }

      // Default: Create or update store
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
        message: 'Store created successfully',
      });
    }

    // 3. DELETE STORE
    if (req.method === 'DELETE') {
      const url = new URL(req.url || '', 'http://localhost');
      const storeId = url.searchParams.get('id') || body.storeId;
      if (!storeId) return res.status(400).json({ error: { message: 'Store ID is required' } });

      await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
      await db.query(`DELETE FROM stores WHERE id = $1`, [storeId]);
      return res.status(200).json({ success: true, message: 'Store removed successfully.' });
    }

    // 4. PATCH (TOGGLE OR ASSIGN)
    if (req.method === 'PATCH') {
      const storeId = body.storeId;
      if (!storeId) return res.status(400).json({ error: { message: 'Store ID is required' } });

      if (body.action === 'assign_admins') {
        const adminUserIds: string[] = Array.isArray(body.adminUserIds) ? body.adminUserIds : [];
        await db.query(`DELETE FROM store_admins WHERE store_id = $1`, [storeId]);
        for (const uid of adminUserIds) {
          await db.query(
            `INSERT INTO store_admins (id, store_id, user_id, created_at)
             VALUES (gen_random_uuid(), $1, $2, NOW())
             ON CONFLICT DO NOTHING`,
            [storeId, uid]
          );
        }
        return res.status(200).json({ success: true, message: 'Admins assigned successfully.' });
      }

      // Default toggle
      const toggleRes = await db.query(
        `UPDATE stores SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
        [storeId]
      );
      return res.status(200).json({ success: true, data: toggleRes.rows[0] });
    }
  } catch (err: any) {
    console.error('Stores API error:', err);
    return res.status(500).json({ error: { message: err.message || 'Stores management error' } });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed' } });
}
