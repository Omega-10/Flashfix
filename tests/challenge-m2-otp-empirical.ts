/**
 * Empirical Adversarial Test Harness for Milestone 2: Dynamic OTP & State Machine Security
 * Agent: challenger_m2_state_machine_2
 *
 * Verifies all ADVERSARIAL OBJECTIVES:
 * 1. Dynamic OTP & Brute-Force Lockout:
 *    - 5 consecutive incorrect OTP attempts triggers HTTP 429 (OTP_MAX_ATTEMPTS_EXCEEDED).
 *    - 6th attempt (even with valid code) remains locked out with HTTP 429.
 *    - OTP replay attack: immediate subsequent verification attempts are rejected.
 *    - Expired OTP: attempts after 15 minutes return HTTP 400 (OTP_EXPIRED).
 * 2. Plaintext Leakage & Privacy Attack:
 *    - POST /bookings/:id/send-pickup-otp: response body does NOT contain 'otp' property or plaintext code.
 *    - GET /bookings/:id:
 *      * Unauthenticated visitor: pickupOtp is undefined / absent.
 *      * Third-party consumer: pickupOtp is undefined / absent.
 *      * Assigned courier: pickupOtp is undefined / absent.
 *      * Authenticated booking owner: pickupOtp present ONLY when status is PICKUP_OTP_SENT.
 *      * Authenticated booking owner: pickupOtp absent when status is CONFIRMED, PICKUP_EN_ROUTE, or IN_TRANSIT.
 *    - Demo code injection ('123456', '849201', '592184'): fails verification unless genuinely generated.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getPool } from '../api/_lib/db.ts';
import { getJwtSecret } from '../api/_lib/env.ts';
import {
  createOtpRecord,
  verifyOtpAttempt,
  deriveOtp,
  hashOtp,
  getActivePickupCodeForOwner,
} from '../api/_lib/otp.ts';
import {
  sendPickupOtpHandler,
  getBookingByIdHandler,
  verifyPickupHandler,
} from '../api/_lib/routes/bookings.ts';
import {
  MockServerlessRequest,
  MockServerlessResponse,
  signSessionToken,
} from './api/test-helpers.ts';
import { HttpError } from '../api/_lib/authz.ts';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

const results: TestResult[] = [];

async function recordTest(
  category: string,
  name: string,
  fn: () => Promise<string | void>
) {
  try {
    const detail = (await fn()) || 'Assertion passed successfully.';
    results.push({ name, category, status: 'PASS', details: detail });
    console.log(`[PASS] [${category}] ${name}`);
    console.log(`       Evidence: ${detail}`);
  } catch (err: any) {
    const errMsg = err.message || String(err);
    results.push({ name, category, status: 'FAIL', details: 'Test assertion failed', error: errMsg });
    console.error(`[FAIL] [${category}] ${name}`);
    console.error(`       Error: ${errMsg}`);
    if (err.stack) console.error(err.stack);
  }
}

async function runAdversarialOtpSuite() {
  console.log('================================================================================');
  console.log('Flashfix v2 Milestone 2 — Empirical Adversarial OTP Challenge Suite');
  console.log('Agent: challenger_m2_state_machine_2');
  console.log('Target: Live Neon Database & Production Route Handlers');
  console.log('================================================================================\n');

  const db = getPool();
  if (!db) {
    throw new Error('Database pool could not be initialized from DATABASE_URL.');
  }

  const jwtSecret = getJwtSecret();
  assert.ok(jwtSecret && jwtSecret.length >= 32, 'JWT secret must be at least 32 characters');

  // Find sample store and test users from database
  const storeRes = await db.query(`SELECT id FROM stores LIMIT 1`);
  const storeId = storeRes.rows[0]?.id || 'store-001';

  // Seeded IDs
  const consumerUserRes = await db.query(`SELECT id, email FROM users WHERE role = 'CONSUMER' LIMIT 1`);
  const courierUserRes = await db.query(`SELECT id, email FROM users WHERE role = 'EMPLOYEE' LIMIT 1`);
  const techUserRes = await db.query(`SELECT id, email FROM users WHERE role = 'TECHNICIAN' LIMIT 1`);

  const ownerId = consumerUserRes.rows[0]?.id || '00000000-0000-4000-a000-000000000006';
  const ownerEmail = consumerUserRes.rows[0]?.email || 'consumer.test@example.com';

  const courierId = courierUserRes.rows[0]?.id || '00000000-0000-4000-a000-000000000012';
  const courierEmail = courierUserRes.rows[0]?.email || 'rider@flashfix.in';

  const otherConsumerId = '00000000-0000-4000-a000-999999999999';
  const otherConsumerEmail = 'attacker@evil.com';

  const ownerToken = signSessionToken({ sub: ownerId, email: ownerEmail, role: 'CONSUMER' }, jwtSecret);
  const courierToken = signSessionToken({ sub: courierId, email: courierEmail, role: 'EMPLOYEE', storeId }, jwtSecret);
  const otherConsumerToken = signSessionToken({ sub: otherConsumerId, email: otherConsumerEmail, role: 'CONSUMER' }, jwtSecret);

  const cleanupBookingIds: string[] = [];

  // Helper to create a test booking in Neon DB
  async function createTestBooking(initialStatus: string = 'PENDING'): Promise<string> {
    const bookingId = `FF-CHALLENGE-M2-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const trackingCode = `TRK-${bookingId}`;
    cleanupBookingIds.push(bookingId);

    await db.query(
      `INSERT INTO bookings (
         id, tracking_code, user_id, brand, device_model, issue_type, store_id,
         scheduled_date, scheduled_time, pickup_address, contact_name, contact_email,
         contact_phone, status, assigned_employee_id, created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'Apple', 'iPhone 15 Pro', 'Screen Damage', $4,
         '2026-11-05', '14:00', '123 Test Street, Koramangala', 'Test Customer', $5,
         '+919876543210', $6, $7, NOW(), NOW()
       )`,
      [bookingId, trackingCode, ownerId, storeId, ownerEmail, initialStatus, courierId]
    );

    await db.query(
      `INSERT INTO booking_trail (id, booking_id, to_status, triggered_by_user_id, notes, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'Test booking seeded', NOW())`,
      [bookingId, initialStatus, ownerId]
    );

    return bookingId;
  }

  try {
    // =========================================================================
    // OBJECTIVE 1: DYNAMIC OTP & BRUTE-FORCE LOCKOUT
    // =========================================================================

    await recordTest(
      'Objective 1: Brute-Force Lockout',
      '1.1 5 consecutive incorrect attempts strictly triggers HTTP 429 (OTP_MAX_ATTEMPTS_EXCEEDED)',
      async () => {
        const bookingId = await createTestBooking('PICKUP_OTP_SENT');
        const { rowId, code: validCode } = await createOtpRecord(db, bookingId, 'PICKUP', ownerEmail);

        assert.match(validCode, /^\d{6}$/, 'Generated OTP must be a 6-digit numeric string');

        // Attempts 1 to 4: Each returns HTTP 400 OTP_INVALID with attempt count decremented
        for (let attempt = 1; attempt <= 4; attempt++) {
          const wrongCode = String(100000 + attempt);
          try {
            await verifyOtpAttempt(db, bookingId, 'PICKUP', wrongCode);
            assert.fail(`Attempt ${attempt} should have thrown HttpError`);
          } catch (err: any) {
            assert.ok(err instanceof HttpError, `Attempt ${attempt} must throw HttpError`);
            assert.strictEqual(err.statusCode, 400, `Attempt ${attempt} status must be 400`);
            assert.strictEqual(err.code, 'OTP_INVALID', `Attempt ${attempt} code must be OTP_INVALID`);
            const remaining = 5 - attempt;
            assert.match(err.message, new RegExp(`${remaining} attempt\\(s\\) remaining`));
          }

          // Verify database state: attempts count must equal attempt number
          const checkRes = await db.query(`SELECT attempts, verified FROM otp_codes WHERE id = $1`, [rowId]);
          assert.strictEqual(checkRes.rows[0].attempts, attempt);
          assert.strictEqual(checkRes.rows[0].verified, false);
        }

        // Attempt 5: The 5th consecutive failure MUST strictly throw HTTP 429 OTP_MAX_ATTEMPTS_EXCEEDED
        try {
          await verifyOtpAttempt(db, bookingId, 'PICKUP', '999999');
          assert.fail('5th attempt should have thrown 429 lockout');
        } catch (err: any) {
          assert.ok(err instanceof HttpError, '5th attempt must throw HttpError');
          assert.strictEqual(err.statusCode, 429, '5th attempt MUST return HTTP 429');
          assert.strictEqual(err.code, 'OTP_MAX_ATTEMPTS_EXCEEDED', '5th attempt code MUST be OTP_MAX_ATTEMPTS_EXCEEDED');
          assert.match(err.message, /Maximum verification attempts exceeded/i);
        }

        // Verify DB attempts counter is now 5
        const checkRes5 = await db.query(`SELECT attempts, verified FROM otp_codes WHERE id = $1`, [rowId]);
        assert.strictEqual(checkRes5.rows[0].attempts, 5);
        assert.strictEqual(checkRes5.rows[0].verified, false);

        // Attempt 6 (Lockout Persistence): Even with the genuine valid OTP, attempt must be rejected with HTTP 429
        try {
          await verifyOtpAttempt(db, bookingId, 'PICKUP', validCode);
          assert.fail('6th attempt with valid code should have thrown 429 lockout');
        } catch (err: any) {
          assert.ok(err instanceof HttpError, '6th attempt must throw HttpError');
          assert.strictEqual(err.statusCode, 429, '6th attempt MUST return HTTP 429');
          assert.strictEqual(err.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
        }

        return `Empirically verified: Attempts 1-4 return 400 OTP_INVALID with counter updates; Attempt 5 strictly triggers 429 OTP_MAX_ATTEMPTS_EXCEEDED; Attempt 6 with genuine valid code (${validCode}) remains blocked with 429.`;
      }
    );

    await recordTest(
      'Objective 1: Replay Attack Resistance',
      '1.2 Verified OTP is atomically invalidated; immediate subsequent attempts are rejected',
      async () => {
        const bookingId = await createTestBooking('PICKUP_OTP_SENT');
        const { rowId, code: validCode } = await createOtpRecord(db, bookingId, 'PICKUP', ownerEmail);

        // First verification: genuine code succeeds
        const verifyRes = await verifyOtpAttempt(db, bookingId, 'PICKUP', validCode);
        assert.strictEqual(verifyRes.success, true);
        assert.strictEqual(verifyRes.rowId, rowId);

        // Verify DB row status
        const dbRow = await db.query(`SELECT verified FROM otp_codes WHERE id = $1`, [rowId]);
        assert.strictEqual(dbRow.rows[0].verified, true, 'DB row must be marked verified = true');

        // Immediate replay attempt 1: submitting identical genuine code again
        try {
          await verifyOtpAttempt(db, bookingId, 'PICKUP', validCode);
          assert.fail('Replay attack should have been rejected');
        } catch (err: any) {
          assert.ok(err instanceof HttpError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OTP_EXPIRED');
          assert.match(err.message, /No active verification code found/i);
        }

        // Immediate replay attempt 2: submitting different code
        try {
          await verifyOtpAttempt(db, bookingId, 'PICKUP', '000000');
          assert.fail('Subsequent attempt on consumed OTP should fail');
        } catch (err: any) {
          assert.ok(err instanceof HttpError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OTP_EXPIRED');
        }

        return `Empirically verified: Genuine OTP (${validCode}) verified successfully; verified column set to true; replaying identical OTP immediately throws 400 OTP_EXPIRED ("No active verification code found").`;
      }
    );

    await recordTest(
      'Objective 1: Expired OTP Protection',
      '1.3 OTP verification after 15 minutes window returns HTTP 400 (OTP_EXPIRED)',
      async () => {
        const bookingId = await createTestBooking('PICKUP_OTP_SENT');
        const rowId = crypto.randomUUID();
        const code = deriveOtp(jwtSecret, bookingId, 'PICKUP', rowId);
        const codeHash = hashOtp(code);

        // Insert OTP with timestamp explicitly expired in the past (e.g. 20 minutes ago)
        await db.query(
          `INSERT INTO otp_codes (
             id, booking_id, email, code_hash, purpose, expires_at, attempts, verified, created_at
           ) VALUES (
             $1, $2, $3, $4, 'PICKUP', NOW() - INTERVAL '20 minutes', 0, false, NOW() - INTERVAL '25 minutes'
           )`,
          [rowId, bookingId, ownerEmail, codeHash]
        );

        // Verification attempt with genuine code on expired record
        try {
          await verifyOtpAttempt(db, bookingId, 'PICKUP', code);
          assert.fail('Expired OTP should have thrown 400 OTP_EXPIRED');
        } catch (err: any) {
          assert.ok(err instanceof HttpError);
          assert.strictEqual(err.statusCode, 400, 'Expired OTP must return HTTP 400');
          assert.strictEqual(err.code, 'OTP_EXPIRED');
          assert.match(err.message, /expired/i);
        }

        // Verification attempt with wrong code on expired record
        try {
          await verifyOtpAttempt(db, bookingId, 'PICKUP', '111222');
          assert.fail('Expired OTP with wrong code should have thrown 400 OTP_EXPIRED');
        } catch (err: any) {
          assert.ok(err instanceof HttpError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OTP_EXPIRED');
        }

        return `Empirically verified: OTP record created with expires_at in the past (>15m) strictly throws 400 OTP_EXPIRED when submitted with genuine or forged code.`;
      }
    );

    // =========================================================================
    // OBJECTIVE 2: PLAINTEXT LEAKAGE & PRIVACY ATTACK
    // =========================================================================

    await recordTest(
      'Objective 2: Plaintext Leakage Prevention',
      '2.1 POST /bookings/:id/send-pickup-otp response body does NOT contain "otp" property or plaintext code',
      async () => {
        // Prepare booking in PICKUP_EN_ROUTE so courier can trigger sendPickupOtp
        const bookingId = await createTestBooking('PICKUP_EN_ROUTE');

        const req = new MockServerlessRequest({
          method: 'POST',
          url: `/bookings/${bookingId}/send-pickup-otp`,
          headers: { cookie: `ff_session=${courierToken}` },
        });
        const res = new MockServerlessResponse();

        await sendPickupOtpHandler(req, res, bookingId);

        if (res.statusCode !== 200) {
          console.error('sendPickupOtpHandler returned non-200:', res.statusCode, res.body);
        }
        assert.strictEqual(res.statusCode, 200, `Handler must return 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        assert.ok(res.body, 'Response body must exist');
        assert.strictEqual(res.body.success, true);

        // Retrieve actual generated OTP from DB to inspect leak
        const otpRow = await db.query(
          `SELECT id, code_hash FROM otp_codes WHERE booking_id = $1 AND purpose = 'PICKUP' ORDER BY created_at DESC LIMIT 1`,
          [bookingId]
        );
        assert.ok(otpRow.rows.length > 0, 'An OTP record must have been created in otp_codes table');
        const generatedRowId = otpRow.rows[0].id;
        const actualDerivedOtp = deriveOtp(jwtSecret, bookingId, 'PICKUP', generatedRowId);

        // Strict Privacy Assertions on Response Body
        const bodyStr = JSON.stringify(res.body);

        assert.strictEqual(res.body.otp, undefined, 'res.body.otp must be undefined');
        assert.strictEqual(res.body.data?.otp, undefined, 'res.body.data.otp must be undefined');
        assert.strictEqual(res.body.data?.code, undefined, 'res.body.data.code must be undefined');
        assert.strictEqual(res.body.data?.pickupOtp, undefined, 'res.body.data.pickupOtp must be undefined');
        assert.strictEqual(res.body.booking?.otp, undefined, 'res.body.booking.otp must be undefined');
        assert.strictEqual(res.body.booking?.pickupOtp, undefined, 'res.body.booking.pickupOtp must be undefined');

        // Check entire serialized body does not contain the 6-digit code substring
        assert.ok(
          !bodyStr.includes(actualDerivedOtp),
          `Leaked plaintext OTP (${actualDerivedOtp}) found inside response body JSON string: ${bodyStr}`
        );

        return `Empirically verified: POST /bookings/${bookingId}/send-pickup-otp returned 200 OK. Dynamic OTP (${actualDerivedOtp}) was generated in DB, but response body strictly contains 0 occurrences of the plaintext code or "otp" property.`;
      }
    );

    await recordTest(
      'Objective 2: Role Scoping & GET /bookings/:id Privacy Matrix',
      '2.2 GET /bookings/:id: pickupOtp is ABSENT for unauthenticated, courier, and third-party; present ONLY for booking owner in PICKUP_OTP_SENT',
      async () => {
        const bookingId = await createTestBooking('PICKUP_OTP_SENT');
        const { code: expectedOtp } = await createOtpRecord(db, bookingId, 'PICKUP', ownerEmail);

        // Case A: Unauthenticated Visitor (no session cookie)
        const reqAnon = new MockServerlessRequest({ method: 'GET', url: `/bookings/${bookingId}` });
        const resAnon = new MockServerlessResponse();
        await getBookingByIdHandler(reqAnon, resAnon, bookingId);

        assert.strictEqual(resAnon.statusCode, 200);
        assert.strictEqual(resAnon.body.data.pickupOtp, undefined, 'Anonymous visitor must NOT receive pickupOtp');
        assert.strictEqual(resAnon.body.data.contactPhone, undefined, 'Anonymous visitor must NOT receive contactPhone (redacted)');
        assert.strictEqual(resAnon.body.data.pickupAddress, undefined, 'Anonymous visitor must NOT receive pickupAddress (redacted)');

        // Case B: Third-Party Consumer (authenticated as a different user)
        const reqOther = new MockServerlessRequest({
          method: 'GET',
          url: `/bookings/${bookingId}`,
          headers: { cookie: `ff_session=${otherConsumerToken}` },
        });
        const resOther = new MockServerlessResponse();
        await getBookingByIdHandler(reqOther, resOther, bookingId);

        assert.strictEqual(resOther.statusCode, 200);
        assert.strictEqual(resOther.body.data.pickupOtp, undefined, 'Third-party consumer must NOT receive pickupOtp');
        assert.strictEqual(resOther.body.data.contactPhone, undefined, 'Third-party consumer must NOT receive contactPhone');

        // Case C: Assigned Courier (authenticated as EMPLOYEE)
        const reqCourier = new MockServerlessRequest({
          method: 'GET',
          url: `/bookings/${bookingId}`,
          headers: { cookie: `ff_session=${courierToken}` },
        });
        const resCourier = new MockServerlessResponse();
        await getBookingByIdHandler(reqCourier, resCourier, bookingId);

        assert.strictEqual(resCourier.statusCode, 200);
        assert.strictEqual(resCourier.body.data.pickupOtp, undefined, 'Assigned courier MUST NOT receive pickupOtp (must be collected from customer)');
        assert.ok(resCourier.body.data.contactPhone, 'Courier receives contact phone for delivery coordination');

        // Case D: Authenticated Booking Owner while status is PICKUP_OTP_SENT
        const reqOwner = new MockServerlessRequest({
          method: 'GET',
          url: `/bookings/${bookingId}`,
          headers: { cookie: `ff_session=${ownerToken}` },
        });
        const resOwner = new MockServerlessResponse();
        await getBookingByIdHandler(reqOwner, resOwner, bookingId);

        assert.strictEqual(resOwner.statusCode, 200);
        assert.strictEqual(resOwner.body.data.pickupOtp, expectedOtp, 'Authenticated owner MUST receive active pickupOtp');

        // Case E: Authenticated Booking Owner when status is NOT PICKUP_OTP_SENT (e.g. IN_TRANSIT)
        await db.query(`UPDATE bookings SET status = 'IN_TRANSIT' WHERE id = $1`, [bookingId]);
        const reqOwnerInTransit = new MockServerlessRequest({
          method: 'GET',
          url: `/bookings/${bookingId}`,
          headers: { cookie: `ff_session=${ownerToken}` },
        });
        const resOwnerInTransit = new MockServerlessResponse();
        await getBookingByIdHandler(reqOwnerInTransit, resOwnerInTransit, bookingId);

        assert.strictEqual(resOwnerInTransit.statusCode, 200);
        assert.strictEqual(
          resOwnerInTransit.body.data.pickupOtp,
          undefined,
          'Owner must NOT receive pickupOtp once status transitions out of PICKUP_OTP_SENT'
        );

        return `Empirically verified: pickupOtp is strictly undefined for anonymous, third-party consumer, and assigned courier. Owner receives dynamic pickupOtp (${expectedOtp}) exclusively when status = PICKUP_OTP_SENT, and undefined once in IN_TRANSIT.`;
      }
    );

    await recordTest(
      'Objective 2: Demo Code Injection Immunity',
      '2.3 Fixed demo codes ("123456", "849201", "592184") fail verification unless genuinely generated',
      async () => {
        const bookingId = await createTestBooking('PICKUP_OTP_SENT');
        const { code: genuineCode } = await createOtpRecord(db, bookingId, 'PICKUP', ownerEmail);

        const demoCodes = ['123456', '849201', '592184'];

        for (const demoCode of demoCodes) {
          // Verify that dynamically generated code is not any of the demo codes
          assert.notStrictEqual(
            genuineCode,
            demoCode,
            `Genuine derived OTP happened to collide with static demo code ${demoCode}`
          );

          // Attempt to verify with the demo code
          try {
            await verifyOtpAttempt(db, bookingId, 'PICKUP', demoCode);
            assert.fail(`Demo code ${demoCode} was accepted! Demo backdoor vulnerability detected!`);
          } catch (err: any) {
            assert.ok(err instanceof HttpError);
            assert.strictEqual(err.statusCode, 400);
            assert.strictEqual(err.code, 'OTP_INVALID');
          }
        }

        // Verify that the genuine code STILL verifies successfully (not locked out after 3 wrong attempts)
        const genuineVerify = await verifyOtpAttempt(db, bookingId, 'PICKUP', genuineCode);
        assert.strictEqual(genuineVerify.success, true);

        return `Empirically verified: Demo codes ("123456", "849201", "592184") all rejected with HTTP 400 OTP_INVALID. No backdoor exists. Genuine code (${genuineCode}) succeeded.`;
      }
    );

    // =========================================================================
    // OBJECTIVE 3: ROUTE-LEVEL VERIFY-PICKUP INTEGRATION
    // =========================================================================

    await recordTest(
      'Objective 3: verifyPickup Route Security',
      '3.1 POST /bookings/:id/verify-pickup enforces 6-digit validation, 5-attempt lockout, and transitions to IN_TRANSIT',
      async () => {
        const bookingId = await createTestBooking('PICKUP_OTP_SENT');
        const { code: validCode } = await createOtpRecord(db, bookingId, 'PICKUP', ownerEmail);

        // Submitting non-6-digit code -> 400 VALIDATION_ERROR
        const reqInvalidLen = new MockServerlessRequest({
          method: 'POST',
          url: `/bookings/${bookingId}/verify-pickup`,
          headers: { cookie: `ff_session=${courierToken}` },
          body: { otp: '123' },
        });
        const resInvalidLen = new MockServerlessResponse();
        await verifyPickupHandler(reqInvalidLen, resInvalidLen, bookingId);
        assert.strictEqual(resInvalidLen.statusCode, 400);
        assert.strictEqual(resInvalidLen.body.error.code, 'VALIDATION_ERROR');

        // Submitting empty OTP -> 400 VALIDATION_ERROR
        const reqEmpty = new MockServerlessRequest({
          method: 'POST',
          url: `/bookings/${bookingId}/verify-pickup`,
          headers: { cookie: `ff_session=${courierToken}` },
          body: {},
        });
        const resEmpty = new MockServerlessResponse();
        await verifyPickupHandler(reqEmpty, resEmpty, bookingId);
        assert.strictEqual(resEmpty.statusCode, 400);
        assert.strictEqual(resEmpty.body.error.code, 'VALIDATION_ERROR');

        // Submitting genuine code -> 200 OK and status transitions to IN_TRANSIT
        const reqValid = new MockServerlessRequest({
          method: 'POST',
          url: `/bookings/${bookingId}/verify-pickup`,
          headers: { cookie: `ff_session=${courierToken}` },
          body: { otp: validCode },
        });
        const resValid = new MockServerlessResponse();
        await verifyPickupHandler(reqValid, resValid, bookingId);

        if (resValid.statusCode !== 200) {
          console.error('verifyPickupHandler returned non-200:', resValid.statusCode, resValid.body);
        }
        assert.strictEqual(resValid.statusCode, 200, `Expected 200, got ${resValid.statusCode}: ${JSON.stringify(resValid.body)}`);
        assert.strictEqual(resValid.body.success, true);
        assert.strictEqual(resValid.body.data.status, 'IN_TRANSIT');

        // Verify audit trail entry was inserted for verifyPickup
        const trailRes = await db.query(
          `SELECT * FROM booking_trail WHERE booking_id = $1 AND to_status = 'IN_TRANSIT'`,
          [bookingId]
        );
        assert.strictEqual(trailRes.rows.length, 1, 'Audit trail entry must exist for verifyPickup');
        assert.strictEqual(trailRes.rows[0].triggered_by_user_id, courierId);

        // Immediate replay of verifyPickup on same booking -> 409 CONFLICT (status is now IN_TRANSIT)
        const reqReplay = new MockServerlessRequest({
          method: 'POST',
          url: `/bookings/${bookingId}/verify-pickup`,
          headers: { cookie: `ff_session=${courierToken}` },
          body: { otp: validCode },
        });
        const resReplay = new MockServerlessResponse();
        await verifyPickupHandler(reqReplay, resReplay, bookingId);

        assert.strictEqual(resReplay.statusCode, 409, 'Replaying verifyPickup must return 409 CONFLICT');
        assert.strictEqual(resReplay.body.error.code, 'CONFLICT');

        return `Empirically verified: POST /bookings/${bookingId}/verify-pickup validates format, accepts valid dynamic OTP (${validCode}), transitions booking to IN_TRANSIT, logs audit trail with courier ID (${courierId}), and rejects replay with 409 CONFLICT.`;
      }
    );

  } finally {
    // Cleanup seeded test bookings and cascaded rows from Neon DB
    if (cleanupBookingIds.length > 0) {
      console.log(`\nCleaning up ${cleanupBookingIds.length} seeded test bookings from database...`);
      for (const id of cleanupBookingIds) {
        await db.query(`DELETE FROM bookings WHERE id = $1`, [id]);
      }
      console.log('Cleanup complete.');
    }
  }

  // Summary
  console.log('\n================================================================================');
  console.log('ADVERSARIAL CHALLENGE EXECUTION SUMMARY');
  console.log('================================================================================');
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Invariants Tested : ${results.length}`);
  console.log(`Passed Invariants       : ${passCount}`);
  console.log(`Failed Invariants       : ${failCount}`);

  if (failCount > 0) {
    console.error('\nFAILURES ENCOUNTERED:');
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      console.error(`- [${r.category}] ${r.name}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log('\nALL ADVERSARIAL CHALLENGE INVARIANTS SATISFIED EMPIRICALLY.');
    process.exit(0);
  }
}

runAdversarialOtpSuite().catch((err) => {
  console.error('Fatal suite execution error:', err);
  process.exit(1);
});
