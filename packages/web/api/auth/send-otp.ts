import { Pool } from 'pg';

const NEON_DB_URL = process.env.DATABASE_URL || '';

const BREVO_KEY = process.env.BREVO_API_KEY || '';

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'nexusprojects03@gmail.com';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Flashfix';

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

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Valid email is required.' } });
    }

    // 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Neon DB
    try {
      const db = getPool();
      if (db) {
        await db.query(
          `INSERT INTO otp_codes (id, email, code, purpose, expires_at, created_at)
           VALUES (gen_random_uuid(), $1, $2, 'login', NOW() + INTERVAL '10 minutes', NOW())`,
          [email, code]
        );
      }
    } catch (dbErr) {
      console.warn('Neon DB OTP insert error:', dbErr);
    }

    // Send via Brevo
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email }],
        subject: `⚡ ${code} is your Flashfix verification code`,
        htmlContent: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 40px 24px; border-radius: 16px; max-width: 480px; margin: auto;">
            <div style="margin-bottom: 24px; text-align: center;">
              <span style="font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #F5F0EB;">FLASH<span style="color: #ef8f0b;">FIX</span></span>
            </div>
            <div style="background: #171717; border: 1px solid rgba(239, 143, 11, 0.25); padding: 32px 24px; border-radius: 12px; text-align: center;">
              <p style="color: #A3A3A3; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px 0; font-family: monospace;">One-Time Verification Code</p>
              <div style="font-size: 44px; font-weight: 800; letter-spacing: 8px; color: #ef8f0b; font-family: monospace; padding: 12px 0;">
                ${code}
              </div>
              <p style="color: #737373; font-size: 12px; margin: 16px 0 0 0;">Valid for 10 minutes. Never share this code with anyone.</p>
            </div>
          </div>
        `,
        textContent: `Your Flashfix verification code is: ${code}. Valid for 10 minutes.`,
      }),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.error('Brevo API Error:', brevoRes.status, errText);
      return res.status(500).json({ error: { message: `Email delivery error: ${errText}` } });
    }

    const brevoData = await brevoRes.json().catch(() => ({}));
    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email successfully.',
      messageId: brevoData.messageId,
    });
  } catch (err: any) {
    console.error('send-otp handler error:', err);
    return res.status(500).json({ error: { message: err.message || 'Internal server error' } });
  }
}
