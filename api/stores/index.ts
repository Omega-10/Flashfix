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

  try {
    const db = getPool();
    if (db) {
      const storesRes = await db.query(
        `SELECT id, slug, name, address, city, lat, lng, phone, hours, rating, review_count as "reviewCount"
         FROM stores
         WHERE is_active = true
         ORDER BY created_at ASC`
      );
      return res.status(200).json(storesRes.rows);
    }
  } catch (err) {
    console.warn('Stores index error:', err);
  }

  return res.status(200).json([]);
}
