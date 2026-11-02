import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

import { getPool } from '../../api/_lib/db.ts';
import { getJwtSecret } from '../../api/_lib/env.ts';
import {
  executeTransition,
  executeStatusTransition,
  TRANSITIONS,
  normalizeAction,
} from '../../api/_lib/bookingMachine.ts';
import {
  createOtpRecord,
  verifyOtpAttempt,
  getActivePickupCodeForOwner,
  deriveOtp,
  hashOtp,
} from '../../api/_lib/otp.ts';
import catchAllRootHandler from '../../api/[...route].ts';
import catchAllWebHandler from '../../packages/web/api/[...route].ts';

// Test Users from seed
const USERS = {
  superAdmin: {
    id: '00000000-0000-4000-a000-000000000001',
    email: 'superadmin@flashfix.in',
    role: 'SUPER_ADMIN' as const,
    storeId: null,
  },
  adminKoramangala: {
    id: '00000000-0000-4000-a000-000000000002',
    email: 'admin.koramangala@flashfix.in',
    role: 'ADMIN' as const,
    storeId: 'store-001',
  },
  adminIndiranagar: {
    id: '00000000-0000-4000-a000-000000000003',
    email: 'admin.indiranagar@flashfix.in',
    role: 'ADMIN' as const,
    storeId: 'store-002',
  },
  riderRajesh: {
    id: '00000000-0000-4000-a000-000000000004',
    email: 'delivery.rajesh@flashfix.in',
    role: 'EMPLOYEE' as const,
    storeId: 'store-001',
  },
  riderOther: {
    id: '00000000-0000-4000-a000-000000000012',
    email: 'rider@flashfix.in',
    role: 'EMPLOYEE' as const,
    storeId: 'store-001',
  },
  techFlashfix: {
    id: '00000000-0000-4000-a000-000000000011',
    email: 'tech@flashfix.in',
    role: 'TECHNICIAN' as const,
    storeId: 'store-001',
  },
  techVikram: {
    id: '00000000-0000-4000-a000-000000000005',
    email: 'tech.vikram@flashfix.in',
    role: 'EMPLOYEE' as const,
    storeId: 'store-001',
  },
  consumerRahul: {
    id: '00000000-0000-4000-a000-000000000006',
    email: 'rahul.sharma@example.com',
    role: 'CONSUMER' as const,
    storeId: null,
  },
  consumerOther: {
    id: '3c74adab-5789-4c50-b62e-b22ae7d2f9ce',
    email: 'velagajayaprakash123@gmail.com',
    role: 'CONSUMER' as const,
    storeId: null,
  },
};

function signSession(user: { id: string; email: string; role: string; storeId?: string | null }) {
  const secret = getJwtSecret();
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    storeId: user.storeId || null,
    storeIds: user.storeId ? [user.storeId] : [],
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' });
}

