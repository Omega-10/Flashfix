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
      max: 5,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

// In-memory OTP storage for ultra-fast verification fallback
const otpMemoryCache = new Map<string, { code: string; expiresAt: number; attempts: number }>();

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path from req.url or req.query
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname.replace(/^\/api/, '');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  try {
    // -------------------------------------------------------------------------
    // 1. POST /api/auth/send-otp
    // -------------------------------------------------------------------------
    if (pathname.includes('/auth/send-otp') && req.method === 'POST') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Valid email is required.' } });
      }

      // Generate 6-digit OTP code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      // Save to memory cache
      otpMemoryCache.set(email, { code, expiresAt, attempts: 0 });

      // Save to Neon DB
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
        console.warn('Neon DB OTP insert error (continuing with memory fallback):', dbErr);
      }

      // Send via Brevo
      const brevoPayload = {
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email }],
        subject: `⚡ ${code} is your Flashfix verification code`,
        htmlContent: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0D0D0D; color: #F5F0EB; padding: 40px 24px; border-radius: 16px; max-width: 480px; margin: auto;">
            <div style="margin-bottom: 24px; text-align: center;">
              <span style="font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #F5F0EB;">FLASH<span style="color: #ef8f0b;">FIX</span></span>
            </div>
            <div style="background: #171717; border: 1px solid rgba(239, 143, 11, 0.2); padding: 32px 24px; border-radius: 12px; text-align: center;">
              <p style="color: #A3A3A3; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px 0; font-family: monospace;">One-Time Verification Code</p>
              <div style="font-size: 40px; font-weight: 800; letter-spacing: 8px; color: #ef8f0b; font-family: monospace; padding: 12px 0;">
                ${code}
              </div>
              <p style="color: #737373; font-size: 12px; margin: 16px 0 0 0;">Valid for 10 minutes. Never share this code with anyone.</p>
            </div>
          </div>
        `,
        textContent: `Your Flashfix verification code is: ${code}. Valid for 10 minutes.`,
      };

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_KEY,
          Accept: 'application/json',
        },
        body: JSON.stringify(brevoPayload),
      });

      if (!brevoRes.ok) {
        const brevoErr = await brevoRes.text();
        console.error('Brevo Error:', brevoRes.status, brevoErr);
        return res.status(500).json({ error: { message: `Brevo email error: ${brevoErr}` } });
      }

      const brevoData = await brevoRes.json().catch(() => ({}));
      return res.status(200).json({
        success: true,
        message: 'Verification code sent to your email successfully.',
        messageId: brevoData.messageId,
      });
    }

    // -------------------------------------------------------------------------
    // 2. POST /api/auth/verify-otp
    // -------------------------------------------------------------------------
    if (pathname.includes('/auth/verify-otp') && req.method === 'POST') {
      const email = (body.email || '').trim().toLowerCase();
      const code = (body.code || '').trim();

      if (!email || !code) {
        return res.status(400).json({ error: { message: 'Email and 6-digit code are required.' } });
      }

      // Check memory cache first
      let valid = false;
      const mem = otpMemoryCache.get(email);
      if (mem && mem.code === code && mem.expiresAt > Date.now()) {
        valid = true;
        otpMemoryCache.delete(email);
      }

      // If not in memory, check Neon DB
      if (!valid) {
        try {
          const db = getPool();
          if (db) {
            const otpCheck = await db.query(
              `SELECT * FROM otp_codes WHERE email = $1 AND code = $2 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
              [email, code]
            );
            if (otpCheck.rows.length > 0) {
              valid = true;
              await db.query(`UPDATE otp_codes SET used = true WHERE id = $1`, [otpCheck.rows[0].id]);
            }
          }
        } catch (dbErr) {
          console.warn('Neon DB OTP check error:', dbErr);
        }
      }

      if (!valid) {
        return res.status(401).json({ error: { message: 'Invalid or expired verification code. Please request a new one.' } });
      }

      // Upsert user in Neon DB
      let user = {
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
            user = existing.rows[0];
          } else {
            const insertRes = await db.query(
              `INSERT INTO users (id, name, email, role, email_verified, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, $2, 'CONSUMER', true, NOW(), NOW()) RETURNING *`,
              [email.split('@')[0], email]
            );
            user = insertRes.rows[0];
          }
        }
      } catch (dbErr) {
        console.warn('Neon DB user upsert error:', dbErr);
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
    }

    // -------------------------------------------------------------------------
    // 3. GET /api/stores/nearby
    // -------------------------------------------------------------------------
    if (pathname.includes('/stores/nearby') && req.method === 'GET') {
      const lat = parseFloat(url.searchParams.get('lat') || '12.9352');
      const lng = parseFloat(url.searchParams.get('lng') || '77.6245');

      let storeList: any[] = [];
      try {
        const db = getPool();
        if (db) {
          const resDb = await db.query(`SELECT * FROM stores WHERE is_active = true`);
          storeList = resDb.rows;
        }
      } catch {
        // Fallback stores if DB query fails
        storeList = [
          { id: 'store-001', name: 'Flashfix — Koramangala', address: '12th Main, 4th Block', city: 'Bengaluru', lat: '12.9352', lng: '77.6245', rating: '4.80', reviewCount: 342 },
          { id: 'store-002', name: 'Flashfix — Indiranagar', address: '100 Feet Road', city: 'Bengaluru', lat: '12.9784', lng: '77.6408', rating: '4.70', reviewCount: 218 },
          { id: 'store-003', name: 'Flashfix — HSR Layout', address: 'Sector 2, HSR Layout', city: 'Bengaluru', lat: '12.9116', lng: '77.6389', rating: '4.90', reviewCount: 504 },
        ];
      }

      const enriched = storeList
        .map((s) => {
          const sLat = parseFloat(s.lat);
          const sLng = parseFloat(s.lng);
          const dist = haversineKm(lat, lng, sLat, sLng);
          return {
            ...s,
            distanceKm: dist,
            tier: dist <= 3 ? 'flash' : dist <= 10 ? 'next-day' : 'out-of-range',
            isFlashHero: dist <= 3,
            estimatedPickupMinutes: dist <= 3 ? 20 + Math.round(dist * 4) : null,
          };
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);

      return res.status(200).json(enriched);
    }

    // -------------------------------------------------------------------------
    // 4. POST /api/bookings
    // -------------------------------------------------------------------------
    if (pathname.includes('/bookings') && req.method === 'POST') {
      const bookingId = `FF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const newBooking = {
        id: bookingId,
        brand: body.brand || 'Apple',
        deviceModel: body.device || body.deviceModel || 'iPhone',
        issueType: body.issue || body.issueType || 'Screen Replacement',
        storeId: body.storeId || 'store-001',
        scheduledDate: body.date || body.scheduledDate || new Date().toISOString().split('T')[0],
        scheduledTime: body.time || body.scheduledTime || '11:00 AM',
        pickupAddress: body.address || body.pickupAddress || 'Customer Address',
        contactName: body.name || body.contactName || 'Valued Customer',
        contactEmail: body.email || body.contactEmail || 'customer@example.com',
        contactPhone: body.phone || body.contactPhone || '+919999999999',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      try {
        const db = getPool();
        if (db) {
          await db.query(
            `INSERT INTO bookings (id, brand, device_model, issue, store_id, scheduled_date, scheduled_time, pickup_address, contact_name, contact_email, contact_phone, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING', NOW(), NOW())`,
            [
              newBooking.id,
              newBooking.brand,
              newBooking.deviceModel,
              newBooking.issueType,
              newBooking.storeId,
              newBooking.scheduledDate,
              newBooking.scheduledTime,
              newBooking.pickupAddress,
              newBooking.contactName,
              newBooking.contactEmail,
              newBooking.contactPhone,
            ]
          );
        }
      } catch (dbErr) {
        console.warn('Neon DB booking insert error:', dbErr);
      }

      return res.status(201).json({
        success: true,
        booking: newBooking,
        message: 'Booking confirmed successfully!',
      });
    }

    // Default route response
    return res.status(200).json({ status: 'ok', service: 'flashfix-vercel-gateway', time: new Date().toISOString() });
  } catch (err: any) {
    console.error('API Gateway Error:', err);
    return res.status(500).json({ error: { message: err.message || 'Internal gateway error' } });
  }
}
