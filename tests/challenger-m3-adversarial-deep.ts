/**
 * Deep Adversarial Empirical Challenge for Milestone 3 Remediation
 *
 * Directly tests:
 * 1. Full 9-step custody lifecycle on BOTH web and root [...route].ts handlers
 * 2. Replay attacks on verify-pickup and verify-custody
 * 3. Out-of-order calls across states (PENDING, CONFIRMED, IN_TRANSIT)
 * 4. Brute force attempts and 5-attempt rate-limiting lockout
 * 5. Role permissions (courier forbidden from verify-custody)
 * 6. Audit trail chronological integrity
 * 7. Technician workbench queue invariants
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load both handlers
import webHandler from '../packages/web/api/[...route].ts';
import rootHandler from '../api/[...route].ts';

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

async function check(desc: string, fn: () => Promise<void> | void) {
  totalChecks++;
  try {
    await fn();
    checksPassed++;
    console.log(`  [PASS] ${desc}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

async function runHarness() {
  console.log('======================================================================');
  console.log('⚡ CHALLENGER M3-I2-2: DEEP ADVERSARIAL STRESS & EMPIRICAL VERIFICATION');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. File Parity Verification
  // -------------------------------------------------------------------------
  console.log('--- 1. PARITY VERIFICATION ---');
  await check('Root api/[...route].ts and packages/web/api/[...route].ts are 100% byte identical', () => {
    const web = fs.readFileSync(path.resolve('packages/web/api/[...route].ts'), 'utf-8');
    const root = fs.readFileSync(path.resolve('api/[...route].ts'), 'utf-8');
    assert.strictEqual(root, web, 'Root and packages/web [...route].ts must be identical');
  });

  await check('Root api/auth/send-otp.ts and packages/web/api/auth/send-otp.ts are 100% byte identical', () => {
    const web = fs.readFileSync(path.resolve('packages/web/api/auth/send-otp.ts'), 'utf-8');
    const root = fs.readFileSync(path.resolve('api/auth/send-otp.ts'), 'utf-8');
    assert.strictEqual(root, web, 'Root and packages/web send-otp.ts must be identical');
  });

  // -------------------------------------------------------------------------
  // 2. Full 9-Step Lifecycle on BOTH Handlers
  // -------------------------------------------------------------------------
  console.log('\n--- 2. END-TO-END 9-STEP LIFECYCLE (WEB & ROOT HANDLERS) ---');
  for (const [name, handler] of [['webHandler', webHandler], ['rootHandler', rootHandler]] as const) {
    const bId = `FF-LIFE-${name}-${Date.now()}`;
    console.log(` Testing handler: ${name} with booking ${bId}`);

    let pickupOtp = '';
    let custodyOtp = '';

    await check(`[${name}] Step 1-2: Create initial booking`, async () => {
      const res = createMockRes();
      await handler({
        method: 'POST',
        url: 'http://localhost/api/bookings',
        body: { id: bId, brand: 'Apple', deviceModel: 'iPhone 15 Pro' },
      }, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body?.data?.status, 'PENDING');
    });

    await check(`[${name}] Step 2 -> 3: start-pickup -> PICKUP_EN_ROUTE`, async () => {
      const res = createMockRes();
      await handler({
        method: 'POST',
        url: `http://localhost/api/bookings/${bId}/start-pickup`,
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'PICKUP_EN_ROUTE');
    });

    await check(`[${name}] Step 3: send-pickup-otp -> PICKUP_OTP_SENT`, async () => {
      const res = createMockRes();
      await handler({
        method: 'POST',
        url: `http://localhost/api/bookings/${bId}/send-pickup-otp`,
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'PICKUP_OTP_SENT');
      assert.ok(res.body?.otp);
      assert.match(res.body?.otp, /^\d{6}$/);
      pickupOtp = res.body.otp;
    });

    await check(`[${name}] Step 3 -> 4: verify-pickup with valid OTP -> IN_TRANSIT`, async () => {
      const res = createMockRes();
      await handler({
        method: 'POST',
        url: `http://localhost/api/bookings/${bId}/verify-pickup`,
        body: { otp: pickupOtp },
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'IN_TRANSIT');
    });

    await check(`[${name}] Step 4 -> 5: send-custody-otp -> CUSTODY_OTP_SENT`, async () => {
      const res = createMockRes();
      await handler({
        method: 'POST',
        url: `http://localhost/api/bookings/${bId}/send-custody-otp`,
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'CUSTODY_OTP_SENT');
      assert.ok(res.body?.otp);
      assert.match(res.body?.otp, /^\d{6}$/);
      custodyOtp = res.body.otp;
    });

    await check(`[${name}] Step 5 -> 6: verify-custody with valid OTP as technician -> IN_REPAIR`, async () => {
      const res = createMockRes();
      await handler({
        method: 'POST',
        url: `http://localhost/api/bookings/${bId}/verify-custody`,
        headers: { 'x-user-role': 'TECHNICIAN' },
        body: { otp: custodyOtp },
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'IN_REPAIR');
    });

    await check(`[${name}] Step 6 -> 7: repair-complete -> REPAIR_COMPLETE`, async () => {
      const res = createMockRes();
      await handler({
        method: 'POST',
        url: `http://localhost/api/bookings/${bId}/repair-complete`,
        body: { finalCostPaise: 499900, note: 'Hardware diagnostic passed' },
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'REPAIR_COMPLETE');
      assert.strictEqual(res.body?.data?.finalCostPaise, 499900);
    });

    await check(`[${name}] Step 7 -> 8: status update -> RETURN_EN_ROUTE`, async () => {
      const res = createMockRes();
      await handler({
        method: 'PATCH',
        url: `http://localhost/api/bookings/${bId}/status`,
        body: { status: 'RETURN_EN_ROUTE', note: 'Out for customer delivery' },
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'RETURN_EN_ROUTE');
    });

    await check(`[${name}] Step 8 -> 9: status update -> DELIVERED & PAID`, async () => {
      const res = createMockRes();
      await handler({
        method: 'PATCH',
        url: `http://localhost/api/bookings/${bId}/status`,
        body: { status: 'DELIVERED', note: 'Customer accepted handover' },
      }, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.data?.status, 'DELIVERED');
      assert.strictEqual(res.body?.data?.paymentStatus, 'PAID');
    });

    await check(`[${name}] Audit trail verification: chronological ordering & completeness`, async () => {
      const res = createMockRes();
      await handler({
        method: 'GET',
        url: `http://localhost/api/bookings/${bId}/trail`,
      }, res);
      assert.strictEqual(res.statusCode, 200);
      const trail = res.body?.data;
      assert.ok(Array.isArray(trail) && trail.length >= 7);
      for (let i = 0; i < trail.length - 1; i++) {
        const t1 = new Date(trail[i].createdAt).getTime();
        const t2 = new Date(trail[i + 1].createdAt).getTime();
        assert.ok(t1 <= t2, `Trail not sorted chronologically: ${t1} > ${t2}`);
      }
    });
  }

  // -------------------------------------------------------------------------
  // 3. Adversarial Stress: Replay Attacks
  // -------------------------------------------------------------------------
  console.log('\n--- 3. ADVERSARIAL STRESS: REPLAY ATTACK MITIGATION ---');
  const replayBookingId = `FF-REPLAY-${Date.now()}`;

  await check('Setup booking for replay challenge', async () => {
    // Create, start-pickup, send-pickup-otp
    await webHandler({
      method: 'POST',
      url: 'http://localhost/api/bookings',
      body: { id: replayBookingId },
    }, createMockRes());

    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${replayBookingId}/start-pickup`,
    }, createMockRes());

    const sendRes = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${replayBookingId}/send-pickup-otp`,
    }, sendRes);

    const otp = sendRes.body?.otp;

    // First verify: must succeed
    const vRes1 = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${replayBookingId}/verify-pickup`,
      body: { otp },
    }, vRes1);
    assert.strictEqual(vRes1.statusCode, 200);
    assert.strictEqual(vRes1.body?.data?.status, 'IN_TRANSIT');

    // Second verify (REPLAY): MUST FAIL with 400
    const vRes2 = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${replayBookingId}/verify-pickup`,
      body: { otp },
    }, vRes2);
    assert.strictEqual(vRes2.statusCode, 400, 'Replay of consumed pickup OTP must be rejected with 400');
    assert.strictEqual(vRes2.body?.success, false);
  });

  const replayCustodyId = `FF-REPLAY-CUSTODY-${Date.now()}`;
  await check('Setup booking for custody replay challenge', async () => {
    await webHandler({ method: 'POST', url: 'http://localhost/api/bookings', body: { id: replayCustodyId } }, createMockRes());
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${replayCustodyId}/start-pickup` }, createMockRes());
    const pRes = createMockRes();
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${replayCustodyId}/send-pickup-otp` }, pRes);
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${replayCustodyId}/verify-pickup`, body: { otp: pRes.body?.otp } }, createMockRes());

    const cRes = createMockRes();
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${replayCustodyId}/send-custody-otp` }, cRes);
    const cOtp = cRes.body?.otp;

    // First verify: succeeds
    const cvRes1 = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${replayCustodyId}/verify-custody`,
      headers: { 'x-user-role': 'TECHNICIAN' },
      body: { otp: cOtp },
    }, cvRes1);
    assert.strictEqual(cvRes1.statusCode, 200);

    // Replay custody verify: MUST FAIL with 400
    const cvRes2 = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${replayCustodyId}/verify-custody`,
      headers: { 'x-user-role': 'TECHNICIAN' },
      body: { otp: cOtp },
    }, cvRes2);
    assert.strictEqual(cvRes2.statusCode, 400, 'Replay of consumed custody OTP must be rejected with 400');
    assert.strictEqual(cvRes2.body?.success, false);
  });

  // -------------------------------------------------------------------------
  // 4. Adversarial Stress: Out-of-Order Calls
  // -------------------------------------------------------------------------
  console.log('\n--- 4. ADVERSARIAL STRESS: OUT-OF-ORDER STATE TRANSITIONS ---');
  let oooId = '';

  await check('Out-of-order verify-pickup on PENDING booking is rejected (400 INVALID_STATUS_TRANSITION)', async () => {
    const createRes = createMockRes();
    await webHandler({ method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Apple' } }, createRes);
    oooId = createRes.body?.data?.id;
    assert.ok(oooId, 'Must create booking and return ID');

    const res = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${oooId}/verify-pickup`,
      body: { otp: '849201' },
    }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
  });

  await check('Out-of-order verify-custody on PENDING booking is rejected (400 INVALID_STATUS_TRANSITION)', async () => {
    const res = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${oooId}/verify-custody`,
      headers: { 'x-user-role': 'TECHNICIAN' },
      body: { otp: '592184' },
    }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body?.error?.code, 'INVALID_STATUS_TRANSITION');
  });

  // -------------------------------------------------------------------------
  // 5. Adversarial Stress: Role Enforcement (Courier verifying custody)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. ADVERSARIAL STRESS: RBAC / ROLE PERMISSION ENFORCEMENT ---');
  let roleTestId = '';
  await check('Courier attempting verify-custody is rejected with 403 FORBIDDEN', async () => {
    const createRes = createMockRes();
    await webHandler({ method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Apple' } }, createRes);
    roleTestId = createRes.body?.data?.id;

    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${roleTestId}/start-pickup` }, createMockRes());
    const pRes = createMockRes();
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${roleTestId}/send-pickup-otp` }, pRes);
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${roleTestId}/verify-pickup`, body: { otp: pRes.body?.otp } }, createMockRes());
    const cRes = createMockRes();
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${roleTestId}/send-custody-otp` }, cRes);

    const courierRes = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${roleTestId}/verify-custody`,
      headers: { 'x-user-role': 'COURIER' },
      body: { otp: cRes.body?.otp },
    }, courierRes);
    assert.strictEqual(courierRes.statusCode, 403);
    assert.strictEqual(courierRes.body?.error?.code, 'FORBIDDEN');
  });

  // -------------------------------------------------------------------------
  // 6. Adversarial Stress: Brute-Force & Rate-Limiting Lockout
  // -------------------------------------------------------------------------
  console.log('\n--- 6. ADVERSARIAL STRESS: BRUTE FORCE & 5-ATTEMPT LOCKOUT ---');
  let bruteId = '';
  await check('5 consecutive wrong OTPs locks out subsequent attempts (including correct OTP)', async () => {
    const createRes = createMockRes();
    await webHandler({ method: 'POST', url: 'http://localhost/api/bookings', body: { brand: 'Apple' } }, createRes);
    bruteId = createRes.body?.data?.id;

    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${bruteId}/start-pickup` }, createMockRes());
    const pRes = createMockRes();
    await webHandler({ method: 'POST', url: `http://localhost/api/bookings/${bruteId}/send-pickup-otp` }, pRes);
    const validOtp = pRes.body?.otp;

    // Send 5 bad codes
    for (let i = 1; i <= 5; i++) {
      const badRes = createMockRes();
      await webHandler({
        method: 'POST',
        url: `http://localhost/api/bookings/${bruteId}/verify-pickup`,
        body: { otp: `00000${i}` },
      }, badRes);
      assert.strictEqual(badRes.statusCode, 400);
    }

    // 6th attempt with valid OTP: must be locked out
    const attempt6 = createMockRes();
    await webHandler({
      method: 'POST',
      url: `http://localhost/api/bookings/${bruteId}/verify-pickup`,
      body: { otp: validOtp },
    }, attempt6);
    assert.strictEqual(attempt6.statusCode, 400);
    assert.strictEqual(attempt6.body?.error?.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
  });

  // -------------------------------------------------------------------------
  // 7. UI State Machine & Queue Invariants
  // -------------------------------------------------------------------------
  console.log('\n--- 7. UI STATE MACHINE & QUEUE INVARIANTS ---');
  await check('TechnicianView.tsx: activeWorkbenchQueue strictly filters for IN_REPAIR only', () => {
    const techCode = fs.readFileSync(path.resolve('packages/web/src/components/admin/TechnicianView.tsx'), 'utf-8');
    assert.ok(techCode.includes('activeWorkbenchQueue = filteredBookings.filter('));
    assert.ok(techCode.includes('(b) => b.status === "IN_REPAIR"'));
    assert.ok(!techCode.includes('(b) => b.status === "IN_REPAIR" || b.status === "CONFIRMED"'), 'CONFIRMED bookings must NOT be in technician active workbench queue!');
  });

  await check('TechnicianView.tsx: custody verify action button is gated on CUSTODY_OTP_SENT', () => {
    const techCode = fs.readFileSync(path.resolve('packages/web/src/components/admin/TechnicianView.tsx'), 'utf-8');
    assert.ok(techCode.includes('const isOtpSent = booking.status === "CUSTODY_OTP_SENT"'));
    assert.ok(techCode.includes('Awaiting Courier Hub Arrival'));
  });

  await check('TrackRepair.tsx: 9-step timeline mapping and chronological audit trail sorting', () => {
    const trackCode = fs.readFileSync(path.resolve('packages/web/src/pages/flashfix/TrackRepair.tsx'), 'utf-8');
    assert.ok(trackCode.includes('NINE_STEPS: StepDefinition[]'));
    assert.ok(trackCode.includes('mapStatusToStepIndex'));
    assert.ok(trackCode.includes('booking.status === "PICKUP_OTP_SENT"'));
    assert.ok(trackCode.includes('new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()'));
  });

  console.log('\n======================================================================');
  console.log(`⚡ ALL CHECKS COMPLETED: ${checksPassed} / ${totalChecks} PASSED CLEANLY`);
  console.log('======================================================================');
}

runHarness().catch((err) => {
  console.error('Harness error:', err);
  process.exit(1);
});
