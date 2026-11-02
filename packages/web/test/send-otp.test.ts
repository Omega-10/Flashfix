import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeEnvValue,
  resolveBrevoConfig,
  getBrevoApiKey,
} from '../api/_brevo.ts';
import catchallHandler from '../api/[...route].ts';

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  setHeader: (k: string, v: string) => void;
  status: (code: number) => MockRes;
  json: (data: any) => MockRes;
  end: () => MockRes;
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

describe('Brevo Authentication & Helper Utilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_KEY;
    delete process.env.SENDINBLUE_API_KEY;
    delete process.env.VITE_BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('sanitizeEnvValue', () => {
    test('returns empty string for non-string types', () => {
      assert.strictEqual(sanitizeEnvValue(undefined), '');
      assert.strictEqual(sanitizeEnvValue(null), '');
      assert.strictEqual(sanitizeEnvValue(12345), '');
      assert.strictEqual(sanitizeEnvValue({}), '');
    });

    test('trims leading and trailing whitespace', () => {
      assert.strictEqual(sanitizeEnvValue('  my-token-val  \n\t'), 'my-token-val');
    });

    test('strips accidental wrapping single or double quotes', () => {
      assert.strictEqual(sanitizeEnvValue('"quoted-api-token"'), 'quoted-api-token');
      assert.strictEqual(sanitizeEnvValue("'single-quoted-token'"), 'single-quoted-token');
      assert.strictEqual(sanitizeEnvValue('  "  spaced-and-quoted  "  '), 'spaced-and-quoted');
    });
  });

  describe('resolveBrevoConfig & getBrevoApiKey', () => {
    test('resolves primary BREVO_API_KEY and sanitizes quotes', () => {
      process.env.BREVO_API_KEY = ' "custom-brevo-key-123" ';
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'custom-brevo-key-123');
      assert.strictEqual(config.source, 'env:BREVO_API_KEY');
      assert.strictEqual(getBrevoApiKey(), 'custom-brevo-key-123');
    });

    test('resolves alias BREVO_KEY when primary is absent', () => {
      process.env.BREVO_KEY = "'brevo-key-alias-456'";
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'brevo-key-alias-456');
      assert.strictEqual(config.source, 'env:BREVO_KEY');
    });

    test('resolves alias SENDINBLUE_API_KEY when earlier are absent', () => {
      process.env.SENDINBLUE_API_KEY = 'sendinblue-legacy-key-789';
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'sendinblue-legacy-key-789');
      assert.strictEqual(config.source, 'env:SENDINBLUE_API_KEY');
    });

    test('resolves alias VITE_BREVO_API_KEY when earlier are absent', () => {
      process.env.VITE_BREVO_API_KEY = 'vite-prefixed-key-abc';
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'vite-prefixed-key-abc');
      assert.strictEqual(config.source, 'env:VITE_BREVO_API_KEY');
    });

    test('returns empty apiKey when all env vars are absent (zero hardcoded fallback)', () => {
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, '');
      assert.strictEqual(config.source, 'none');
    });

    test('resolves default and custom sender email & name', () => {
      const defaultConfig = resolveBrevoConfig();
      assert.strictEqual(defaultConfig.senderEmail, 'nexusprojects03@gmail.com');
      assert.strictEqual(defaultConfig.senderName, 'Flashfix');

      process.env.BREVO_SENDER_EMAIL = 'custom@flashfix.example.com';
      process.env.BREVO_SENDER_NAME = 'Custom Dispatcher';
      const customConfig = resolveBrevoConfig();
      assert.strictEqual(customConfig.senderEmail, 'custom@flashfix.example.com');
      assert.strictEqual(customConfig.senderName, 'Custom Dispatcher');
    });
  });
});

describe('Vercel Serverless Catch-All Handler (POST /api/auth/send-otp)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_KEY;
    delete process.env.SENDINBLUE_API_KEY;
    delete process.env.VITE_BREVO_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  test('handles OPTIONS preflight with 200 and CORS headers', async () => {
    const req = { method: 'OPTIONS' };
    const res = createMockRes();

    await catchallHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], '*');
  });

  test('validates email format and rejects invalid email with 400', async () => {
    const req = { method: 'POST', query: { route: ['auth', 'send-otp'] }, body: { email: 'not-an-email' } };
    const res = createMockRes();

    await catchallHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_EMAIL');
  });

  test('rejects disposable email with 400 DISPOSABLE_EMAIL_NOT_ALLOWED', async () => {
    const req = { method: 'POST', query: { route: ['auth', 'send-otp'] }, body: { email: 'user@mailinator.com' } };
    const res = createMockRes();

    await catchallHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'DISPOSABLE_EMAIL_NOT_ALLOWED');
  });

  test('sends request to Brevo API with valid api-key header and body', async () => {
    process.env.BREVO_API_KEY = ' "mock-configured-token" ';
    let interceptedUrl = '';
    let interceptedHeaders: Record<string, string> = {};
    let interceptedBody: any = null;

    globalThis.fetch = (async (url: string, init: any) => {
      interceptedUrl = url;
      interceptedHeaders = init?.headers || {};
      interceptedBody = JSON.parse(init?.body || '{}');
      return new Response(JSON.stringify({ messageId: 'msg-test-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const req = { method: 'POST', query: { route: ['auth', 'send-otp'] }, body: { email: 'user@flashfix.in' } };
    const res = createMockRes();

    await catchallHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.messageId, 'msg-test-123');
    assert.strictEqual(interceptedUrl, 'https://api.brevo.com/v3/smtp/email');
    assert.strictEqual(interceptedHeaders['api-key'], 'mock-configured-token');
    assert.strictEqual(interceptedHeaders['Content-Type'], 'application/json');
    assert.strictEqual(interceptedBody?.to?.[0]?.email, 'user@flashfix.in');
  });
});
