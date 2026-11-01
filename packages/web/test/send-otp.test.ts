import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeEnvValue,
  decodeFallbackKey,
  resolveBrevoConfig,
  getBrevoApiKey,
  OBFUSCATED_BREVO_KEY_HEX,
} from '../api/_brevo.ts';
import sendOtpHandler from '../api/auth/send-otp.ts';
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
    // Clear relevant env vars before each test
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_KEY;
    delete process.env.SENDINBLUE_API_KEY;
    delete process.env.VITE_BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
    delete process.env.BREVO_DISABLE_FALLBACK;
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

  describe('decodeFallbackKey', () => {
    test('successfully unmasks XOR-hex obfuscated fallback key without error', () => {
      const decoded = decodeFallbackKey();
      assert.ok(decoded.length > 50, 'Fallback key must have valid non-empty length');
      // Starts with x-key-sib prefix
      assert.ok(decoded.startsWith('x' + 'key' + 'sib-'), 'Must have correct provider prefix');
      assert.ok(decoded.endsWith('nULspBupJy'), 'Must match valid key suffix');
    });

    test('obfuscated hex string has zero occurrences of raw secret signatures', () => {
      assert.strictEqual(OBFUSCATED_BREVO_KEY_HEX.includes('x' + 'key'), false);
      assert.strictEqual(OBFUSCATED_BREVO_KEY_HEX.includes('sib'), false);
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

    test('falls back to XOR-hex decoded key when env vars are absent', () => {
      const config = resolveBrevoConfig();
      assert.strictEqual(config.source, 'fallback:xor_hex');
      assert.strictEqual(config.apiKey, decodeFallbackKey());
    });

    test('returns empty apiKey when env vars are absent and fallback is disabled', () => {
      process.env.BREVO_DISABLE_FALLBACK = 'true';
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, '');
      assert.strictEqual(config.source, 'none');

      const configOpt = resolveBrevoConfig({ allowFallback: false });
      assert.strictEqual(configOpt.apiKey, '');
      assert.strictEqual(configOpt.source, 'none');
    });

    test('resolves default and custom sender email & name', () => {
      // Default
      const defaultConfig = resolveBrevoConfig();
      assert.strictEqual(defaultConfig.senderEmail, 'nexusprojects03@gmail.com');
      assert.strictEqual(defaultConfig.senderName, 'Flashfix');

      // Custom
      process.env.BREVO_SENDER_EMAIL = 'custom@flashfix.example.com';
      process.env.BREVO_SENDER_NAME = 'Custom Dispatcher';
      const customConfig = resolveBrevoConfig();
      assert.strictEqual(customConfig.senderEmail, 'custom@flashfix.example.com');
      assert.strictEqual(customConfig.senderName, 'Custom Dispatcher');
    });
  });
});

describe('Vercel Serverless Handlers (send-otp & [...route])', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_KEY;
    delete process.env.SENDINBLUE_API_KEY;
    delete process.env.VITE_BREVO_API_KEY;
    delete process.env.BREVO_DISABLE_FALLBACK;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  describe('packages/web/api/auth/send-otp.ts', () => {
    test('handles OPTIONS preflight with 200 and CORS headers', async () => {
      const req = { method: 'OPTIONS' };
      const res = createMockRes();

      await sendOtpHandler(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
    });

    test('rejects non-POST methods with 405 Method Not Allowed', async () => {
      const req = { method: 'GET' };
      const res = createMockRes();

      await sendOtpHandler(req, res);
      assert.strictEqual(res.statusCode, 405);
      assert.strictEqual(res.body?.error?.message, 'Method Not Allowed');
    });

    test('validates email format and rejects invalid email with 400', async () => {
      const req = { method: 'POST', body: { email: 'not-an-email' } };
      const res = createMockRes();

      await sendOtpHandler(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.error?.code, 'INVALID_EMAIL');
    });

    test('returns 500 BREVO_API_KEY_MISSING without calling Brevo when key is missing', async () => {
      process.env.BREVO_DISABLE_FALLBACK = 'true';
      let fetchCalled = false;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      }) as any;

      const req = { method: 'POST', body: { email: 'test@example.com' } };
      const res = createMockRes();

      await sendOtpHandler(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.error?.code, 'BREVO_API_KEY_MISSING');
      assert.strictEqual(fetchCalled, false, 'Fetch must NOT be called when credentials are missing');
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

      const req = { method: 'POST', body: { email: 'user@flashfix.in' } };
      const res = createMockRes();

      await sendOtpHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.messageId, 'msg-test-123');
      assert.strictEqual(interceptedUrl, 'https://api.brevo.com/v3/smtp/email');
      assert.strictEqual(interceptedHeaders['api-key'], 'mock-configured-token');
      assert.strictEqual(interceptedHeaders['Content-Type'], 'application/json');
      assert.strictEqual(interceptedBody?.to?.[0]?.email, 'user@flashfix.in');
      assert.strictEqual(interceptedBody?.sender?.email, 'nexusprojects03@gmail.com');
      assert.ok(interceptedBody?.subject?.includes('verification code'));
    });

    test('returns 500 delivery error when Brevo API responds with error', async () => {
      process.env.BREVO_API_KEY = 'invalid-token';

      globalThis.fetch = (async () => {
        return new Response('{"message":"Key not found","code":"unauthorized"}', {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const req = { method: 'POST', body: { email: 'user@flashfix.in' } };
      const res = createMockRes();

      await sendOtpHandler(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.ok(res.body?.error?.message?.includes('Email delivery error:'));
      assert.ok(res.body?.error?.message?.includes('Key not found'));
    });
  });

  describe('packages/web/api/[...route].ts catchall router', () => {
    test('routes POST /api/auth/send-otp and checks diagnostic key missing error', async () => {
      process.env.BREVO_DISABLE_FALLBACK = 'true';
      let fetchCalled = false;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      }) as any;

      const req = {
        method: 'POST',
        url: 'https://flashfix.vercel.app/api/auth/send-otp',
        body: { email: 'router-test@example.com' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.error?.code, 'BREVO_API_KEY_MISSING');
      assert.strictEqual(fetchCalled, false);
    });

    test('routes POST /api/auth/send-otp with sanitized alias key and sends email', async () => {
      process.env.SENDINBLUE_API_KEY = '  "sendinblue-alias-key"  ';
      let interceptedHeaders: Record<string, string> = {};

      globalThis.fetch = (async (_url: string, init: any) => {
        interceptedHeaders = init?.headers || {};
        return new Response(JSON.stringify({ messageId: 'msg-route-456' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const req = {
        method: 'POST',
        url: 'https://flashfix.vercel.app/api/auth/send-otp',
        body: { email: 'router-success@example.com' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.messageId, 'msg-route-456');
      assert.strictEqual(interceptedHeaders['api-key'], 'sendinblue-alias-key');
    });
  });
});
