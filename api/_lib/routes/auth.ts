import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool } from '../db.ts';
import { issue, clearSession, requireAuth } from '../session.ts';
import { HttpError } from '../authz.ts';
import { sendOtpEmail } from '../email.ts';
import { isDisposableEmail } from '@flashfix/shared';

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Returns role-specific destination route.
 */
export function getRedirectForRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin/overview';
    case 'TECHNICIAN':
      return '/admin/queue';
    case 'EMPLOYEE':
      return '/admin/runs';
    case 'CONSUMER':
    default:
      return '/flashfix/profile';
  }
}

/**
 * POST /auth/identify
 * Identifies if email belongs to active staff (requires password) or consumer (requires OTP).
 */
export async function identifyHandler(req: any, res: any) {
  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' },
    });
  }

  if (isDisposableEmail(email)) {
    return res.status(400).json({
      error: {
        code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
        message: 'Disposable email domains are not allowed. Please enter your work or personal email.',
      },
    });
  }

  const db = getPool();
  let isStaff = false;

  if (db) {
    try {
      const userRes = await db.query(
        `SELECT id, email, role, password_hash, is_active FROM users 
         WHERE LOWER(email) = LOWER($1) 
           AND role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')`,
        [email]
      );
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        if (u.is_active !== false && u.password_hash) {
          isStaff = true;
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('is_active')) {
        const fallback = await db.query(
          `SELECT id, email, role, password_hash FROM users 
           WHERE LOWER(email) = LOWER($1) 
             AND role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'TECHNICIAN')`,
          [email]
        );
        if (fallback.rows.length > 0 && fallback.rows[0].password_hash) {
          isStaff = true;
        }
      } else {
        console.error('Error during staff check:', err);
      }
    }
  }

  if (isStaff) {
    return res.status(200).json({
      success: true,
      next: 'password',
    });
  }

  // Consumer or new user -> Generate and send OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeH = hashOtp(code);

  if (db) {
    try {
      await db.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email, codeH]
      );
    } catch (dbErr) {
      console.error('Neon DB OTP insert error:', dbErr);
    }
  }

  try {
    await sendOtpEmail(email, code);
  } catch (emailErr: any) {
    console.error('Brevo email dispatch error in identify:', emailErr);
    if (emailErr instanceof HttpError) {
      return res.status(emailErr.statusCode).json({
        error: { code: emailErr.code, message: emailErr.message },
      });
    }
  }

  return res.status(200).json({
    success: true,
    next: 'otp',
    message: 'One-time verification code dispatched to your email.',
  });
}

/**
 * POST /auth/staff-login
 * Authenticates staff with email & password, sets ff_session cookie.
 */
export async function staffLoginHandler(req: any, res: any) {
  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const rememberMe = Boolean(body.rememberMe);

  if (!email || !password) {
    return res.status(400).json({
      error: { code: 'MISSING_CREDENTIALS', message: 'Email and password are required.' },
    });
  }

  const db = getPool();
  if (!db) {
    return res.status(500).json({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection is unavailable.' },
    });
  }

  try {
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

    if (userRow.is_active === false) {
      return res.status(401).json({
        error: { code: 'ACCOUNT_DEACTIVATED', message: 'This staff account has been deactivated.' },
      });
    }

    const hash = userRow.password_hash;
    if (!hash) {
      return res.status(401).json({
        error: { code: 'NO_PASSWORD', message: 'Password has not been set for this account. Contact an administrator.' },
      });
    }

    const isMatch = bcrypt.compareSync(password, hash);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    // Fetch assigned stores from store_admins
    const saRes = await db.query(
      `SELECT store_id FROM store_admins WHERE user_id = $1`,
      [userRow.id]
    );
    const storeIds: string[] = saRes.rows.map((r: any) => r.store_id);
    if (userRow.store_id && !storeIds.includes(userRow.store_id)) {
      storeIds.push(userRow.store_id);
    }

    const userPayload = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      storeId: userRow.store_id || (storeIds[0] || null),
      storeIds,
    };

    // Issue signed JWT cookie
    const token = issue(res, userPayload, rememberMe);
    const redirectTo = getRedirectForRole(userRow.role);

    return res.status(200).json({
      success: true,
      token, // Also returned in body for non-browser HTTP clients
      user: userPayload,
      redirectTo,
    });
  } catch (err: any) {
    console.error('Staff Login Error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Staff authentication error.' },
    });
  }
}

/**
 * POST /auth/verify-otp
 * Verifies consumer/staff login OTP, sets ff_session cookie.
 */
