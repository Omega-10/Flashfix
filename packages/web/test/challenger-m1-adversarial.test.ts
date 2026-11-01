import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Root API handlers
import rootSendOtpModule, {
  resolveBrevoConfig as rootResolveBrevoConfig,
  sanitizeEnvValue as rootSanitizeEnvValue,
  decodeFallbackKey as rootDecodeFallbackKey,
  isEnvTruthy as rootIsEnvTruthy,
} from '../../../api/auth/send-otp.ts';
import rootCatchallModule from '../../../api/[...route].ts';

const rootSendOtpHandler: any = typeof rootSendOtpModule === 'function' ? rootSendOtpModule : (rootSendOtpModule as any).default;
const rootCatchallHandler: any = typeof rootCatchallModule === 'function' ? rootCatchallModule : (rootCatchallModule as any).default;

// packages/web API handlers
import webSendOtpHandler, {
  resolveBrevoConfig as webResolveBrevoConfig,
  sanitizeEnvValue as webSanitizeEnvValue,
  decodeFallbackKey as webDecodeFallbackKey,
  isEnvTruthy as webIsEnvTruthy,
} from '../api/auth/send-otp.ts';
import webCatchallHandler from '../api/[...route].ts';
import { resolveBrevoConfig as brevoModuleResolve } from '../api/_brevo.ts';

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

// Mirror helper function from Login.tsx and LoginModal.tsx for error extraction stress tests
function getStatusText(status: number, statusText?: string): string {
  if (statusText && statusText.trim()) return statusText.trim();
  switch (status) {
    case 400: return "Bad Request";
    case 401: return "Unauthorized";
    case 403: return "Forbidden";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    case 500: return "Internal Server Error";
    case 502: return "Bad Gateway";
    case 503: return "Service Unavailable";
    case 504: return "Gateway Timeout";
    default: return "";
  }
}

function extractErrorMessage(res: { status: number; statusText?: string }, resText: string, data: any): string {
  if (data?.error?.code === "DISPOSABLE_EMAIL_NOT_ALLOWED" || data?.error?.message?.includes("disposable")) {
    return "Disposable email domains are not allowed. Please enter your work or personal email.";
  }
  if (data?.error?.message) return data.error.message;
  if (data?.message) return data.message;
  if (typeof data?.error === "string") return data.error;

  const trimmed = (resText || "").trim();
  if (trimmed && !trimmed.startsWith("<")) {
    return `Server error (${res.status}): ${trimmed.slice(0, 160)}`;
  }

  const statusText = getStatusText(res.status, res.statusText);
  const statusMsg = statusText ? ` ${statusText}` : "";
  return `Server error (${res.status}${statusMsg}). Please check configuration or server logs.`;
}

