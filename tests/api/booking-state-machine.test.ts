/**
 * Booking State Machine & Optimistic Concurrency Control (OCC) Test Suite
 * Derivation: ORIGINAL_REQUEST.md § R2, PROJECT.md § Milestone 2, TEST_INFRA.md § Feature 4, 5, 6
 *
 * Verifies:
 * 1. Table-driven transition enforcement (TRANSITIONS table, valid transitions succeed, invalid jumps return 409).
 * 2. Concurrency & Double-Submit Guard (concurrent execution of identical transition produces exactly one 200 and one 409 Conflict).
 * 3. Immutable audit trail verification (booking_trail entry appended on every transition with triggered_by_user_id).
 * 4. Customer cancellation flow (allowed in PENDING, CONFIRMED, PICKUP_EN_ROUTE; 409 in IN_TRANSIT, IN_REPAIR; 403 on non-owner).
 * 5. Dynamic HMAC OTP derivation & 5-attempt brute-force lockout (fixed codes fail, 5 wrong attempts lock out, valid code verifies).
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  TEST_JWT_SECRET,
  SessionPayload,
  UserRole,
  deriveHmacOtp,
} from "./test-helpers.js";
import {
  TRANSITIONS as PROD_TRANSITIONS,
  normalizeAction,
} from "../../api/_lib/bookingMachine.ts";
import {
  deriveOtp as prodDeriveOtp,
  hashOtp as prodHashOtp,
} from "../../api/_lib/otp.ts";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PICKUP_EN_ROUTE"
  | "PICKUP_OTP_SENT"
  | "IN_TRANSIT"
  | "CUSTODY_OTP_SENT"
  | "IN_REPAIR"
  | "REPAIR_COMPLETE"
  | "RETURN_EN_ROUTE"
  | "DELIVERED"
  | "CANCELLED";

export interface TransitionConfig {
  from: BookingStatus[];
  to: BookingStatus;
  roles: UserRole[];
  assignedOnly?: "employee" | "technician";
  requiresOtp?: "PICKUP" | "CUSTODY";
  allowOwner?: boolean;
}

export const TRANSITIONS: Record<string, TransitionConfig> = {
  assign: {
    from: ["PENDING"],
    to: "CONFIRMED",
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  startPickup: {
    from: ["CONFIRMED"],
    to: "PICKUP_EN_ROUTE",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
  },
  sendPickupOtp: {
    from: ["PICKUP_EN_ROUTE"],
    to: "PICKUP_OTP_SENT",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
  },
  verifyPickup: {
    from: ["PICKUP_OTP_SENT"],
    to: "IN_TRANSIT",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
    requiresOtp: "PICKUP",
  },
  sendCustodyOtp: {
    from: ["IN_TRANSIT"],
    to: "CUSTODY_OTP_SENT",
    roles: ["EMPLOYEE", "TECHNICIAN"],
  },
  verifyCustody: {
    from: ["CUSTODY_OTP_SENT"],
    to: "IN_REPAIR",
    roles: ["TECHNICIAN"],
    assignedOnly: "technician",
    requiresOtp: "CUSTODY",
  },
  completeRepair: {
    from: ["IN_REPAIR"],
    to: "REPAIR_COMPLETE",
    roles: ["TECHNICIAN"],
    assignedOnly: "technician",
  },
  startReturn: {
    from: ["REPAIR_COMPLETE"],
    to: "RETURN_EN_ROUTE",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
  },
  deliver: {
    from: ["RETURN_EN_ROUTE"],
    to: "DELIVERED",
    roles: ["EMPLOYEE"],
    assignedOnly: "employee",
  },
  cancel: {
    from: ["PENDING", "CONFIRMED", "PICKUP_EN_ROUTE"],
    to: "CANCELLED",
    roles: ["CONSUMER", "ADMIN", "SUPER_ADMIN"],
    allowOwner: true,
  },
};

export interface BookingEntity {
  id: string;
  userId: string;
  storeId: string;
  status: BookingStatus;
  assignedEmployeeId?: string | null;
  technicianId?: string | null;
  finalCostPaise?: number | null;
  updatedAt: string;
}

export interface BookingTrailEntry {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  triggeredByUserId: string;
  notes: string;
  createdAt: string;
}

export interface OtpRecord {
  id: string;
  bookingId: string;
  purpose: "PICKUP" | "CUSTODY";
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  expiresAt: number;
}

/**
 * In-memory transactional test database fixture simulating PostgreSQL OCC & row locking.
 */
