/**
 * Challenger M1 Iteration 2 Adversarial Security Verification Suite
 * 
 * Verifies complete remediation of the GET /api/admin/stores vulnerability:
 * 1. Comprehensive authentication & forgery rejection matrix (unauth, legacy, expired, tampered, alg=none)
 * 2. RBAC store-boundary isolation and universal Super Admin access
 * 3. Complete redaction of administrative staff rosters (assignedAdmins) from public endpoints
 * 4. Boundary & injection stress tests (SQL injection in storeId, role bypass attempts)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import handler from '../api/[...route].ts';
import { MockServerlessRequest, MockServerlessResponse } from './api/test-helpers.ts';

const VALID_DEV_SECRET = 'flashfix_local_development_jwt_secret_32bytes_min';
const ATTACKER_SECRET = 'evil_attacker_cryptographic_key_32_chars_long!';

function makeSignedToken(payload: any, key: string = VALID_DEV_SECRET, expiresIn: string | number = '1h'): string {
  return jwt.sign(payload, key, { algorithm: 'HS256', expiresIn });
}

function makeExpiredToken(payload: any, key: string = VALID_DEV_SECRET): string {
  const iat = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
  const exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  return jwt.sign({ ...payload, iat, exp }, key, { algorithm: 'HS256' });
}

function makeAlgNoneToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

async function invoke(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body: any = null
) {
  const req = new MockServerlessRequest({
    method,
    url: path,
    headers,
    body,
  });
  const res = new MockServerlessResponse();
  await handler(req, res);
  return { status: res.statusCode, body: res.body, headers: res.headers };
}

test('Objective 1: Unauthenticated & Invalid Token Rejection on GET /api/admin/stores', async (t) => {
  const testEndpoints = ['/api/admin/stores', '/admin/stores'];

  for (const ep of testEndpoints) {
    await t.test(`${ep}: Rejects unauthenticated request (no headers/cookies) with 401`, async () => {
      const res = await invoke('GET', ep);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'UNAUTHORIZED');
    });

    await t.test(`${ep}: Rejects empty Bearer Authorization header with 401`, async () => {
      const res = await invoke('GET', ep, { Authorization: 'Bearer ' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'UNAUTHORIZED');
    });

    await t.test(`${ep}: Rejects empty ff_session cookie with 401`, async () => {
      const res = await invoke('GET', ep, { Cookie: 'ff_session=' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body?.error?.code, 'UNAUTHORIZED');
    });

    const attackVectors = [
      {
        name: 'Legacy ff_jwt_ token',
        token: 'ff_jwt_eyJzdWIiOiIxMjM0NSIsImVtYWlsIjoiYWRtaW5AZmxhc2hmaXguaW4iLCJyb2xlIjoiU1VQRVJfQURNSU4ifQ',
      },
      {
        name: 'Legacy ff_staff_ token',
        token: 'ff_staff_eyJzdWIiOiJzdGFmZi0xIiwiZW1haWwiOiJzdGFmZkBmbGFzaGZpeC5pbiIsInJvbGUiOiJBRE1JTiJ9',
      },
      {
        name: 'Legacy mock_ff_token_',
        token: 'mock_ff_token_999988887777',
      },
      {
        name: 'Legacy local-dev-jwt-',
        token: 'local-dev-jwt-1234567890',
      },
      {
        name: 'Malformed JWT signature',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.invalidsignaturehere',
      },
      {
        name: 'Truncated JWT',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.truncated',
      },
      {
        name: 'Attacker-signed JWT (unauthorized secret)',
        token: makeSignedToken({ sub: 'hacker', email: 'hacker@evil.com', role: 'SUPER_ADMIN' }, ATTACKER_SECRET),
      },
      {
        name: 'Expired JWT',
        token: makeExpiredToken({ sub: 'expired-admin', email: 'admin@flashfix.in', role: 'SUPER_ADMIN' }),
      },
      {
        name: 'Algorithm None token bypass attempt',
        token: makeAlgNoneToken({ sub: 'hacker', email: 'hacker@evil.com', role: 'SUPER_ADMIN' }),
      },
    ];

    for (const atk of attackVectors) {
      await t.test(`${ep}: Rejects ${atk.name} via Authorization Header with 401`, async () => {
        const res = await invoke('GET', ep, { Authorization: `Bearer ${atk.token}` });
        assert.strictEqual(res.status, 401, `Expected 401 for ${atk.name} via header`);
        assert.ok(['UNAUTHORIZED', 'INVALID_TOKEN'].includes(res.body?.error?.code));
      });

      await t.test(`${ep}: Rejects ${atk.name} via ff_session Cookie with 401`, async () => {
        const res = await invoke('GET', ep, { Cookie: `ff_session=${atk.token}` });
        assert.strictEqual(res.status, 401, `Expected 401 for ${atk.name} via cookie`);
        assert.ok(['UNAUTHORIZED', 'INVALID_TOKEN'].includes(res.body?.error?.code));
      });
    }
  }

  // Non-administrative roles must receive 403 Forbidden even with valid cryptographic signature
  const unauthorizedRoles = ['CONSUMER', 'TECHNICIAN', 'EMPLOYEE'] as const;
  for (const role of unauthorizedRoles) {
    await t.test(`Rejects valid signed token with non-admin role "${role}" on GET /api/admin/stores with 403`, async () => {
      const validToken = makeSignedToken({
        sub: `user-${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@example.com`,
        role,
      });
      const res = await invoke('GET', '/api/admin/stores', {
        Authorization: `Bearer ${validToken}`,
      });
      assert.strictEqual(res.status, 403, `Expected 403 Forbidden for role ${role}`);
      assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
    });
  }
});

test('Objective 2: Authenticated Store Admin & Super Admin Access Scoping on GET /api/admin/stores', async (t) => {
  const storeA = 'store-kora-01';
  const storeB = 'store-indira-02';
  const storeC = 'store-whitefield-03';

  const singleStoreAdmin = {
    sub: 'admin-a',
    email: 'admin.a@flashfix.in',
    role: 'ADMIN' as const,
    storeId: storeA,
    storeIds: [storeA],
  };

  const multiStoreAdmin = {
    sub: 'admin-multi',
    email: 'admin.multi@flashfix.in',
    role: 'ADMIN' as const,
    storeId: storeA,
    storeIds: [storeA, storeC],
  };

  const unassignedAdmin = {
    sub: 'admin-none',
    email: 'admin.none@flashfix.in',
    role: 'ADMIN' as const,
    storeId: null,
    storeIds: [],
  };

  const superAdmin = {
    sub: 'super-admin',
    email: 'director@flashfix.in',
    role: 'SUPER_ADMIN' as const,
  };

  await t.test('Store Admin with assigned storeA calling without query param returns 200', async () => {
    const token = makeSignedToken(singleStoreAdmin);
    const res = await invoke('GET', '/api/admin/stores', {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.success, true);
    assert.ok(Array.isArray(res.body?.data));
  });

  await t.test('Store Admin with assigned storeA calling ?storeId=storeA returns 200', async () => {
    const token = makeSignedToken(singleStoreAdmin);
    const res = await invoke('GET', `/api/admin/stores?storeId=${storeA}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.success, true);
  });

  await t.test('Store Admin with assigned storeA calling ?storeId=storeB returns 403 Forbidden', async () => {
    const token = makeSignedToken(singleStoreAdmin);
    const res = await invoke('GET', `/api/admin/stores?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('Multi-store Admin can access assigned storeA and storeC, but is blocked from storeB (403)', async () => {
    const token = makeSignedToken(multiStoreAdmin);

    const resA = await invoke('GET', `/api/admin/stores?storeId=${storeA}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(resA.status, 200);

    const resC = await invoke('GET', `/api/admin/stores?storeId=${storeC}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(resC.status, 200);

    const resB = await invoke('GET', `/api/admin/stores?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(resB.status, 403);
    assert.strictEqual(resB.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('Admin with no assigned stores calling without query param returns empty data array', async () => {
    const token = makeSignedToken(unassignedAdmin);
    const res = await invoke('GET', '/api/admin/stores', {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body?.data, []);
  });

  await t.test('Admin with no assigned stores attempting to query storeA returns 403 Forbidden', async () => {
    const token = makeSignedToken(unassignedAdmin);
    const res = await invoke('GET', `/api/admin/stores?storeId=${storeA}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('Super Admin has universal access without query param (200 OK)', async () => {
    const token = makeSignedToken(superAdmin);
    const res = await invoke('GET', '/api/admin/stores', {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.success, true);
  });

  await t.test('Super Admin has universal access to storeA, storeB, and storeC', async () => {
    const token = makeSignedToken(superAdmin);
    for (const sid of [storeA, storeB, storeC]) {
      const res = await invoke('GET', `/api/admin/stores?storeId=${sid}`, {
        Authorization: `Bearer ${token}`,
      });
      assert.strictEqual(res.status, 200, `Expected 200 for Super Admin on ${sid}`);
    }
  });

  await t.test('Super Admin calling with storeId=ALL returns 200 OK', async () => {
    const token = makeSignedToken(superAdmin);
    const res = await invoke('GET', '/api/admin/stores?storeId=ALL', {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
  });
});

test('Objective 3: Public GET /api/stores Redaction & Absence of assignedAdmins', async (t) => {
  const publicEndpoints = [
    { path: '/api/stores', isArray: false },
    { path: '/stores', isArray: false },
    { path: '/api/stores/nearby', isArray: true },
    { path: '/stores/nearby', isArray: true },
  ];

  for (const ep of publicEndpoints) {
    await t.test(`${ep.path} returns 200 without authentication`, async () => {
      const res = await invoke('GET', ep.path);
      assert.strictEqual(res.status, 200);
      if (ep.isArray) {
        assert.ok(Array.isArray(res.body));
      } else {
        assert.strictEqual(res.body?.success, true);
      }
    });

    await t.test(`${ep.path} completely omits assignedAdmins and staff data from response body`, async () => {
      const res = await invoke('GET', ep.path);
      const rawJson = JSON.stringify(res.body);

      assert.strictEqual(
        rawJson.includes('assignedAdmins'),
        false,
        `${ep.path} response MUST NOT contain assignedAdmins`
      );

      // Verify no staff email or admin role strings appear in public data
      assert.strictEqual(rawJson.includes('@flashfix.in'), false, `${ep.path} MUST NOT leak staff email addresses`);
      assert.strictEqual(rawJson.includes('"SUPER_ADMIN"'), false, `${ep.path} MUST NOT leak SUPER_ADMIN role`);
      assert.strictEqual(rawJson.includes('"ADMIN"'), false, `${ep.path} MUST NOT leak ADMIN role`);
    });
  }
});

test('Objective 4: Boundary, Injection & Method Stress-Testing on /api/admin/stores', async (t) => {
  const storeA = 'store-kora-01';
  const storeAdminToken = makeSignedToken({
    sub: 'admin-a',
    email: 'admin.a@flashfix.in',
    role: 'ADMIN' as const,
    storeId: storeA,
    storeIds: [storeA],
  });
  const superAdminToken = makeSignedToken({
    sub: 'super-admin',
    email: 'super@flashfix.in',
    role: 'SUPER_ADMIN' as const,
  });

  await t.test('SQL injection attempt in storeId by Store Admin is blocked by store scope check (403)', async () => {
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "store-kora-01' OR '1'='1",
      "'; DROP TABLE stores; --",
      "1 UNION SELECT * FROM users--",
    ];

    for (const injection of sqlInjectionPayloads) {
      const res = await invoke('GET', `/api/admin/stores?storeId=${encodeURIComponent(injection)}`, {
        Authorization: `Bearer ${storeAdminToken}`,
      });
      assert.strictEqual(res.status, 403, `Expected 403 for injection: ${injection}`);
    }
  });

  await t.test('SQL injection attempt in storeId by Super Admin is safely parameterized (no crash/injection)', async () => {
    const res = await invoke('GET', `/api/admin/stores?storeId=${encodeURIComponent("'; DROP TABLE stores; --")}`, {
      Authorization: `Bearer ${superAdminToken}`,
    });
    // Parameterized query executes safely without SQL syntax error, returning 200 with []
    assert.strictEqual(res.status, 200);
  });

  await t.test('POST /api/admin/stores requires SUPER_ADMIN: rejected with 401 unauth', async () => {
    const res = await invoke('POST', '/api/admin/stores', {}, { name: 'Test Store' });
    assert.strictEqual(res.status, 401);
  });

  await t.test('POST /api/admin/stores requires SUPER_ADMIN: Store Admin is rejected with 403 Forbidden', async () => {
    const res = await invoke('POST', '/api/admin/stores', {
      Authorization: `Bearer ${storeAdminToken}`,
    }, { name: 'Test Store', address: '123 Test St' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('DELETE /api/admin/stores/:id requires authentication: rejected with 401 unauth', async () => {
    const res = await invoke('DELETE', '/api/admin/stores/some-store-id');
    assert.strictEqual(res.status, 401);
  });
});
