import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'crypto';

// Import handlers under test
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
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function recordPass(suite: string, name: string, details?: any) {
  results.push({ suite, name, passed: true, details });
  console.log(`  [PASS] ${suite} -> ${name}`);
}

function recordFail(suite: string, name: string, error: string, details?: any) {
  results.push({ suite, name, passed: false, error, details });
  console.error(`  [FAIL] ${suite} -> ${name}: ${error}`);
}

async function runEdgeCases() {
  console.log('================================================================');
  console.log('⚡ ADVERSARIAL CHALLENGER: OBJECTIVE 3 DEEP EDGE CASES HARNESS ⚡');
  console.log('================================================================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const createdTestEmails: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 3A: HIGH CONCURRENCY / SIMULTANEOUS VERIFICATION RACE CONDITION
    // -------------------------------------------------------------------------
    console.log('--- TEST 3A: High Concurrency / Simultaneous Verification Race Condition ---');
    {
      const testEmail = `race.concurrency.${Date.now()}@flashfix.in`;
      createdTestEmails.push(testEmail);
      const code = '482910';
      const codeH = hashOtp(code);

      // Seed valid unverified OTP in Neon DB
      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [testEmail, codeH]
      );

      // Fire 10 simultaneous verification requests at the exact same instant
      const concurrencyCount = 10;
      const promises = Array.from({ length: concurrencyCount }, async (_, idx) => {
        const req: any = {
          url: '/api/auth/verify-otp',
          method: 'POST',
          body: { email: testEmail, code },
        };
        const res = new MockResponse();
        // Alternate between catchAllPkgHandler and catchAllRootHandler
        const handler = idx % 2 === 0 ? catchAllPkgHandler : catchAllRootHandler;
        await handler(req, res);
        return { idx, statusCode: res.statusCode, body: res.body };
      });

      const responses = await Promise.all(promises);
      const successes = responses.filter((r) => r.statusCode === 200);
      const rejects = responses.filter((r) => r.statusCode === 401);

      console.log(`  Concurrency results (${concurrencyCount} simultaneous requests):`, {
        successCount: successes.length,
        rejectCount: rejects.length,
        otherCount: responses.length - successes.length - rejects.length,
      });

      if (successes.length === 1 && rejects.length === concurrencyCount - 1) {
        recordPass(
          'Concurrency Stress',
          'Exactly 1 request succeeded (200) and all 9 concurrent race requests were rejected (401)',
          { successes: successes.length, rejects: rejects.length }
        );
      } else {
        recordFail(
          'Concurrency Stress',
          'Simultaneous verification race condition',
          `Expected exactly 1 success and ${concurrencyCount - 1} 401 rejections, but got ${successes.length} successes and ${rejects.length} rejections`
        );
      }

      // Check DB verified status
      const dbCheck = await pool.query(`SELECT verified, attempts FROM otp_codes WHERE email = $1`, [testEmail]);
      if (dbCheck.rows[0]?.verified === true) {
        recordPass('Concurrency Stress', 'Database verified flag is true after concurrent race');
      } else {
        recordFail('Concurrency Stress', 'Database verified status', 'DB verified is false after concurrent race');
      }
    }

    // -------------------------------------------------------------------------
    // TEST 3A.2: WARM MEMORY CACHE CONCURRENCY RACE CONDITION
    // -------------------------------------------------------------------------
    console.log('--- TEST 3A.2: Warm Memory Cache Concurrency Race Condition ---');
    {
      const testEmail = `race.warm.${Date.now()}@flashfix.in`;
      createdTestEmails.push(testEmail);
      const code = '592014';
      const codeH = hashOtp(code);

      // Seed DB
      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [testEmail, codeH]
      );

      // Populate warm memory cache via send-otp or direct module manipulation if available
      // Or call send-otp:
      const sendRes = new MockResponse();
      await catchAllPkgHandler(
        { url: '/api/auth/send-otp', method: 'POST', body: { email: testEmail } },
        sendRes
      );

      if (sendRes.statusCode === 200) {
        // Find generated code
        const dbRow = await pool.query(
          `SELECT id, code_hash FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
          [testEmail]
        );
        let warmCode = '';
        for (let i = 100000; i <= 999999; i++) {
          if (hashOtp(i.toString()) === dbRow.rows[0]?.code_hash) {
            warmCode = i.toString();
            break;
          }
        }

        // Fire 10 simultaneous requests against warm cache
        const concurrencyCount = 10;
        const promises = Array.from({ length: concurrencyCount }, async (_, idx) => {
          const req: any = {
            url: '/api/auth/verify-otp',
            method: 'POST',
            body: { email: testEmail, code: warmCode },
          };
          const res = new MockResponse();
          await catchAllPkgHandler(req, res);
          return { idx, statusCode: res.statusCode, body: res.body };
        });

        const responses = await Promise.all(promises);
        const successes = responses.filter((r) => r.statusCode === 200);
        const rejects = responses.filter((r) => r.statusCode === 401);

        console.log(`  Warm cache concurrency results (${concurrencyCount} simultaneous requests):`, {
          successCount: successes.length,
          rejectCount: rejects.length,
        });

        if (successes.length === 1 && rejects.length === concurrencyCount - 1) {
          recordPass(
            'Warm Concurrency Stress',
            'Warm memory cache: exactly 1 request succeeded (200) and all 9 concurrent race requests were rejected (401)'
          );
        } else {
          recordFail(
            'Warm Concurrency Stress',
            'Warm memory cache concurrency race condition',
            `Expected exactly 1 success and ${concurrencyCount - 1} 401 rejections, but got ${successes.length} successes and ${rejects.length} rejections`
          );
        }
      } else {
        console.log('send-otp failed for warm cache test:', sendRes.body);
      }
    }

    // -------------------------------------------------------------------------
    // TEST 3B: CROSS-ENDPOINT VERIFICATION & REPLAY RESISTANCE
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3B: Cross-Endpoint Verification & Replay Resistance ---');
    {
      // Sub-scenario 3B.1: Send via [...route].ts (warm memory + DB), Verify on [...route].ts, Replay on standalone verify-otp.ts
      const email1 = `cross.replay.mem_to_standalone.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email1);

      const sendRes1 = new MockResponse();
      await catchAllPkgHandler(
        { url: '/api/auth/send-otp', method: 'POST', body: { email: email1 } },
        sendRes1
      );

      if (sendRes1.statusCode === 200) {
        const dbRow1 = await pool.query(
          `SELECT id, code_hash FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
          [email1]
        );
        let code1 = '';
        for (let i = 100000; i <= 999999; i++) {
          if (hashOtp(i.toString()) === dbRow1.rows[0]?.code_hash) {
            code1 = i.toString();
            break;
          }
        }

        // Verify on [...route].ts (handles via memory and updates DB)
        const vRes1 = new MockResponse();
        await catchAllPkgHandler(
          { url: '/api/auth/verify-otp', method: 'POST', body: { email: email1, code: code1 } },
          vRes1
        );

        // Immediate Replay on standalone verify-otp.ts (packages/web)
        const replayRes1Pkg = new MockResponse();
        await verifyOtpPkgHandler(
          { method: 'POST', body: { email: email1, code: code1 } },
          replayRes1Pkg
        );

        // Immediate Replay on standalone verify-otp.ts (root)
        const replayRes1Root = new MockResponse();
        await verifyOtpRootHandler(
          { method: 'POST', body: { email: email1, code: code1 } },
          replayRes1Root
        );

        if (vRes1.statusCode === 200 && replayRes1Pkg.statusCode === 401 && replayRes1Root.statusCode === 401) {
          recordPass(
            'Cross-Endpoint Replay',
            '[...route].ts verify -> standalone verify-otp.ts replay: strictly rejected with 401 on both standalone handlers'
          );
        } else {
          recordFail(
            'Cross-Endpoint Replay',
            '[...route].ts verify -> standalone verify-otp.ts replay',
            `vRes1: ${vRes1.statusCode}, replayPkg: ${replayRes1Pkg.statusCode}, replayRoot: ${replayRes1Root.statusCode}`
          );
        }
      } else {
        recordFail('Cross-Endpoint Replay', 'send-otp failed for test 3B.1', JSON.stringify(sendRes1.body));
      }

      // Sub-scenario 3B.2: Verify on standalone verify-otp.ts, Replay on [...route].ts
      const email2 = `cross.replay.standalone_to_route.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email2);
      const code2 = '938172';
      const codeH2 = hashOtp(code2);

      await pool.query(
        `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
         VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
        [email2, codeH2]
      );

      // Verify on standalone verify-otp.ts
      const vRes2 = new MockResponse();
      await verifyOtpPkgHandler({ method: 'POST', body: { email: email2, code: code2 } }, vRes2);

      // Replay on [...route].ts
      const replayRes2 = new MockResponse();
      await catchAllPkgHandler(
        { url: '/api/auth/verify-otp', method: 'POST', body: { email: email2, code: code2 } },
        replayRes2
      );

      if (vRes2.statusCode === 200 && replayRes2.statusCode === 401) {
        recordPass(
          'Cross-Endpoint Replay',
          'standalone verify-otp.ts verify -> [...route].ts replay: strictly rejected with 401'
        );
      } else {
        recordFail(
          'Cross-Endpoint Replay',
          'standalone verify-otp.ts verify -> [...route].ts replay',
          `vRes2: ${vRes2.statusCode}, replayRes2: ${replayRes2.statusCode}`
        );
      }
    }

    // -------------------------------------------------------------------------
    // TEST 3C: 5-ATTEMPT LOCKOUT ENFORCEMENT ACROSS WARM MEMORY & COLD DB PATHS
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3C: 5-Attempt Lockout Enforcement Across Warm Memory & Cold DB Paths ---');
    {
      // Sub-scenario 3C.1: 3 wrong attempts on warm memory cache ([...route].ts), then 2 wrong attempts on standalone verify-otp.ts
      const email1 = `lockout.cross.mem_to_db.${Date.now()}@flashfix.in`;
      createdTestEmails.push(email1);

      // Send OTP to populate warm memory cache + DB
      const sendRes = new MockResponse();
      await catchAllPkgHandler(
        { url: '/api/auth/send-otp', method: 'POST', body: { email: email1 } },
        sendRes
      );

      const dbRow = await pool.query(
        `SELECT id, code_hash FROM otp_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
        [email1]
      );
      let realCode = '';
      for (let i = 100000; i <= 999999; i++) {
        if (hashOtp(i.toString()) === dbRow.rows[0]?.code_hash) {
          realCode = i.toString();
          break;
        }
      }

      // 3 wrong attempts on [...route].ts (warm memory cache)
      for (let i = 1; i <= 3; i++) {
        const res = new MockResponse();
        await catchAllPkgHandler(
          { url: '/api/auth/verify-otp', method: 'POST', body: { email: email1, code: '000000' } },
          res
        );
        if (res.statusCode !== 401) {
          recordFail('Cross Lockout', `Warm memory attempt ${i}`, `Expected 401, got ${res.statusCode}`);
        }
      }

      // Verify DB attempts counter after 3 warm memory wrong attempts
      const dbAfter3 = await pool.query(`SELECT attempts FROM otp_codes WHERE email = $1`, [email1]);
      if (dbAfter3.rows[0]?.attempts === 3) {
        recordPass('Cross Lockout', 'Warm memory wrong attempts synchronized to Neon DB attempts counter (= 3)');
      } else {
        recordFail('Cross Lockout', 'Warm memory wrong attempts DB sync', `Expected attempts=3, got ${dbAfter3.rows[0]?.attempts}`);
      }

      // 2 wrong attempts on standalone verify-otp.ts (cold DB path)
      for (let i = 4; i <= 5; i++) {
        const res = new MockResponse();
        await verifyOtpPkgHandler(
          { method: 'POST', body: { email: email1, code: '000000' } },
          res
        );
        if (res.statusCode !== 401) {
          recordFail('Cross Lockout', `Cold DB attempt ${i}`, `Expected 401, got ${res.statusCode}`);
        }
      }

      const dbAfter5 = await pool.query(`SELECT attempts FROM otp_codes WHERE email = $1`, [email1]);
      if (dbAfter5.rows[0]?.attempts === 5) {
        recordPass('Cross Lockout', 'Total attempts reached 5 across both warm memory and cold DB paths');
      } else {
        recordFail('Cross Lockout', 'Cumulative attempts', `Expected attempts=5, got ${dbAfter5.rows[0]?.attempts}`);
      }

      // Attempt 6 with CORRECT code on standalone verify-otp.ts -> MUST be rejected with 400 OTP_MAX_ATTEMPTS_EXCEEDED
      const lockedResDb = new MockResponse();
      await verifyOtpPkgHandler(
        { method: 'POST', body: { email: email1, code: realCode } },
        lockedResDb
      );

      if (lockedResDb.statusCode === 400 && lockedResDb.body?.error?.code === 'OTP_MAX_ATTEMPTS_EXCEEDED') {
        recordPass(
          'Cross Lockout',
          'Cold DB path enforces lockout (HTTP 400 OTP_MAX_ATTEMPTS_EXCEEDED) when attempts were split across memory & DB'
        );
      } else {
        recordFail(
          'Cross Lockout',
          'Cold DB path lockout enforcement',
          `Expected 400 OTP_MAX_ATTEMPTS_EXCEEDED, got status ${lockedResDb.statusCode}: ${JSON.stringify(lockedResDb.body)}`
        );
      }

      // Attempt 7 with CORRECT code on [...route].ts -> MUST also be rejected with 400 OTP_MAX_ATTEMPTS_EXCEEDED
      const lockedResRoute = new MockResponse();
      await catchAllPkgHandler(
        { url: '/api/auth/verify-otp', method: 'POST', body: { email: email1, code: realCode } },
        lockedResRoute
      );

      if (lockedResRoute.statusCode === 400 && lockedResRoute.body?.error?.code === 'OTP_MAX_ATTEMPTS_EXCEEDED') {
        recordPass(
          'Cross Lockout',
          'Warm memory path enforces lockout (HTTP 400 OTP_MAX_ATTEMPTS_EXCEEDED) on valid code'
        );
      } else {
        recordFail(
          'Cross Lockout',
          'Warm memory path lockout enforcement',
          `Expected 400 OTP_MAX_ATTEMPTS_EXCEEDED, got status ${lockedResRoute.statusCode}: ${JSON.stringify(lockedResRoute.body)}`
        );
      }
    }

  } finally {
    console.log('\n--- Cleaning up test artifacts ---');
    if (createdTestEmails.length > 0) {
      await pool.query(`DELETE FROM otp_codes WHERE email = ANY($1)`, [createdTestEmails]);
      await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdTestEmails]);
    }
    await pool.end();
  }

  console.log('\n================================================================');
  console.log('EDGE CASES TEST SUMMARY:');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total edge case assertions: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runEdgeCases().catch((err) => {
  console.error('Fatal edge case error:', err);
  process.exit(1);
});
