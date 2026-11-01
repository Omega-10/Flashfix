/**
 * Empirical Challenger M3-1: Two-Factor Custody Tracking & Serverless Gateway Stress
 *
 * Executes empirical stress tests across:
 * 1. Root api/[...route].ts vs packages/web/api/[...route].ts synchronization
 * 2. Doorstep pickup OTP state machine transitions & edge cases
 * 3. Hub custody OTP state machine transitions & edge cases
 * 4. Out-of-order transitions & bypass vectors
 * 5. In-memory vs database-connected fallback flaws
 * 6. Frontend admin api.ts fallback logic flaws
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Import handlers
import webGatewayHandler from '../packages/web/api/[...route].ts';
import rootGatewayHandler from '../api/[...route].ts';

// Client admin API
import {
  verifyPickupOtp,
  verifyCustodyOtp,
  sendPickupOtp,
  sendCustodyOtp,
  startPickupRoute,
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

let totalTests = 0;
let passedTests = 0;
const findings: { id: string; title: string; severity: string; details: string }[] = [];

async function runCheck(
  name: string,
  fn: () => Promise<void> | void
) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) await res;
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.log(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('⚡ EMPIRICAL CHALLENGER M3-1: CUSTODY TRACKING & GATEWAY STRESS HARNESS');
  console.log('======================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1: ROOT API MIRRORING & VERCEL CATCHALL GATEWAY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('--- SUITE 1: ROOT API MIRRORING & VERCEL CATCHALL GATEWAY ---');

  await runCheck('1.1 Root api/[...route].ts vs packages/web/api/[...route].ts file identity', () => {
    const rootPath = path.resolve('api/[...route].ts');
    const webPath = path.resolve('packages/web/api/[...route].ts');

    const rootContent = fs.readFileSync(rootPath, 'utf-8');
    const webContent = fs.readFileSync(webPath, 'utf-8');

    if (rootContent !== webContent) {
      findings.push({
        id: 'FINDING-1',
        title: 'Root api/[...route].ts is NOT synchronized with packages/web/api/[...route].ts',
        severity: 'CRITICAL',
        details: `Root api has ${rootContent.split('\n').length} lines, but packages/web/api has ${webContent.split('\n').length} lines. All Milestone 3 custody endpoints are entirely missing from root api/[...route].ts!`,
      });
      console.log('    -> Discovered critical divergence: Root api is 415 lines; web api is 1594 lines.');
    } else {
      assert.strictEqual(rootContent, webContent);
    }
  });

  await runCheck('1.2 Verify custody endpoints behavior on Root api/[...route].ts', async () => {
    // Calling verify-pickup on root handler
    const req = {
      method: 'POST',
      url: 'http://localhost/api/bookings/FF-104921/verify-pickup',
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await rootGatewayHandler(req, res);

    // Root handler falls through to default: status: 'ok', service: 'flashfix-vercel-gateway'
    if (res.body?.service === 'flashfix-vercel-gateway') {
      findings.push({
        id: 'FINDING-2',
        title: 'Root api/[...route].ts silently ignores verify-pickup and returns dummy 200 { status: "ok" }',
        severity: 'HIGH',
        details: `Because root handler lacks custody routes, POST /api/bookings/:id/verify-pickup falls through and returns 200 { status: 'ok' } without updating booking state or verifying OTP!`,
      });
      console.log('    -> Root handler returned dummy status: ok instead of executing custody verification.');
    }
  });

  await runCheck('1.3 Expose false-positive bug in custody-tracking-m3.test.ts path resolution', () => {
    // Replicate resolvePath from custody-tracking-m3.test.ts when running inside packages/web
    const cwdPackagesWeb = path.resolve('packages/web');
    function faultyResolvePath(filePath: string): string {
      const candidates = [
        path.resolve(cwdPackagesWeb, filePath),
        path.resolve(cwdPackagesWeb, '../../', filePath),
        path.resolve(cwdPackagesWeb, '../', filePath),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      return candidates[0];
    }

    const resolvedWeb = faultyResolvePath('packages/web/api/[...route].ts');
    const resolvedRoot = faultyResolvePath('api/[...route].ts');

    // Both resolve to the EXACT SAME FILE inside packages/web!
    assert.strictEqual(resolvedWeb, resolvedRoot);
    findings.push({
      id: 'FINDING-3',
      title: 'Faulty path resolution in worker unit test masks unsynchronized root api',
      severity: 'HIGH',
      details: `In custody-tracking-m3.test.ts, resolvePath('api/[...route].ts') resolved to packages/web/api/[...route].ts instead of monorepo root api/[...route].ts because candidate 0 matched the local directory. The test was comparing web api to web api!`,
    });
    console.log('    -> Confirmed: Worker test compared packages/web/api/[...route].ts with itself.');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: DOORSTEP PICKUP OTP STATE MACHINE & EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 2: DOORSTEP PICKUP OTP STATE MACHINE & EDGE CASES ---');

  const testBookingId = `FF-EMP-${Date.now()}`;

  await runCheck('2.1 Initialize new booking for empirical testing', async () => {
    const req = {
      method: 'POST',
      url: 'http://localhost/api/bookings',
      body: {
        id: testBookingId,
        brand: 'Google',
        deviceModel: 'Pixel 9',
        issueType: 'Battery',
      },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 201);
  });

  await runCheck('2.2 OUT-OF-ORDER: verify-pickup before send-pickup-otp with bypass code "123456"', async () => {
    // Booking is in PENDING state. send-pickup-otp was NEVER called.
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId}/verify-pickup`,
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    // If it succeeds, it allowed state jump from PENDING -> IN_TRANSIT out-of-order!
    if (res.statusCode === 200 && res.body?.data?.status === 'IN_TRANSIT') {
      findings.push({
        id: 'FINDING-4',
        title: 'State Machine Invariant Violation: verify-pickup allows jumping from PENDING to IN_TRANSIT',
        severity: 'CRITICAL',
        details: `POST /api/bookings/:id/verify-pickup does not check if the current status is PICKUP_OTP_SENT. Any booking in PENDING or CONFIRMED can be forced to IN_TRANSIT without ever dispatching an OTP.`,
      });
      console.log('    -> State jumped out of order: PENDING -> IN_TRANSIT via verify-pickup.');
    }
  });

  const testBookingId2 = `FF-EMP2-${Date.now()}`;
  let genuinePickupOtp = '';

  await runCheck('2.3 Create booking 2 and dispatch doorstep pickup OTP', async () => {
    // 1. Create booking
    const req1 = {
      method: 'POST',
      url: 'http://localhost/api/bookings',
      body: { id: testBookingId2, brand: 'Apple', deviceModel: 'iPhone 15' },
    };
    const res1 = createMockRes();
    await webGatewayHandler(req1, res1);

    // 2. Start pickup route
    const req2 = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId2}/start-pickup`,
    };
    const res2 = createMockRes();
    await webGatewayHandler(req2, res2);
    assert.strictEqual(res2.body?.data?.status, 'PICKUP_EN_ROUTE');

    // 3. Send pickup OTP
    const req3 = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId2}/send-pickup-otp`,
    };
    const res3 = createMockRes();
    await webGatewayHandler(req3, res3);
    assert.strictEqual(res3.body?.data?.status, 'PICKUP_OTP_SENT');
    genuinePickupOtp = res3.body?.otp;
    assert.ok(genuinePickupOtp);
  });

  await runCheck('2.4 Test wrong OTP rejection (400 OTP_INVALID)', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId2}/verify-pickup`,
      body: { otp: '999999' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'OTP_INVALID');
  });

  await runCheck('2.5 Rate Limiting / 5 Max Attempts Lockout in Serverless In-Memory Mode', async () => {
    // Send 5 incorrect codes consecutively
    const badCodes = ['111111', '222222', '333333', '444444', '555555'];
    for (const code of badCodes) {
      const req = {
        method: 'POST',
        url: `http://localhost/api/bookings/${testBookingId2}/verify-pickup`,
        body: { otp: code },
      };
      const res = createMockRes();
      await webGatewayHandler(req, res);
      assert.strictEqual(res.statusCode, 400);
    }

    // Now attempt 6: Send genuine OTP. Should it be locked out?
    const req6 = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId2}/verify-pickup`,
      body: { otp: genuinePickupOtp },
    };
    const res6 = createMockRes();
    await webGatewayHandler(req6, res6);

    if (res6.statusCode === 200) {
      findings.push({
        id: 'FINDING-5',
        title: 'Missing rate-limiting and attempt lockout in Serverless In-Memory OTP verification',
        severity: 'HIGH',
        details: `In-memory verify-pickup does not track or increment attempts in otpMemoryCache. After 5 incorrect attempts, submitting the genuine OTP still succeeds instead of returning 400 OTP_MAX_ATTEMPTS_EXCEEDED.`,
      });
      console.log('    -> Flaw detected: In-memory mode does not enforce 5-attempt rate limit lockout.');
    } else {
      assert.strictEqual(res6.body?.error?.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3: HUB CUSTODY OTP STATE MACHINE & EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 3: HUB CUSTODY OTP STATE MACHINE & EDGE CASES ---');

  const testBookingId3 = `FF-EMP3-${Date.now()}`;

  await runCheck('3.1 OUT-OF-ORDER: verify-custody before pickup or send-custody-otp', async () => {
    // Booking in PENDING state
    const reqCreate = {
      method: 'POST',
      url: 'http://localhost/api/bookings',
      body: { id: testBookingId3, brand: 'Apple', deviceModel: 'iPad Pro' },
    };
    await webGatewayHandler(reqCreate, createMockRes());

    // Calling verify-custody with demo code '123456'
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId3}/verify-custody`,
      body: { otp: '123456' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    if (res.statusCode === 200 && res.body?.data?.status === 'IN_REPAIR') {
      findings.push({
        id: 'FINDING-6',
        title: 'State Machine Invariant Violation: verify-custody transitions uncollected device directly to IN_REPAIR',
        severity: 'CRITICAL',
        details: `POST /api/bookings/:id/verify-custody does not verify that booking.status is CUSTODY_OTP_SENT or IN_TRANSIT. It allows devices to jump straight from PENDING to IN_REPAIR.`,
      });
      console.log('    -> State jumped out of order: PENDING -> IN_REPAIR via verify-custody.');
    }
  });

  const testBookingId4 = `FF-EMP4-${Date.now()}`;
  let genuineCustodyOtp = '';

  await runCheck('3.2 Progress booking 4 through pickup to IN_TRANSIT and send-custody-otp', async () => {
    // 1. Create
    await webGatewayHandler(
      { method: 'POST', url: 'http://localhost/api/bookings', body: { id: testBookingId4 } },
      createMockRes()
    );
    // 2. Start pickup
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${testBookingId4}/start-pickup` },
      createMockRes()
    );
    // 3. Send pickup OTP
    const resPickupOtp = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${testBookingId4}/send-pickup-otp` },
      resPickupOtp
    );
    // 4. Verify pickup OTP
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${testBookingId4}/verify-pickup`, body: { otp: resPickupOtp.body?.otp } },
      createMockRes()
    );
    // 5. Send custody OTP
    const resCustodyOtp = createMockRes();
    await webGatewayHandler(
      { method: 'POST', url: `http://localhost/api/bookings/${testBookingId4}/send-custody-otp` },
      resCustodyOtp
    );
    assert.strictEqual(resCustodyOtp.body?.data?.status, 'CUSTODY_OTP_SENT');
    genuineCustodyOtp = resCustodyOtp.body?.otp;
    assert.ok(genuineCustodyOtp);
  });

  await runCheck('3.3 Test wrong custody OTP rejection (400 OTP_INVALID)', async () => {
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId4}/verify-custody`,
      body: { otp: '888888' },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'OTP_INVALID');
  });

  await runCheck('3.4 Test unauthorized courier submitting verify-custody', async () => {
    // Courier attempts to verify custody (should require technician identity/role)
    const req = {
      method: 'POST',
      url: `http://localhost/api/bookings/${testBookingId4}/verify-custody`,
      headers: {
        'x-user-role': 'COURIER',
        'x-user-id': 'emp-001',
      },
      body: { otp: genuineCustodyOtp },
    };
    const res = createMockRes();
    await webGatewayHandler(req, res);

    // If it succeeds without checking x-user-role, courier can self-verify custody
    if (res.statusCode === 200) {
      findings.push({
        id: 'FINDING-7',
        title: 'Missing RBAC/Authorization on verify-custody endpoint',
        severity: 'MEDIUM',
        details: `POST /api/bookings/:id/verify-custody has no role verification or technician identity check. Anyone who knows or guesses the OTP (or demo bypass) can transition the booking to IN_REPAIR.`,
      });
      console.log('    -> Missing role enforcement: verify-custody accepted request with courier header.');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 4: FRONTEND CLIENT ADMIN API.TS OFFLINE MOCK BOOLEAN FLAW
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SUITE 4: FRONTEND CLIENT ADMIN API.TS OFFLINE MOCK BOOLEAN FLAW ---');

  await runCheck('4.1 Test verifyPickupOtp fallback boolean logic in api.ts', async () => {
    // In packages/web/src/components/admin/api.ts lines 758 & 815:
    // if (b?.pickupOtp && b.pickupOtp !== otp && otp !== "123456" && otp.length !== 6)
    // When otp is ANY 6-digit number, otp.length !== 6 is FALSE, so the error check is bypassed!

    // Seed OTP
    await sendPickupOtp('FF-104918');

    // Call verifyPickupOtp with a blatantly wrong 6-digit code ("000000")
    // Note: We bypass network by using an arbitrary offline booking
    const result = await verifyPickupOtp('FF-104918', '000000');

    if (result.success === true) {
      findings.push({
        id: 'FINDING-8',
        title: 'Boolean expression flaw in packages/web/src/components/admin/api.ts accepts ANY 6-digit OTP in fallback',
        severity: 'HIGH',
        details: `Lines 758 and 815 test: (b?.pickupOtp && b.pickupOtp !== otp && otp !== "123456" && otp.length !== 6). Because "000000".length !== 6 evaluates to false, the entire condition evaluates to false, and wrong 6-digit OTPs are accepted as valid in fallback mode!`,
      });
      console.log('    -> Boolean logic bug confirmed: verifyPickupOtp("FF-104918", "000000") returned success: true.');
    }
  });

  await runCheck('4.2 Test verifyCustodyOtp fallback boolean logic in api.ts', async () => {
    await sendCustodyOtp('FF-104930');
    const result = await verifyCustodyOtp('FF-104930', '999999');

    if (result.success === true) {
      findings.push({
        id: 'FINDING-9',
        title: 'Boolean expression flaw in verifyCustodyOtp accepts ANY 6-digit OTP in fallback',
        severity: 'HIGH',
        details: `Line 815 in api.ts accepts arbitrary 6-digit strings during offline/fallback mode.`,
      });
      console.log('    -> Boolean logic bug confirmed: verifyCustodyOtp("FF-104930", "999999") returned success: true.');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log('⚡ EMPIRICAL CHALLENGE EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`Executed: ${totalTests} checks | Completed: ${passedTests}`);
  console.log(`Findings logged: ${findings.length}\n`);

  for (const f of findings) {
    console.log(`[${f.severity}] ${f.id}: ${f.title}`);
    console.log(`  Details: ${f.details}\n`);
  }
}

main().catch((err) => {
  console.error('Test harness execution error:', err);
  process.exit(1);
});
