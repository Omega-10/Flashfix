/**
 * Challenger M1 Comprehensive Empirical Test Suite
 * Stress-testing:
 * 1. Forged, Unsigned, Malformed, Attacker-Keyed, and Alg-None Tokens
 * 2. Fail-Closed Secret Resolution in Production
 * 3. Granular RBAC Store Boundary Isolation & Universal Super Admin Access
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import handler from '../api/[...route].ts';
import { getJwtSecret } from '../api/_lib/env.ts';
import { requireAuth } from '../api/_lib/session.ts';
import { requireStoreAccess, requireRole, HttpError } from '../api/_lib/authz.ts';
import { MockServerlessRequest, MockServerlessResponse } from './api/test-helpers.ts';

const VALID_KEY = 'flashfix_local_development_jwt_secret_32bytes_min';
const ATTACKER_KEY = 'evil_attacker_cryptographic_key_32_chars_long!';

function makeSignedToken(payload: any, key: string = VALID_KEY, expiresIn: string = '1h'): string {
  return jwt.sign(payload, key, { algorithm: 'HS256', expiresIn });
}

function makeAlgNoneToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

async function invokeHandler(method: string, path: string, headers: Record<string, string> = {}, body: any = null) {
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

test('Invariant 1: Forged, Legacy, and Unsigned Token Rejection across Protected Routes', async (t) => {
  const attackTokens = [
    { name: 'Legacy unsigned ff_jwt_', token: 'ff_jwt_eyJzdWIiOiIxMjM0NSIsImVtYWlsIjoidmljdGltQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSX0FETUlOIn0' },
    { name: 'Legacy unsigned ff_staff_', token: 'ff_staff_eyJzdWIiOiJzdGFmZi0xIiwiZW1haWwiOiJzdGFmZkBmbGFzaGZpeC5pbiIsInJvbGUiOiJBRE1JTiJ9' },
    { name: 'Legacy mock_ff_token_', token: 'mock_ff_token_123456789' },
    { name: 'Malformed JWT syntax', token: 'header.payload.invalidsignature' },
    { name: 'Attacker signed JWT', token: makeSignedToken({ sub: 'attacker', email: 'attacker@evil.com', role: 'SUPER_ADMIN' }, ATTACKER_KEY) },
    { name: 'Algorithm None bypass attempt', token: makeAlgNoneToken({ sub: 'attacker', email: 'attacker@evil.com', role: 'SUPER_ADMIN' }) },
  ];

  const protectedEndpoints = [
    { method: 'GET', path: '/api/admin/dashboard' },
    { method: 'GET', path: '/api/admin/team' },
    { method: 'POST', path: '/api/admin/stores' },
    { method: 'GET', path: '/api/bookings/mine' },
    { method: 'GET', path: '/api/auth/me' },
  ];

  for (const ep of protectedEndpoints) {
    for (const atk of attackTokens) {
      await t.test(`Rejects ${atk.name} on ${ep.method} ${ep.path} via Authorization Header`, async () => {
        const res = await invokeHandler(ep.method, ep.path, {
          Authorization: `Bearer ${atk.token}`,
        });
        assert.strictEqual(res.status, 401, `Expected 401 for ${ep.method} ${ep.path}`);
      });

      await t.test(`Rejects ${atk.name} on ${ep.method} ${ep.path} via ff_session Cookie`, async () => {
        const res = await invokeHandler(ep.method, ep.path, {
          Cookie: `ff_session=${atk.token}`,
        });
        assert.strictEqual(res.status, 401, `Expected 401 for ${ep.method} ${ep.path} (cookie)`);
      });
    }
  }

  // Security Verification: GET /api/admin/stores requires authentication
  await t.test('GET /api/admin/stores returns 401 for unauthenticated/forged requests', async () => {
    const resUnauth = await invokeHandler('GET', '/api/admin/stores', {});
    assert.strictEqual(resUnauth.status, 401, 'Confirms unauthenticated request returns 401');

    const resForged = await invokeHandler('GET', '/api/admin/stores', {
      Authorization: `Bearer ${attackTokens[0].token}`,
    });
    assert.strictEqual(resForged.status, 401, 'Confirms forged token request returns 401');

    // Public GET /api/stores succeeds without leaking assignedAdmins
    const resPublic = await invokeHandler('GET', '/api/stores', {});
    assert.strictEqual(resPublic.status, 200, 'Public stores endpoint returns 200');
    assert.strictEqual(JSON.stringify(resPublic.body).includes('assignedAdmins'), false, 'Public stores endpoint does not leak assignedAdmins');
  });
});

test('Invariant 2: Fail-Closed Secret Resolution in Production', async (t) => {
  const origEnv = process.env.NODE_ENV;
  const origSecret = process.env.JWT_SECRET;

  try {
    process.env.NODE_ENV = 'production';

    await t.test('Throws fatal error when JWT_SECRET is empty string in production', () => {
      process.env.JWT_SECRET = '';
      assert.throws(
        () => getJwtSecret(),
        (err: any) => err.message.includes('FATAL: JWT_SECRET environment variable is missing or insecure in production')
      );
    });

    await t.test('Throws fatal error when JWT_SECRET is undefined in production', () => {
      delete process.env.JWT_SECRET;
      assert.throws(
        () => getJwtSecret(),
        (err: any) => err.message.includes('FATAL: JWT_SECRET environment variable is missing or insecure in production')
      );
    });

    await t.test('Throws fatal error when JWT_SECRET is shorter than 32 chars in production', () => {
      process.env.JWT_SECRET = 'short_secret_20_chars';
      assert.throws(
        () => getJwtSecret(),
        (err: any) => err.message.includes('FATAL: JWT_SECRET environment variable is missing or insecure in production')
      );
    });

    await t.test('Accepts valid 32+ char secret in production without throwing', () => {
      const validSecret = 'valid_production_secret_must_be_at_least_32_characters_long!';
      process.env.JWT_SECRET = validSecret;
      const resolved = getJwtSecret();
      assert.strictEqual(resolved, validSecret);
    });

    await t.test('Falls back to local dev secret when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = '';
      const resolved = getJwtSecret();
      assert.strictEqual(resolved, 'flashfix_local_development_jwt_secret_32bytes_min');
    });
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.JWT_SECRET = origSecret;
  }
});

test('Invariant 3: RBAC Store Boundary Isolation & Super Admin Universal Access', async (t) => {
  const storeA = 'store-koramangala-01';
  const storeB = 'store-indiranagar-02';

  const storeAdminA = {
    sub: 'admin-a-id',
    email: 'admin.a@flashfix.in',
    role: 'ADMIN' as const,
    storeId: storeA,
    storeIds: [storeA],
  };

  const superAdmin = {
    sub: 'super-admin-id',
    email: 'super@flashfix.in',
    role: 'SUPER_ADMIN' as const,
  };

  await t.test('requireStoreAccess: Store Admin A is authorized for Store A', () => {
    assert.doesNotThrow(() => requireStoreAccess(storeAdminA as any, storeA));
  });

  await t.test('requireStoreAccess: Store Admin A attempting to access Store B throws 403 Forbidden', () => {
    assert.throws(
      () => requireStoreAccess(storeAdminA as any, storeB),
      (err: any) => err instanceof HttpError && err.statusCode === 403 && err.code === 'FORBIDDEN'
    );
  });

  await t.test('requireStoreAccess: Super Admin has universal bypass across Store A and Store B', () => {
    assert.doesNotThrow(() => requireStoreAccess(superAdmin as any, storeA));
    assert.doesNotThrow(() => requireStoreAccess(superAdmin as any, storeB));
  });

  await t.test('Endpoint: Store Admin A calling /api/admin/dashboard?storeId=storeB returns 403 Forbidden', async () => {
    const token = makeSignedToken(storeAdminA);
    const res = await invokeHandler('GET', `/api/admin/dashboard?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('Endpoint: Store Admin A calling /api/admin/inventory?storeId=storeB returns 403 Forbidden', async () => {
    const token = makeSignedToken(storeAdminA);
    const res = await invokeHandler('GET', `/api/admin/inventory?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('Endpoint: Store Admin A calling /api/admin/team?storeId=storeB returns 403 Forbidden', async () => {
    const token = makeSignedToken(storeAdminA);
    const res = await invokeHandler('GET', `/api/admin/team?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('Endpoint: Store Admin A calling /api/admin/bookings?storeId=storeB returns 403 Forbidden', async () => {
    const token = makeSignedToken(storeAdminA);
    const res = await invokeHandler('GET', `/api/admin/bookings?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await t.test('Endpoint: Super Admin calling /api/admin/dashboard?storeId=storeB returns 200 OK', async () => {
    const token = makeSignedToken(superAdmin);
    const res = await invokeHandler('GET', `/api/admin/dashboard?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('Endpoint: Super Admin calling /api/admin/inventory?storeId=storeB returns 200 OK', async () => {
    const token = makeSignedToken(superAdmin);
    const res = await invokeHandler('GET', `/api/admin/inventory?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('Endpoint: Super Admin calling /api/admin/team?storeId=storeB returns 200 OK', async () => {
    const token = makeSignedToken(superAdmin);
    const res = await invokeHandler('GET', `/api/admin/team?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('Endpoint: Super Admin calling /api/admin/bookings?storeId=storeB returns 200 OK', async () => {
    const token = makeSignedToken(superAdmin);
    const res = await invokeHandler('GET', `/api/admin/bookings?storeId=${storeB}`, {
      Authorization: `Bearer ${token}`,
    });
    assert.strictEqual(res.status, 200);
  });
});
