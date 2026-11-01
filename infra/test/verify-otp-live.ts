import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'crypto';
import verifyOtpHandler from '../../packages/web/api/auth/verify-otp.js';
import catchAllRouteHandler from '../../packages/web/api/[...route].js';

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

async function testLiveOtp() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const testEmail1 = `test.otp1.${Date.now()}@flashfix.in`;
  const testEmail2 = `test.otp2.${Date.now()}@flashfix.in`;
  const validCode = '849201';
  const wrongCode = '112233';
  const codeH = hashOtp(validCode);

  console.log('Testing OTP verification against live Neon DB...');

  try {
    // -------------------------------------------------------------
    // Test 1: packages/web/api/auth/verify-otp.ts
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing packages/web/api/auth/verify-otp.ts ---');
    await pool.query(
      `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
       VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
      [testEmail1, codeH]
    );

    // Wrong code -> 401 & increment attempts
    const reqWrong1 = { method: 'POST', body: { email: testEmail1, code: wrongCode } };
    const resWrong1 = new MockResponse();
    await verifyOtpHandler(reqWrong1, resWrong1);
    if (resWrong1.statusCode !== 401) throw new Error(`Expected 401 for wrong code, got ${resWrong1.statusCode}`);

    const att1 = await pool.query(`SELECT attempts FROM otp_codes WHERE email = $1 AND verified = false`, [testEmail1]);
    if (att1.rows[0]?.attempts !== 1) throw new Error(`Expected attempts = 1, got ${att1.rows[0]?.attempts}`);

    // Valid code -> 200 & verified = true
    const reqValid1 = { method: 'POST', body: { email: testEmail1, code: validCode } };
    const resValid1 = new MockResponse();
    await verifyOtpHandler(reqValid1, resValid1);
    if (resValid1.statusCode !== 200) throw new Error(`Expected 200, got ${resValid1.statusCode}`);
    if (resValid1.body.user.emailVerified !== true) throw new Error('user.emailVerified !== true');

    const ver1 = await pool.query(`SELECT verified FROM otp_codes WHERE email = $1`, [testEmail1]);
    if (ver1.rows[0]?.verified !== true) throw new Error('otp_codes record verified !== true');

    // Replay -> 401
    const reqReplay1 = { method: 'POST', body: { email: testEmail1, code: validCode } };
    const resReplay1 = new MockResponse();
    await verifyOtpHandler(reqReplay1, resReplay1);
    if (resReplay1.statusCode !== 401) throw new Error(`Expected 401 replay, got ${resReplay1.statusCode}`);

    console.log('verify-otp.ts tests passed!');

    // -------------------------------------------------------------
    // Test 2: packages/web/api/[...route].ts
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing packages/web/api/[...route].ts ---');
    await pool.query(
      `INSERT INTO otp_codes (id, email, code_hash, purpose, expires_at, created_at, verified, attempts)
       VALUES (gen_random_uuid(), $1, $2, 'LOGIN', NOW() + INTERVAL '10 minutes', NOW(), false, 0)`,
      [testEmail2, codeH]
    );

    // Wrong code -> 401 & increment attempts
    const reqWrong2 = { url: '/api/auth/verify-otp', method: 'POST', body: { email: testEmail2, code: wrongCode } };
    const resWrong2 = new MockResponse();
    await catchAllRouteHandler(reqWrong2, resWrong2);
    if (resWrong2.statusCode !== 401) throw new Error(`Expected 401 for wrong code in route, got ${resWrong2.statusCode}`);

    const att2 = await pool.query(`SELECT attempts FROM otp_codes WHERE email = $1 AND verified = false`, [testEmail2]);
    if (att2.rows[0]?.attempts !== 1) throw new Error(`Expected attempts = 1, got ${att2.rows[0]?.attempts}`);

    // Valid code -> 200 & verified = true
    const reqValid2 = { url: '/api/auth/verify-otp', method: 'POST', body: { email: testEmail2, code: validCode } };
    const resValid2 = new MockResponse();
    await catchAllRouteHandler(reqValid2, resValid2);
    if (resValid2.statusCode !== 200) throw new Error(`Expected 200 in route, got ${resValid2.statusCode}`);
    if (resValid2.body.user.emailVerified !== true) throw new Error('user.emailVerified !== true in route');

    const ver2 = await pool.query(`SELECT verified FROM otp_codes WHERE email = $1`, [testEmail2]);
    if (ver2.rows[0]?.verified !== true) throw new Error('otp_codes record verified !== true in route');

    // Replay -> 401
    const reqReplay2 = { url: '/api/auth/verify-otp', method: 'POST', body: { email: testEmail2, code: validCode } };
    const resReplay2 = new MockResponse();
    await catchAllRouteHandler(reqReplay2, resReplay2);
    if (resReplay2.statusCode !== 401) throw new Error(`Expected 401 replay in route, got ${resReplay2.statusCode}`);

    console.log('[...route].ts tests passed!');

    console.log('\n🎉 ALL LIVE OTP VERIFICATION TESTS PASSED SUCCESFULLY ON BOTH HANDLERS! 🎉');
  } finally {
    await pool.query(`DELETE FROM otp_codes WHERE email IN ($1, $2)`, [testEmail1, testEmail2]);
    await pool.query(`DELETE FROM users WHERE email IN ($1, $2)`, [testEmail1, testEmail2]);
    await pool.end();
  }
}

testLiveOtp().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
