import assert from 'node:assert';
import test from 'node:test';
import rootCatchAllHandler from '../api/[...route].ts';
import webCatchAllHandler from '../packages/web/api/[...route].ts';
import { getJwtSecret } from '../api/_lib/env.ts';
import { getBrevoConfig, sendEmail } from '../api/_lib/email.ts';
import { MockServerlessRequest, MockServerlessResponse, signSessionToken } from './api/test-helpers.ts';

const superAdminPayload = {
  sub: 'usr_super_1',
  email: 'superadmin@flashfix.in',
  role: 'SUPER_ADMIN' as const,
  name: 'Super Admin',
};

const superAdminToken = signSessionToken(superAdminPayload);

interface RouteTestCase {
  method: string;
  url: string;
  routeSegments: string[];
  body?: any;
  needsAuth?: boolean;
}

const canonicalRoutes: RouteTestCase[] = [
  // Auth
  { method: 'POST', url: '/api/auth/identify', routeSegments: ['auth', 'identify'], body: { email: 'bad-email' } },
  { method: 'POST', url: '/api/auth/staff-login', routeSegments: ['auth', 'staff-login'], body: {} },
  { method: 'POST', url: '/api/auth/verify-otp', routeSegments: ['auth', 'verify-otp'], body: {} },
  { method: 'POST', url: '/api/auth/send-otp', routeSegments: ['auth', 'send-otp'], body: {} },
  { method: 'GET', url: '/api/auth/me', routeSegments: ['auth', 'me'], needsAuth: true },
  { method: 'PATCH', url: '/api/auth/me', routeSegments: ['auth', 'me'], body: {}, needsAuth: true },
  { method: 'POST', url: '/api/auth/logout', routeSegments: ['auth', 'logout'] },

  // Account
  { method: 'GET', url: '/api/account/addresses', routeSegments: ['account', 'addresses'], needsAuth: true },
  { method: 'POST', url: '/api/account/addresses', routeSegments: ['account', 'addresses'], body: {}, needsAuth: true },
  { method: 'DELETE', url: '/api/account/addresses/addr-1', routeSegments: ['account', 'addresses', 'addr-1'], needsAuth: true },

  // Stores
  { method: 'GET', url: '/api/stores', routeSegments: ['stores'] },
  { method: 'GET', url: '/api/stores/nearby', routeSegments: ['stores', 'nearby'] },

  // Admin
  { method: 'GET', url: '/api/admin/dashboard', routeSegments: ['admin', 'dashboard'], needsAuth: true },
  { method: 'GET', url: '/api/admin/team', routeSegments: ['admin', 'team'], needsAuth: true },
  { method: 'PATCH', url: '/api/admin/team/user-1/role', routeSegments: ['admin', 'team', 'user-1', 'role'], body: {}, needsAuth: true },
  { method: 'GET', url: '/api/admin/inventory', routeSegments: ['admin', 'inventory'], needsAuth: true },
  { method: 'GET', url: '/api/admin/stores', routeSegments: ['admin', 'stores'] },
  { method: 'POST', url: '/api/admin/stores', routeSegments: ['admin', 'stores'], body: {}, needsAuth: true },
  { method: 'POST', url: '/api/admin/stores/s-1/toggle', routeSegments: ['admin', 'stores', 's-1', 'toggle'], needsAuth: true },
  { method: 'DELETE', url: '/api/admin/stores/s-1', routeSegments: ['admin', 'stores', 's-1'], needsAuth: true },
  { method: 'POST', url: '/api/admin/stores/assign-admins', routeSegments: ['admin', 'stores', 'assign-admins'], body: {}, needsAuth: true },
  { method: 'POST', url: '/api/admin/bookings/b-1/assign', routeSegments: ['admin', 'bookings', 'b-1', 'assign'], body: {}, needsAuth: true },
  { method: 'GET', url: '/api/admin/bookings', routeSegments: ['admin', 'bookings'], needsAuth: true },

  // Bookings
  { method: 'POST', url: '/api/bookings', routeSegments: ['bookings'], body: {} },
  { method: 'GET', url: '/api/bookings/mine', routeSegments: ['bookings', 'mine'], needsAuth: true },
  { method: 'GET', url: '/api/bookings/b-1', routeSegments: ['bookings', 'b-1'] },
  { method: 'GET', url: '/api/bookings/b-1/trail', routeSegments: ['bookings', 'b-1', 'trail'] },
  { method: 'POST', url: '/api/bookings/b-1/start-pickup', routeSegments: ['bookings', 'b-1', 'start-pickup'], needsAuth: true },
  { method: 'POST', url: '/api/bookings/b-1/send-pickup-otp', routeSegments: ['bookings', 'b-1', 'send-pickup-otp'], needsAuth: true },
  { method: 'POST', url: '/api/bookings/b-1/verify-pickup', routeSegments: ['bookings', 'b-1', 'verify-pickup'], body: {}, needsAuth: true },
  { method: 'POST', url: '/api/bookings/b-1/send-custody-otp', routeSegments: ['bookings', 'b-1', 'send-custody-otp'], needsAuth: true },
  { method: 'POST', url: '/api/bookings/b-1/verify-custody', routeSegments: ['bookings', 'b-1', 'verify-custody'], body: {}, needsAuth: true },
  { method: 'POST', url: '/api/bookings/b-1/repair-complete', routeSegments: ['bookings', 'b-1', 'repair-complete'], needsAuth: true },
  { method: 'PATCH', url: '/api/bookings/b-1/status', routeSegments: ['bookings', 'b-1', 'status'], body: {}, needsAuth: true },
  { method: 'POST', url: '/api/bookings/b-1/cancel', routeSegments: ['bookings', 'b-1', 'cancel'], needsAuth: true },
];

