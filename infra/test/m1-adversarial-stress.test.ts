import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import verifyOtpWebHandler from '../../packages/web/api/auth/verify-otp.js';
import verifyOtpRootHandler from '../../api/auth/verify-otp.js';
import catchAllWebHandler from '../../packages/web/api/[...route].js';
import catchAllRootHandler from '../../api/[...route].js';

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

class MockResponse {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;

  setHeader(name: string, value: string) {
    this.headers[name] = value;
    return this;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: any) {
    this.body = data;
    return this;
  }

  end() {
    return this;
  }
}

async function invokeHandler(handler: Function, req: any): Promise<MockResponse> {
  const res = new MockResponse();
  await handler(req, res);
  return res;
}

describe('Milestone 1 Adversarial Stress Test Suite', () => {
  let pool: Pool;
  const createdTestEmails: string[] = [];
  const createdTestUserIds: string[] = [];
  const createdTestStoreIds: string[] = [];

  before(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  });

  after(async () => {
    if (pool) {
      if (createdTestEmails.length > 0) {
        await pool.query('DELETE FROM otp_codes WHERE email = ANY($1)', [createdTestEmails]);
        await pool.query('DELETE FROM users WHERE email = ANY($1)', [createdTestEmails]);
      }
      if (createdTestUserIds.length > 0) {
        await pool.query('DELETE FROM store_admins WHERE user_id = ANY($1)', [createdTestUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdTestUserIds]);
      }
      if (createdTestStoreIds.length > 0) {
        await pool.query('DELETE FROM store_admins WHERE store_id = ANY($1)', [createdTestStoreIds]);
        await pool.query('DELETE FROM stores WHERE id = ANY($1)', [createdTestStoreIds]);
      }
      await pool.end();
    }
  });

  // =========================================================================
  // 1. ENDPOINT BEHAVIORAL PARITY & MALFORMED PAYLOADS
  // =========================================================================
  describe('Endpoint Parity: Malformed Payloads & Boundary Handling', () => {
    const handlers = [
      { name: 'packages/web/api/auth/verify-otp.ts', fn: verifyOtpWebHandler, isRoute: false },
      { name: 'api/auth/verify-otp.ts', fn: verifyOtpRootHandler, isRoute: false },
      { name: 'packages/web/api/[...route].ts', fn: catchAllWebHandler, isRoute: true },
      { name: 'api/[...route].ts', fn: catchAllRootHandler, isRoute: true },
    ];

    for (const { name, fn, isRoute } of handlers) {
      describe(`Handler: ${name}`, () => {
        const makeReq = (body: any, method = 'POST') => {
          if (isRoute) {
            return { url: '/api/auth/verify-otp', method, body };
          }
          return { method, body };
        };

        test('Rejects missing email with 400', async () => {
          const res = await invokeHandler(fn, makeReq({ code: '849201' }));
          assert.equal(res.statusCode, 400);
          assert.ok(res.body?.error?.message, 'Must return error message');
        });

        test('Rejects empty string email with 400', async () => {
          const res = await invokeHandler(fn, makeReq({ email: '   ', code: '849201' }));
          assert.equal(res.statusCode, 400);
          assert.ok(res.body?.error?.message);
        });

        test('Rejects missing code with 400', async () => {
          const res = await invokeHandler(fn, makeReq({ email: 'user@flashfix.in' }));
          assert.equal(res.statusCode, 400);
          assert.ok(res.body?.error?.message);
        });

        test('Rejects empty string code with 400', async () => {
          const res = await invokeHandler(fn, makeReq({ email: 'user@flashfix.in', code: '   ' }));
          assert.equal(res.statusCode, 400);
          assert.ok(res.body?.error?.message);
        });

        test('Rejects completely empty payload with 400', async () => {
          const res = await invokeHandler(fn, makeReq({}));
          assert.equal(res.statusCode, 400);
          assert.ok(res.body?.error?.message);
        });

        test('Rejects null body or empty string with 400', async () => {
          const res = await invokeHandler(fn, makeReq(''));
          assert.equal(res.statusCode, 400);
        });

        test('Handles string with surrounding spaces by trimming correctly', async () => {
          const testEmail = `adversarial.spaces.${Date.now()}.${Math.random()}@flashfix.in`;
          createdTestEmails.push(testEmail);
          const rawCode = '739281';
          const codeH = hashOtp(rawCode);

          await pool.query(
            `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
             VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
            [testEmail, codeH]
          );

          // Code with leading and trailing whitespace
          const res = await invokeHandler(fn, makeReq({ email: `  ${testEmail}  `, code: `  ${rawCode}  ` }));
          assert.equal(res.statusCode, 200, `Failed to trim whitespace: status=${res.statusCode}`);
          assert.equal(res.body?.success, true);
          assert.ok(res.body?.accessToken);
        });

        test('Rejects code with interior spaces with 401', async () => {
          const testEmail = `adversarial.innerspace.${Date.now()}.${Math.random()}@flashfix.in`;
          createdTestEmails.push(testEmail);
          const rawCode = '739282';
          const codeH = hashOtp(rawCode);

          await pool.query(
            `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
             VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
            [testEmail, codeH]
          );

          const res = await invokeHandler(fn, makeReq({ email: testEmail, code: '73 92 82' }));
          assert.equal(res.statusCode, 401);
          assert.ok(res.body?.error?.message);
        });

        test('Rejects XSS and script tags in code safely with 401', async () => {
          const testEmail = `adversarial.xss.${Date.now()}@flashfix.in`;
          const res = await invokeHandler(fn, makeReq({ email: testEmail, code: '<script>alert(1)</script>' }));
          assert.equal(res.statusCode, 401);
          assert.ok(res.body?.error?.message);
        });
      });
    }
  });

  // =========================================================================
  // 2. SQL INJECTION RESISTANCE VIA PARAMETERIZED QUERIES
  // =========================================================================
  describe('SQL Injection Adversarial Stress', () => {
    const maliciousEmails = [
      "' OR '1'='1",
      "admin@flashfix.in' OR '1'='1",
      "admin@flashfix.in'; DROP TABLE otp_codes; --",
      "test@flashfix.in'; SELECT pg_sleep(5); --",
      "test@flashfix.in' UNION SELECT id, email, password_hash, role FROM users --",
      "admin@flashfix.in'--",
      "' OR 1=1; --",
      "\" OR \"\"=\"",
    ];

    for (const sqlPayload of maliciousEmails) {
      test(`Safely handles SQL payload in email: [${sqlPayload}]`, async () => {
        // Use an un-seeded, non-demo random code ('839102') so universal demo bypass ('123456') does not mask SQL testing
        const res = await invokeHandler(verifyOtpWebHandler, {
          method: 'POST',
          body: { email: sqlPayload, code: '839102' },
        });

        // Must reject unauthorized or bad input with 401, NEVER execute SQL injection
        assert.equal(
          res.statusCode,
          401,
          `Expected 401 for SQL payload without valid code, got ${res.statusCode}`
        );

        // Verify table integrity: otp_codes must still exist
        const check = await pool.query('SELECT COUNT(*) FROM otp_codes');
        assert.ok(Number(check.rows[0].count) >= 0, 'otp_codes table must exist and remain intact');
      });
    }

    test('Safely handles SQL payload in code parameter', async () => {
      const sqlCodePayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "123456' UNION SELECT * FROM otp_codes --",
      ];

      for (const payload of sqlCodePayloads) {
        const res = await invokeHandler(verifyOtpWebHandler, {
          method: 'POST',
          body: { email: 'superadmin@flashfix.in', code: payload },
        });
        assert.equal(
          res.statusCode,
          401,
          `Expected 401 for SQL code payload, got ${res.statusCode}`
        );
      }
    });

    test('Demo code backdoor is disabled when NODE_ENV === production', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const testEmail = `production.demo.check.${Date.now()}@flashfix.in`;
        const res = await invokeHandler(verifyOtpWebHandler, {
          method: 'POST',
          body: { email: testEmail, code: '123456' },
        });
        assert.equal(
          res.statusCode,
          401,
          'In production mode, code 123456 without DB record MUST be rejected with 401'
        );
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  // =========================================================================
  // 3. TIMING & EXPIRATION BOUNDARIES
  // =========================================================================
  describe('Timing & Expiration Boundaries Stress', () => {
    test('Allows OTP valid 2 seconds before expiration', async () => {
      const email = `boundary.unexpired.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email);
      const code = '654321';
      const codeH = hashOtp(code);

      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '2 seconds', NOW(), false, 0)`,
        [email, codeH]
      );

      const res = await invokeHandler(verifyOtpWebHandler, {
        method: 'POST',
        body: { email, code },
      });
      assert.equal(res.statusCode, 200, 'Should allow verification before expiration');
      assert.equal(res.body?.success, true);
    });

    test('Rejects OTP expired 1 second in the past', async () => {
      const email = `boundary.expired.1s.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email);
      const code = '654321';
      const codeH = hashOtp(code);

      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() - INTERVAL '1 second', NOW() - INTERVAL '10 minutes', false, 0)`,
        [email, codeH]
      );

      const res = await invokeHandler(verifyOtpWebHandler, {
        method: 'POST',
        body: { email, code },
      });
      assert.equal(res.statusCode, 401, 'Should reject expired code');
      assert.match(res.body?.error?.message, /Invalid or expired/i);
    });

    test('Rejects OTP expired 10 minutes ago', async () => {
      const email = `boundary.expired.10m.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email);
      const code = '654321';
      const codeH = hashOtp(code);

      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '20 minutes', false, 0)`,
        [email, codeH]
      );

      const res = await invokeHandler(verifyOtpWebHandler, {
        method: 'POST',
        body: { email, code },
      });
      assert.equal(res.statusCode, 401);
    });

    test('Rejects OTP with non-LOGIN purpose (e.g. PICKUP or CUSTODY)', async () => {
      const email = `boundary.purpose.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email);
      const code = '654321';
      const codeH = hashOtp(code);

      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'PICKUP', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email, codeH]
      );

      const res = await invokeHandler(verifyOtpWebHandler, {
        method: 'POST',
        body: { email, code },
      });
      assert.equal(res.statusCode, 401, 'Must reject OTP issued for purpose != LOGIN');
    });
  });

  // =========================================================================
  // 4. ATTEMPT LIMITS, LOCKOUT & REPLAY ATTACK STRESS
  // =========================================================================
  describe('Attempt Limits, Lockout & Replay Attacks', () => {
    test('Lockout after 5 wrong attempts prevents even the correct code', async () => {
      const email = `lockout.test.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email);
      const validCode = '928374';
      const wrongCode = '000000';
      const codeH = hashOtp(validCode);

      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email, codeH]
      );

      // Submit wrong code 5 times
      for (let i = 1; i <= 5; i++) {
        const res = await invokeHandler(verifyOtpWebHandler, {
          method: 'POST',
          body: { email, code: wrongCode },
        });
        assert.equal(res.statusCode, 401, `Attempt ${i} should return 401`);

        const dbRow = await pool.query('SELECT attempts FROM otp_codes WHERE email = $1', [email]);
        assert.equal(dbRow.rows[0].attempts, i, `Database attempts counter must equal ${i}`);
      }

      // 6th attempt with CORRECT code -> MUST be locked out with OTP_MAX_ATTEMPTS_EXCEEDED (400)
      const resLocked = await invokeHandler(verifyOtpWebHandler, {
        method: 'POST',
        body: { email, code: validCode },
      });
      assert.equal(resLocked.statusCode, 400, 'Locked out OTP must return HTTP 400');
      assert.equal(
        resLocked.body?.error?.code,
        'OTP_MAX_ATTEMPTS_EXCEEDED',
        'Must return OTP_MAX_ATTEMPTS_EXCEEDED error code'
      );
    });

    test('Replay attack: Verified code cannot be reused on verify-otp', async () => {
      const email = `replay.test.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email);
      const code = '554433';
      const codeH = hashOtp(code);

      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email, codeH]
      );

      // First verification: success
      const res1 = await invokeHandler(verifyOtpWebHandler, {
        method: 'POST',
        body: { email, code },
      });
      assert.equal(res1.statusCode, 200);

      // Replay verification: must be rejected with 401
      const res2 = await invokeHandler(verifyOtpWebHandler, {
        method: 'POST',
        body: { email, code },
      });
      assert.equal(res2.statusCode, 401, 'Replay attempt must be rejected with 401');
    });

    test('Adversarial Finding: [...route].ts memory cache replay vulnerability check', async () => {
      const email = `adversarial.route.mem.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email);

      // Trigger send-otp via [...route].ts
      const sendRes = await invokeHandler(catchAllWebHandler, {
        url: '/api/auth/send-otp',
        method: 'POST',
        body: { email },
      });
      assert.equal(sendRes.statusCode, 200);

      // Retrieve generated OTP from DB
      const dbRow = await pool.query(
        'SELECT * FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
        [email]
      );
      const codeHash = dbRow.rows[0]?.code_hash;

      // Find numeric code by matching hash
      let code = '';
      for (let c = 100000; c <= 999999; c++) {
        if (hashOtp(c.toString()) === codeHash) {
          code = c.toString();
          break;
        }
      }
      assert.ok(code, 'Must find generated code');

      // 1st verification via [...route].ts (verified via memory cache)
      const v1 = await invokeHandler(catchAllWebHandler, {
        url: '/api/auth/verify-otp',
        method: 'POST',
        body: { email, code },
      });
      assert.equal(v1.statusCode, 200);

      // Inspect DB row immediately after memory verification:
      const dbAfterV1 = await pool.query(
        'SELECT verified FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
        [email]
      );
      
      // Memory cache verification failed to update Neon DB:
      const wasDbUpdated = dbAfterV1.rows[0]?.verified === true;

      // Second verification (Replay attack):
      const v2 = await invokeHandler(catchAllWebHandler, {
        url: '/api/auth/verify-otp',
        method: 'POST',
        body: { email, code },
      });

      // A secure system MUST reject replay attacks with 401.
      // If v2 returns 200, it demonstrates the memory-cache replay vulnerability!
      console.log('Memory-cache synchronization state:', {
        wasDbUpdated,
        replayResponseStatusCode: v2.statusCode,
      });

      // Assert that replay should be rejected
      assert.equal(
        v2.statusCode,
        401,
        'SECURITY DEFECT: [...route].ts allowed replay attack because memory cache verification skipped updating Neon DB verified=true'
      );
    });
  });

  // =========================================================================
  // 5. DATABASE SCHEMA STRESS: UNIQUE CONSTRAINTS & CASCADE DELETES
  // =========================================================================
  describe('Database Schema Stress: store_admins Constraints & Cascades', () => {
    test('Enforces UNIQUE constraint on store_admins(store_id, user_id)', async () => {
      // 1. Create a temporary test user
      const testEmail = `schema.unique.user.${Date.now()}@flashfix.in`;
      createdTestEmails.push(testEmail);
      const userRes = await pool.query(
        `INSERT INTO users (id, name, email, role, created_at, updated_at)
         VALUES (gen_random_uuid(), 'Test Unique User', $1, 'ADMIN', NOW(), NOW()) RETURNING id`,
        [testEmail]
      );
      const testUserId = userRes.rows[0].id;
      createdTestUserIds.push(testUserId);

      // 2. Insert first record into store_admins
      await pool.query(
        `INSERT INTO store_admins (id, store_id, user_id) VALUES (gen_random_uuid(), 'store-001', $1)`,
        [testUserId]
      );

      // 3. Attempt duplicate insert with same (store_id, user_id)
      let duplicateError: any = null;
      try {
        await pool.query(
          `INSERT INTO store_admins (id, store_id, user_id) VALUES (gen_random_uuid(), 'store-001', $1)`,
          [testUserId]
        );
      } catch (err) {
        duplicateError = err;
      }

      assert.ok(duplicateError, 'Must throw error on duplicate store_admins insert');
      assert.equal(
        duplicateError.code,
        '23505',
        `Expected PostgreSQL unique_violation code 23505, got ${duplicateError.code}`
      );
      assert.match(
        duplicateError.message,
        /uq_store_admins|duplicate key/i,
        'Error must reference unique constraint'
      );
    });

    test('Cascade delete: Deleting a USER automatically deletes all store_admins assignments', async () => {
      // 1. Create a test user
      const testEmail = `schema.cascade.user.${Date.now()}@flashfix.in`;
      createdTestEmails.push(testEmail);
      const userRes = await pool.query(
        `INSERT INTO users (id, name, email, role, created_at, updated_at)
         VALUES (gen_random_uuid(), 'Cascade User', $1, 'ADMIN', NOW(), NOW()) RETURNING id`,
        [testEmail]
      );
      const testUserId = userRes.rows[0].id;
      createdTestUserIds.push(testUserId);

      // 2. Assign to both store-001 and store-002
      await pool.query(
        `INSERT INTO store_admins (id, store_id, user_id) VALUES 
         (gen_random_uuid(), 'store-001', $1),
         (gen_random_uuid(), 'store-002', $1)`,
        [testUserId]
      );

      // Verify records exist
      const beforeCount = await pool.query('SELECT COUNT(*) FROM store_admins WHERE user_id = $1', [testUserId]);
      assert.equal(Number(beforeCount.rows[0].count), 2);

      // 3. Delete the user
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);

      // 4. Verify cascade delete in store_admins
      const afterCount = await pool.query('SELECT COUNT(*) FROM store_admins WHERE user_id = $1', [testUserId]);
      assert.equal(
        Number(afterCount.rows[0].count),
        0,
        'All store_admins records must be deleted via CASCADE when user is deleted'
      );
    });

    test('Cascade delete: Deleting a STORE automatically deletes all store_admins assignments', async () => {
      // 1. Create a test store
      const tempStoreId = `temp-store-${Date.now()}`;
      createdTestStoreIds.push(tempStoreId);
      await pool.query(
        `INSERT INTO stores (id, name, address, city, lat, lng, is_active, created_at)
         VALUES ($1, 'Temp Test Store', '123 Test Rd', 'Hyderabad', 17.44, 78.38, true, NOW())`,
        [tempStoreId]
      );

      // 2. Create a test user
      const testEmail = `schema.cascade.store.${Date.now()}@flashfix.in`;
      createdTestEmails.push(testEmail);
      const userRes = await pool.query(
        `INSERT INTO users (id, name, email, role, created_at, updated_at)
         VALUES (gen_random_uuid(), 'Store Cascade User', $1, 'ADMIN', NOW(), NOW()) RETURNING id`,
        [testEmail]
      );
      const testUserId = userRes.rows[0].id;
      createdTestUserIds.push(testUserId);

      // 3. Insert into store_admins
      await pool.query(
        `INSERT INTO store_admins (id, store_id, user_id) VALUES (gen_random_uuid(), $1, $2)`,
        [tempStoreId, testUserId]
      );

      const beforeCount = await pool.query('SELECT COUNT(*) FROM store_admins WHERE store_id = $1', [tempStoreId]);
      assert.equal(Number(beforeCount.rows[0].count), 1);

      // 4. Delete the store
      await pool.query('DELETE FROM stores WHERE id = $1', [tempStoreId]);

      // 5. Verify cascade delete in store_admins
      const afterCount = await pool.query('SELECT COUNT(*) FROM store_admins WHERE store_id = $1', [tempStoreId]);
      assert.equal(
        Number(afterCount.rows[0].count),
        0,
        'All store_admins records must be deleted via CASCADE when store is deleted'
      );
    });
  });

  // =========================================================================
  // 6. BCRYPT PASSWORD HASH VALIDATION IN NEON DB
  // =========================================================================
  describe('Bcrypt Password Hash Validation for Neon DB Staff Users', () => {
    const expectedStaffCredentials = [
      { email: 'superadmin@flashfix.in', role: 'SUPER_ADMIN', password: 'Admin@123' },
      { email: 'admin.koramangala@flashfix.in', role: 'ADMIN', password: 'Admin@123' },
      { email: 'admin.indiranagar@flashfix.in', role: 'ADMIN', password: 'Admin@123' },
      { email: 'admin@flashfix.in', role: 'ADMIN', password: 'Admin@123' },
      { email: 'tech.vikram@flashfix.in', role: 'EMPLOYEE', password: 'Tech@123' },
      { email: 'tech@flashfix.in', role: 'TECHNICIAN', password: 'Tech@123' },
      { email: 'delivery.rajesh@flashfix.in', role: 'EMPLOYEE', password: 'Rider@123' },
      { email: 'rider@flashfix.in', role: 'EMPLOYEE', password: 'Rider@123' },
    ];

    for (const staff of expectedStaffCredentials) {
      test(`Validates bcrypt password hash for ${staff.email} (${staff.role})`, async () => {
        const res = await pool.query('SELECT id, email, role, password_hash FROM users WHERE email = $1', [staff.email]);
        assert.equal(res.rows.length, 1, `Staff user ${staff.email} must exist in users table`);

        const user = res.rows[0];
        assert.ok(user.password_hash, `password_hash must be non-null for ${staff.email}`);
        assert.match(
          user.password_hash,
          /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/,
          `Hash must be valid bcrypt format: ${user.password_hash}`
        );

        // Verify positive authentication match
        const matchesExpected = bcrypt.compareSync(staff.password, user.password_hash);
        assert.equal(
          matchesExpected,
          true,
          `Password '${staff.password}' must match bcrypt hash for ${staff.email}`
        );

        // Verify negative authentication mismatch
        const matchesWrong = bcrypt.compareSync('WrongPassword!2026', user.password_hash);
        assert.equal(
          matchesWrong,
          false,
          `Arbitrary wrong password must NOT match bcrypt hash for ${staff.email}`
        );
      });
    }
  });
});
