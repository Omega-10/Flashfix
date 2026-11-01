import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeEnvValue,
  decodeFallbackKey,
  resolveBrevoConfig,
  getBrevoApiKey,
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

describe('Adversarial Brevo Key Resolution & Sanitization', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
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

  describe('Extreme Sanitization Inputs', () => {
    test('handles whitespace combinations (tabs, newlines, carriage returns, spaces)', () => {
      assert.strictEqual(sanitizeEnvValue("   \t\r\n token-value \n\r\t   "), "token-value");
      assert.strictEqual(sanitizeEnvValue("\t\t\n\n"), "");
      assert.strictEqual(sanitizeEnvValue("   "), "");
    });

    test('handles nested, repeated, and mixed surrounding quotes', () => {
      assert.strictEqual(sanitizeEnvValue('"""triple-quoted"""'), 'triple-quoted');
      assert.strictEqual(sanitizeEnvValue("'''single-tripled'''"), 'single-tripled');
      assert.strictEqual(sanitizeEnvValue('"\'mixed-quotes\'"'), 'mixed-quotes');
      assert.strictEqual(sanitizeEnvValue('\'"mixed-reversed"\''), 'mixed-reversed');
      assert.strictEqual(sanitizeEnvValue('   "   inner-spaced   "   '), 'inner-spaced');
      assert.strictEqual(sanitizeEnvValue('""'), '');
      assert.strictEqual(sanitizeEnvValue("''"), '');
      assert.strictEqual(sanitizeEnvValue('""""'), '');
    });

    test('preserves valid characters inside the key while trimming outer whitespace/quotes', () => {
      assert.strictEqual(sanitizeEnvValue(' "my-token_abc-DEF=456" '), 'my-token_abc-DEF=456');
    });

    test('handles non-string types safely', () => {
      assert.strictEqual(sanitizeEnvValue(null), '');
      assert.strictEqual(sanitizeEnvValue(undefined), '');
      assert.strictEqual(sanitizeEnvValue(42), '');
      assert.strictEqual(sanitizeEnvValue(true), '');
      assert.strictEqual(sanitizeEnvValue({ key: 'val' }), '');
      assert.strictEqual(sanitizeEnvValue([1, 2, 3]), '');
    });
  });

  describe('Key Precedence Across Combinations', () => {
    test('BREVO_API_KEY overrides all other aliases', () => {
      process.env.BREVO_API_KEY = 'key-primary';
      process.env.BREVO_KEY = 'key-alias-1';
      process.env.SENDINBLUE_API_KEY = 'key-alias-2';
      process.env.VITE_BREVO_API_KEY = 'key-alias-3';

      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'key-primary');
      assert.strictEqual(config.source, 'env:BREVO_API_KEY');
    });

    test('BREVO_KEY overrides SENDINBLUE_API_KEY and VITE_BREVO_API_KEY when primary is empty/whitespace', () => {
      process.env.BREVO_API_KEY = '   ';
      process.env.BREVO_KEY = 'key-alias-1';
      process.env.SENDINBLUE_API_KEY = 'key-alias-2';
      process.env.VITE_BREVO_API_KEY = 'key-alias-3';

      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'key-alias-1');
      assert.strictEqual(config.source, 'env:BREVO_KEY');
    });

    test('SENDINBLUE_API_KEY overrides VITE_BREVO_API_KEY when primary and alias-1 are quotes/empty', () => {
      process.env.BREVO_API_KEY = '""';
      process.env.BREVO_KEY = "''";
      process.env.SENDINBLUE_API_KEY = 'key-alias-2';
      process.env.VITE_BREVO_API_KEY = 'key-alias-3';

      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'key-alias-2');
      assert.strictEqual(config.source, 'env:SENDINBLUE_API_KEY');
    });

    test('VITE_BREVO_API_KEY resolves when all earlier aliases are empty or unset', () => {
      process.env.BREVO_API_KEY = '\n';
      process.env.VITE_BREVO_API_KEY = 'key-alias-3';

      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'key-alias-3');
      assert.strictEqual(config.source, 'env:VITE_BREVO_API_KEY');
    });

    test('Falls back to obfuscated fallback key when all env keys are absent or empty', () => {
      process.env.BREVO_API_KEY = '   ';
      process.env.BREVO_KEY = '""';
      process.env.SENDINBLUE_API_KEY = "  ''  ";
      process.env.VITE_BREVO_API_KEY = '\t\n';

      const config = resolveBrevoConfig();
      assert.strictEqual(config.source, 'fallback:xor_hex');
      assert.strictEqual(config.apiKey, decodeFallbackKey());
      assert.ok(config.apiKey.length > 50);
    });
  });

  describe('Adversarial Challenge: BREVO_DISABLE_FALLBACK variations', () => {
    test('BREVO_DISABLE_FALLBACK="true" disables fallback', () => {
      process.env.BREVO_DISABLE_FALLBACK = 'true';
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, '');
      assert.strictEqual(config.source, 'none');
    });

    test('DISPATCH REQUIREMENT: BREVO_DISABLE_FALLBACK=1 disables fallback', () => {
      process.env.BREVO_DISABLE_FALLBACK = '1';
      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, '', 'apiKey should be empty when BREVO_DISABLE_FALLBACK=1');
      assert.strictEqual(config.source, 'none', 'source should be none when BREVO_DISABLE_FALLBACK=1');
    });

    test('allowFallback option takes precedence over env var', () => {
      process.env.BREVO_DISABLE_FALLBACK = 'false';
      const configDisabled = resolveBrevoConfig({ allowFallback: false });
      assert.strictEqual(configDisabled.apiKey, '');

      process.env.BREVO_DISABLE_FALLBACK = 'true';
      const configEnabled = resolveBrevoConfig({ allowFallback: true });
      assert.strictEqual(configEnabled.apiKey, decodeFallbackKey());
    });
  });
});

