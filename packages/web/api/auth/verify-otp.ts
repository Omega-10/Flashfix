import { Pool } from 'pg';
import crypto from 'crypto';

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

const NEON_DB_URL = process.env.DATABASE_URL || '';

let pool: Pool | null = null;
function getPool(): Pool | null {
  if (!NEON_DB_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: NEON_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 5000,
    });
  }
  return pool;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    const code = (body.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ error: { message: 'Email and 6-digit verification code are required.' } });
    }

    let isValid = false;
    let dbOtpId: string | null = null;
    const codeH = hashOtp(code);

    try {
      const db = getPool();
      if (db) {
        // Query otp_codes for latest unverified LOGIN code that has not expired
        const otpRes = await db.query(
          `SELECT * FROM otp_codes 
           WHERE email = $1 
             AND purpose = 'LOGIN' 
             AND verified = false 
             AND expires_at > NOW() 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [email]
        );

        if (otpRes.rows.length > 0) {
          const latestOtp = otpRes.rows[0];
          if (latestOtp.attempts >= 5) {
            return res.status(400).json({
              error: { code: 'OTP_MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded. Please request a new code.' }
            });
          }

          if (latestOtp.code_hash === codeH || latestOtp.code_hash === code) {
            isValid = true;
            dbOtpId = latestOtp.id;
            await db.query(`UPDATE otp_codes SET verified = true WHERE id = $1`, [dbOtpId]);
          } else {
            await db.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [latestOtp.id]);
          }
        }
      }
    } catch (dbErr) {
      console.warn('Neon DB OTP check error:', dbErr);
    }

    // Accept universal demo code in non-production mode only
    if (!isValid && process.env.NODE_ENV !== 'production' && code === '123456') {
      isValid = true;
    }

    if (!isValid) {
      return res.status(401).json({ error: { message: 'Invalid or expired verification code. Please request a new one.' } });
    }

    // Upsert user in Neon DB
    let user: any = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0],
      email,
      role: 'CONSUMER',
      emailVerified: true,
    };

    try {
      const db = getPool();
      if (db) {
        const existing = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          user = {
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            role: row.role,
            emailVerified: row.email_verified ?? true,
            avatarUrl: row.avatar_url,
            storeId: row.store_id,
            createdAt: row.created_at,
          };
        } else {
          const insertRes = await db.query(
            `INSERT INTO users (id, name, email, role, email_verified, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'CONSUMER', true, NOW(), NOW()) RETURNING *`,
            [email.split('@')[0], email]
          );
          const row = insertRes.rows[0];
          user = {
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            role: row.role,
            emailVerified: row.email_verified ?? true,
            avatarUrl: row.avatar_url,
            storeId: row.store_id,
            createdAt: row.created_at,
          };
        }
      }
    } catch (dbErr) {
      console.warn('Neon DB user query error:', dbErr);
    }

    const tokenPayload = { id: user.id, email: user.email, role: user.role, iat: Date.now() };
    const accessToken = 'ff_jwt_' + Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    const refreshToken = 'ff_ref_' + Buffer.from(JSON.stringify({ id: user.id })).toString('base64');

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user,
    });
  } catch (err: any) {
    console.error('verify-otp handler error:', err);
    return res.status(500).json({ error: { message: err.message || 'Internal server error' } });
  }
}
