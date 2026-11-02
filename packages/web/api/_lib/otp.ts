import crypto from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { getJwtSecret } from './env.ts';
import { HttpError } from './authz.ts';
import { getPool } from './db.ts';

export const OTP_PURPOSES = ['LOGIN', 'PICKUP', 'CUSTODY'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const MAX_OTP_ATTEMPTS = 5;
export const OTP_EXPIRY_MINUTES = 15;

/**
 * Dynamic RFC 4226 HMAC derivation bound to booking ID, purpose, and unique row UUID.
 */
export function deriveOtp(
  secret: string,
  bookingId: string,
  purpose: string,
  rowId: string
): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${bookingId}:${purpose}:${rowId}`);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
}

/**
 * Computes SHA-256 hash of OTP code for secure storage in the database.
 */
export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Creates and stores a new dynamic HMAC OTP record in the otp_codes table.
 */
export async function createOtpRecord(
  clientOrPool: Pool | PoolClient,
  bookingId: string,
  purpose: OtpPurpose,
  email: string,
  secret?: string
): Promise<{ rowId: string; code: string }> {
  const rowId = crypto.randomUUID();
  const jwtSecret = secret || getJwtSecret();
  const code = deriveOtp(jwtSecret, bookingId, purpose, rowId);
  const codeHash = hashOtp(code);

  await clientOrPool.query(
    `INSERT INTO otp_codes (
       id, booking_id, email, code_hash, purpose, expires_at, attempts, verified, created_at
     ) VALUES (
       $1, $2, $3, $4, $5, NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes', 0, false, NOW()
     )`,
    [rowId, bookingId, email.toLowerCase().trim(), codeHash, purpose]
  );

  return { rowId, code };
}

/**
 * Verifies an OTP attempt with attempt counting and 5-attempt brute-force lockout.
 * Marks verified = true in the database upon successful match.
 */
export async function verifyOtpAttempt(
  clientOrPool: Pool | PoolClient,
  bookingId: string,
  purpose: 'PICKUP' | 'CUSTODY',
  submittedCode: string
): Promise<{ success: boolean; rowId: string }> {
  const cleanCode = (submittedCode || '').trim();
  if (!cleanCode || cleanCode.length !== 6) {
    throw new HttpError(400, 'VALIDATION_ERROR', '6-digit OTP code required.');
  }

  // Fetch the latest unverified OTP row for this booking and purpose
  const res = await clientOrPool.query(
    `SELECT * FROM otp_codes 
     WHERE booking_id = $1 AND purpose = $2 AND verified = false 
     ORDER BY created_at DESC LIMIT 1`,
    [bookingId, purpose]
  );

  if (res.rows.length === 0) {
    throw new HttpError(400, 'OTP_EXPIRED', 'No active verification code found. Please request a new OTP.');
  }

  const record = res.rows[0];

  // Check if locked out (5 attempts)
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new HttpError(
      429,
      'OTP_MAX_ATTEMPTS_EXCEEDED',
      'Maximum verification attempts exceeded. Please request a new code.'
    );
  }

  // Check expiration
  const expiresAt = new Date(record.expires_at).getTime();
  if (Date.now() > expiresAt) {
    throw new HttpError(
      400,
      'OTP_EXPIRED',
      'Verification code has expired. Please request a new OTP.'
    );
  }

  // Compare submitted hash with stored hash using constant-time comparison
  const submittedHash = hashOtp(cleanCode);
  const submittedBuf = Buffer.from(submittedHash, 'hex');
  const recordBuf = Buffer.from(record.code_hash, 'hex');
  const isMatch =
    submittedBuf.length === recordBuf.length &&
    crypto.timingSafeEqual(submittedBuf, recordBuf);

  if (!isMatch) {
    const newAttempts = record.attempts + 1;
    // Execute attempt counter update outside caller's transaction to ensure increment persists even if caller rolls back
    const pool = getPool();
    const dbExecutor = pool || clientOrPool;
    await dbExecutor.query(
      `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`,
      [record.id]
    );

    if (newAttempts >= MAX_OTP_ATTEMPTS) {
      throw new HttpError(
        429,
        'OTP_MAX_ATTEMPTS_EXCEEDED',
        'Maximum verification attempts exceeded. Please request a new code.'
      );
    }

    const remaining = MAX_OTP_ATTEMPTS - newAttempts;
    throw new HttpError(
      400,
      'OTP_INVALID',
      `Invalid verification code. ${remaining} attempt(s) remaining.`
    );
  }

  // Match: invalidate code in DB so it cannot be reused
  await clientOrPool.query(
    `UPDATE otp_codes SET verified = true WHERE id = $1`,
    [record.id]
  );

  return { success: true, rowId: record.id };
}

/**
 * Retrieves active pickup code for authenticated booking owner only.
 * Re-derives the code dynamically using row UUID and secret without storing plaintext.
 */
export async function getActivePickupCodeForOwner(
  clientOrPool: Pool | PoolClient,
  bookingId: string
): Promise<string | null> {
  const res = await clientOrPool.query(
    `SELECT id, expires_at FROM otp_codes 
     WHERE booking_id = $1 AND purpose = 'PICKUP' AND verified = false AND attempts < 5 AND expires_at > NOW() 
     ORDER BY created_at DESC LIMIT 1`,
    [bookingId]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const secret = getJwtSecret();
  return deriveOtp(secret, bookingId, 'PICKUP', row.id);
}
