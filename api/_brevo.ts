/**
 * api/_brevo.ts
 *
 * Centralized Brevo email configuration and authentication resolver for Vercel Serverless Functions.
 * Reads strictly from environment variables without hardcoded or obfuscated fallback keys.
 */

export interface BrevoResolvedConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  source: string;
}

export interface ResolveBrevoOptions {
  allowFallback?: boolean;
}

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
 * Dynamically resolves Brevo API key, sender email, and sender name per-request.
 * Checks environment variable aliases:
 * 1. BREVO_API_KEY
 * 2. BREVO_KEY
 * 3. SENDINBLUE_API_KEY
 * 4. VITE_BREVO_API_KEY
 */
export function resolveBrevoConfig(_options: ResolveBrevoOptions = {}): BrevoResolvedConfig {
  const aliases: Array<[string, string | undefined]> = [
    ['BREVO_API_KEY', process.env.BREVO_API_KEY],
    ['BREVO_KEY', process.env.BREVO_KEY],
    ['SENDINBLUE_API_KEY', process.env.SENDINBLUE_API_KEY],
    ['VITE_BREVO_API_KEY', process.env.VITE_BREVO_API_KEY],
  ];

  let apiKey = '';
  let source = 'none';

  for (const [name, rawVal] of aliases) {
    const cleaned = sanitizeEnvValue(rawVal);
    if (cleaned) {
      apiKey = cleaned;
      source = `env:${name}`;
      break;
    }
  }

  const senderEmail =
    sanitizeEnvValue(process.env.BREVO_SENDER_EMAIL) ||
    sanitizeEnvValue(process.env.SENDER_EMAIL) ||
    sanitizeEnvValue(process.env.VITE_BREVO_SENDER_EMAIL) ||
    'nexusprojects03@gmail.com';

  const senderName =
    sanitizeEnvValue(process.env.BREVO_SENDER_NAME) ||
    sanitizeEnvValue(process.env.SENDER_NAME) ||
    sanitizeEnvValue(process.env.VITE_BREVO_SENDER_NAME) ||
    'Flashfix';

  return {
    apiKey,
    senderEmail,
    senderName,
    source,
  };
}

export function getBrevoApiKey(options?: ResolveBrevoOptions): string {
  return resolveBrevoConfig(options).apiKey;
}
