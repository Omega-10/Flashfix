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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
      const statsRes = await db.query(
        `SELECT 
           COUNT(*)::int as "todayTotal",
           COUNT(*) FILTER (WHERE status = 'PENDING')::int as "pending",
           COUNT(*) FILTER (WHERE status IN ('IN_REPAIR', 'CUSTODY_OTP_SENT'))::int as "inRepair",
           COUNT(*) FILTER (WHERE status = 'DELIVERED')::int as "delivered",
           COUNT(*) FILTER (WHERE assigned_employee_id IS NULL AND status != 'CANCELLED')::int as "unassignedCount"
         FROM bookings
         WHERE ($1::text IS NULL OR store_id = $1)`,
        [filterStore]
      );

      return res.status(200).json({
        success: true,
        data: statsRes.rows[0] || {
          todayTotal: 0,
          pending: 0,
          inRepair: 0,
          delivered: 0,
          unassignedCount: 0,
        },
      });
    }
  } catch (err: any) {
    console.warn('Dashboard API error:', err);
  }

  return res.status(200).json({
    success: true,
    data: {
      todayTotal: 0,
      pending: 0,
      inRepair: 0,
      delivered: 0,
      unassignedCount: 0,
    },
  });
}
