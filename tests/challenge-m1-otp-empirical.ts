import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Import handlers to test
// @ts-ignore
import verifyOtpPkgHandler from '../packages/web/api/auth/verify-otp.js';
// @ts-ignore
import verifyOtpRootHandler from '../api/auth/verify-otp.js';
// @ts-ignore
import catchAllPkgHandler from '../packages/web/api/[...route].js';
// @ts-ignore
import catchAllRootHandler from '../api/[...route].js';

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

class MockResponse {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;
  ended: boolean = false;

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
    this.ended = true;
    return this;
  }
}

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function recordPass(suite: string, testName: string, details?: any) {
  results.push({ suite, testName, passed: true, details });
  console.log(`  [PASS] ${suite} -> ${testName}`);
}

function recordFail(suite: string, testName: string, error: string, details?: any) {
  results.push({ suite, testName, passed: false, error, details });
  console.error(`  [FAIL] ${suite} -> ${testName}: ${error}`);
}

async function runEmpiricalChallenge() {
  console.log('================================================================');
  console.log('⚡ EMPIRICAL CHALLENGER: MILESTONE 1 DEEP ADVERSARIAL HARNESS ⚡');
  console.log('================================================================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const createdTestEmails: string[] = [];
  const createdUserIds: string[] = [];
  const createdStoreIds: string[] = [];

  try {
    // =========================================================================
    // PART 1: LIVE NEON DB SCHEMA & INTEGRITY CHECKS
    // =========================================================================
    console.log('--- PART 1: Live Neon DB Schema & Constraint Integrity ---');

    // 1.1 Check users table for password_hash column
    try {
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_hash'
      `);
      if (colRes.rows.length === 1 && colRes.rows[0].data_type === 'text') {
        recordPass('Schema Integrity', 'users.password_hash column exists with type text', colRes.rows[0]);
      } else {
        recordFail('Schema Integrity', 'users.password_hash column check', `Expected 1 row with text type, got: ${JSON.stringify(colRes.rows)}`);
      }
    } catch (e: any) {
      recordFail('Schema Integrity', 'users.password_hash column check', e.message);
    }

    // 1.2 Check user_role enum for TECHNICIAN
    try {
      const enumRes = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = 'user_role'::regtype
        ORDER BY enumlabel
      `);
      const labels = enumRes.rows.map((r) => r.enumlabel);
      if (labels.includes('TECHNICIAN')) {
        recordPass('Schema Integrity', 'user_role enum contains TECHNICIAN', { labels });
      } else {
        recordFail('Schema Integrity', 'user_role enum contains TECHNICIAN', `TECHNICIAN missing from enum labels: ${labels.join(', ')}`);
      }

      // Empirical insert of TECHNICIAN role user
      const tempTechId = crypto.randomUUID();
      const tempTechEmail = `emp.test.tech.${Date.now()}@flashfix.in`;
      createdUserIds.push(tempTechId);
      createdTestEmails.push(tempTechEmail);
      await pool.query(
        `INSERT INTO users (id, name, email, role, email_verified, created_at, updated_at)
         VALUES ($1, 'Test Technician', $2, 'TECHNICIAN', true, NOW(), NOW())`,
        [tempTechId, tempTechEmail]
      );
      const insertedTech = await pool.query(`SELECT id, role FROM users WHERE id = $1`, [tempTechId]);
      if (insertedTech.rows[0]?.role === 'TECHNICIAN') {
        recordPass('Schema Integrity', 'users table accepts TECHNICIAN role insert', insertedTech.rows[0]);
      } else {
        recordFail('Schema Integrity', 'users table accepts TECHNICIAN role insert', 'Failed to read back inserted TECHNICIAN');
      }
    } catch (e: any) {
      recordFail('Schema Integrity', 'user_role TECHNICIAN verification', e.message);
    }

    // 1.3 Check store_admins table exists, schema, and FK constraint enforcement
    try {
      const tableRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'store_admins'
      `);
      if (tableRes.rows.length === 1) {
        recordPass('Schema Integrity', 'store_admins table exists');
      } else {
        recordFail('Schema Integrity', 'store_admins table exists', 'Table public.store_admins not found');
      }

      // Check FK constraints in information_schema
      const fkRes = await pool.query(`
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'store_admins'
      `);
      recordPass('Schema Integrity', 'store_admins foreign keys inspected', fkRes.rows);

      // Empirical FK enforcement: Invalid store_id
      const fakeStoreId = 'nonexistent-store-' + Date.now();
      const fakeUserId = crypto.randomUUID();
      let storeFkBlocked = false;
      try {
        await pool.query(
          `INSERT INTO store_admins (id, store_id, user_id) VALUES (gen_random_uuid(), $1, $2)`,
          [fakeStoreId, fakeUserId]
        );
      } catch (err: any) {
        if (err.code === '23503') {
          storeFkBlocked = true;
        } else {
          console.log('Unexpected error on invalid store_id FK test:', err.code, err.message);
        }
      }
      if (storeFkBlocked) {
        recordPass('Constraint Enforcement', 'store_admins blocks invalid store_id with FK violation 23503');
      } else {
        recordFail('Constraint Enforcement', 'store_admins blocks invalid store_id', 'Insert with invalid store_id did NOT throw 23503 FK error');
      }

      // Empirical FK enforcement: Valid store, invalid user_id
      let userFkBlocked = false;
      try {
        await pool.query(
          `INSERT INTO store_admins (id, store_id, user_id) VALUES (gen_random_uuid(), 'store-001', $1)`,
          [fakeUserId]
        );
      } catch (err: any) {
        if (err.code === '23503') {
          userFkBlocked = true;
        }
      }
      if (userFkBlocked) {
        recordPass('Constraint Enforcement', 'store_admins blocks invalid user_id with FK violation 23503');
      } else {
        recordFail('Constraint Enforcement', 'store_admins blocks invalid user_id', 'Insert with invalid user_id did NOT throw 23503 FK error');
      }

      // Empirical Cascade Delete test
      const tempCascadeStoreId = `temp-store-${Date.now()}`;
      const tempCascadeUserId = crypto.randomUUID();
      const tempCascadeEmail = `cascade.${Date.now()}@flashfix.in`;
      createdStoreIds.push(tempCascadeStoreId);
      createdUserIds.push(tempCascadeUserId);
      createdTestEmails.push(tempCascadeEmail);

      await pool.query(
        `INSERT INTO stores (id, name, address, city, lat, lng, phone, is_active, created_at)
         VALUES ($1, 'Cascade Test Store', 'Test Addr', 'Bengaluru', '12.9352', '77.6245', '9876543210', true, NOW())`,
        [tempCascadeStoreId]
      );
      await pool.query(
        `INSERT INTO users (id, name, email, role, email_verified, created_at, updated_at)
         VALUES ($1, 'Cascade User', $2, 'ADMIN', true, NOW(), NOW())`,
        [tempCascadeUserId, tempCascadeEmail]
      );
      const junctionId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO store_admins (id, store_id, user_id) VALUES ($1, $2, $3)`,
        [junctionId, tempCascadeStoreId, tempCascadeUserId]
      );

      // Verify row exists
      const jCheck = await pool.query(`SELECT * FROM store_admins WHERE id = $1`, [junctionId]);
      if (jCheck.rows.length === 1) {
        // Delete store and verify cascade delete on store_admins
        await pool.query(`DELETE FROM stores WHERE id = $1`, [tempCascadeStoreId]);
        const jAfterStoreDelete = await pool.query(`SELECT * FROM store_admins WHERE id = $1`, [junctionId]);
        if (jAfterStoreDelete.rows.length === 0) {
          recordPass('Constraint Enforcement', 'store_admins CASCADE DELETE on store deletion works');
        } else {
          recordFail('Constraint Enforcement', 'store_admins CASCADE DELETE on store deletion', 'Row still exists after store deleted');
        }
      } else {
        recordFail('Constraint Enforcement', 'store_admins insert valid row', 'Failed to insert test junction row');
      }
    } catch (e: any) {
      recordFail('Constraint Enforcement', 'store_admins FK tests', e.message);
    }

    // 1.4 Check Staff Password Hashes
    try {
      const staffRes = await pool.query(`
        SELECT email, role, password_hash
        FROM users
        WHERE email IN ('superadmin@flashfix.in', 'tech@flashfix.in', 'admin@flashfix.in', 'rider@flashfix.in')
      `);
      let allValid = true;
      for (const row of staffRes.rows) {
        if (!row.password_hash || !row.password_hash.startsWith('$2')) {
          allValid = false;
          recordFail('Staff Passwords', `Staff user ${row.email}`, `Missing or invalid bcrypt hash: ${row.password_hash}`);
        } else {
          // Test bcrypt verify
          const pass = row.role === 'SUPER_ADMIN' || row.role === 'ADMIN' ? 'Admin@123' : (row.role === 'TECHNICIAN' ? 'Tech@123' : 'Rider@123');
          const matches = bcrypt.compareSync(pass, row.password_hash);
          if (matches) {
            recordPass('Staff Passwords', `Staff user ${row.email} has valid bcrypt hash matching ${pass}`);
          } else {
            recordFail('Staff Passwords', `Staff user ${row.email} bcrypt comparison`, `Password does not match expected password`);
            allValid = false;
          }
        }
      }
      if (allValid) {
        recordPass('Staff Passwords', 'All critical staff accounts have valid verified password hashes');
      }
    } catch (e: any) {
      recordFail('Staff Passwords', 'Staff password verification', e.message);
    }

    // =========================================================================
    // PART 2: EMPIRICAL OTP ADVERSARIAL STRESS HARNESS
    // =========================================================================
    console.log('\n--- PART 2: Empirical OTP Logic Adversarial Stress Harness ---');

    const handlersToTest = [
      { name: 'packages/web/api/auth/verify-otp.ts', handler: verifyOtpPkgHandler, isRoute: false },
      { name: 'api/auth/verify-otp.ts', handler: verifyOtpRootHandler, isRoute: false },
      { name: 'packages/web/api/[...route].ts', handler: catchAllPkgHandler, isRoute: true },
      { name: 'api/[...route].ts', handler: catchAllRootHandler, isRoute: true },
    ];

    for (const h of handlersToTest) {
      console.log(`\nTesting Handler: ${h.name}...`);

      // 2.1 Valid OTP Test: SHA-256 matching code_hash, verified = true, valid tokens
      {
        const testEmail = `valid.otp.${Date.now()}.${Math.floor(Math.random() * 1000)}@flashfix.in`;
        const code = '729104';
        const codeH = hashOtp(code);
        createdTestEmails.push(testEmail);

        await pool.query(
          `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
           VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
          [testEmail, codeH]
        );

        const req: any = {
          method: 'POST',
          body: { email: testEmail, code },
          ...(h.isRoute ? { url: '/api/auth/verify-otp' } : {}),
        };
        const res = new MockResponse();
        await h.handler(req, res);

        if (res.statusCode === 200 && res.body?.success === true && res.body?.accessToken && res.body?.user?.emailVerified === true) {
          // Check DB record was updated to verified = true
          const dbRow = await pool.query(`SELECT verified, attempts FROM otp_codes WHERE email = $1`, [testEmail]);
          if (dbRow.rows[0]?.verified === true) {
            recordPass(h.name, 'Valid OTP: returns 200, sets verified = true, returns valid JWT and emailVerified = true');
          } else {
            recordFail(h.name, 'Valid OTP: DB verified status', `DB verified is ${dbRow.rows[0]?.verified}, expected true`);
          }
        } else {
          recordFail(h.name, 'Valid OTP', `Expected 200 with tokens, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
      }

      // 2.2 Wrong OTP Test: increments attempts and returns 401
      {
        const testEmail = `wrong.otp.${Date.now()}.${Math.floor(Math.random() * 1000)}@flashfix.in`;
        const code = '729104';
        const wrongCode = '998877';
        const codeH = hashOtp(code);
        createdTestEmails.push(testEmail);

        await pool.query(
          `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
           VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
          [testEmail, codeH]
        );

        const req: any = {
          method: 'POST',
          body: { email: testEmail, code: wrongCode },
          ...(h.isRoute ? { url: '/api/auth/verify-otp' } : {}),
        };
        const res = new MockResponse();
        await h.handler(req, res);

        const dbRow = await pool.query(`SELECT verified, attempts FROM otp_codes WHERE email = $1`, [testEmail]);
        if (res.statusCode === 401 && dbRow.rows[0]?.attempts === 1 && dbRow.rows[0]?.verified === false) {
          recordPass(h.name, 'Wrong OTP: returns 401 and increments attempts to 1 while verified remains false');
        } else {
          recordFail(h.name, 'Wrong OTP', `Expected 401 and attempts=1, got status ${res.statusCode}, attempts=${dbRow.rows[0]?.attempts}`);
        }
      }

      // 2.3 Replay Attack Test: Already verified OTP cannot be reused
      {
        const testEmail = `replay.otp.${Date.now()}.${Math.floor(Math.random() * 1000)}@flashfix.in`;
        const code = '615243';
        const codeH = hashOtp(code);
        createdTestEmails.push(testEmail);

        // Insert code that is already marked verified = true
        await pool.query(
          `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
           VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), true, 0)`,
          [testEmail, codeH]
        );

        const req: any = {
          method: 'POST',
          body: { email: testEmail, code },
          ...(h.isRoute ? { url: '/api/auth/verify-otp' } : {}),
        };
        const res = new MockResponse();
        await h.handler(req, res);

        if (res.statusCode === 401) {
          recordPass(h.name, 'Replay Attack: rejected with 401 when code was already verified');
        } else {
          recordFail(h.name, 'Replay Attack', `Expected 401 for already verified code, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
      }

      // 2.4 Expired OTP Test: expires_at < NOW() must be rejected with 401
      {
        const testEmail = `expired.otp.${Date.now()}.${Math.floor(Math.random() * 1000)}@flashfix.in`;
        const code = '839201';
        const codeH = hashOtp(code);
        createdTestEmails.push(testEmail);

        // Insert code expired 5 minutes ago
        await pool.query(
          `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
           VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '15 minutes', false, 0)`,
          [testEmail, codeH]
        );

        const req: any = {
          method: 'POST',
          body: { email: testEmail, code },
          ...(h.isRoute ? { url: '/api/auth/verify-otp' } : {}),
        };
        const res = new MockResponse();
        await h.handler(req, res);

        if (res.statusCode === 401) {
          recordPass(h.name, 'Expired OTP: rejected with 401 when expires_at < NOW()');
        } else {
          recordFail(h.name, 'Expired OTP', `Expected 401 for expired code, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
      }

      // 2.5 Purpose Isolation Test: purpose != 'LOGIN' must NOT be consumed by login
      {
        const testEmail = `purpose.otp.${Date.now()}.${Math.floor(Math.random() * 1000)}@flashfix.in`;
        const code = '502918';
        const codeH = hashOtp(code);
        createdTestEmails.push(testEmail);

        // Insert code with purpose = 'CUSTODY'
        await pool.query(
          `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
           VALUES (gen_random_uuid(), $1, $2, 'CUSTODY', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
          [testEmail, codeH]
        );

        const req: any = {
          method: 'POST',
          body: { email: testEmail, code },
          ...(h.isRoute ? { url: '/api/auth/verify-otp' } : {}),
        };
        const res = new MockResponse();
        await h.handler(req, res);

        if (res.statusCode === 401) {
          recordPass(h.name, "Purpose Isolation: code with purpose != 'LOGIN' rejected by login verification");
        } else {
          recordFail(h.name, 'Purpose Isolation', `Expected 401 for non-LOGIN purpose, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
      }

      // 2.6 Brute-force Lockout Test: 5 failed attempts locks out the OTP
      {
        const testEmail = `lockout.otp.${Date.now()}.${Math.floor(Math.random() * 1000)}@flashfix.in`;
        const code = '491823';
        const codeH = hashOtp(code);
        createdTestEmails.push(testEmail);

        // Insert code with attempts = 5
        await pool.query(
          `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
           VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 5)`,
          [testEmail, codeH]
        );

        // Submit the CORRECT code, but attempts is already 5
        const req: any = {
          method: 'POST',
          body: { email: testEmail, code },
          ...(h.isRoute ? { url: '/api/auth/verify-otp' } : {}),
        };
        const res = new MockResponse();
        await h.handler(req, res);

        const dbRow = await pool.query(`SELECT verified, attempts FROM otp_codes WHERE email = $1`, [testEmail]);
        if (res.statusCode === 400 && res.body?.error?.code === 'OTP_MAX_ATTEMPTS_EXCEEDED' && dbRow.rows[0]?.verified === false) {
          recordPass(h.name, 'Brute-force Lockout: 5 failed attempts locks out code even if valid code is entered, returns 400 OTP_MAX_ATTEMPTS_EXCEEDED');
        } else {
          recordFail(h.name, 'Brute-force Lockout', `Expected 400 with OTP_MAX_ATTEMPTS_EXCEEDED and verified=false, got status ${res.statusCode}: ${JSON.stringify(res.body)}`);
        }
      }

      // 2.7 Production Demo Code Isolation
      {
        const prevEnv = process.env.NODE_ENV;
        try {
          process.env.NODE_ENV = 'production';
          const fakeEmail = `prod.demo.${Date.now()}@flashfix.in`;
          const req: any = {
            method: 'POST',
            body: { email: fakeEmail, code: '123456' },
            ...(h.isRoute ? { url: '/api/auth/verify-otp' } : {}),
          };
          const res = new MockResponse();
          await h.handler(req, res);

          if (res.statusCode === 401) {
            recordPass(h.name, 'Demo Code Isolation: 123456 rejected in NODE_ENV=production when no matching OTP exists in DB');
          } else {
            recordFail(h.name, 'Demo Code Isolation in Production', `Expected 401 in production for 123456, got ${res.statusCode}`);
          }
        } finally {
          process.env.NODE_ENV = prevEnv;
        }
      }
    }

    // =========================================================================
    // PART 3: ADVERSARIAL STRESS TEST — MEMORY VS DATABASE REPLAY IN [...route].ts
    // =========================================================================
    console.log('\n--- PART 3: Adversarial Challenge: Memory Cache vs Neon DB Sync ---');
    {
      // Let's test what happens when send-otp is invoked through [...route].ts
      // send-otp populates otpMemoryCache AND inserts into Neon DB.
      // Then verify-otp is called on [...route].ts with valid code.
      // DOES Neon DB get updated to verified = true?
      // If NOT, an attacker can submit the same code a 2nd time!
      const testEmail = `memdb.challenge.${Date.now()}@flashfix.in`;
      createdTestEmails.push(testEmail);

      const sendReq = {
        url: '/api/auth/send-otp',
        method: 'POST',
        body: { email: testEmail },
      };
      const sendRes = new MockResponse();
      await catchAllPkgHandler(sendReq, sendRes);

      if (sendRes.statusCode === 200) {
        // Query Neon DB to find the generated OTP code_hash
        const dbCodeRow = await pool.query(
          `SELECT id, code_hash, verified, attempts FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
          [testEmail]
        );

        if (dbCodeRow.rows.length > 0) {
          const insertedHash = dbCodeRow.rows[0].code_hash;
          // In send-otp, the code was sent via Brevo. Let's see if we can deduce the 6 digit code or test by matching code_hash
          // Or let's test by setting an explicit memory cache + DB entry or brute forcing the 6-digit code (since it's a 6 digit number, brute force sha256 takes < 100ms in Node)
          let discoveredCode = '';
          for (let i = 100000; i <= 999999; i++) {
            const c = i.toString();
            if (hashOtp(c) === insertedHash) {
              discoveredCode = c;
              break;
            }
          }

          if (discoveredCode) {
            console.log(`  Discovered generated code: ${discoveredCode} for hash ${insertedHash}`);

            // First verify call on [...route].ts
            const verifyReq1 = {
              url: '/api/auth/verify-otp',
              method: 'POST',
              body: { email: testEmail, code: discoveredCode },
            };
            const verifyRes1 = new MockResponse();
            await catchAllPkgHandler(verifyReq1, verifyRes1);

            console.log(`  First verify response: status=${verifyRes1.statusCode}, success=${verifyRes1.body?.success}`);

            // Inspect DB immediately after first verify
            const dbAfterFirstVerify = await pool.query(
              `SELECT id, verified, attempts FROM otp_codes WHERE id = $1`,
              [dbCodeRow.rows[0].id]
            );
            const isDbVerified = dbAfterFirstVerify.rows[0]?.verified;
            console.log(`  DB verified status after first verify (handled via memory cache): ${isDbVerified}`);

            // Attempt SECOND verify with the same code (REPLAY ATTACK)
            const verifyReq2 = {
              url: '/api/auth/verify-otp',
              method: 'POST',
              body: { email: testEmail, code: discoveredCode },
            };
            const verifyRes2 = new MockResponse();
            await catchAllPkgHandler(verifyReq2, verifyRes2);

            console.log(`  Second verify response (Replay Attack): status=${verifyRes2.statusCode}`);

            if (verifyRes2.statusCode === 401) {
              recordPass('Adversarial Stress', 'Memory-to-DB Replay: Second verification attempt was properly REJECTED with 401', {
                isDbVerified,
                secondStatus: verifyRes2.statusCode,
              });
            } else if (verifyRes2.statusCode === 200) {
              recordFail(
                'Adversarial Stress',
                'Memory-to-DB Replay Vulnerability Confirmed!',
                `CRITICAL: Replay attack succeeded! When verified via memory cache, DB was NOT updated to verified=true, allowing a second verification with status 200!`,
                { firstStatus: verifyRes1.statusCode, secondStatus: verifyRes2.statusCode, dbVerified: isDbVerified }
              );
            }
          }
        }
      } else {
        console.log('send-otp failed (possibly Brevo quota or config):', sendRes.body);
      }
    }

  } finally {
    // Clean up created test data
    console.log('\n--- Cleaning up test artifacts from Neon DB ---');
    if (createdTestEmails.length > 0) {
      await pool.query(`DELETE FROM otp_codes WHERE email = ANY($1)`, [createdTestEmails]);
      await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdTestEmails]);
    }
    if (createdStoreIds.length > 0) {
      await pool.query(`DELETE FROM stores WHERE id = ANY($1)`, [createdStoreIds]);
    }
    if (createdUserIds.length > 0) {
      await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUserIds]);
    }
    await pool.end();
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log('CHALLENGER VERIFICATION SUMMARY:');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total assertions: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    console.error('\nFAILED ASSERTIONS:');
    for (const f of results.filter((r) => !r.passed)) {
      console.error(`- [${f.suite}] ${f.testName}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log('\nALL EMPIRICAL ADVERSARIAL CHALLENGES PASSED! 🎉');
    process.exit(0);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
