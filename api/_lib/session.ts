import jwt from 'jsonwebtoken';
import { getJwtSecret, isProduction } from './env.ts';
import { getPool } from './db.ts';
import { HttpError, SessionPayload, UserRole } from './authz.ts';

export const SESSION_COOKIE_NAME = 'ff_session';

export interface UserSessionInput {
  id: string;
  email: string;
  role: string;
  name?: string;
  storeId?: string | null;
  storeIds?: string[];
}

/**
 * Parses cookies from cookie header string.
 */
export function parseCookies(header?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!header) return list;

  const pairs = header.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      list[key] = decodeURIComponent(val);
    }
  }

  return list;
}

/**
 * Extracts raw session token from request cookies or Authorization header.
 */
export function extractToken(req: any): string | null {
  if (!req) return null;

  // 1. Check Cookie header
  const cookieHeader = req.headers?.cookie || (typeof req.getHeader === 'function' ? req.getHeader('cookie') : '');
  const cookies = parseCookies(cookieHeader);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers?.authorization || (typeof req.getHeader === 'function' ? req.getHeader('authorization') : '');
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Issues an HS256 signed JWT session token and sets it in the Set-Cookie header.
 */
export function issue(res: any, user: UserSessionInput, remember?: boolean): string {
  const secret = getJwtSecret();
  const isProd = isProduction();

  const payload: SessionPayload = {
    sub: user.id,
    email: user.email.toLowerCase().trim(),
    role: user.role as UserRole,
    name: user.name,
    storeId: user.storeId || null,
    storeIds: user.storeIds || [],
  };

  const expiresIn = remember ? '7d' : '12h';
  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn,
  });

  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProd) {
    cookieParts.push('Secure');
  }

  if (remember) {
    cookieParts.push('Max-Age=604800'); // 7 days in seconds
  }

  const cookieStr = cookieParts.join('; ');

  // Append or set Set-Cookie header
  const existing = res.getHeader ? res.getHeader('Set-Cookie') : res.headers?.['set-cookie'];
  if (existing) {
    if (Array.isArray(existing)) {
      res.setHeader('Set-Cookie', [...existing, cookieStr]);
    } else {
      res.setHeader('Set-Cookie', [existing, cookieStr]);
    }
  } else {
    res.setHeader('Set-Cookie', cookieStr);
  }

  return token;
}

/**
 * Clears the ff_session cookie.
 */
export function clearSession(res: any): void {
  const isProd = isProduction();
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProd) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

/**
 * Validates the session from req. Returns SessionPayload or null without throwing.
 */
export async function getSession(req: any): Promise<SessionPayload | null> {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as SessionPayload;

    if (!decoded || !decoded.sub) {
      return null;
    }

    // Verify active user in Neon DB
    const db = getPool();
    if (db) {
      try {
        const userRes = await db.query(
          `SELECT id, role, is_active FROM users WHERE id = $1`,
          [decoded.sub]
        );
        if (userRes.rows.length === 0) {
          return null;
        }
        if (userRes.rows[0].is_active === false) {
          return null;
        }
      } catch (dbErr: any) {
        // If is_active column doesn't exist yet before 0002 migration, check user existence
        if (dbErr?.message?.includes('is_active')) {
          const fallbackRes = await db.query(
            `SELECT id, role FROM users WHERE id = $1`,
            [decoded.sub]
          );
          if (fallbackRes.rows.length === 0) {
            return null;
          }
        } else {
          console.warn('Neon DB session verification error:', dbErr);
        }
      }
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Requires an authenticated user session.
 * Throws HttpError(401) if missing, invalid, or expired.
 */
export async function requireAuth(req: any): Promise<SessionPayload> {
  const token = extractToken(req);
  if (!token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Authentication session required.');
  }

  let decoded: SessionPayload;
  try {
    const secret = getJwtSecret();
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as SessionPayload;
  } catch (err: any) {
    throw new HttpError(401, 'INVALID_TOKEN', 'Session token is invalid or expired.');
  }

  if (!decoded || !decoded.sub) {
    throw new HttpError(401, 'INVALID_TOKEN', 'Session token payload is invalid.');
  }

  // Database verification
  const db = getPool();
  if (db) {
    try {
      const userRes = await db.query(
        `SELECT id, role, is_active FROM users WHERE id = $1`,
        [decoded.sub]
      );
      if (userRes.rows.length === 0) {
        throw new HttpError(401, 'USER_NOT_FOUND', 'User account does not exist.');
      }
      if (userRes.rows[0].is_active === false) {
        throw new HttpError(401, 'ACCOUNT_DEACTIVATED', 'User account is deactivated.');
      }
    } catch (dbErr: any) {
      if (dbErr instanceof HttpError) throw dbErr;
      if (dbErr?.message?.includes('is_active')) {
        const fallbackRes = await db.query(
          `SELECT id, role FROM users WHERE id = $1`,
          [decoded.sub]
        );
        if (fallbackRes.rows.length === 0) {
          throw new HttpError(401, 'USER_NOT_FOUND', 'User account does not exist.');
        }
      } else {
        console.warn('Neon DB user active check warning:', dbErr);
      }
    }
  }

  return decoded;
}
