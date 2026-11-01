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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '', 'http://localhost');
  const storeId = url.searchParams.get('storeId');
  const filterStore = storeId && storeId !== 'ALL' ? storeId : null;

  try {
    const db = getPool();
    if (db) {
      if (req.method === 'GET') {
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
          [filterStore]
        );

        return res.status(200).json({ success: true, data: teamRes.rows });
      }

      if (req.method === 'PATCH') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
        const { userId, role, storeId } = body;
        if (!userId || !role) {
          return res.status(400).json({ error: { message: 'userId and role are required' } });
        }
        await db.query(
          `UPDATE users SET role = $1, store_id = COALESCE($2, store_id), updated_at = NOW() WHERE id = $3`,
          [role, storeId || null, userId]
        );
        return res.status(200).json({ success: true, message: 'Role updated successfully.' });
      }
    }
  } catch (err: any) {
    console.warn('Team API error:', err);
  }

  return res.status(200).json({ success: true, data: [] });
}
