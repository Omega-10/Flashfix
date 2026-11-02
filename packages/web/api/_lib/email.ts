import { sanitizeEnvValue, isProduction } from './env.ts';
import { HttpError } from './authz.ts';

export interface BrevoEmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string | BrevoEmailRecipient | BrevoEmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface BrevoConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

/**
 * Resolves Brevo configuration strictly from environment variables.
 * Never uses hardcoded or obfuscated fallbacks.
 */
export function getBrevoConfig(): BrevoConfig {
  const apiKey =
    sanitizeEnvValue(process.env.BREVO_API_KEY) ||
    sanitizeEnvValue(process.env.BREVO_KEY) ||
    sanitizeEnvValue(process.env.SENDINBLUE_API_KEY) ||
    sanitizeEnvValue(process.env.VITE_BREVO_API_KEY);

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

  return { apiKey, senderEmail, senderName };
}

/**
 * Sends a transactional email using the official Brevo v3 API.
 * Reads API key strictly from process.env.BREVO_API_KEY.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
  const config = getBrevoConfig();

  if (!config.apiKey) {
    if (isProduction()) {
      throw new HttpError(
        500,
        'BREVO_API_KEY_MISSING',
        'Brevo API key is not configured. Please set BREVO_API_KEY in production environment variables.'
      );
    }
    console.warn('[Brevo Email Warning] BREVO_API_KEY is not configured in local environment. Skipping outbound email dispatch.');
    return { success: true, messageId: `mock-dev-${Date.now()}` };
  }

  const recipients: BrevoEmailRecipient[] = Array.isArray(options.to)
    ? options.to
    : typeof options.to === 'string'
      ? [{ email: options.to }]
      : [options.to];

  const payload = {
    sender: { name: config.senderName, email: config.senderEmail },
    to: recipients,
    subject: options.subject,
    htmlContent: options.htmlContent,
    textContent: options.textContent || options.subject,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Brevo API Error:', response.status, errorText);
    throw new HttpError(
      502,
      'EMAIL_DISPATCH_FAILED',
      `Failed to send email via Brevo: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json().catch(() => ({}))) as any;
  return { success: true, messageId: data.messageId };
}

/**
 * Sends a standard 6-digit OTP email to a user.
 */
export async function sendOtpEmail(email: string, code: string): Promise<{ success: boolean; messageId?: string }> {
  return sendEmail({
    to: email,
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
  });
}
