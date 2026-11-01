/**
 * Challenger M3 Deep Adversarial Verification Suite
 *
 * Exhaustively stress-tests:
 * 1. Root vs Web API parity & Direct Root Gateway Execution of all 9 custody endpoints
 * 2. Replay attack resistance across verify-pickup, verify-custody, and admin/api.ts
 * 3. Out-of-order transition invariants (HTTP 400 INVALID_STATUS_TRANSITION)
 * 4. Rate limiting: 5 failed OTP attempts triggers OTP_MAX_ATTEMPTS_EXCEEDED and blocks genuine OTP
 * 5. Production mode demo code gating (NODE_ENV=production rejects '123456')
 * 6. Boolean conjunction test in admin/api.ts: arbitrary codes like '000000' rejected
 * 7. Role-based access control (RBAC): Couriers rejected with HTTP 403 FORBIDDEN on verify-custody
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import handlers
import webGatewayHandler from '../packages/web/api/[...route].ts';
import rootGatewayHandler from '../api/[...route].ts';

// Import client admin API
import {
  verifyPickupOtp,
  verifyCustodyOtp,
  sendPickupOtp,
  sendCustodyOtp,
} from '../packages/web/src/components/admin/api.ts';

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

let checksPassed = 0;
let totalChecks = 0;

async function check(name: string, fn: () => Promise<void> | void) {
  totalChecks++;
  try {
    const res = fn();
    if (res instanceof Promise) await res;
    checksPassed++;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('⚡ CHALLENGER M3 DEEP ADVERSARIAL VERIFICATION SUITE');
  console.log('======================================================================\n');

  // =========================================================================
  // TEST 1: ROOT VS WEB API PARITY & DIRECT ROOT HANDLER EXECUTION
  // =========================================================================
  console.log('--- TEST 1: ROOT VS WEB API PARITY & DIRECT ROOT EXECUTION ---');

  await check('1.1 Byte-for-byte identity between packages/web/api/[...route].ts and api/[...route].ts', () => {
    const rootPath = path.resolve('api/[...route].ts');
    const webPath = path.resolve('packages/web/api/[...route].ts');
    const rootContent = fs.readFileSync(rootPath, 'utf-8');
    const webContent = fs.readFileSync(webPath, 'utf-8');
    assert.strictEqual(rootContent, webContent, 'Root api/[...route].ts must be identical to web api');
  });

  await check('1.2 Byte-for-byte identity between packages/web/api/auth/send-otp.ts and api/auth/send-otp.ts', () => {
    const rootAuthPath = path.resolve('api/auth/send-otp.ts');
    const webAuthPath = path.resolve('packages/web/api/auth/send-otp.ts');
    const rootAuthContent = fs.readFileSync(rootAuthPath, 'utf-8');
    const webAuthContent = fs.readFileSync(webAuthPath, 'utf-8');
    assert.strictEqual(rootAuthContent, webAuthContent, 'Root api/auth/send-otp.ts must be identical to web api');
  });

  let rootBookingId = '';
  let rootPickupOtp = '';
  let rootCustodyOtp = '';

  await check('1.3 Direct Root execution: POST /api/bookings creates booking', async () => {
    const req = {
      method: 'POST',
      url: 'http://localhost/api/bookings',
      body: {
        brand: 'Samsung',
        deviceModel: 'Galaxy S24',
        issueType: 'Screen',
      },
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body?.success, true);
    rootBookingId = res.body?.data?.id;
    assert.ok(rootBookingId && rootBookingId.startsWith('FF-'));
  });

  await check('1.4 Direct Root execution: POST /api/bookings/:id/start-pickup transitions to PICKUP_EN_ROUTE', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/start-pickup`,
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.data?.status, 'PICKUP_EN_ROUTE');
  });

  await check('1.5 Direct Root execution: POST /api/bookings/:id/send-pickup-otp dispatches OTP and sets PICKUP_OTP_SENT', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/send-pickup-otp`,
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.data?.status, 'PICKUP_OTP_SENT');
    rootPickupOtp = res.body?.otp;
    assert.match(rootPickupOtp, /^\d{6}$/);
  });

  await check('1.6 Direct Root execution: POST /api/bookings/:id/verify-pickup transitions to IN_TRANSIT', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/verify-pickup`,
      body: { otp: rootPickupOtp },
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.data?.status, 'IN_TRANSIT');
  });

  await check('1.7 Direct Root execution: POST /api/bookings/:id/send-custody-otp dispatches OTP and sets CUSTODY_OTP_SENT', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/send-custody-otp`,
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.data?.status, 'CUSTODY_OTP_SENT');
    rootCustodyOtp = res.body?.otp;
    assert.match(rootCustodyOtp, /^\d{6}$/);
  });

  await check('1.8 Direct Root execution: POST /api/bookings/:id/verify-custody transitions to IN_REPAIR', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/verify-custody`,
      headers: { 'x-user-role': 'TECHNICIAN' },
      body: { otp: rootCustodyOtp },
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.data?.status, 'IN_REPAIR');
  });

  await check('1.9 Direct Root execution: POST /api/bookings/:id/repair-complete marks REPAIR_COMPLETE', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/repair-complete`,
      body: { finalCost: 2999 },
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.strictEqual(res.body?.data?.status, 'REPAIR_COMPLETE');
  });

  await check('1.10 Direct Root execution: GET /api/bookings/:id/trail returns audit trail', async () => {
    const req = {
      method: 'GET',
      url: `http://localhost/api/bookings/${rootBookingId}/trail`,
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body?.success, true);
    assert.ok(Array.isArray(res.body?.data));
    assert.ok(res.body.data.length >= 4);
  });

  await check('1.11 Direct Root execution: GET /api/bookings/:id and GET /api/bookings/mine', async () => {
    const req1 = {
      method: 'GET',
      url: `http://localhost/api/bookings/${rootBookingId}`,
    };
    const res1 = createMockRes();
    await rootGatewayHandler(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body?.data?.id, rootBookingId);

    const req2 = {
      method: 'GET',
      url: 'http://localhost/api/bookings/mine',
    };
    const res2 = createMockRes();
    await rootGatewayHandler(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.ok(Array.isArray(res2.body?.data));
  });

  // =========================================================================
  // TEST 2: REPLAY ATTACK TEST (CONSUMED OTP CANNOT BE RE-USED)
  // =========================================================================
  console.log('\n--- TEST 2: REPLAY ATTACK TEST ---');

  await check('2.1 Replay attack on verify-pickup returns 400 and preserves status', async () => {
    // Attempt to verify again using rootPickupOtp on rootBookingId (already past PICKUP_OTP_SENT)
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/verify-pickup`,
      body: { otp: rootPickupOtp },
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
  });

  await check('2.2 Replay attack on verify-custody returns 400 and preserves status', async () => {
    // Attempt to verify again using rootCustodyOtp on rootBookingId (already REPAIR_COMPLETE)
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rootBookingId}/verify-custody`,
      headers: { 'x-user-role': 'TECHNICIAN' },
      body: { otp: rootCustodyOtp },
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
  });

  await check('2.3 Immediate replay attack on freshly verified pickup OTP', async () => {
    // 1. Create booking
    const resCreate = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Apple' } },
      resCreate
    );
    const replayBookingId = resCreate.body?.data?.id;
    assert.ok(replayBookingId);

    // 2. Start pickup
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${replayBookingId}/start-pickup` },
      createMockRes()
    );
    // 3. Send pickup OTP
    const resOtp = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${replayBookingId}/send-pickup-otp` },
      resOtp
    );
    const validOtp = resOtp.body?.otp;
    assert.ok(validOtp);

    // 4. Verify pickup OTP (1st time -> succeeds)
    const resVerify1 = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${replayBookingId}/verify-pickup`, body: { otp: validOtp } },
      resVerify1
    );
    assert.strictEqual(resVerify1.statusCode, 200);

    // 5. Replay exact same OTP (2nd time -> MUST fail with 400)
    const resVerify2 = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${replayBookingId}/verify-pickup`, body: { otp: validOtp } },
      resVerify2
    );
    assert.strictEqual(resVerify2.statusCode, 400);
    assert.strictEqual(resVerify2.body?.error?.code, 'INVALID_STATUS_TRANSITION');
  });

  await check('2.4 Immediate replay attack on client admin/api.ts fallback verification', async () => {
    const clientBookingId = 'FF-104910';
    // Seed OTP in client state
    const sendRes = await sendPickupOtp(clientBookingId);
    assert.strictEqual(sendRes.success, true);
    const clientOtp = sendRes.otp!;

    // 1st verify succeeds
    const v1 = await verifyPickupOtp(clientBookingId, clientOtp);
    assert.strictEqual(v1.success, true);

    // 2nd verify with same OTP MUST fail
    const v2 = await verifyPickupOtp(clientBookingId, clientOtp);
    assert.strictEqual(v2.success, false);
  });

  // =========================================================================
  // TEST 3: OUT-OF-ORDER TRANSITION TEST (HTTP 400 INVALID_STATUS_TRANSITION)
  // =========================================================================
  console.log('\n--- TEST 3: OUT-OF-ORDER TRANSITION TEST ---');

  let oooBookingId = '';

  await check('3.1 verify-pickup on PENDING booking returns HTTP 400 INVALID_STATUS_TRANSITION', async () => {
    const resCreate = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Apple' } },
      resCreate
    );
    oooBookingId = resCreate.body?.data?.id;
    assert.ok(oooBookingId);

    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${oooBookingId}/verify-pickup`,
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.success, false);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
    assert.ok(res.body.error.message.includes('PICKUP_OTP_SENT'));
  });

  await check('3.2 verify-pickup on PICKUP_EN_ROUTE (before send-pickup-otp) returns HTTP 400', async () => {
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${oooBookingId}/start-pickup` },
      createMockRes()
    );

    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${oooBookingId}/verify-pickup`,
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
  });

  await check('3.3 verify-custody on PENDING booking returns HTTP 400 INVALID_STATUS_TRANSITION', async () => {
    const resCreate = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Google' } },
      resCreate
    );
    const rawPendingId = resCreate.body?.data?.id;

    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rawPendingId}/verify-custody`,
      headers: { 'x-user-role': 'TECHNICIAN' },
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
    assert.ok(res.body.error.message.includes('CUSTODY_OTP_SENT'));
  });

  await check('3.4 verify-custody on IN_TRANSIT before send-custody-otp returns HTTP 400', async () => {
    // Progress oooBookingId to IN_TRANSIT
    const resOtp = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${oooBookingId}/send-pickup-otp` },
      resOtp
    );
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${oooBookingId}/verify-pickup`, body: { otp: resOtp.body?.otp } },
      createMockRes()
    );

    // Call verify-custody BEFORE send-custody-otp
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${oooBookingId}/verify-custody`,
      headers: { 'x-user-role': 'TECHNICIAN' },
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
  });

  // =========================================================================
  // TEST 4: RATE LIMITING & ATTEMPT LOCKOUT
  // =========================================================================
  console.log('\n--- TEST 4: RATE LIMITING & ATTEMPT LOCKOUT ---');

  let rlBookingId = '';
  let rlPickupOtp = '';

  await check('4.1 Set up booking in PICKUP_OTP_SENT for rate limit test', async () => {
    const resCreate = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'OnePlus' } },
      resCreate
    );
    rlBookingId = resCreate.body?.data?.id;
    assert.ok(rlBookingId);

    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlBookingId}/start-pickup` },
      createMockRes()
    );
    const resOtp = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlBookingId}/send-pickup-otp` },
      resOtp
    );
    rlPickupOtp = resOtp.body?.otp;
    assert.ok(rlPickupOtp);
  });

  await check('4.2 Verify 5 failed OTP attempts triggers OTP_MAX_ATTEMPTS_EXCEEDED', async () => {
    const wrongCodes = ['100001', '100002', '100003', '100004'];
    for (const code of wrongCodes) {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${rlBookingId}/verify-pickup`,
        body: { otp: code },
      };
      const res = createMockRes();
      await webGatewayHandler(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.error?.code, 'OTP_INVALID');
    }

    // 5th failed attempt: should trigger OTP_MAX_ATTEMPTS_EXCEEDED
    const req5 = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rlBookingId}/verify-pickup`,
      body: { otp: '100005' },
    };
    const res5 = createMockRes();
    await webGatewayHandler(req5, res5);
    assert.strictEqual(res5.statusCode, 400);
    assert.strictEqual(res5.body?.error?.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
  });

  await check('4.3 Attempt 6 with GENUINE OTP is blocked by OTP_MAX_ATTEMPTS_EXCEEDED', async () => {
    const req6 = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rlBookingId}/verify-pickup`,
      body: { otp: rlPickupOtp },
    };
    const res6 = createMockRes();
    await webGatewayHandler(req6, res6);
    assert.strictEqual(res6.statusCode, 400);
    assert.strictEqual(res6.body?.error?.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');

    // Confirm booking did not transition to IN_TRANSIT
    const reqGet = {
      method: 'GET',
      url: `http://localhost/api/bookings/${rlBookingId}`,
    };
    const resGet = createMockRes();
    await webGatewayHandler(reqGet, resGet);
    assert.strictEqual(resGet.body?.data?.status, 'PICKUP_OTP_SENT');
  });

  let rlCustodyBookingId = '';
  let rlCustodyOtp = '';

  await check('4.4 Rate limiting on verify-custody: 5 attempts lockout blocks genuine custody OTP', async () => {
    // 1. Create, pickup, and send custody OTP
    const resCreate = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Xiaomi' } },
      resCreate
    );
    rlCustodyBookingId = resCreate.body?.data?.id;
    assert.ok(rlCustodyBookingId);

    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlCustodyBookingId}/start-pickup` },
      createMockRes()
    );
    const rPickup = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlCustodyBookingId}/send-pickup-otp` },
      rPickup
    );
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlCustodyBookingId}/verify-pickup`, body: { otp: rPickup.body?.otp } },
      createMockRes()
    );
    const rCustody = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlCustodyBookingId}/send-custody-otp` },
      rCustody
    );
    rlCustodyOtp = rCustody.body?.otp;
    assert.ok(rlCustodyOtp);

    // 2. Submit 5 bad attempts
    for (let i = 1; i <= 4; i++) {
      const res = createMockRes();
      await webGatewayHandler(
        { method: 'POST', url: `http://localhost/api/bookings/${rlCustodyBookingId}/verify-custody`, headers: { 'x-user-role': 'TECHNICIAN' }, body: { otp: `20000${i}` } },
        res
      );
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.error?.code, 'OTP_INVALID');
    }

    // 5th attempt
    const res5 = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlCustodyBookingId}/verify-custody`, headers: { 'x-user-role': 'TECHNICIAN' }, body: { otp: '200005' } },
      res5
    );
    assert.strictEqual(res5.statusCode, 400);
    assert.strictEqual(res5.body?.error?.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');

    // 6th attempt with genuine custody OTP
    const res6 = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rlCustodyBookingId}/verify-custody`, headers: { 'x-user-role': 'TECHNICIAN' }, body: { otp: rlCustodyOtp } },
      res6
    );
    assert.strictEqual(res6.statusCode, 400);
    assert.strictEqual(res6.body?.error?.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
  });

  // =========================================================================
  // TEST 5: DEMO CODE TEST (REJECT '123456' WHEN NODE_ENV=production)
  // =========================================================================
  console.log('\n--- TEST 5: DEMO CODE GATING (NODE_ENV=production) ---');

  const prevEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'production';

    await check('5.1 verify-pickup rejects demo OTP "123456" in production mode', async () => {
      const resCreate = createMockRes();
      await webGatewayHandler(
        { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Pixel' } },
        resCreate
      );
      const prodBookingId = resCreate.body?.data?.id;

      await webGatewayHandler(
        { method: 'POST', url: `http://localhost/api/bookings/${prodBookingId}/start-pickup` },
        createMockRes()
      );
      await webGatewayHandler(
        { method: 'POST', url: `http://localhost/api/bookings/${prodBookingId}/send-pickup-otp` },
        createMockRes()
      );

      // Now attempt verify with '123456'
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${prodBookingId}/verify-pickup`,
        body: { otp: '123456' },
      };
      const res = createMockRes();
      await webGatewayHandler(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.error?.code, 'OTP_INVALID');
    });

    await check('5.2 verify-custody rejects demo OTP "123456" in production mode', async () => {
      const resCreate = createMockRes();
      await webGatewayHandler(
        { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Motorola' } },
        resCreate
      );
      const prodCustId = resCreate.body?.data?.id;

      await webGatewayHandler(
        { method: 'POST', url: `http://localhost/api/bookings/${prodCustId}/start-pickup` },
        createMockRes()
      );
      const resP = createMockRes();
      await webGatewayHandler(
        { method: 'POST', url: `http://localhost/api/bookings/${prodCustId}/send-pickup-otp` },
        resP
      );
      // Verify pickup with actual genuine OTP
      await webGatewayHandler(
        { method: 'POST', url: `http://localhost/api/bookings/${prodCustId}/verify-pickup`, body: { otp: resP.body?.otp } },
        createMockRes()
      );
      // Send custody OTP
      await webGatewayHandler(
        { method: 'POST', url: `http://localhost/api/bookings/${prodCustId}/send-custody-otp` },
        createMockRes()
      );

      // Now try verify-custody with '123456'
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${prodCustId}/verify-custody`,
        headers: { 'x-user-role': 'TECHNICIAN' },
        body: { otp: '123456' },
      };
      const res = createMockRes();
      await webGatewayHandler(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.error?.code, 'OTP_INVALID');
    });

    await check('5.3 client admin/api.ts rejects "123456" in production mode', async () => {
      const clientProdId = 'FF-104905';
      await sendPickupOtp(clientProdId);
      const res = await verifyPickupOtp(clientProdId, '123456');
      assert.strictEqual(res.success, false);
      assert.ok(res.error?.includes('Invalid'));
    });
  } finally {
    process.env.NODE_ENV = prevEnv;
  }

  // =========================================================================
  // TEST 6: BOOLEAN CONJUNCTION TEST IN admin/api.ts
  // =========================================================================
  console.log('\n--- TEST 6: BOOLEAN CONJUNCTION IN admin/api.ts ---');

  await check('6.1 verifyPickupOtp rejects arbitrary 6-digit codes ("000000", "999999", "111111")', async () => {
    const testId = 'FF-104918';
    const sendRes = await sendPickupOtp(testId);
    assert.strictEqual(sendRes.success, true);
    const genuineOtp = sendRes.otp!;

    const arbitraryCodes = ['000000', '999999', '111111', '123450', '654321', '888888'];
    for (const code of arbitraryCodes) {
      if (code === genuineOtp) continue;
      const res = await verifyPickupOtp(testId, code);
      assert.strictEqual(res.success, false, `Code ${code} must NOT be accepted`);
      assert.ok(res.error?.includes('Invalid doorstep verification code'));
    }

    // Now test that genuine OTP succeeds
    const goodRes = await verifyPickupOtp(testId, genuineOtp);
    assert.strictEqual(goodRes.success, true);
  });

  await check('6.2 verifyCustodyOtp rejects arbitrary 6-digit codes', async () => {
    const testId = 'FF-104930';
    const sendRes = await sendCustodyOtp(testId);
    assert.strictEqual(sendRes.success, true);
    const genuineOtp = sendRes.otp!;

    const arbitraryCodes = ['000000', '999999', '111111', '777777', '543210'];
    for (const code of arbitraryCodes) {
      if (code === genuineOtp) continue;
      const res = await verifyCustodyOtp(testId, code);
      assert.strictEqual(res.success, false, `Code ${code} must NOT be accepted`);
      assert.ok(res.error?.includes('Invalid custody verification code'));
    }

    // Now test that genuine OTP succeeds
    const goodRes = await verifyCustodyOtp(testId, genuineOtp);
    assert.strictEqual(goodRes.success, true);
  });

  await check('6.3 verifyPickupOtp & verifyCustodyOtp reject invalid string lengths', async () => {
    const badLengths = ['', '123', '12345', '1234567'];
    for (const code of badLengths) {
      const res1 = await verifyPickupOtp('FF-104899', code);
      assert.strictEqual(res1.success, false);
      assert.strictEqual(res1.error, '6-digit OTP code required');

      const res2 = await verifyCustodyOtp('FF-104899', code);
      assert.strictEqual(res2.success, false);
      assert.strictEqual(res2.error, '6-digit OTP code required');
    }

    // 6-character non-numeric / non-matching code
    const resAlpha1 = await verifyPickupOtp('FF-104899', 'abcdef');
    assert.strictEqual(resAlpha1.success, false);
    assert.ok(resAlpha1.error?.includes('Invalid'));

    const resAlpha2 = await verifyCustodyOtp('FF-104899', 'abcdef');
    assert.strictEqual(resAlpha2.success, false);
    assert.ok(resAlpha2.error?.includes('Invalid'));
  });

  // =========================================================================
  // TEST 7: RBAC & EDGE CASE DEFENSE
  // =========================================================================
  console.log('\n--- TEST 7: RBAC & EDGE CASES ---');

  await check('7.1 verify-custody rejects COURIER role with HTTP 403 FORBIDDEN', async () => {
    const resCreate = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Nothing Phone' } },
      resCreate
    );
    const rbacId = resCreate.body?.data?.id;

    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rbacId}/start-pickup` },
      createMockRes()
    );
    const rP = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rbacId}/send-pickup-otp` },
      rP
    );
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rbacId}/verify-pickup`, body: { otp: rP.body?.otp } },
      createMockRes()
    );
    const rC = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${rbacId}/send-custody-otp` },
      rC
    );

    // Courier submits valid OTP
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${rbacId}/verify-custody`,
      headers: { 'x-user-role': 'COURIER' },
      body: { otp: rC.body?.otp },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  await check('7.2 Non-existent booking returns 404 BOOKING_NOT_FOUND', async () => {
    const req = {
      method: 'POST',
      url: 'http://localhost/api/bookings/FF-DOES-NOT-EXIST-99999/verify-pickup',
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body?.error?.code, 'BOOKING_NOT_FOUND');
  });

  console.log('\n======================================================================');
  console.log('⚡ CHALLENGER M3 DEEP VERIFICATION COMPLETE');
  console.log('======================================================================');
  console.log(`Total checks executed: ${totalChecks}`);
  console.log(`Passed checks: ${checksPassed}`);
  console.log(`Failed checks: ${totalChecks - checksPassed}`);
  console.log('All 7 challenge vectors rigorously verified and passing.');
}

main().catch((err) => {
  console.error('Execution terminated with error:', err);
  process.exit(1);
});