class MockResponse {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
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

async function invokeRoute(handler: Function, method: string, pathname: string, body: any = {}, sessionCookie?: string) {
  const req: any = {
    method,
    url: pathname,
    body,
    headers: {
      cookie: sessionCookie ? `ff_session=${sessionCookie}` : '',
    },
  };
  const res = new MockResponse();
  await handler(req, res);
  return res;
}

describe('Milestone 2 Adversarial Stress Test Suite', () => {
  let pool: Pool;
  const createdBookingIds: string[] = [];

  before(async () => {
    pool = getPool()!;
    assert.ok(pool, 'Neon DB Pool must be initialized');
  });

  after(async () => {
    if (pool && createdBookingIds.length > 0) {
      await pool.query('DELETE FROM booking_trail WHERE booking_id = ANY($1)', [createdBookingIds]);
      await pool.query('DELETE FROM otp_codes WHERE booking_id = ANY($1)', [createdBookingIds]);
      await pool.query('DELETE FROM bookings WHERE id = ANY($1)', [createdBookingIds]);
    }
  });

  async function createTestBooking(status: string = 'PENDING', storeId: string = 'store-001', assignedEmployeeId: string | null = null, technicianId: string | null = null) {
    const bookingId = `FF-ADV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const trackingCode = `TRK-${bookingId}`;
    createdBookingIds.push(bookingId);

    await pool.query(
      `INSERT INTO bookings (
         id, tracking_code, user_id, brand, device_model, issue_type, store_id,
         scheduled_date, scheduled_time, pickup_address, contact_name, contact_email,
         contact_phone, status, assigned_employee_id, technician_id, created_at, updated_at
       ) VALUES ($1, $2, $3, 'Apple', 'iPhone 15 Pro', 'Screen', $4, '2026-11-10', '10:00 AM',
                 '123 Adversarial Lane', 'Rahul Sharma', 'rahul.sharma@example.com', '+919876543210',
                 $5, $6, $7, NOW(), NOW())`,
      [bookingId, trackingCode, USERS.consumerRahul.id, storeId, status, assignedEmployeeId, technicianId]
    );

    return bookingId;
  }

  // =========================================================================
  // 1. CONCURRENCY & RACE CONDITION STRESS (OCC)
  // =========================================================================
  describe('1. Concurrency & Race Condition Stress (OCC)', () => {
    test('1.1 Conflicting concurrent transitions (Rider startPickup vs Customer cancel from CONFIRMED)', async () => {
      const bookingId = await createTestBooking('CONFIRMED', 'store-001', USERS.riderRajesh.id);

      const riderSession = {
        sub: USERS.riderRajesh.id,
        email: USERS.riderRajesh.email,
        role: USERS.riderRajesh.role,
        storeId: USERS.riderRajesh.storeId,
      };
      const customerSession = {
        sub: USERS.consumerRahul.id,
        email: USERS.consumerRahul.email,
        role: USERS.consumerRahul.role,
        storeId: null,
      };

      // Launch both simultaneously
      const [riderRes, customerRes] = await Promise.allSettled([
        executeTransition(pool, bookingId, 'startPickup', riderSession),
        executeTransition(pool, bookingId, 'cancel', customerSession),
      ]);

      const results = [riderRes, customerRes];
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one transition must succeed');
      assert.equal(rejected.length, 1, 'Exactly one transition must be rejected with conflict');

      const rejectionError = (rejected[0] as PromiseRejectedResult).reason;
      assert.equal(rejectionError.statusCode, 409, 'Losing transition must throw HTTP 409 Conflict');

      // Verify final DB state is either PICKUP_EN_ROUTE or CANCELLED, never an illegal mixed state
      const dbRes = await pool.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
      assert.ok(['PICKUP_EN_ROUTE', 'CANCELLED'].includes(dbRes.rows[0].status));
    });

    test('1.2 Double-cancel race condition (simultaneous customer cancellation)', async () => {
      const bookingId = await createTestBooking('PENDING');
      const customerSession = {
        sub: USERS.consumerRahul.id,
        email: USERS.consumerRahul.email,
        role: USERS.consumerRahul.role,
        storeId: null,
      };

      const [res1, res2] = await Promise.allSettled([
        executeTransition(pool, bookingId, 'cancel', customerSession),
        executeTransition(pool, bookingId, 'cancel', customerSession),
      ]);

      const results = [res1, res2];
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one cancel call must succeed');
      assert.equal(rejected.length, 1, 'Double-cancel second call must reject with 409');
      assert.equal((rejected[0] as PromiseRejectedResult).reason.statusCode, 409);
    });

    test('1.3 10-way burst concurrency on single booking transition', async () => {
      const bookingId = await createTestBooking('CONFIRMED', 'store-001', USERS.riderRajesh.id);
      const riderSession = {
        sub: USERS.riderRajesh.id,
        email: USERS.riderRajesh.email,
        role: USERS.riderRajesh.role,
        storeId: USERS.riderRajesh.storeId,
      };

      // Fire 10 simultaneous startPickup requests
      const promises = Array.from({ length: 10 }, () =>
        executeTransition(pool, bookingId, 'startPickup', riderSession)
      );

      const outcomes = await Promise.allSettled(promises);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Burst of 10 concurrent requests must produce exactly 1 success');
      assert.equal(rejected.length, 9, 'All 9 losing requests must be rejected');

      for (const rej of rejected) {
        assert.equal((rej as PromiseRejectedResult).reason.statusCode, 409, 'Every losing request must return 409');
      }

      const dbRes = await pool.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
      assert.equal(dbRes.rows[0].status, 'PICKUP_EN_ROUTE');
    });
  });

  // =========================================================================
  // 2. STATE MACHINE INTEGRITY & BOUNDARY CHECKS
  // =========================================================================
  describe('2. State Machine Integrity & Boundary Checks', () => {
    test('2.1 Rejects illegal state jumps with 409 Conflict', async () => {
      const superSession = {
        sub: USERS.superAdmin.id,
        email: USERS.superAdmin.email,
        role: USERS.superAdmin.role,
      };

      // PENDING -> DELIVERED
      const b1 = await createTestBooking('PENDING');
      await assert.rejects(
        executeTransition(pool, b1, 'deliver', superSession),
        (err: any) => err.statusCode === 409 && /Cannot transition from "PENDING" to "DELIVERED"/i.test(err.message)
      );

      // PENDING -> IN_REPAIR
      const b2 = await createTestBooking('PENDING');
      await assert.rejects(
        executeTransition(pool, b2, 'verifyCustody', superSession, { otp: '000000' }),
        (err: any) => err.statusCode === 409
      );

      // CONFIRMED -> DELIVERED
      const b3 = await createTestBooking('CONFIRMED');
      await assert.rejects(
        executeTransition(pool, b3, 'deliver', superSession),
        (err: any) => err.statusCode === 409
      );

      // IN_REPAIR -> PENDING (backward regression)
      const b4 = await createTestBooking('IN_REPAIR');
      await assert.rejects(
        executeStatusTransition(pool, b4, 'PENDING', superSession),
        (err: any) => err.statusCode === 400 || err.statusCode === 409
      );

      // DELIVERED -> any transition (terminal state)
      const b5 = await createTestBooking('DELIVERED');
      await assert.rejects(
        executeTransition(pool, b5, 'cancel', superSession),
        (err: any) => err.statusCode === 409
      );
      await assert.rejects(
        executeTransition(pool, b5, 'startReturn', superSession),
        (err: any) => err.statusCode === 409
      );

      // CANCELLED -> any transition (terminal state)
      const b6 = await createTestBooking('CANCELLED');
      await assert.rejects(
        executeTransition(pool, b6, 'assign', superSession),
        (err: any) => err.statusCode === 409
      );
    });

    test('2.2 Customer cancellation allowed only in PENDING, CONFIRMED, PICKUP_EN_ROUTE', async () => {
      const customerSession = {
        sub: USERS.consumerRahul.id,
        email: USERS.consumerRahul.email,
        role: USERS.consumerRahul.role,
        storeId: null,
      };

      // Allowed from PENDING
      const b1 = await createTestBooking('PENDING');
      const res1 = await executeTransition(pool, b1, 'cancel', customerSession);
      assert.equal(res1.booking.status, 'CANCELLED');

      // Allowed from CONFIRMED
      const b2 = await createTestBooking('CONFIRMED');
      const res2 = await executeTransition(pool, b2, 'cancel', customerSession);
      assert.equal(res2.booking.status, 'CANCELLED');

      // Allowed from PICKUP_EN_ROUTE
      const b3 = await createTestBooking('PICKUP_EN_ROUTE');
      const res3 = await executeTransition(pool, b3, 'cancel', customerSession);
      assert.equal(res3.booking.status, 'CANCELLED');

      // Disallowed from IN_TRANSIT
      const b4 = await createTestBooking('IN_TRANSIT');
      await assert.rejects(
        executeTransition(pool, b4, 'cancel', customerSession),
        (err: any) => err.statusCode === 409
      );

      // Disallowed from IN_REPAIR
      const b5 = await createTestBooking('IN_REPAIR');
      await assert.rejects(
        executeTransition(pool, b5, 'cancel', customerSession),
        (err: any) => err.statusCode === 409
      );

      // Disallowed from REPAIR_COMPLETE
      const b6 = await createTestBooking('REPAIR_COMPLETE');
      await assert.rejects(
        executeTransition(pool, b6, 'cancel', customerSession),
        (err: any) => err.statusCode === 409
      );

      // Disallowed from RETURN_EN_ROUTE
      const b7 = await createTestBooking('RETURN_EN_ROUTE');
      await assert.rejects(
        executeTransition(pool, b7, 'cancel', customerSession),
        (err: any) => err.statusCode === 409
      );

      // Disallowed from DELIVERED
      const b8 = await createTestBooking('DELIVERED');
      await assert.rejects(
        executeTransition(pool, b8, 'cancel', customerSession),
        (err: any) => err.statusCode === 409
      );
    });

    test('2.3 Role-based authorization & scope boundaries', async () => {
      const bookingId = await createTestBooking('PENDING', 'store-001', USERS.riderRajesh.id, USERS.techFlashfix.id);

      // Consumer attempting staff action (assign) -> 403
      await assert.rejects(
        executeTransition(pool, bookingId, 'assign', {
          sub: USERS.consumerRahul.id,
          email: USERS.consumerRahul.email,
          role: USERS.consumerRahul.role,
        }),
        (err: any) => err.statusCode === 403
      );

      // Non-owner consumer attempting to cancel another customer's booking -> 403
      await assert.rejects(
        executeTransition(pool, bookingId, 'cancel', {
          sub: USERS.consumerOther.id,
          email: USERS.consumerOther.email,
          role: USERS.consumerOther.role,
        }),
        (err: any) => err.statusCode === 403 && /You do not own this booking/i.test(err.message)
      );

      // Courier attempting technician action (completeRepair) -> 403
      await assert.rejects(
        executeTransition(pool, bookingId, 'completeRepair', {
          sub: USERS.riderRajesh.id,
          email: USERS.riderRajesh.email,
          role: USERS.riderRajesh.role,
          storeId: 'store-001',
        }),
        (err: any) => err.statusCode === 403
      );

      // Technician attempting courier action (startPickup) -> 403
      await assert.rejects(
        executeTransition(pool, bookingId, 'startPickup', {
          sub: USERS.techFlashfix.id,
          email: USERS.techFlashfix.email,
          role: USERS.techFlashfix.role,
          storeId: 'store-001',
        }),
        (err: any) => err.statusCode === 403
      );

      // Cross-store staff: Admin for Indiranagar (store-002) attempting transition on Koramangala (store-001) booking -> 403
      await assert.rejects(
        executeTransition(pool, bookingId, 'assign', {
          sub: USERS.adminIndiranagar.id,
          email: USERS.adminIndiranagar.email,
          role: USERS.adminIndiranagar.role,
          storeId: 'store-002',
        }),
        (err: any) => err.statusCode === 403
      );

      // Unassigned courier attempting courier action on assigned booking
      const bConf = await createTestBooking('CONFIRMED', 'store-001', USERS.riderRajesh.id);
      await assert.rejects(
        executeTransition(pool, bConf, 'startPickup', {
          sub: USERS.riderOther.id,
          email: USERS.riderOther.email,
          role: USERS.riderOther.role,
          storeId: 'store-001',
        }),
        (err: any) => err.statusCode === 403 && /not the courier assigned/i.test(err.message)
      );
    });
  });

  // =========================================================================
  // 3. AUDIT TRAIL VERIFICATION
  // =========================================================================
  describe('3. Immutable Audit Trail Verification', () => {
    test('3.1 Successful transition writes immutable audit log with triggered_by_user_id', async () => {
      const bookingId = await createTestBooking('PENDING', 'store-001');

      const adminSession = {
        sub: USERS.adminKoramangala.id,
        email: USERS.adminKoramangala.email,
        role: USERS.adminKoramangala.role,
        storeId: 'store-001',
      };

      await executeTransition(pool, bookingId, 'assign', adminSession, {
        note: 'Assigned to Rajesh Kumar for pickup',
        employeeId: USERS.riderRajesh.id,
      });

      const trailRes = await pool.query(
        'SELECT * FROM booking_trail WHERE booking_id = $1 ORDER BY created_at DESC',
        [bookingId]
      );

      assert.ok(trailRes.rows.length >= 1, 'Audit trail entry must be inserted');
      const latest = trailRes.rows[0];
      assert.equal(latest.from_status, 'PENDING');
      assert.equal(latest.to_status, 'CONFIRMED');
      assert.equal(latest.triggered_by_user_id, USERS.adminKoramangala.id);
      assert.equal(latest.notes, 'Assigned to Rajesh Kumar for pickup');
      assert.ok(latest.created_at, 'created_at must be populated');
    });

    test('3.2 Failed transition rolls back cleanly without writing audit trail', async () => {
      const bookingId = await createTestBooking('PENDING', 'store-001');

      const beforeTrail = await pool.query('SELECT COUNT(*) FROM booking_trail WHERE booking_id = $1', [bookingId]);
      const initialCount = Number(beforeTrail.rows[0].count);

      // Attempt illegal transition that fails with 409
      try {
        await executeTransition(pool, bookingId, 'deliver', {
          sub: USERS.superAdmin.id,
          email: USERS.superAdmin.email,
          role: USERS.superAdmin.role,
        });
      } catch (err: any) {
        assert.equal(err.statusCode, 409);
      }

      const afterTrail = await pool.query('SELECT COUNT(*) FROM booking_trail WHERE booking_id = $1', [bookingId]);
      assert.equal(Number(afterTrail.rows[0].count), initialCount, 'Trail count must not change on rolled back transaction');
    });
  });

  // =========================================================================
  // 4. DYNAMIC HMAC OTP ENGINE & SECURITY
  // =========================================================================
  describe('4. Dynamic HMAC OTP Engine & Security', () => {
    test('4.1 Dynamic HMAC OTP derivation generates valid 6-digit code', async () => {
      const bookingId = await createTestBooking('PICKUP_EN_ROUTE');
      const secret = getJwtSecret();
      const rowId = crypto.randomUUID();

      const code = deriveOtp(secret, bookingId, 'PICKUP', rowId);
      assert.match(code, /^\d{6}$/, 'OTP must be exactly 6 digits');
      assert.notEqual(code, '123456', 'Must not be demo 123456');
      assert.notEqual(code, '849201', 'Must not be demo 849201');

      // Derivation is deterministic given same parameters
      const codeRepeat = deriveOtp(secret, bookingId, 'PICKUP', rowId);
      assert.equal(code, codeRepeat, 'HMAC derivation must be deterministic');
    });

    test('4.2 5-attempt brute-force lockout locks OTP permanently (HTTP 429)', async () => {
      const bookingId = await createTestBooking('PICKUP_EN_ROUTE');
      const { code } = await createOtpRecord(pool, bookingId, 'PICKUP', 'rahul@example.com');

      // Attempts 1 to 4: should fail with 400 OTP_INVALID
      for (let i = 1; i <= 4; i++) {
        await assert.rejects(
          verifyOtpAttempt(pool, bookingId, 'PICKUP', '000000'),
          (err: any) => err.statusCode === 400 && err.code === 'OTP_INVALID'
        );
      }

      // Attempt 5: triggers lockout (HTTP 429)
      await assert.rejects(
        verifyOtpAttempt(pool, bookingId, 'PICKUP', '000000'),
        (err: any) => err.statusCode === 429 && err.code === 'OTP_MAX_ATTEMPTS_EXCEEDED'
      );

      // Attempt 6: even submitting the valid code fails after lockout
      await assert.rejects(
        verifyOtpAttempt(pool, bookingId, 'PICKUP', code),
        (err: any) => err.statusCode === 429 && err.code === 'OTP_MAX_ATTEMPTS_EXCEEDED'
      );
    });

    test('4.3 Replay prevention: Verified OTP cannot be reused', async () => {
      const bookingId = await createTestBooking('PICKUP_EN_ROUTE');
      const { code } = await createOtpRecord(pool, bookingId, 'PICKUP', 'rahul@example.com');

      const verifyRes = await verifyOtpAttempt(pool, bookingId, 'PICKUP', code);
      assert.equal(verifyRes.success, true);

      // Replay attempt
      await assert.rejects(
        verifyOtpAttempt(pool, bookingId, 'PICKUP', code),
        (err: any) => err.statusCode === 400 && err.code === 'OTP_EXPIRED'
      );
    });

    test('4.4 Owner-only dynamic pickup OTP retrieval via getActivePickupCodeForOwner', async () => {
      const bookingId = await createTestBooking('PICKUP_OTP_SENT');
      const { code } = await createOtpRecord(pool, bookingId, 'PICKUP', 'rahul@example.com');

      const retrievedCode = await getActivePickupCodeForOwner(pool, bookingId);
      assert.equal(retrievedCode, code, 'Authenticated owner retrieves exact dynamic OTP');
    });
  });

  // =========================================================================
  // 5. SERVERLESS GATEWAY PARITY (api/[...route].ts vs packages/web/api)
  // =========================================================================
  describe('5. Serverless Catch-All Gateway Parity', () => {
    test('5.1 POST /bookings/:id/cancel through root and web catch-all routers', async () => {
      const sessionCookie = signSession(USERS.consumerRahul);

      // Root router test
      const bRoot = await createTestBooking('PENDING');
      const resRoot = await invokeRoute(
        catchAllRootHandler,
        'POST',
        `/api/bookings/${bRoot}/cancel`,
        { note: 'Root cancel test' },
        sessionCookie
      );
      assert.equal(resRoot.statusCode, 200);
      assert.equal(resRoot.body.success, true);
      assert.equal(resRoot.body.booking.status, 'CANCELLED');

      // Web router test (parity check)
      const bWeb = await createTestBooking('PENDING');
      const resWeb = await invokeRoute(
        catchAllWebHandler,
        'POST',
        `/api/bookings/${bWeb}/cancel`,
        { note: 'Web cancel test' },
        sessionCookie
      );
      assert.equal(resWeb.statusCode, 200);
      assert.equal(resWeb.body.success, true);
      assert.equal(resWeb.body.booking.status, 'CANCELLED');
    });

    test('5.2 Redacted vs Authenticated Owner view via GET /bookings/:id', async () => {
      const bookingId = await createTestBooking('PICKUP_OTP_SENT');
      const { code } = await createOtpRecord(pool, bookingId, 'PICKUP', 'rahul@example.com');

      // 1. Unauthenticated public request -> Redacted view
      const pubRes = await invokeRoute(catchAllRootHandler, 'GET', `/api/bookings/${bookingId}`);
      assert.equal(pubRes.statusCode, 200);
      assert.equal(pubRes.body.success, true);
      assert.equal(pubRes.body.data.pickupOtp, undefined, 'Public must not receive pickupOtp');
      assert.equal(pubRes.body.data.contactPhone, undefined, 'Public must not receive contactPhone');
      assert.equal(pubRes.body.data.pickupAddress, undefined, 'Public must not receive pickupAddress');

      // 2. Authenticated Owner request -> Full view + dynamic pickupOtp
      const ownerCookie = signSession(USERS.consumerRahul);
      const ownerRes = await invokeRoute(catchAllRootHandler, 'GET', `/api/bookings/${bookingId}`, {}, ownerCookie);
      assert.equal(ownerRes.statusCode, 200);
      assert.equal(ownerRes.body.success, true);
      assert.equal(ownerRes.body.data.pickupOtp, code, 'Owner must receive active pickupOtp');
      assert.equal(ownerRes.body.data.contactPhone, '+919876543210', 'Owner must receive contactPhone');
      assert.equal(ownerRes.body.data.pickupAddress, '123 Adversarial Lane', 'Owner must receive pickupAddress');
    });

    test('5.3 Unauthenticated transition attempt returns 401 Unauthorized', async () => {
      const bookingId = await createTestBooking('CONFIRMED');
      const res = await invokeRoute(catchAllRootHandler, 'POST', `/api/bookings/${bookingId}/start-pickup`);
      assert.equal(res.statusCode, 401, 'Must reject unauthenticated request with 401');
    });
  });
});
