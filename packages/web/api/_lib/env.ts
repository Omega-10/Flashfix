/**
 * Environment configuration and secret resolver for Flashfix Serverless API.
 * Ensures fail-closed security in production and safe developer defaults in local development.
 */

const DEV_LOCAL_JWT_SECRET = 'flashfix_local_development_jwt_secret_32bytes_min';

/**
 * Strips whitespace and accidental surrounding single or double quotes.
 */
export function sanitizeEnvValue(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Checks whether an environment variable represents a truthy boolean value.
 * Handles 'true', '1', 'yes', 'on' (case-insensitive, whitespace and quote sanitized).
 */
export function isEnvTruthy(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const sanitized = sanitizeEnvValue(val).toLowerCase();
  return sanitized === 'true' || sanitized === '1' || sanitized === 'yes' || sanitized === 'on';
}

/**
 * Returns true if running in production environment.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Resolves JWT secret.
 * In production: MUST be provided via JWT_SECRET (minimum 32 characters), otherwise throws fatal error (fail-closed).
 * In development: falls back to DEV_LOCAL_JWT_SECRET if unset.
 */
export function getJwtSecret(): string {
  const secret = sanitizeEnvValue(process.env.JWT_SECRET);
  if (secret && secret.length >= 32) {
    return secret;
  }

  if (isProduction()) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing or insecure in production (minimum 32 characters required).');
  }

  return DEV_LOCAL_JWT_SECRET;
}

/**
 * Resolves Neon PostgreSQL Database URL.
 */
export function getDbUrl(): string {
  return sanitizeEnvValue(process.env.DATABASE_URL);
}

/**
 * Requires an environment variable to be present and non-empty.
 * Throws an Error if missing.
 */
export function requireEnv(name: string): string {
  const value = sanitizeEnvValue(process.env[name]);
  if (!value) {
    throw new Error(`Environment variable "${name}" is required.`);
  }
  return value;
}