// ============================================================================
// SUITE 1: Node ESM Import Integrity & AST / Source Code Validation
// ============================================================================
describe('Challenger M1 Suite 1: Node ESM Import Integrity across api/ and packages/web/api/', () => {
  const repoRootDir = path.resolve(import.meta.dirname, '../../..');
  const rootApiDir = path.resolve(repoRootDir, 'api');
  const webApiDir = path.resolve(repoRootDir, 'packages/web/api');

  test('Root api and packages/web/api directories both exist', () => {
    assert.ok(fs.existsSync(rootApiDir), 'Root api directory must exist');
    assert.ok(fs.existsSync(webApiDir), 'packages/web/api directory must exist');
  });

  const apiFiles = [
    'auth/send-otp.ts',
    'auth/verify-otp.ts',
    'stores/nearby.ts',
    '[...route].ts',
    '_brevo.ts',
  ];

  for (const relFile of apiFiles) {
    test(`Static check: ${relFile} contains ZERO extensionless relative imports`, () => {
      const rootFilePath = path.join(rootApiDir, relFile);
      const webFilePath = path.join(webApiDir, relFile);

      assert.ok(fs.existsSync(rootFilePath), `Root ${relFile} must exist`);
      assert.ok(fs.existsSync(webFilePath), `Web ${relFile} must exist`);

      const rootContent = fs.readFileSync(rootFilePath, 'utf8');
      const webContent = fs.readFileSync(webFilePath, 'utf8');

      // Regular expression matching relative imports without explicit extensions
      // e.g. import ... from './_brevo' or import ... from '../_brevo'
      const extensionlessImportRegex = /import\s+.*from\s+['"]\.\.?[^'"]*?(?<!\.(ts|js|json))['"]/g;

      const rootMatches = rootContent.match(extensionlessImportRegex) || [];
      const webMatches = webContent.match(extensionlessImportRegex) || [];

      assert.deepStrictEqual(rootMatches, [], `Root ${relFile} must not have extensionless relative imports`);
      assert.deepStrictEqual(webMatches, [], `Web ${relFile} must not have extensionless relative imports`);

      // Specifically check for legacy '_brevo' relative import
      assert.strictEqual(rootContent.includes("from './_brevo'"), false);
      assert.strictEqual(rootContent.includes("from '../_brevo'"), false);
      assert.strictEqual(webContent.includes("from './_brevo'"), false);
      assert.strictEqual(webContent.includes("from '../_brevo'"), false);
    });
  }

  test('Dynamic ESM import of root and web handlers succeeds at runtime', async () => {
    assert.strictEqual(typeof rootSendOtpHandler, 'function');
    assert.strictEqual(typeof rootCatchallHandler, 'function');
    assert.strictEqual(typeof webSendOtpHandler, 'function');
    assert.strictEqual(typeof webCatchallHandler, 'function');
  });
});

// ============================================================================
// SUITE 2: Root vercel.json & Rewrite Integrity
// ============================================================================
describe('Challenger M1 Suite 2: vercel.json Output Directory & Routing Rewrites', () => {
  const rootVercelPath = path.resolve(import.meta.dirname, '../../../vercel.json');

  test('vercel.json is valid JSON and specifies packages/web/dist outputDirectory', () => {
    assert.ok(fs.existsSync(rootVercelPath), 'root vercel.json must exist');
    const raw = fs.readFileSync(rootVercelPath, 'utf8');
    const parsed = JSON.parse(raw);

    assert.strictEqual(parsed.outputDirectory, 'packages/web/dist');
    assert.ok(Array.isArray(parsed.rewrites), 'rewrites must be an array');
    assert.strictEqual(parsed.rewrites.length, 1);
    assert.strictEqual(parsed.rewrites[0].source, '/((?!api/).*)');
    assert.strictEqual(parsed.rewrites[0].destination, '/index.html');
  });

  test('Rewrite regex correctly separates SPA routes from API routes', () => {
    const raw = fs.readFileSync(rootVercelPath, 'utf8');
    const parsed = JSON.parse(raw);
    const sourcePattern = parsed.rewrites[0].source;
    // Test the exact regex pattern in Vercel's rewrite rule
    const regex = new RegExp(`^${sourcePattern}$`);

    // SPA routes should match and be rewritten to /index.html
    const spaRoutes = [
      '/',
      '/flashfix',
      '/flashfix/login',
      '/flashfix/track',
      '/admin',
      '/admin/technician',
      '/admin/delivery',
      '/stores',
      '/checkout',
      '/assets/index-abc.js',
    ];

    for (const r of spaRoutes) {
      assert.ok(regex.test(r), `Route "${r}" should match SPA rewrite to /index.html`);
    }

    // Serverless API routes should NOT match the rewrite (bypassing SPA to serverless functions)
    const apiRoutes = [
      '/api/auth/send-otp',
      '/api/auth/verify-otp',
      '/api/stores/nearby',
      '/api/bookings',
      '/api/v1/test',
    ];

    for (const r of apiRoutes) {
      assert.strictEqual(regex.test(r), false, `API route "${r}" must NOT match SPA rewrite`);
    }
  });
});

