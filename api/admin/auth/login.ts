import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'MISSING_CREDENTIALS', message: 'Email and password are required for staff login.' },
      });
    }

    const db = getPool();
    if (!db) {
      return res.status(500).json({ error: { message: 'Database connection unavailable.' } });
    }

    const userRes = await db.query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials or staff privileges not assigned.' },
      });
    }

    const userRow = userRes.rows[0];
    const hash = userRow.password_hash;

    if (!hash) {
      return res.status(401).json({
        error: { code: 'NO_PASSWORD', message: 'Password has not been set for this staff account. Contact administrator.' },
      });
    }

    const isMatch = bcrypt.compareSync(password, hash);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid password. Please check your credentials.' },
      });
    }

    // Fetch assigned stores from store_admins junction table
    const saRes = await db.query(
      `SELECT store_id FROM store_admins WHERE user_id = $1`,
      [userRow.id]
    );
    const storeIds: string[] = saRes.rows.map((r: any) => r.store_id);
    if (userRow.store_id && !storeIds.includes(userRow.store_id)) {
      storeIds.push(userRow.store_id);
    }

    const tokenPayload = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      storeId: userRow.store_id || (storeIds[0] || null),
      storeIds,
      iat: Date.now(),
    };
    const token = 'ff_staff_' + Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        phone: userRow.phone,
        role: userRow.role,
        storeId: userRow.store_id || (storeIds[0] || null),
        storeIds,
      },
    });
  } catch (err: any) {
    console.error('Staff Login Handler Error:', err);
    return res.status(500).json({ error: { message: err.message || 'Staff authentication error' } });
  }
}
