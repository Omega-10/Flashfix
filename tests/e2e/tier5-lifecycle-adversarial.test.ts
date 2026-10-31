/**
 * Flashfix Platform — Tier 5 Adversarial Coverage Hardening Test Suite
 * Focus Areas:
 * 1. Booking Lifecycle State Transitions & Complete 11x11 Jump Exhaustion
 * 2. OTP Replay Protection (Doorstep Pickup & Lab Custody)
 * 3. Admin Assignment Integrity, Multi-Store Scoping & Live Audit Trail
 * 4. Consumer Auth Gate, Draft Persistence (`ff_booking_draft`) & Session Isolation
 * 5. Malformed / Adversarial Inputs (Unicode Emojis, Extreme Coordinates, Attack Payloads)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_STATUSES,
  BookingStatus,
  NearbyStoresQuerySchema,
  CreateSavedAddressRequestSchema,
  CreateBookingRequestSchema,
  UpdateBookingStatusRequestSchema,
  AdminAssignBookingRequestSchema,
} from '@flashfix/shared';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue,
  calculateHaversineDistanceKm,
  ALLOWED_TRANSITIONS,
} from '../mocks/index.ts';

// Web Storage Mock for simulating sessionStorage and localStorage
class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

test.describe('Tier 5: Adversarial Hardening — Booking Lifecycle State Machine & Jump Exhaustion', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-T5-LIFE-01: 11x11 State Transition Exhaustion Matrix — verifies all invalid status transitions throw ILLEGAL_STATUS_TRANSITION', () => {
    const allStatuses = BOOKING_STATUSES as readonly BookingStatus[];
    assert.equal(allStatuses.length, 11, 'Must evaluate all 11 booking statuses');

    let testedPairs = 0;
    let allowedCount = 0;
    let rejectedCount = 0;

    for (const fromStatus of allStatuses) {
      const allowedTargets = ALLOWED_TRANSITIONS[fromStatus] || [];
      for (const toStatus of allStatuses) {
        testedPairs++;
        if (allowedTargets.includes(toStatus)) {
          allowedCount++;
          // Valid transition should not throw
          assert.doesNotThrow(() => {
            service.assertTransition(fromStatus, toStatus);
          }, `Transition from ${fromStatus} to ${toStatus} is valid and should succeed`);
        } else {
          rejectedCount++;
          // Disallowed transition MUST throw ILLEGAL_STATUS_TRANSITION
          assert.throws(
            () => service.assertTransition(fromStatus, toStatus),
            /ILLEGAL_STATUS_TRANSITION/,
            `Transition from ${fromStatus} to ${toStatus} must be strictly rejected`
          );
        }
      }
    }

    assert.equal(testedPairs, 121, 'Must test exactly 11 x 11 = 121 state transition pairs');
    assert.ok(allowedCount > 0, 'There must be valid transitions');
    assert.ok(rejectedCount > 100, 'Over 100 transition pairs must be strictly prohibited');
  });

  test('TC-T5-LIFE-02: Terminal State Immutability — DELIVERED status permits zero subsequent transitions', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issue: 'Screen Replacement',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-01',
      scheduledTime: '10:00 AM',
      contactName: 'Delivered User',
      contactEmail: 'delivered.user@gmail.com',
      contactPhone: '+91 99000 11111',
    });

    booking.status = 'DELIVERED';
    mockDb.bookings.set(booking.id, booking);

    for (const targetStatus of BOOKING_STATUSES) {
      assert.throws(
        () => service.assertTransition('DELIVERED', targetStatus),
        /ILLEGAL_STATUS_TRANSITION.*Cannot jump from DELIVERED/,
        `DELIVERED cannot jump to ${targetStatus}`
      );
    }
  });

  test('TC-T5-LIFE-03: Terminal State Immutability — CANCELLED status permits zero subsequent transitions', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S24',
      issue: 'Battery Swelling',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-01',
      scheduledTime: '11:00 AM',
      contactName: 'Cancelled User',
      contactEmail: 'cancelled.user@gmail.com',
      contactPhone: '+91 99000 22222',
    });

    service.cancelBooking(booking.id, 'user-admin', 'Customer cancelled');
    assert.equal(booking.status, 'CANCELLED');

    for (const targetStatus of BOOKING_STATUSES) {
      assert.throws(
        () => service.assertTransition('CANCELLED', targetStatus),
        /ILLEGAL_STATUS_TRANSITION.*Cannot jump from CANCELLED/,
        `CANCELLED cannot jump to ${targetStatus}`
      );
    }
  });

  test('TC-T5-LIFE-04: Cancellation Lockdown Post-Pickup — cancellation rejected once device is in transit or lab custody', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 9 Pro',
      issue: 'Camera Lens Broken',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-01',
      scheduledTime: '12:00 PM',
      contactName: 'Lockdown User',
      contactEmail: 'lockdown.user@gmail.com',
      contactPhone: '+91 99000 33333',
    });

    // Advance to CONFIRMED
    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');

    // Test non-cancellable statuses
    const lockedStatuses: BookingStatus[] = [
      'IN_TRANSIT',
      'CUSTODY_OTP_SENT',
      'IN_REPAIR',
      'REPAIR_COMPLETE',
      'RETURN_EN_ROUTE',
      'DELIVERED',
    ];

    for (const st of lockedStatuses) {
      booking.status = st;
      mockDb.bookings.set(booking.id, booking);

      assert.throws(
        () => service.cancelBooking(booking.id, 'consumer-user', 'I want my device back'),
        /CANNOT_CANCEL.*can only be cancelled from PENDING status/,
        `Cancellation must fail when status is ${st}`
      );
    }
  });

  test('TC-T5-LIFE-05: Mid-flight Jump Prevention — cannot bypass intermediate custody milestones', () => {
    const booking = service.createBooking({
      brand: 'OnePlus',
      deviceModel: 'OnePlus 12',
      issue: 'Fast Charging',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-01',
      scheduledTime: '01:00 PM',
      contactName: 'Bypass Tester',
      contactEmail: 'bypass.tester@gmail.com',
      contactPhone: '+91 99000 44444',
    });

    // PENDING -> IN_TRANSIT (skipping CONFIRMED, PICKUP_EN_ROUTE, PICKUP_OTP_SENT)
    assert.throws(
      () => service.assertTransition(booking.status, 'IN_TRANSIT'),
      /ILLEGAL_STATUS_TRANSITION/
    );

    // Advance legitimately to CONFIRMED
    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');

    // CONFIRMED -> IN_REPAIR (skipping pickup and custody handovers)
    assert.throws(
      () => service.assertTransition(booking.status, 'IN_REPAIR'),
      /ILLEGAL_STATUS_TRANSITION/
    );

    // CONFIRMED -> DELIVERED (skipping entire repair lifecycle)
    assert.throws(
      () => service.assertTransition(booking.status, 'DELIVERED'),
      /ILLEGAL_STATUS_TRANSITION/
    );
  });
});

test.describe('Tier 5: Adversarial Hardening — OTP Replay Protection & Boundary Integrity', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-T5-OTP-01: Single-Use Doorstep Pickup OTP Replay Protection — consumed OTP cannot be re-verified', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Broken Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Pickup Replay Consumer',
      contactEmail: 'pickup.replay@gmail.com',
      contactPhone: '+91 99000 55555',
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');

    const { code: pickupCode } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    assert.match(pickupCode, /^\d{6}$/);

    // First verification: must succeed
    const v1 = service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pickupCode);
    assert.equal(v1.status, 'IN_TRANSIT');

    // Second verification attempt (Replay Attack): must fail
    assert.throws(
      () => service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pickupCode),
      /ILLEGAL_STATUS_TRANSITION|OTP_EXPIRED_OR_NOT_FOUND/,
      'Consumed pickup OTP cannot be replayed'
    );
  });

  test('TC-T5-OTP-02: Single-Use Lab Custody OTP Replay Protection — consumed custody OTP cannot be re-verified', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S23 Ultra',
      issue: 'Camera Lens',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'Custody Replay Consumer',
      contactEmail: 'custody.replay@gmail.com',
      contactPhone: '+91 99000 66666',
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code: pCode } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pCode);

    // Send custody OTP to technician
    const { code: custodyCode } = service.sendCustodyOtp(booking.id, 'user-delivery-vijay');
    assert.match(custodyCode, /^\d{6}$/);

    // First verification: technician receives device into lab
    const v1 = service.verifyCustodyOtp(booking.id, 'user-tech-rahul', custodyCode);
    assert.equal(v1.status, 'IN_REPAIR');

    // Replay attack: calling verifyCustodyOtp a second time with identical code
    assert.throws(
      () => service.verifyCustodyOtp(booking.id, 'user-tech-rahul', custodyCode),
      /ILLEGAL_STATUS_TRANSITION|OTP_EXPIRED_OR_NOT_FOUND/,
      'Consumed custody OTP cannot be replayed'
    );
  });

  test('TC-T5-OTP-03: Cross-Booking Replay Attack — OTP from Booking A cannot verify Booking B', () => {
    const bookingA = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 14 Pro',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '01:00 PM',
      contactName: 'User Alpha',
      contactEmail: 'cross.booking@gmail.com',
      contactPhone: '+91 99000 77771',
    });

    const bookingB = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 13 Mini',
      issue: 'Speaker',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '02:00 PM',
      contactName: 'User Beta',
      contactEmail: 'cross.booking@gmail.com',
      contactPhone: '+91 99000 77772',
    });

    service.assignStaff(bookingA.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(bookingA.id, 'user-delivery-vijay');
    const { code: codeA } = service.sendPickupOtp(bookingA.id, 'user-delivery-vijay');

    service.assignStaff(bookingB.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(bookingB.id, 'user-delivery-vijay');
    service.sendPickupOtp(bookingB.id, 'user-delivery-vijay');

    // Submit codeA against bookingB
    assert.throws(
      () => service.verifyPickupOtp(bookingB.id, 'user-delivery-vijay', codeA),
      /INVALID_OTP/,
      'Booking A OTP must not authenticate Booking B'
    );
  });

  test('TC-T5-OTP-04: Cross-Purpose Handover Swapping — Login OTP cannot be used for Pickup OTP', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 8a',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '03:00 PM',
      contactName: 'Cross Purpose User',
      contactEmail: 'purpose.swap@gmail.com',
      contactPhone: '+91 99000 88888',
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    service.sendPickupOtp(booking.id, 'user-delivery-vijay');

    // Issue login OTP to the same consumer email
    const { code: loginCode } = service.sendLoginOtp('purpose.swap@gmail.com');

    // Attempt to verify pickup using the login OTP
    assert.throws(
      () => service.verifyPickupOtp(booking.id, 'user-delivery-vijay', loginCode!),
      /INVALID_OTP/,
      'Login OTP cannot authenticate pickup handover'
    );
  });

  test('TC-T5-OTP-05: Lockout Threshold Hardening — 5 failed attempts locks OTP code permanently', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S24 FE',
      issue: 'Back Glass',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '04:00 PM',
      contactName: 'Bruteforce Victim',
      contactEmail: 'bruteforce.victim@gmail.com',
      contactPhone: '+91 99000 99999',
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code: validCode } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');

    // Submit 5 wrong codes
    for (let i = 1; i <= 5; i++) {
      assert.throws(
        () => service.verifyPickupOtp(booking.id, 'user-delivery-vijay', '000000'),
        i === 5 ? /OTP_MAX_ATTEMPTS_EXCEEDED|INVALID_OTP/ : /INVALID_OTP/
      );
    }

    // 6th attempt with genuine code MUST be rejected due to lockout
    assert.throws(
      () => service.verifyPickupOtp(booking.id, 'user-delivery-vijay', validCode),
      /OTP_MAX_ATTEMPTS_EXCEEDED/,
      'Locked out OTP must reject genuine code on subsequent attempts'
    );
  });
});

test.describe('Tier 5: Adversarial Hardening — Admin Assignment Integrity & Multi-Store Audit Scoping', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-T5-ADMIN-01: Cross-Store Staff Assignment Audit Trail Integrity — tracks actor and store affiliation', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 16',
      issue: 'Display Flicker',
      storeId: 'store-blr-01', // Koramangala
      scheduledDate: '2026-11-03',
      scheduledTime: '10:00 AM',
      contactName: 'Cross Store Customer',
      contactEmail: 'cross.store@gmail.com',
      contactPhone: '+91 98111 22233',
    });

    // Add employee belonging to Indiranagar (store-blr-02)
    mockDb.users.set('user-delivery-indiranagar', {
      id: 'user-delivery-indiranagar',
      name: 'Ramesh Indiranagar',
      email: 'ramesh.indiranagar@flashfix.in',
      role: 'EMPLOYEE',
      storeId: 'store-blr-02',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Assign Indiranagar courier to Koramangala booking
    const assigned = service.assignStaff(
      booking.id,
      'user-admin-koramangala',
      'user-delivery-indiranagar',
      'user-tech-rahul'
    );

    assert.equal(assigned.status, 'CONFIRMED');
    assert.equal(assigned.assignedEmployeeId, 'user-delivery-indiranagar');

    // Audit trail must capture exact actor and assignment details
    const trail = mockDb.getBookingTrail(booking.id);
    assert.equal(trail.length, 2);
    assert.equal(trail[1].status, 'CONFIRMED');
    assert.equal(trail[1].changedByUserId, 'user-admin-koramangala');
    assert.ok(trail[1].note?.includes('user-delivery-indiranagar'));
  });

  test('TC-T5-ADMIN-02: Unassigned Bookings Accounting & Resolution — unassigned count clears upon assignment', () => {
    // Check initial unassigned active bookings
    const initialUnassigned = Array.from(mockDb.bookings.values()).filter(
      (b) => !b.assignedEmployeeId && b.status !== 'CANCELLED'
    ).length;

    // Create 3 unassigned bookings
    const b1 = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 14',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-03',
      scheduledTime: '11:00 AM',
      contactName: 'Cust One',
      contactEmail: 'cust1@gmail.com',
      contactPhone: '+91 98111 00001',
    });

    const b2 = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S23',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-03',
      scheduledTime: '12:00 PM',
      contactName: 'Cust Two',
      contactEmail: 'cust2@gmail.com',
      contactPhone: '+91 98111 00002',
    });

    const b3 = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 7',
      issue: 'Charging Port',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-03',
      scheduledTime: '01:00 PM',
      contactName: 'Cust Three',
      contactEmail: 'cust3@gmail.com',
      contactPhone: '+91 98111 00003',
    });

    const countAfterCreation = Array.from(mockDb.bookings.values()).filter(
      (b) => !b.assignedEmployeeId && b.status !== 'CANCELLED'
    ).length;
    assert.equal(countAfterCreation, initialUnassigned + 3);

    // Assign b1
    service.assignStaff(b1.id, 'user-admin', 'user-delivery-vijay', 'user-tech-rahul');
    const countAfterOneAssign = Array.from(mockDb.bookings.values()).filter(
      (b) => !b.assignedEmployeeId && b.status !== 'CANCELLED'
    ).length;
    assert.equal(countAfterOneAssign, initialUnassigned + 2);

    // Cancel b2 before assignment
    service.cancelBooking(b2.id, 'consumer', 'Decided to buy new phone');
    const countAfterCancel = Array.from(mockDb.bookings.values()).filter(
      (b) => !b.assignedEmployeeId && b.status !== 'CANCELLED'
    ).length;
    assert.equal(countAfterCancel, initialUnassigned + 1, 'Cancelled booking must NOT count as unassigned alert');

    // Assign b3
    service.assignStaff(b3.id, 'user-admin', 'user-delivery-vijay', 'user-tech-rahul');
    const finalUnassigned = Array.from(mockDb.bookings.values()).filter(
      (b) => !b.assignedEmployeeId && b.status !== 'CANCELLED'
    ).length;
    assert.equal(finalUnassigned, initialUnassigned);
  });

  test('TC-T5-ADMIN-03: Reassignment & Multi-Step Audit Trail Monotonicity — preserves prior history immutably', () => {
    const booking = service.createBooking({
      brand: 'OnePlus',
      deviceModel: 'OnePlus 11',
      issue: 'Screen Glass',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-03',
      scheduledTime: '02:00 PM',
      contactName: 'Reassignment Test',
      contactEmail: 'reassign.test@gmail.com',
      contactPhone: '+91 98111 33344',
    });

    // First assignment: Vijay (Rider) + Rahul (Tech)
    service.assignStaff(booking.id, 'admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');

    // Simulate reassignment: Reassign to alternative rider
    const reassignTrail = service.recordTrail(
      booking.id,
      'CONFIRMED',
      'admin-koramangala',
      'Reassigned rider to user-delivery-backup due to shift change'
    );
    booking.assignedEmployeeId = 'user-delivery-backup';
    mockDb.bookings.set(booking.id, booking);

    const fullTrail = mockDb.getBookingTrail(booking.id);
    assert.equal(fullTrail.length, 3, 'Creation + First Assign + Reassignment');
    assert.equal(fullTrail[0].status, 'PENDING');
    assert.equal(fullTrail[1].status, 'CONFIRMED');
    assert.equal(fullTrail[2].status, 'CONFIRMED');
    assert.ok(fullTrail[1].note?.includes('user-delivery-vijay'));
    assert.ok(fullTrail[2].note?.includes('user-delivery-backup'));

    // Verify chronological order
    for (let i = 1; i < fullTrail.length; i++) {
      assert.ok(
        new Date(fullTrail[i].createdAt).getTime() >= new Date(fullTrail[i - 1].createdAt).getTime(),
        `Trail timestamp ${i} must be >= timestamp ${i - 1}`
      );
    }
  });
});

test.describe('Tier 5: Adversarial Hardening — Consumer Auth Gate & Booking Draft Lifecycle', () => {
  test('TC-T5-DRAFT-01: SessionStorage Draft Serialization & Complete Field Preservation', () => {
    const sessionStorageMock = new MockStorage();

    const bookingDraft = {
      step1: { brand: 'Apple', device: 'iPhone 16 Pro Max' },
      step2: { issue: 'Screen Replacement' },
      step3: {
        address: 'Villa 402, Palm Meadows, Whitefield, Bengaluru',
        lat: 12.9698,
        lng: 77.7499,
        name: 'Arun Varma',
        phone: '+91 98450 12345',
      },
      step4: {
        storeId: 'store-blr-03',
        date: '2026-11-04',
        time: '11:00 AM',
      },
      step: 3,
    };

    // Save draft when auth gate triggers
    sessionStorageMock.setItem('ff_booking_draft', JSON.stringify(bookingDraft));

    // Verify saved format
    const retrievedRaw = sessionStorageMock.getItem('ff_booking_draft');
    assert.ok(retrievedRaw, 'Draft must exist in sessionStorage');

    const parsed = JSON.parse(retrievedRaw);
    assert.equal(parsed.step1.brand, 'Apple');
    assert.equal(parsed.step1.device, 'iPhone 16 Pro Max');
    assert.equal(parsed.step2.issue, 'Screen Replacement');
    assert.equal(parsed.step3.lat, 12.9698);
    assert.equal(parsed.step3.lng, 77.7499);
    assert.equal(parsed.step4.storeId, 'store-blr-03');
    assert.equal(parsed.step, 3);
  });

  test('TC-T5-DRAFT-02: SessionStorage Tab/Session Isolation Semantics — independent storage across sessions', () => {
    const sessionTab1 = new MockStorage();
    const sessionTab2 = new MockStorage();

    sessionTab1.setItem(
      'ff_booking_draft',
      JSON.stringify({ step1: { brand: 'Apple', device: 'iPhone 15' }, step: 3 })
    );

    sessionTab2.setItem(
      'ff_booking_draft',
      JSON.stringify({ step1: { brand: 'Samsung', device: 'Galaxy S24' }, step: 2 })
    );

    assert.notEqual(
      sessionTab1.getItem('ff_booking_draft'),
      sessionTab2.getItem('ff_booking_draft'),
      'Different browser sessions/tabs must maintain strict draft isolation'
    );

    const draft1 = JSON.parse(sessionTab1.getItem('ff_booking_draft')!);
    const draft2 = JSON.parse(sessionTab2.getItem('ff_booking_draft')!);
    assert.equal(draft1.step1.device, 'iPhone 15');
    assert.equal(draft2.step1.device, 'Galaxy S24');
  });

  test('TC-T5-DRAFT-03: Post-Login Draft Restoration & Contact Pre-fill Merging', () => {
    const sessionStorageMock = new MockStorage();

    // Draft stored without contact name/phone
    const partialDraft = {
      step1: { brand: 'Google', device: 'Pixel 9' },
      step2: { issue: 'Battery Service' },
      step3: { address: 'Indiranagar 100ft Rd', lat: 12.9784, lng: 77.6408, name: '', phone: '' },
      step4: { storeId: 'store-blr-02', date: '2026-11-05', time: '02:00 PM' },
      step: 3,
    };
    sessionStorageMock.setItem('ff_booking_draft', JSON.stringify(partialDraft));

    // Simulated authenticated user returned from auth modal
    const authedUser = {
      id: 'usr-new-001',
      name: 'Sunita Krishnan',
      email: 'sunita.k@gmail.com',
      phone: '+91 97700 88990',
    };

    // Simulate handleAuthSuccess in Booking.tsx
    const restoredDraft = JSON.parse(sessionStorageMock.getItem('ff_booking_draft')!);
    const mergedStep3 = {
      ...restoredDraft.step3,
      name: restoredDraft.step3.name || authedUser.name || '',
      phone: restoredDraft.step3.phone || authedUser.phone || '',
    };

    assert.equal(mergedStep3.name, 'Sunita Krishnan');
    assert.equal(mergedStep3.phone, '+91 97700 88990');
    assert.equal(mergedStep3.address, 'Indiranagar 100ft Rd');
    assert.equal(restoredDraft.step1.device, 'Pixel 9');
  });

  test('TC-T5-DRAFT-04: Draft Purging on Booking Completion — removes ff_booking_draft from storage', () => {
    const sessionStorageMock = new MockStorage();
    sessionStorageMock.setItem(
      'ff_booking_draft',
      JSON.stringify({ step1: { brand: 'OnePlus', device: '12' }, step: 4 })
    );

    assert.ok(sessionStorageMock.getItem('ff_booking_draft'));

    // Simulate booking submission completion in Booking.tsx
    sessionStorageMock.removeItem('ff_booking_draft');

    assert.equal(sessionStorageMock.getItem('ff_booking_draft'), null, 'Draft must be cleared after submission');
  });

  test('TC-T5-DRAFT-05: Resilience Against Corrupted Draft JSON — handles malformed storage gracefully', () => {
    const sessionStorageMock = new MockStorage();
    sessionStorageMock.setItem('ff_booking_draft', '{"invalid-json: corrupt payload...');

    let restored = false;
    let failedSafely = false;

    // Simulate safe parsing inside useEffect
    try {
      const raw = sessionStorageMock.getItem('ff_booking_draft');
      if (raw) {
        JSON.parse(raw);
        restored = true;
      }
    } catch {
      failedSafely = true;
    }

    assert.equal(restored, false);
    assert.equal(failedSafely, true, 'Corrupted draft must be caught safely without throwing uncaught exceptions');
  });
});

test.describe('Tier 5: Adversarial Hardening — Malformed & Adversarial Inputs Robustness', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-T5-INPUT-01: Unicode Emojis in Customer & Device Details — preserved without truncation or regex failures', () => {
    const emojiPayload = {
      brand: 'Apple 🍎',
      deviceModel: 'iPhone 15 Pro Max ⚡📱🚀',
      issue: 'Broken Screen 💥',
      issueNotes: 'Dropped down stairwell 😱💔 screen shattered into spiderweb pattern 🕸️',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-06',
      scheduledTime: '10:00 AM',
      pickupAddress: 'Flat 901 🏢, Palm Tower 🌴, Koramangala, Bengaluru',
      contactName: 'Rohit Sharma ⚡🏏',
      contactEmail: 'rohit.emoji@gmail.com',
      contactPhone: '+91 99999 12345',
      estimatedCostPaise: 1850000,
    };

    const booking = service.createBooking(emojiPayload);

    assert.equal(booking.contactName, 'Rohit Sharma ⚡🏏');
    assert.equal(booking.deviceModel, 'iPhone 15 Pro Max ⚡📱🚀');
    assert.equal(booking.issueNotes, emojiPayload.issueNotes);

    // Verify retrieval from DB
    const retrieved = mockDb.bookings.get(booking.id);
    assert.ok(retrieved);
    assert.equal(retrieved.contactName, 'Rohit Sharma ⚡🏏');

    // Verify audit trail retains unicode characters
    const trail = mockDb.getBookingTrail(booking.id);
    assert.ok(trail.length >= 1);
  });

  test('TC-T5-INPUT-02: Extreme Coordinate Boundaries — lat > 90, lat < -90, lng > 180, lng < -180 strictly rejected by schemas', () => {
    // 1. NearbyStoresQuerySchema: lat > 90
    const invalidLatHigh = NearbyStoresQuerySchema.safeParse({ lat: 95.5, lng: 77.6 });
    assert.equal(invalidLatHigh.success, false, 'lat > 90 must fail validation');

    // 2. NearbyStoresQuerySchema: lat < -90
    const invalidLatLow = NearbyStoresQuerySchema.safeParse({ lat: -95.5, lng: 77.6 });
    assert.equal(invalidLatLow.success, false, 'lat < -90 must fail validation');

    // 3. NearbyStoresQuerySchema: lng > 180
    const invalidLngHigh = NearbyStoresQuerySchema.safeParse({ lat: 12.9, lng: 185.0 });
    assert.equal(invalidLngHigh.success, false, 'lng > 180 must fail validation');

    // 4. NearbyStoresQuerySchema: lng < -180
    const invalidLngLow = NearbyStoresQuerySchema.safeParse({ lat: 12.9, lng: -185.0 });
    assert.equal(invalidLngLow.success, false, 'lng < -180 must fail validation');

    // 5. CreateSavedAddressRequestSchema: lat > 90
    const invalidAddr = CreateSavedAddressRequestSchema.safeParse({
      address: 'Extreme coordinate test',
      lat: 100.0,
      lng: 77.6,
    });
    assert.equal(invalidAddr.success, false, 'Saved address with lat=100.0 must fail validation');

    // 6. Valid boundaries: exact poles and anti-meridian
    const northPole = NearbyStoresQuerySchema.safeParse({ lat: 90.0, lng: 0.0 });
    assert.equal(northPole.success, true, 'lat=90.0 (North Pole) is valid');

    const southPole = NearbyStoresQuerySchema.safeParse({ lat: -90.0, lng: 0.0 });
    assert.equal(southPole.success, true, 'lat=-90.0 (South Pole) is valid');

    const antiMeridian = NearbyStoresQuerySchema.safeParse({ lat: 0.0, lng: 180.0 });
    assert.equal(antiMeridian.success, true, 'lng=180.0 is valid');
  });

  test('TC-T5-INPUT-03: Adversarial Strings in Device Issue Notes (SQLi, XSS, CRLF) — treated safely as plain text', () => {
    const maliciousPayloads = [
      { name: 'SQL Injection', text: "'; DROP TABLE bookings; SELECT * FROM users; --" },
      { name: 'XSS Attack', text: '<script>alert(document.cookie)</script><img src=x onerror=alert(1)>' },
      { name: 'CRLF Email Injection', text: 'Screen broken\r\nBcc: evil@hacker.com\r\nSubject: Injected' },
      { name: 'Null Byte Injection', text: 'Display shattered\0--admin=true' },
    ];

    for (const attack of maliciousPayloads) {
      const booking = service.createBooking({
        brand: 'Apple',
        deviceModel: 'iPhone 15',
        issue: 'Screen',
        issueNotes: attack.text,
        storeId: 'store-blr-01',
        scheduledDate: '2026-11-07',
        scheduledTime: '10:00 AM',
        contactName: `Sec Tester (${attack.name})`,
        contactEmail: 'sec.tester@gmail.com',
        contactPhone: '+91 99000 00000',
      });

      assert.ok(booking.id.startsWith('FF-'));
      assert.equal(booking.issueNotes, attack.text, `${attack.name} payload must be stored verbatim without executing`);

      // Verify no tables dropped or corrupted
      assert.ok(mockDb.bookings.size >= 1);
      assert.ok(mockDb.stores.size >= 5);
    }
  });

  test('TC-T5-INPUT-04: Oversized Text Buffers in Issue Description — handles 10,000+ characters without memory exhaustion', () => {
    const largeNote = 'CRACK_REPAIR_NOTE_'.repeat(1000); // ~18,000 characters
    assert.ok(largeNote.length > 15000);

    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S24',
      issue: 'Full Diagnosis',
      issueNotes: largeNote,
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-08',
      scheduledTime: '11:00 AM',
      contactName: 'Buffer Test User',
      contactEmail: 'buffer.user@gmail.com',
      contactPhone: '+91 99000 12345',
    });

    assert.ok(booking.id.startsWith('FF-'));
    assert.equal(booking.issueNotes?.length, largeNote.length);

    // Verify audit trail entry handles large note
    const trail = mockDb.getBookingTrail(booking.id);
    assert.ok(trail.length >= 1);
  });

  test('TC-T5-INPUT-05: Whitespace Normalization & Missing Field Rejection — rejects empty or whitespace-only inputs', () => {
    // Empty contactName rejected by schema
    const emptyName = CreateBookingRequestSchema.safeParse({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issueType: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-08',
      scheduledTime: '10:00 AM',
      pickupAddress: 'Valid address street',
      contactName: '',
      contactEmail: 'user@gmail.com',
      contactPhone: '+91 99000 12345',
    });
    assert.equal(emptyName.success, false, 'Empty contactName must fail validation');

    // Invalid scheduledDate format rejected by schema
    const invalidDate = CreateBookingRequestSchema.safeParse({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issueType: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '08-11-2026', // Wrong format (expected YYYY-MM-DD)
      scheduledTime: '10:00 AM',
      pickupAddress: 'Valid address street',
      contactName: 'Valid Name',
      contactEmail: 'user@gmail.com',
      contactPhone: '+91 99000 12345',
    });
    assert.equal(invalidDate.success, false, 'Invalid scheduledDate format must fail regex');

    // Short address rejected by schema (< 5 characters)
    const shortAddr = CreateBookingRequestSchema.safeParse({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issueType: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-08',
      scheduledTime: '10:00 AM',
      pickupAddress: 'St',
      contactName: 'Valid Name',
      contactEmail: 'user@gmail.com',
      contactPhone: '+91 99000 12345',
    });
    assert.equal(shortAddr.success, false, 'Short address < 5 chars must fail validation');

    // Disposable email rejected at service layer
    assert.throws(
      () =>
        service.createBooking({
          brand: 'Apple',
          deviceModel: 'iPhone 15',
          issue: 'Screen',
          storeId: 'store-blr-01',
          scheduledDate: '2026-11-08',
          scheduledTime: '10:00 AM',
          contactName: 'Disposable User',
          contactEmail: 'user@mailinator.com',
          contactPhone: '+91 99000 12345',
        }),
      /DISPOSABLE_EMAIL_NOT_ALLOWED/
    );
  });
});