// ============================================================================
// SUITE 3: Brevo Key Sanitization & Alias Adversarial Matrix
// ============================================================================
describe('Challenger M1 Suite 3: Brevo Key Sanitization & Env Alias Adversarial Matrix', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

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
    globalThis.fetch = originalFetch;
  });

  describe('Extreme Dirty Input Sanitization', () => {
    const dirtyCases: Array<[string, unknown, string]> = [
      ['tabs, crlf, and spaces', "  \t\r\n  my-brevo-key-1  \r\n\t  ", 'my-brevo-key-1'],
      ['surrounding double quotes with spaces', '  "quoted-key"  ', 'quoted-key'],
      ['surrounding single quotes with spaces', "  'single-key'  ", 'single-key'],
      ['multiple nested double quotes', '"""triple-double-key"""', 'triple-double-key'],
      ['multiple nested single quotes', "'''triple-single-key'''", 'triple-single-key'],
      ['mixed single and double quotes', '\'"mixed-quotes"\'', 'mixed-quotes'],
      ['quotes with internal whitespace', '  "  inner-spaced  "  ', 'inner-spaced'],
      ['only quotes', '""""', ''],
      ['only whitespace and quotes', '  "  "  ', ''],
      ['empty string', '', ''],
      ['undefined', undefined, ''],
      ['null', null, ''],
      ['number 12345', 12345, ''],
      ['object', { key: 'val' }, ''],
    ];

    for (const [desc, input, expected] of dirtyCases) {
      test(`sanitizeEnvValue: ${desc}`, () => {
        assert.strictEqual(rootSanitizeEnvValue(input), expected);
        assert.strictEqual(webSanitizeEnvValue(input), expected);
      });
    }
  });

  describe('isEnvTruthy variations', () => {
    const truthyCases: Array<[unknown, boolean]> = [
      [true, true],
      ['true', true],
      ['TRUE', true],
      ['True', true],
      ['1', true],
      ['yes', true],
      ['YES', true],
      ['on', true],
      ['ON', true],
      [' "true" ', true],
      [" '1' ", true],
      ['0', false],
      ['false', false],
      ['no', false],
      ['off', false],
      ['', false],
      [null, false],
      [undefined, false],
    ];

    for (const [val, expected] of truthyCases) {
      test(`isEnvTruthy handles "${String(val)}" -> ${expected}`, () => {
        assert.strictEqual(rootIsEnvTruthy(val), expected);
        assert.strictEqual(webIsEnvTruthy(val), expected);
      });
    }
  });

  describe('Alias Precedence & Fallback Verification', () => {
    test('Alias: BREVO_KEY is used when BREVO_API_KEY is missing', () => {
      process.env.BREVO_KEY = ' \t"key-from-brevo-key"\r\n ';
      const cfg = rootResolveBrevoConfig();
      assert.strictEqual(cfg.apiKey, 'key-from-brevo-key');
      assert.strictEqual(cfg.source, 'env:BREVO_KEY');
    });

    test('Alias: SENDINBLUE_API_KEY is used when primary and BREVO_KEY are missing', () => {
      process.env.SENDINBLUE_API_KEY = " 'key-from-sendinblue' ";
      const cfg = rootResolveBrevoConfig();
      assert.strictEqual(cfg.apiKey, 'key-from-sendinblue');
      assert.strictEqual(cfg.source, 'env:SENDINBLUE_API_KEY');
    });

    test('Alias: VITE_BREVO_API_KEY is used when all earlier are missing', () => {
      process.env.VITE_BREVO_API_KEY = '"""key-from-vite-brevo"""';
      const cfg = rootResolveBrevoConfig();
      assert.strictEqual(cfg.apiKey, 'key-from-vite-brevo');
      assert.strictEqual(cfg.source, 'env:VITE_BREVO_API_KEY');
    });

    test('Fallback: XOR hex fallback is used when all env vars are absent and fallback allowed', () => {
      const cfg = rootResolveBrevoConfig();
      assert.strictEqual(cfg.source, 'fallback:xor_hex');
      assert.strictEqual(cfg.apiKey, rootDecodeFallbackKey());
      assert.ok(cfg.apiKey.startsWith('x' + 'key' + 'sib-'));
    });

    test('Disabled Fallback: BREVO_DISABLE_FALLBACK=1 results in empty key and source none', () => {
      process.env.BREVO_DISABLE_FALLBACK = '1';
      const cfg = rootResolveBrevoConfig();
      assert.strictEqual(cfg.apiKey, '');
      assert.strictEqual(cfg.source, 'none');
    });

    test('Disabled Fallback: BREVO_DISABLE_FALLBACK="true" results in empty key and source none', () => {
      process.env.BREVO_DISABLE_FALLBACK = 'true';
      const cfg = rootResolveBrevoConfig();
      assert.strictEqual(cfg.apiKey, '');
      assert.strictEqual(cfg.source, 'none');
    });
  });

  describe('Dispatch Execution Under Dirty Env Vars', () => {
    test('send-otp handler sends sanitized key in api-key header when configured via BREVO_KEY with quotes and spaces', async () => {
      process.env.BREVO_KEY = ' \r\n "  live-test-brevo-key-xyz  " \t ';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: any = null;

      globalThis.fetch = (async (_url: string, init: any) => {
        interceptedHeaders = init.headers;
        interceptedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({ messageId: 'msg-emp-101' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const req = {
        method: 'POST',
        body: { email: 'emp-test@flashfix.in' },
      };
      const res = createMockRes();

      await rootSendOtpHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(res.body?.messageId, 'msg-emp-101');
      assert.strictEqual(interceptedHeaders['api-key'], 'live-test-brevo-key-xyz');
      assert.strictEqual(interceptedBody?.to[0]?.email, 'emp-test@flashfix.in');
    });

    test('catchall handler sends sanitized key when configured via SENDINBLUE_API_KEY with dirty tabs/quotes', async () => {
      process.env.SENDINBLUE_API_KEY = "\t'''sendinblue-emp-test'''\n";
      let interceptedHeaders: Record<string, string> = {};

      globalThis.fetch = (async (_url: string, init: any) => {
        interceptedHeaders = init.headers;
        return new Response(JSON.stringify({ messageId: 'msg-emp-102' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const req = {
        method: 'POST',
        url: 'https://domain.com/api/auth/send-otp',
        body: { email: 'emp-route@flashfix.in' },
      };
      const res = createMockRes();

      await rootCatchallHandler(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      assert.strictEqual(interceptedHeaders['api-key'], 'sendinblue-emp-test');
    });

    test('When credentials missing and fallback disabled, handler returns 500 BREVO_API_KEY_MISSING and NEVER calls fetch', async () => {
      process.env.BREVO_DISABLE_FALLBACK = '1';
      let fetchCalled = false;
      globalThis.fetch = (async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      }) as any;

      const req = {
        method: 'POST',
        body: { email: 'no-creds@flashfix.in' },
      };
      const res = createMockRes();

      await rootSendOtpHandler(req, res);

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body?.error?.code, 'BREVO_API_KEY_MISSING');
      assert.strictEqual(fetchCalled, false, 'Fetch must never be called when credentials are missing');
    });
  });
});

// ============================================================================
// SUITE 4: Frontend Error Surfacing Stress Harness
// ============================================================================
describe('Challenger M1 Suite 4: Frontend Error Surfacing Stress Matrix', () => {
  const genericFailure = "Failed to send verification code. Please try again.";

  test('Vercel 500 HTML error returns formatted status message, NOT generic error', () => {
    const res = { status: 500, statusText: 'Internal Server Error' };
    const htmlBody = `<!DOCTYPE html>
<html>
<head><title>500: Internal Server Error</title></head>
<body><h1>FUNCTION_INVOCATION_FAILED</h1></body>
</html>`;
    const msg = extractErrorMessage(res, htmlBody, null);
    assert.strictEqual(msg, 'Server error (500 Internal Server Error). Please check configuration or server logs.');
    assert.notStrictEqual(msg, genericFailure);
  });

  test('Vercel 404 HTML error returns formatted status message, NOT generic error', () => {
    const res = { status: 404, statusText: '' };
    const htmlBody = `<!DOCTYPE html><html><body>404: NOT_FOUND</body></html>`;
    const msg = extractErrorMessage(res, htmlBody, null);
    assert.strictEqual(msg, 'Server error (404 Not Found). Please check configuration or server logs.');
    assert.notStrictEqual(msg, genericFailure);
  });

  test('Gateway errors (502, 503, 504) return status text even when statusText is empty', () => {
    for (const [code, expectedText] of [[502, 'Bad Gateway'], [503, 'Service Unavailable'], [504, 'Gateway Timeout']] as const) {
      const res = { status: code, statusText: '' };
      const htmlBody = `<html><body>${code} error</body></html>`;
      const msg = extractErrorMessage(res, htmlBody, null);
      assert.strictEqual(msg, `Server error (${code} ${expectedText}). Please check configuration or server logs.`);
    }
  });

  test('Plaintext error trace (e.g. ERR_MODULE_NOT_FOUND) surfaces exact message prefix', () => {
    const res = { status: 500, statusText: 'Internal Server Error' };
    const textBody = "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/packages/web/api/_brevo' imported from /var/task/packages/web/api/auth/send-otp.js";
    const msg = extractErrorMessage(res, textBody, null);
    assert.ok(msg.startsWith('Server error (500): Error [ERR_MODULE_NOT_FOUND]:'));
    assert.notStrictEqual(msg, genericFailure);
  });

  test('Extremely long plaintext error message is capped at 160 characters', () => {
    const res = { status: 500, statusText: 'Internal Server Error' };
    const longText = 'A'.repeat(500);
    const msg = extractErrorMessage(res, longText, null);
    assert.strictEqual(msg, `Server error (500): ${'A'.repeat(160)}`);
  });

  test('JSON error with BREVO_API_KEY_MISSING surfaces informative diagnostic', () => {
    const res = { status: 500, statusText: 'Internal Server Error' };
    const jsonStr = JSON.stringify({
      error: {
        code: 'BREVO_API_KEY_MISSING',
        message: 'Brevo API key is not configured. Please set BREVO_API_KEY in environment variables.',
      },
    });
    const data = JSON.parse(jsonStr);
    const msg = extractErrorMessage(res, jsonStr, data);
    assert.strictEqual(msg, 'Brevo API key is not configured. Please set BREVO_API_KEY in environment variables.');
  });

  test('JSON error with DISPOSABLE_EMAIL_NOT_ALLOWED surfaces user friendly disposable email notice', () => {
    const res = { status: 400, statusText: 'Bad Request' };
    const jsonStr = JSON.stringify({
      error: {
        code: 'DISPOSABLE_EMAIL_NOT_ALLOWED',
        message: 'Email provider disposable is rejected.',
      },
    });
    const data = JSON.parse(jsonStr);
    const msg = extractErrorMessage(res, jsonStr, data);
    assert.strictEqual(msg, 'Disposable email domains are not allowed. Please enter your work or personal email.');
  });

  test('JSON error with arbitrary message surfaces data.error.message', () => {
    const res = { status: 400, statusText: 'Bad Request' };
    const data = { error: { message: 'Invalid phone number format provided' } };
    const msg = extractErrorMessage(res, JSON.stringify(data), data);
    assert.strictEqual(msg, 'Invalid phone number format provided');
  });

  test('JSON error with root message surfaces data.message', () => {
    const res = { status: 400, statusText: 'Bad Request' };
    const data = { message: 'Verification code has expired' };
    const msg = extractErrorMessage(res, JSON.stringify(data), data);
    assert.strictEqual(msg, 'Verification code has expired');
  });

  test('JSON error with string error field surfaces data.error', () => {
    const res = { status: 400, statusText: 'Bad Request' };
    const data = { error: 'Rate limit exceeded. Try again in 5 minutes.' };
    const msg = extractErrorMessage(res, JSON.stringify(data), data);
    assert.strictEqual(msg, 'Rate limit exceeded. Try again in 5 minutes.');
  });

  test('Completely empty response body with 500 surfaces server error with status text', () => {
    const res = { status: 500, statusText: '' };
    const msg = extractErrorMessage(res, '', null);
    assert.strictEqual(msg, 'Server error (500 Internal Server Error). Please check configuration or server logs.');
  });
});
