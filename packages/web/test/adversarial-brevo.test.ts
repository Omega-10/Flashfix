import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeEnvValue,
  resolveBrevoConfig,
  getBrevoApiKey,
  isEnvTruthy,
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
      assert.strictEqual(sanitizeEnvValue(' \t\r\n test-key \r\n\t '), 'test-key');
    });

    test('handles nested, repeated, and mixed surrounding quotes', () => {
      assert.strictEqual(sanitizeEnvValue('"""my-key"""'), 'my-key');
      assert.strictEqual(sanitizeEnvValue("'''my-key'''"), 'my-key');
      assert.strictEqual(sanitizeEnvValue(' "\'my-key\'" '), 'my-key');
      assert.strictEqual(sanitizeEnvValue('\'"my-key"\''), 'my-key');
    });

    test('preserves valid characters inside the key while trimming outer whitespace/quotes', () => {
      const complexKey = 'xkeysib-abc_123.XYZ-def$ghi';
      assert.strictEqual(sanitizeEnvValue(` " ${complexKey} " `), complexKey);
    });

    test('handles non-string types safely', () => {
      assert.strictEqual(sanitizeEnvValue(undefined), '');
      assert.strictEqual(sanitizeEnvValue(null), '');
      assert.strictEqual(sanitizeEnvValue(123456), '');
      assert.strictEqual(sanitizeEnvValue({ key: 'value' }), '');
      assert.strictEqual(sanitizeEnvValue(['key']), '');
    });
  });

  describe('Key Precedence Across Combinations', () => {
    test('BREVO_API_KEY overrides all other aliases', () => {
      process.env.BREVO_API_KEY = 'primary-key';
      process.env.BREVO_KEY = 'key-alias-1';
      process.env.SENDINBLUE_API_KEY = 'key-alias-2';
      process.env.VITE_BREVO_API_KEY = 'key-alias-3';

      const config = resolveBrevoConfig();
      assert.strictEqual(config.apiKey, 'primary-key');
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

    test('Returns empty when all env keys are absent or empty (zero hardcoded fallback)', () => {
      process.env.BREVO_API_KEY = '   ';
      process.env.BREVO_KEY = '""';
      process.env.SENDINBLUE_API_KEY = "  ''  ";
      process.env.VITE_BREVO_API_KEY = '\t\n';

      const config = resolveBrevoConfig();
      assert.strictEqual(config.source, 'none');
      assert.strictEqual(config.apiKey, '');
    });
  });
});

describe('Adversarial Handler Execution: [...route]', () => {
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
      url: 'http://localhost/api/auth/send-otp',
      query: { route: ['auth', 'send-otp'] },
      body: JSON.stringify({ email: 'Adv.User@FlashFix.IN ' }),
    };
    const res = createMockRes();

    await catchallHandler(req, res);

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
  });

  test('Malformed body string (invalid JSON) is handled safely', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    const req = {
      method: 'POST',
      url: 'http://localhost/api/auth/send-otp',
      query: { route: ['auth', 'send-otp'] },
      body: 'not-valid-json',
    };
    const res = createMockRes();

    await catchallHandler(req, res);
    assert.ok([400, 500].includes(res.statusCode));
  });

  test('Missing body or empty body returns 400 INVALID_EMAIL', async () => {
    const req = {
      method: 'POST',
      url: 'http://localhost/api/auth/send-otp',
      query: { route: ['auth', 'send-otp'] },
      body: null,
    };
    const res = createMockRes();

    await catchallHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_EMAIL');
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
      query: { route: ['auth', 'send-otp'] },
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
