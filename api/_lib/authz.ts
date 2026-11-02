export type UserRole = 'CONSUMER' | 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN' | 'TECHNICIAN';

export interface SessionPayload {
  sub: string;             // User UUID
  email: string;           // Normalized lowercase email
  role: UserRole;          // Role enum
  name?: string;
  storeId?: string | null; // Primary assigned store
  storeIds?: string[];     // Authorized store scopes
  iat?: number;
  exp?: number;
}

/**
 * Standard HTTP Error with status code and error code.
 */
export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Enforces that the current authenticated session has at least one of the required roles.
 * SUPER_ADMIN is granted universal access across all endpoints.
 */
export function requireRole(session: SessionPayload, ...allowed: UserRole[]): void {
  if (session.role === 'SUPER_ADMIN') {
    return;
  }

  if (!allowed.includes(session.role)) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `Role "${session.role}" lacks permission for this action. Allowed: ${allowed.join(', ')}.`
    );
  }
}

/**
 * Enforces that the current session has access to the specified store.
 * SUPER_ADMIN bypasses store scoping.
 */
export function requireStoreAccess(session: SessionPayload, storeId: string): void {
  if (session.role === 'SUPER_ADMIN') {
    return;
  }

  const authorized =
    session.storeId === storeId ||
    (Array.isArray(session.storeIds) && session.storeIds.includes(storeId));

  if (!authorized) {
    throw new HttpError(403, 'FORBIDDEN', `Access to store "${storeId}" denied.`);
  }
}