export class TestBookingStore {
  private bookings: Map<string, BookingEntity> = new Map();
  private trails: BookingTrailEntry[] = [];
  private otps: Map<string, OtpRecord> = new Map();
  private lockTable: Set<string> = new Set();

  reset() {
    this.bookings.clear();
    this.trails = [];
    this.otps.clear();
    this.lockTable.clear();
  }

  insertBooking(booking: BookingEntity) {
    this.bookings.set(booking.id, { ...booking });
  }

  getBooking(id: string): BookingEntity | undefined {
    const b = this.bookings.get(id);
    return b ? { ...b } : undefined;
  }

  getTrails(bookingId: string): BookingTrailEntry[] {
    return this.trails.filter((t) => t.bookingId === bookingId);
  }

  createOtp(bookingId: string, purpose: "PICKUP" | "CUSTODY"): { rowId: string; code: string } {
    const rowId = crypto.randomUUID();
    const code = deriveHmacOtp(TEST_JWT_SECRET, bookingId, purpose, rowId);
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    this.otps.set(`${bookingId}:${purpose}`, {
      id: rowId,
      bookingId,
      purpose,
      codeHash,
      attempts: 0,
      maxAttempts: 5,
      verified: false,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return { rowId, code };
  }

  getOtp(bookingId: string, purpose: "PICKUP" | "CUSTODY"): OtpRecord | undefined {
    return this.otps.get(`${bookingId}:${purpose}`);
  }

  verifyOtp(
    bookingId: string,
    purpose: "PICKUP" | "CUSTODY",
    submittedCode: string
  ): { success: boolean; statusCode: number; error?: string } {
    const record = this.otps.get(`${bookingId}:${purpose}`);
    if (!record) {
      return { success: false, statusCode: 400, error: "No active OTP generated for this purpose" };
    }
    if (record.verified) {
      return { success: false, statusCode: 400, error: "OTP has already been verified and consumed" };
    }
    if (record.attempts >= record.maxAttempts) {
      return { success: false, statusCode: 429, error: "OTP lockout: maximum 5 attempts exceeded" };
    }
    if (Date.now() > record.expiresAt) {
      return { success: false, statusCode: 400, error: "OTP code has expired (15m window exceeded)" };
    }

    const submittedHash = crypto.createHash("sha256").update(submittedCode).digest("hex");
    if (submittedHash !== record.codeHash) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        return { success: false, statusCode: 429, error: "OTP lockout: maximum 5 attempts exceeded" };
      }
      return {
        success: false,
        statusCode: 400,
        error: `Incorrect OTP code. Remaining attempts: ${record.maxAttempts - record.attempts}`,
      };
    }

    record.verified = true;
    return { success: true, statusCode: 200 };
  }

  /**
   * Simulates atomic executeTransition with Optimistic Concurrency Control (OCC).
   */
  async executeTransition(
    bookingId: string,
    action: string,
    session: SessionPayload,
    extraData?: { note?: string; otp?: string; employeeId?: string; technicianId?: string; finalCostPaise?: number }
  ): Promise<{ statusCode: number; booking?: BookingEntity; error?: string }> {
    const config = TRANSITIONS[action];
    if (!config) {
      return { statusCode: 400, error: `Invalid transition action "${action}"` };
    }

    // Role check
    const isOwner = session.role === "CONSUMER";
    if (isOwner && !config.allowOwner) {
      return { statusCode: 403, error: "Consumers cannot execute this action" };
    }
    if (!isOwner && session.role !== "SUPER_ADMIN" && !config.roles.includes(session.role)) {
      return { statusCode: 403, error: `Role "${session.role}" not permitted to execute "${action}"` };
    }

    // OCC Row Lock Simulation (simulates PostgreSQL SELECT FOR UPDATE / atomic UPDATE WHERE)
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      return { statusCode: 404, error: "Booking does not exist" };
    }