test('Adversarial Test Suite 1: Canonical Route Dispatch & JSON Integrity', async (t) => {
  for (const handlerFn of [
    { name: 'Root api/[...route].ts', fn: rootCatchAllHandler },
    { name: 'Web api/[...route].ts', fn: webCatchAllHandler },
  ]) {
    await t.test(`${handlerFn.name} handles all canonical routes with well-formed JSON`, async (st) => {
      for (const route of canonicalRoutes) {
        await st.test(`${route.method} ${route.url} (via req.query.route)`, async () => {
          const req = new MockServerlessRequest({
            method: route.method,
            url: route.url,
            query: { route: route.routeSegments },
            body: route.body || {},
            headers: route.needsAuth ? { Authorization: `Bearer ${superAdminToken}` } : {},
          });
          const res = new MockServerlessResponse();

          await handlerFn.fn(req, res);

          assert.ok(res.ended, `Response should be ended for ${route.method} ${route.url}`);
          assert.notStrictEqual(res.body, null, `Response body should not be null for ${route.method} ${route.url}`);
          assert.strictEqual(typeof res.body, 'object', `Response should return a JSON object, got ${typeof res.body}`);
          // Ensure response is not default ping or unrouted 404
          if (res.body.service === 'flashfix-serverless-api') {
            assert.fail(`Route ${route.method} ${route.url} fell through to default catch-all service ping!`);
          }
        });

        await st.test(`${route.method} ${route.url} (via req.url string)`, async () => {
          const req = new MockServerlessRequest({
            method: route.method,
            url: route.url,
            body: route.body || {},
            headers: route.needsAuth ? { Authorization: `Bearer ${superAdminToken}` } : {},
          });
          const res = new MockServerlessResponse();

          await handlerFn.fn(req, res);

          assert.ok(res.ended, `Response should be ended for ${route.method} ${route.url}`);
          assert.notStrictEqual(res.body, null, `Response body should not be null for ${route.method} ${route.url}`);
          assert.strictEqual(typeof res.body, 'object', `Response should return a JSON object for ${route.method} ${route.url}`);
          if (res.body.service === 'flashfix-serverless-api') {
            assert.fail(`Route ${route.method} ${route.url} fell through to default catch-all service ping!`);
          }
        });
      }
    });
  }
});