export async function verifyOtpHandler(req: any, res: any) {
  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  const rememberMe = Boolean(body.rememberMe);

  if (!email || !code || code.length !== 6) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Valid email and 6-digit code are required.' },
    });
  }

  const db = getPool();
  if (!db) {
    return res.status(500).json({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database pool unavailable.' },
    });
  }

  try {
    const codeH = hashOtp(code);
    const otpCheck = await db.query(
      `SELECT * FROM otp_codes 
       WHERE email = $1 
         AND purpose = 'LOGIN' 
         AND verified = false 
         AND expires_at > NOW() 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [email]
    );

    if (otpCheck.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'OTP_EXPIRED', message: 'Verification code has expired or was not found. Please request a new code.' },
      });
    }

    const latestOtp = otpCheck.rows[0];
    if (latestOtp.attempts >= 5) {
      return res.status(400).json({
        error: { code: 'OTP_MAX_ATTEMPTS_EXCEEDED', message: 'Maximum verification attempts exceeded. Please request a new code.' },
      });
    }

    const isValid = latestOtp.code_hash === codeH;

    if (!isValid) {
      await db.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [latestOtp.id]);
      const remaining = 5 - (latestOtp.attempts + 1);
      return res.status(401).json({
        error: {
          code: 'OTP_INVALID',
          message: remaining > 0
            ? `Invalid code. ${remaining} attempt(s) remaining.`
            : 'Maximum verification attempts exceeded. Please request a new code.',
        },
      });
    }

    // Mark OTP as verified
    await db.query(`UPDATE otp_codes SET verified = true WHERE id = $1`, [latestOtp.id]);

    // Upsert user in Neon DB
    let userRow: any;
    const existing = await db.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);

    if (existing.rows.length > 0) {
      userRow = existing.rows[0];
      if (userRow.is_active === false) {
        return res.status(401).json({
          error: { code: 'ACCOUNT_DEACTIVATED', message: 'Your account has been deactivated.' },
        });
      }
      if (!userRow.email_verified) {
        await db.query(`UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1`, [userRow.id]);
        userRow.email_verified = true;
      }
    } else {
      const defaultName = email.split('@')[0];
      const insertRes = await db.query(
        `INSERT INTO users (id, name, email, role, email_verified, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'CONSUMER', true, NOW(), NOW()) RETURNING *`,
        [defaultName, email]
      );
      userRow = insertRes.rows[0];
    }

    // Check assigned stores if staff
    let storeIds: string[] = [];
    if (userRow.role !== 'CONSUMER') {
      const saRes = await db.query(`SELECT store_id FROM store_admins WHERE user_id = $1`, [userRow.id]);
      storeIds = saRes.rows.map((r: any) => r.store_id);
      if (userRow.store_id && !storeIds.includes(userRow.store_id)) {
        storeIds.push(userRow.store_id);
      }
    }

    const userPayload = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      phone: userRow.phone,
      role: userRow.role,
      avatarUrl: userRow.avatar_url,
      storeId: userRow.store_id || (storeIds[0] || null),
      storeIds,
    };

    const token = issue(res, userPayload, rememberMe);
    const redirectTo = getRedirectForRole(userRow.role);

    return res.status(200).json({
      success: true,
      token,
      user: userPayload,
      redirectTo,
    });
  } catch (err: any) {
    console.error('Verify OTP Error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message || 'OTP verification error.' },
    });
  }
}

/**
 * GET /auth/me
 * Returns current authenticated user profile.
 */
export async function meHandler(req: any, res: any) {
  try {
    const session = await requireAuth(req);
    const db = getPool();

    let userProfile: {
      id: string;
      email: string;
      role: any;
      name?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      storeId?: string | null;
      storeIds?: string[];
    } = {
      id: session.sub,
      email: session.email,
      role: session.role,
      name: session.name,
      storeId: session.storeId,
      storeIds: session.storeIds || [],
    };

    if (db) {
      const uRes = await db.query(
        `SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar_url as "avatarUrl", 
                u.store_id as "storeId", u.created_at as "createdAt", u.updated_at as "updatedAt",
                COALESCE((SELECT json_agg(sa.store_id) FROM store_admins sa WHERE sa.user_id = u.id), '[]'::json) as "assignedStoreIds"
         FROM users u WHERE u.id = $1`,
        [session.sub]
      );
      if (uRes.rows.length > 0) {
        const row = uRes.rows[0];
        const assignedIds = Array.isArray(row.assignedStoreIds) ? row.assignedStoreIds : [];
        if (row.storeId && !assignedIds.includes(row.storeId)) {
          assignedIds.push(row.storeId);
        }
        userProfile = {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: row.role,
          avatarUrl: row.avatarUrl,
          storeId: row.storeId || (assignedIds[0] || null),
          storeIds: assignedIds,
        };
      }
    }

    return res.status(200).json({
      success: true,
      user: userProfile,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Authentication error' } });
  }
}

/**
 * POST /auth/logout
 * Clears the session cookie.
 */
export async function logoutHandler(_req: any, res: any) {
  clearSession(res);
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * POST /auth/send-otp
 * Direct OTP sending route for backwards compatibility.
 */
export async function sendOtpHandler(req: any, res: any) {
  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: { code: 'INVALID_EMAIL', message: 'A valid email is required.' },
    });
  }

  if (isDisposableEmail(email)) {
    return res.status(400).json({
      error: {
        code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
        message: 'Disposable email domains are not allowed. Please enter your work or personal email.',
      },
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeH = hashOtp(code);

  const db = getPool();
  if (db) {
    try {
      await db.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email, codeH]
      );
    } catch (dbErr) {
      console.error('Neon DB OTP insert error:', dbErr);
    }
  }

  try {
    const result = await sendOtpEmail(email, code);
    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email successfully.',
      messageId: result.messageId,
    });
  } catch (err: any) {
    console.error('Brevo OTP send error:', err);
    if (err instanceof HttpError) {
      return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    }
    return res.status(500).json({ error: { message: err.message || 'Failed to send OTP.' } });
  }
}