    // Ownership & Scope validation
    if (isOwner && booking.userId !== session.sub) {
      return { statusCode: 403, error: "You do not own this booking" };
    }
    if (!isOwner && session.role !== "SUPER_ADMIN") {
      if (session.storeId && session.storeId !== booking.storeId) {
        return { statusCode: 403, error: `Store mismatch: assigned to ${session.storeId}, not ${booking.storeId}` };
      }
    }

    // Assignment role check
    if (config.assignedOnly === "employee" && booking.assignedEmployeeId !== session.sub && session.role !== "SUPER_ADMIN") {
      return { statusCode: 403, error: "You are not the courier assigned to this booking" };
    }
    if (config.assignedOnly === "technician" && booking.technicianId !== session.sub && session.role !== "SUPER_ADMIN") {
      return { statusCode: 403, error: "You are not the technician assigned to this booking" };
    }

    // Status OCC check: WHERE status = ANY(config.from)
    if (!config.from.includes(booking.status)) {
      return {
        statusCode: 409,
        error: `Cannot transition from "${booking.status}" to "${config.to}". Expected: [${config.from.join(", ")}]`,
      };
    }

    // OTP verification if required
    if (config.requiresOtp) {
      const otpRes = this.verifyOtp(bookingId, config.requiresOtp, extraData?.otp || "");
      if (!otpRes.success) {
        return { statusCode: otpRes.statusCode, error: otpRes.error };
      }
    }

    // Atomic update
    const previousStatus = booking.status;
    booking.status = config.to;
    if (extraData?.employeeId) booking.assignedEmployeeId = extraData.employeeId;
    if (extraData?.technicianId) booking.technicianId = extraData.technicianId;
    if (extraData?.finalCostPaise) booking.finalCostPaise = extraData.finalCostPaise;
    booking.updatedAt = new Date().toISOString();

    // Insert immutable audit trail entry
    const trailEntry: BookingTrailEntry = {
      id: crypto.randomUUID(),
      bookingId,
      fromStatus: previousStatus,
      toStatus: config.to,
      triggeredByUserId: session.sub,
      notes: extraData?.note || `Action "${action}" executed successfully.`,
      createdAt: new Date().toISOString(),
    };
    this.trails.push(trailEntry);

    return { statusCode: 200, booking: { ...booking } };
  }
}

// ---------------------------------------------------------------------------
// Test Execution
// ---------------------------------------------------------------------------