describe('Adversarial Handler Execution: send-otp & [...route]', () => {
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
    test('CRITICAL: When all keys and fallback disabled (BREVO_DISABLE_FALLBACK=true), returns 500 BREVO_API_KEY_MISSING and fetch is NEVER called', async () => {
      process.env.BREVO_DISABLE_FALLBACK = 'true';
      let fetchCallCount = 0;
      globalThis.fetch = (async () => {
        fetchCallCount++;
        return new Response('{}', { status: 200 });
      }) as any;

      const req = { method: 'POST', body: { email: 'adversary@flashfix.in' } };
      const res = createMockRes();

      await sendOtpHandler(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.error?.code, 'BREVO_API_KEY_MISSING');
      assert.strictEqual(fetchCallCount, 0, 'Fetch must NEVER be invoked when credentials are missing');
    });

    test('DISPATCH REQUIREMENT: When BREVO_DISABLE_FALLBACK=1, returns 500 BREVO_API_KEY_MISSING and fetch is NEVER called', async () => {
      process.env.BREVO_DISABLE_FALLBACK = '1';
      let fetchCallCount = 0;
      globalThis.fetch = (async () => {
        fetchCallCount++;
        return new Response('{}', { status: 200 });
      }) as any;

      const req = { method: 'POST', body: { email: 'adversary@flashfix.in' } };
      const res = createMockRes();

      await sendOtpHandler(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.error?.code, 'BREVO_API_KEY_MISSING');
      assert.strictEqual(fetchCallCount, 0, 'Fetch must NEVER be invoked when BREVO_DISABLE_FALLBACK=1');
    });

    test('Outbound request contains exact sanitized key, headers, and payload structure', async () => {
      process.env.BREVO_KEY = '  "sk-test-secret-value-777"  ';
      let interceptedUrl = '';
      let interceptedMethod = '';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedPayload: any = null;

      globalThis.fetch = (async (url: string, init: any) => {
        interceptedUrl = url;
        interceptedMethod = init.method;
        interceptedHeaders = init.headers;
        interceptedPayload = JSON.parse(init.body);
        return new Response(JSON.stringify({ messageId: 'msg-adv-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const req = {
        method: 'POST',
        body: JSON.stringify({ email: 'Adv.User@FlashFix.IN ' }),
      };
      const res = createMockRes();

      await sendOtpHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.messageId, 'msg-adv-1');

      assert.strictEqual(interceptedUrl, 'https://api.brevo.com/v3/smtp/email');
      assert.strictEqual(interceptedMethod, 'POST');
      assert.strictEqual(interceptedHeaders['api-key'], 'sk-test-secret-value-777');
      assert.strictEqual(interceptedHeaders['Content-Type'], 'application/json');
      assert.strictEqual(interceptedHeaders['Accept'], 'application/json');

      assert.strictEqual(interceptedPayload.to[0].email, 'adv.user@flashfix.in');
      assert.strictEqual(interceptedPayload.sender.email, 'nexusprojects03@gmail.com');
      assert.strictEqual(interceptedPayload.sender.name, 'Flashfix');
      assert.ok(interceptedPayload.subject.includes('Flashfix verification code'));
      assert.ok(interceptedPayload.htmlContent.includes('One-Time Verification Code'));
      assert.ok(interceptedPayload.textContent.includes('Your Flashfix verification code is:'));
    });

    test('Malformed body string (invalid JSON) is handled safely', async () => {
      process.env.BREVO_API_KEY = 'test-key';
      const req = { method: 'POST', body: 'not-valid-json' };
      const res = createMockRes();

      // Should handle JSON parse error gracefully
      await sendOtpHandler(req, res);
      // Since JSON.parse throws or body is invalid, it either catches and returns 500 or 400
      assert.ok([400, 500].includes(res.statusCode));
    });

    test('Missing body or empty body returns 400 INVALID_EMAIL', async () => {
      const req = { method: 'POST', body: null };
      const res = createMockRes();

      await sendOtpHandler(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.error?.code, 'INVALID_EMAIL');
    });
  });

  describe('packages/web/api/[...route].ts', () => {
    test('CRITICAL: Catch-all route returns 500 BREVO_API_KEY_MISSING and fetch is NEVER called when fallback disabled (BREVO_DISABLE_FALLBACK=true)', async () => {
      process.env.BREVO_DISABLE_FALLBACK = 'true';
      let fetchCallCount = 0;
      globalThis.fetch = (async () => {
        fetchCallCount++;
        return new Response('{}', { status: 200 });
      }) as any;

      const req = {
        method: 'POST',
        url: 'http://localhost/api/auth/send-otp',
        body: { email: 'catchall@flashfix.in' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.error?.code, 'BREVO_API_KEY_MISSING');
      assert.strictEqual(fetchCallCount, 0, 'Fetch must NEVER be invoked');
    });

    test('DISPATCH REQUIREMENT: Catch-all route returns 500 BREVO_API_KEY_MISSING and fetch is NEVER called when BREVO_DISABLE_FALLBACK=1', async () => {
      process.env.BREVO_DISABLE_FALLBACK = '1';
      let fetchCallCount = 0;
      globalThis.fetch = (async () => {
        fetchCallCount++;
        return new Response('{}', { status: 200 });
      }) as any;

      const req = {
        method: 'POST',
        url: 'http://localhost/api/auth/send-otp',
        body: { email: 'catchall-1@flashfix.in' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.error?.code, 'BREVO_API_KEY_MISSING');
      assert.strictEqual(fetchCallCount, 0, 'Fetch must NEVER be invoked when BREVO_DISABLE_FALLBACK=1');
    });

    test('Catch-all route verifies payload and headers when sending OTP via alias VITE_BREVO_API_KEY', async () => {
      process.env.VITE_BREVO_API_KEY = '  "vite-brevo-key-999"  ';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedPayload: any = null;

      globalThis.fetch = (async (_url: string, init: any) => {
        interceptedHeaders = init.headers;
        interceptedPayload = JSON.parse(init.body);
        return new Response(JSON.stringify({ messageId: 'msg-route-999' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const req = {
        method: 'POST',
        url: 'http://localhost/api/auth/send-otp',
        body: { email: 'catchall-alias@flashfix.in' },
      };
      const res = createMockRes();

      await catchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.messageId, 'msg-route-999');
      assert.strictEqual(interceptedHeaders['api-key'], 'vite-brevo-key-999');
      assert.strictEqual(interceptedPayload.to[0].email, 'catchall-alias@flashfix.in');
    });
  });
});
