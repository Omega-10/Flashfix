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
        [filterStore]
      );

      return res.status(200).json({ success: true, data: invRes.rows });
    }
  } catch (err: any) {
    console.warn('Inventory API error:', err);
  }

  return res.status(200).json({ success: true, data: [] });
}