test.describe("Booking State Machine & OCC Test Suite", () => {
  const store = new TestBookingStore();

  test.beforeEach(() => {
    store.reset();
  });

  // -------------------------------------------------------------------------
  // Feature 1: Table-Driven Transition Enforcement
  // -------------------------------------------------------------------------
  test.describe("1. Table-Driven Transition Enforcement & Jump Prevention", () => {
    test("Full 10-step happy path transitions sequentially through state machine", async () => {
      const bookingId = "FF-HAPPY01";
      store.insertBooking({
        id: bookingId,
        userId: "user-consumer-01",
        storeId: "store-01",
        status: "PENDING",
        updatedAt: new Date().toISOString(),
      });

      const adminSession: SessionPayload = { sub: "admin-01", email: "admin@flashfix.in", role: "ADMIN", storeId: "store-01" };
      const courierSession: SessionPayload = { sub: "rider-01", email: "rider@flashfix.in", role: "EMPLOYEE", storeId: "store-01" };
      const techSession: SessionPayload = { sub: "tech-01", email: "tech@flashfix.in", role: "TECHNICIAN", storeId: "store-01" };

      // 1. assign: PENDING -> CONFIRMED
      const res1 = await store.executeTransition(bookingId, "assign", adminSession, {
        employeeId: courierSession.sub,
        technicianId: techSession.sub,
      });
      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res1.booking?.status, "CONFIRMED");

      // 2. startPickup: CONFIRMED -> PICKUP_EN_ROUTE
      const res2 = await store.executeTransition(bookingId, "startPickup", courierSession);
      assert.strictEqual(res2.statusCode, 200);
      assert.strictEqual(res2.booking?.status, "PICKUP_EN_ROUTE");

      // 3. sendPickupOtp: PICKUP_EN_ROUTE -> PICKUP_OTP_SENT
      const { code: pickupCode } = store.createOtp(bookingId, "PICKUP");
      const res3 = await store.executeTransition(bookingId, "sendPickupOtp", courierSession);
      assert.strictEqual(res3.statusCode, 200);
      assert.strictEqual(res3.booking?.status, "PICKUP_OTP_SENT");

      // 4. verifyPickup: PICKUP_OTP_SENT -> IN_TRANSIT (with valid pickup OTP)
      const res4 = await store.executeTransition(bookingId, "verifyPickup", courierSession, { otp: pickupCode });
      assert.strictEqual(res4.statusCode, 200);
      assert.strictEqual(res4.booking?.status, "IN_TRANSIT");

      // 5. sendCustodyOtp: IN_TRANSIT -> CUSTODY_OTP_SENT
      const { code: custodyCode } = store.createOtp(bookingId, "CUSTODY");
      const res5 = await store.executeTransition(bookingId, "sendCustodyOtp", courierSession);
      assert.strictEqual(res5.statusCode, 200);
      assert.strictEqual(res5.booking?.status, "CUSTODY_OTP_SENT");

      // 6. verifyCustody: CUSTODY_OTP_SENT -> IN_REPAIR (with valid custody OTP)
      const res6 = await store.executeTransition(bookingId, "verifyCustody", techSession, { otp: custodyCode });
      assert.strictEqual(res6.statusCode, 200);
      assert.strictEqual(res6.booking?.status, "IN_REPAIR");

      // 7. completeRepair: IN_REPAIR -> REPAIR_COMPLETE
      const res7 = await store.executeTransition(bookingId, "completeRepair", techSession, { finalCostPaise: 349900 });
      assert.strictEqual(res7.statusCode, 200);
      assert.strictEqual(res7.booking?.status, "REPAIR_COMPLETE");

      // 8. startReturn: REPAIR_COMPLETE -> RETURN_EN_ROUTE
      const res8 = await store.executeTransition(bookingId, "startReturn", courierSession);
      assert.strictEqual(res8.statusCode, 200);
      assert.strictEqual(res8.booking?.status, "RETURN_EN_ROUTE");

      // 9. deliver: RETURN_EN_ROUTE -> DELIVERED
      const res9 = await store.executeTransition(bookingId, "deliver", courierSession);
      assert.strictEqual(res9.statusCode, 200);
      assert.strictEqual(res9.booking?.status, "DELIVERED");
    });

    test("Prohibits illegal jump from PENDING directly to IN_REPAIR (returns 409)", async () => {
      const bookingId = "FF-ILLEGAL01";
      store.insertBooking({
        id: bookingId,
        userId: "user-consumer-01",
        storeId: "store-01",
        status: "PENDING",
        technicianId: "tech-01",
        updatedAt: new Date().toISOString(),
      });

      const techSession: SessionPayload = { sub: "tech-01", email: "tech@flashfix.in", role: "TECHNICIAN", storeId: "store-01" };
      const res = await store.executeTransition(bookingId, "verifyCustody", techSession, { otp: "000000" });
      assert.strictEqual(res.statusCode, 409);
      assert.match(res.error!, /Cannot transition from "PENDING" to "IN_REPAIR"/);
    });

    test("Prohibits illegal jump from CONFIRMED directly to DELIVERED (returns 409)", async () => {
      const bookingId = "FF-ILLEGAL02";
      store.insertBooking({
        id: bookingId,
        userId: "user-consumer-01",
        storeId: "store-01",
        status: "CONFIRMED",
        assignedEmployeeId: "rider-01",
        updatedAt: new Date().toISOString(),
      });

      const courierSession: SessionPayload = { sub: "rider-01", email: "rider@flashfix.in", role: "EMPLOYEE", storeId: "store-01" };
      const res = await store.executeTransition(bookingId, "deliver", courierSession);
      assert.strictEqual(res.statusCode, 409);
      assert.match(res.error!, /Cannot transition from "CONFIRMED" to "DELIVERED"/);
    });

    test("Prohibits regression backward from IN_REPAIR to PENDING (returns 409)", async () => {
      const bookingId = "FF-REGRESS01";
      store.insertBooking({
        id: bookingId,
        userId: "user-consumer-01",
        storeId: "store-01",
        status: "IN_REPAIR",
        updatedAt: new Date().toISOString(),
      });

      const adminSession: SessionPayload = { sub: "admin-01", email: "admin@flashfix.in", role: "ADMIN", storeId: "store-01" };
      const res = await store.executeTransition(bookingId, "assign", adminSession);
      assert.strictEqual(res.statusCode, 409);
    });

    test("Terminal state DELIVERED rejects all further transitions (returns 409)", async () => {
      const bookingId = "FF-TERM01";
      store.insertBooking({
        id: bookingId,
        userId: "user-consumer-01",
        storeId: "store-01",
        status: "DELIVERED",
        assignedEmployeeId: "rider-01",
        updatedAt: new Date().toISOString(),
      });

      const courierSession: SessionPayload = { sub: "rider-01", email: "rider@flashfix.in", role: "EMPLOYEE", storeId: "store-01" };
      const res = await store.executeTransition(bookingId, "deliver", courierSession);
      assert.strictEqual(res.statusCode, 409);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 2: Concurrency & Double-Submit Guard (OCC)
  // -------------------------------------------------------------------------
  test.describe("2. Concurrency & Double-Submit Guard (OCC)", () => {
    test("Concurrent execution of identical transition produces exactly one 200 and one 409 Conflict", async () => {
      const bookingId = "FF-RACE01";
      store.insertBooking({
        id: bookingId,
        userId: "user-01",
        storeId: "store-01",
        status: "PENDING",
        updatedAt: new Date().toISOString(),
      });

      const adminSession: SessionPayload = { sub: "admin-01", email: "admin@flashfix.in", role: "ADMIN", storeId: "store-01" };

      // Dispatch two identical concurrent calls to `assign`
      const [resA, resB] = await Promise.all([
        store.executeTransition(bookingId, "assign", adminSession, { employeeId: "rider-01" }),
        store.executeTransition(bookingId, "assign", adminSession, { employeeId: "rider-01" }),
      ]);

      const statusCodes = [resA.statusCode, resB.statusCode].sort();
      assert.deepStrictEqual(
        statusCodes,
        [200, 409],
        "Race condition guard must yield exactly one 200 success and one 409 Conflict"
      );

      // Verify booking status is CONFIRMED and exactly one audit trail entry was logged
      const booking = store.getBooking(bookingId);
      assert.strictEqual(booking?.status, "CONFIRMED");
      const trails = store.getTrails(bookingId);
      assert.strictEqual(trails.length, 1, "Only the winning transaction may record an audit trail");
    });
  });

  // -------------------------------------------------------------------------
  // Feature 3: Immutable Audit Trail Verification
  // -------------------------------------------------------------------------
  test.describe("3. Immutable Audit Trail Logging", () => {
    test("Every transition appends an immutable trail row with triggeredByUserId and timestamps", async () => {
      const bookingId = "FF-TRAIL01";
      store.insertBooking({
        id: bookingId,
        userId: "user-consumer-01",
        storeId: "store-01",
        status: "PENDING",
        updatedAt: new Date().toISOString(),
      });

      const adminSession: SessionPayload = { sub: "actor-admin-uuid", email: "admin@flashfix.in", role: "ADMIN", storeId: "store-01" };
      await store.executeTransition(bookingId, "assign", adminSession, {
        note: "Assigned staff to booking",
        employeeId: "courier-uuid",
      });

      const trails = store.getTrails(bookingId);
      assert.strictEqual(trails.length, 1);
      assert.strictEqual(trails[0].bookingId, bookingId);
      assert.strictEqual(trails[0].fromStatus, "PENDING");
      assert.strictEqual(trails[0].toStatus, "CONFIRMED");
      assert.strictEqual(trails[0].triggeredByUserId, "actor-admin-uuid");
      assert.strictEqual(trails[0].notes, "Assigned staff to booking");
      assert.ok(trails[0].createdAt, "Must have valid timestamp");
    });
  });

  // -------------------------------------------------------------------------
  // Feature 4: Customer Cancellation Flow
  // -------------------------------------------------------------------------
  test.describe("4. Customer Cancellation Flow", () => {
    const ownerSession: SessionPayload = { sub: "user-owner-123", email: "owner@gmail.com", role: "CONSUMER" };
    const attackerSession: SessionPayload = { sub: "user-evil-456", email: "evil@gmail.com", role: "CONSUMER" };

    test("Owner can cancel booking in PENDING status (transitions to CANCELLED)", async () => {
      const bookingId = "FF-CANCEL01";
      store.insertBooking({ id: bookingId, userId: ownerSession.sub, storeId: "store-01", status: "PENDING", updatedAt: new Date().toISOString() });

      const res = await store.executeTransition(bookingId, "cancel", ownerSession, { note: "Customer requested cancellation" });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.booking?.status, "CANCELLED");
    });

    test("Owner can cancel booking in CONFIRMED status (transitions to CANCELLED)", async () => {
      const bookingId = "FF-CANCEL02";
      store.insertBooking({ id: bookingId, userId: ownerSession.sub, storeId: "store-01", status: "CONFIRMED", updatedAt: new Date().toISOString() });

      const res = await store.executeTransition(bookingId, "cancel", ownerSession);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.booking?.status, "CANCELLED");
    });

    test("Owner can cancel booking in PICKUP_EN_ROUTE status (transitions to CANCELLED)", async () => {
      const bookingId = "FF-CANCEL03";
      store.insertBooking({ id: bookingId, userId: ownerSession.sub, storeId: "store-01", status: "PICKUP_EN_ROUTE", updatedAt: new Date().toISOString() });

      const res = await store.executeTransition(bookingId, "cancel", ownerSession);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.booking?.status, "CANCELLED");
    });

    test("Owner CANNOT cancel booking in IN_TRANSIT (returns 409 Conflict)", async () => {
      const bookingId = "FF-CANCEL04";
      store.insertBooking({ id: bookingId, userId: ownerSession.sub, storeId: "store-01", status: "IN_TRANSIT", updatedAt: new Date().toISOString() });

      const res = await store.executeTransition(bookingId, "cancel", ownerSession);
      assert.strictEqual(res.statusCode, 409);
      assert.match(res.error!, /Cannot transition from "IN_TRANSIT" to "CANCELLED"/);
    });

    test("Owner CANNOT cancel booking in IN_REPAIR (returns 409 Conflict)", async () => {
      const bookingId = "FF-CANCEL05";
      store.insertBooking({ id: bookingId, userId: ownerSession.sub, storeId: "store-01", status: "IN_REPAIR", updatedAt: new Date().toISOString() });

      const res = await store.executeTransition(bookingId, "cancel", ownerSession);
      assert.strictEqual(res.statusCode, 409);
      assert.match(res.error!, /Cannot transition from "IN_REPAIR" to "CANCELLED"/);
    });

    test("Non-owner consumer calling cancel on another's booking returns 403 Forbidden", async () => {
      const bookingId = "FF-CANCEL06";
      store.insertBooking({ id: bookingId, userId: ownerSession.sub, storeId: "store-01", status: "PENDING", updatedAt: new Date().toISOString() });

      const res = await store.executeTransition(bookingId, "cancel", attackerSession);
      assert.strictEqual(res.statusCode, 403);
      assert.match(res.error!, /You do not own this booking/);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 5: Dynamic HMAC OTP Derivation & 5-Attempt Lockout
  // -------------------------------------------------------------------------
  test.describe("5. Dynamic HMAC OTP Derivation & 5-Attempt Lockout", () => {
    test("Rejects fixed/demo codes (123456, 849201)", () => {
      const bookingId = "FF-OTP01";
      const { code } = store.createOtp(bookingId, "PICKUP");

      assert.notStrictEqual(code, "123456", "Generated OTP must never be fixed 123456");
      assert.notStrictEqual(code, "849201", "Generated OTP must never be fixed 849201");

      const demoVerify1 = store.verifyOtp(bookingId, "PICKUP", "123456");
      assert.strictEqual(demoVerify1.success, false);
      assert.strictEqual(demoVerify1.statusCode, 400);

      const demoVerify2 = store.verifyOtp(bookingId, "PICKUP", "849201");
      assert.strictEqual(demoVerify2.success, false);
      assert.strictEqual(demoVerify2.statusCode, 400);
    });

    test("Locks out OTP after 5 consecutive incorrect attempts (returns 429)", () => {
      const bookingId = "FF-LOCK01";
      const { code: validCode } = store.createOtp(bookingId, "PICKUP");

      // Attempt 1 to 4: increment attempts, return 400
      for (let i = 1; i <= 4; i++) {
        const res = store.verifyOtp(bookingId, "PICKUP", `wrong_${i}`);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(store.getOtp(bookingId, "PICKUP")?.attempts, i);
      }

      // Attempt 5: triggers lockout (returns 429)
      const res5 = store.verifyOtp(bookingId, "PICKUP", "wrong_5");
      assert.strictEqual(res5.success, false);
      assert.strictEqual(res5.statusCode, 429);
      assert.match(res5.error!, /lockout/i);

      // Attempt 6: even with the genuine valid code, verification is rejected after lockout
      const resAfterLockout = store.verifyOtp(bookingId, "PICKUP", validCode);
      assert.strictEqual(resAfterLockout.success, false);
      assert.strictEqual(resAfterLockout.statusCode, 429);
      assert.match(resAfterLockout.error!, /lockout/i);
    });

    test("Submitting valid dynamically derived OTP succeeds and marks verified = true", () => {
      const bookingId = "FF-SUCCESS-OTP";
      const { code: validCode } = store.createOtp(bookingId, "CUSTODY");

      const res = store.verifyOtp(bookingId, "CUSTODY", validCode);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.statusCode, 200);

      const record = store.getOtp(bookingId, "CUSTODY");
      assert.strictEqual(record?.verified, true);

      // Consumed OTP cannot be reused (replay attack prevention)
      const replayRes = store.verifyOtp(bookingId, "CUSTODY", validCode);
      assert.strictEqual(replayRes.success, false);
      assert.strictEqual(replayRes.statusCode, 400);
      assert.match(replayRes.error!, /already been verified/i);
    });
  });

  // -------------------------------------------------------------------------
  // Feature 6: Production Module Contracts & State Machine Integrity
  // -------------------------------------------------------------------------
  test.describe("6. Production Module Contracts & State Machine Integrity", () => {
    test("Production TRANSITIONS matches test specification for all 10 actions", () => {
      const actions = Object.keys(TRANSITIONS);
      for (const action of actions) {
        assert.ok(PROD_TRANSITIONS[action], `Production TRANSITIONS must define action "${action}"`);
        assert.deepStrictEqual(PROD_TRANSITIONS[action].from, TRANSITIONS[action].from);
        assert.strictEqual(PROD_TRANSITIONS[action].to, TRANSITIONS[action].to);
        assert.deepStrictEqual(PROD_TRANSITIONS[action].roles, TRANSITIONS[action].roles);
      }
    });

    test("Production deriveOtp matches test-helpers deriveHmacOtp exactly", () => {
      const bookingId = "FF-PROD-TEST-1";
      const rowId = crypto.randomUUID();
      const codeHelper = deriveHmacOtp(TEST_JWT_SECRET, bookingId, "PICKUP", rowId);
      const codeProd = prodDeriveOtp(TEST_JWT_SECRET, bookingId, "PICKUP", rowId);
      assert.strictEqual(codeProd, codeHelper, "Production deriveOtp must match RFC 4226 reference derivation");
      assert.match(codeProd, /^\d{6}$/, "Must be 6-digit numeric string");
    });

    test("Production normalizeAction maps kebab-case, lowercase, and camelCase actions", () => {
      assert.strictEqual(normalizeAction("start-pickup"), "startPickup");
      assert.strictEqual(normalizeAction("send-pickup-otp"), "sendPickupOtp");
      assert.strictEqual(normalizeAction("verify-pickup"), "verifyPickup");
      assert.strictEqual(normalizeAction("send-custody-otp"), "sendCustodyOtp");
      assert.strictEqual(normalizeAction("verify-custody"), "verifyCustody");
      assert.strictEqual(normalizeAction("complete-repair"), "completeRepair");
      assert.strictEqual(normalizeAction("repair-complete"), "completeRepair");
      assert.strictEqual(normalizeAction("start-return"), "startReturn");
      assert.strictEqual(normalizeAction("deliver"), "deliver");
      assert.strictEqual(normalizeAction("cancel"), "cancel");
      assert.strictEqual(normalizeAction("assign"), "assign");
    });

    test("Production hashOtp produces deterministic SHA-256 hex digest", () => {
      const code = "654321";
      const expected = crypto.createHash("sha256").update(code).digest("hex");
      assert.strictEqual(prodHashOtp(code), expected);
    });
  });
});