test('Adversarial Test Suite 2: Unauthenticated Protected Routes Return JSON 401', async (t) => {
  const protectedRoutes = canonicalRoutes.filter((r) => r.needsAuth);
  for (const route of protectedRoutes) {
    await t.test(`${route.method} ${route.url} rejects unauthenticated call with 401 JSON`, async () => {
      const req = new MockServerlessRequest({
        method: route.method,
        url: route.url,
        query: { route: route.routeSegments },
        body: route.body || {},
      });
      const res = new MockServerlessResponse();

      await rootCatchAllHandler(req, res);

      assert.strictEqual(res.statusCode, 401, `Expected 401 status code for ${route.method} ${route.url}, got ${res.statusCode}`);
      assert.ok(res.body && typeof res.body === 'object', `Expected JSON body for ${route.method} ${route.url}`);
      assert.ok(res.body.error, `Expected res.body.error for ${route.method} ${route.url}`);
    });
  }
});

test('Adversarial Test Suite 3: Brevo Key Exclusivity & Fail-Closed Enforcement', async (t) => {
  await t.test('Missing BREVO_API_KEY throws HttpError(500, BREVO_API_KEY_MISSING) in production', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevKey = process.env.BREVO_API_KEY;
    const prevKeyAlias1 = process.env.BREVO_KEY;
    const prevKeyAlias2 = process.env.SENDINBLUE_API_KEY;
    const prevKeyAlias3 = process.env.VITE_BREVO_API_KEY;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_KEY;
      delete process.env.SENDINBLUE_API_KEY;
      delete process.env.VITE_BREVO_API_KEY;

      const config = getBrevoConfig();
      assert.strictEqual(config.apiKey, '', 'Config apiKey should be empty when no env vars set');

      await assert.rejects(
        async () => {
          await sendEmail({
            to: 'test@example.com',
            subject: 'Test Subject',
            htmlContent: '<p>Test</p>',
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 500);
          assert.strictEqual(err.code, 'BREVO_API_KEY_MISSING');
          return true;
        }
      );
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevKey) process.env.BREVO_API_KEY = prevKey;
      if (prevKeyAlias1) process.env.BREVO_KEY = prevKeyAlias1;
      if (prevKeyAlias2) process.env.SENDINBLUE_API_KEY = prevKeyAlias2;
      if (prevKeyAlias3) process.env.VITE_BREVO_API_KEY = prevKeyAlias3;
    }
  });

  await t.test('Brevo email sending uses exact API key without fallback or alteration', async () => {
    const prevKey = process.env.BREVO_API_KEY;
    const originalFetch = globalThis.fetch;
    let interceptedKey: string | null = null;

    try {
      const testKey = 'xkeysib-adversarial-test-key-999888777';
      process.env.BREVO_API_KEY = `  "${testKey}"  \n`;

      globalThis.fetch = (async (url: any, init: any) => {
        interceptedKey = init?.headers?.['api-key'] || null;
        return {
          ok: true,
          status: 200,
          json: async () => ({ messageId: 'msg-adv-123' }),
        } as any;
      }) as any;

      const res = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Verification Code',
        htmlContent: '<p>Code: 123456</p>',
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.messageId, 'msg-adv-123');
      assert.strictEqual(interceptedKey, testKey, 'Outbound request must use sanitized BREVO_API_KEY');
    } finally {
      globalThis.fetch = originalFetch;
      if (prevKey) {
        process.env.BREVO_API_KEY = prevKey;
      } else {
        delete process.env.BREVO_API_KEY;
      }
    }
  });
});

test('Adversarial Test Suite 4: Fail-Closed JWT Secret Resolution', async (t) => {
  await t.test('Throws fatal error in production when JWT_SECRET is missing', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      assert.throws(() => {
        getJwtSecret();
      }, /FATAL: JWT_SECRET environment variable is missing or insecure in production/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret) process.env.JWT_SECRET = prevSecret;
    }
  });

  await t.test('Throws fatal error in production when JWT_SECRET is < 32 characters', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short_key_under_32_chars';

      assert.throws(() => {
        getJwtSecret();
      }, /FATAL: JWT_SECRET environment variable is missing or insecure in production/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret) process.env.JWT_SECRET = prevSecret;
    }
  });

  await t.test('Falls back safely in development mode when JWT_SECRET is unset', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      const sec = getJwtSecret();
      assert.strictEqual(sec, 'flashfix_local_development_jwt_secret_32bytes_min');
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevSecret) process.env.JWT_SECRET = prevSecret;
    }
  });
});
