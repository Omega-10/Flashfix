import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService
} from '../../mocks/index.ts';

test.describe('Tier 2: Boundary & Corner Cases - OTP Security & Limits', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    service = new DomainLogicService(mockDb);
  });

  test('TC-BOUND-OTP-01: Rejects expired OTP (>10 minutes past expiration)', () => {
    const email = 'user.expired@gmail.com';
    service.sendLoginOtp(email);

    const otpInDb = mockDb.findActiveOtp(email, 'LOGIN')!;
    assert.ok(otpInDb);

    // Fast-forward expiration to 11 minutes in past
    otpInDb.expiresAt = new Date(Date.now() - 11 * 60 * 1000);

    assert.throws(
      () => service.verifyLoginOtp(email, otpInDb.code),
      /OTP_EXPIRED_OR_NOT_FOUND/
    );
  });

  test('TC-BOUND-OTP-02: Locks out OTP after 5 consecutive incorrect attempts', () => {
    const email = 'user.bruteforce@gmail.com';
    service.sendLoginOtp(email);

    const otpInDb = mockDb.findActiveOtp(email, 'LOGIN')!;
    assert.ok(otpInDb);

    // 5 failed attempts
    for (let i = 1; i <= 5; i++) {
      assert.throws(
        () => service.verifyLoginOtp(email, '000000'),
        i === 5 ? /OTP_MAX_ATTEMPTS_EXCEEDED|INVALID_OTP/ : /INVALID_OTP/
      );
    }

    assert.equal(otpInDb.attempts, 5);

    // 6th attempt even with correct code must now be blocked
    assert.throws(
      () => service.verifyLoginOtp(email, otpInDb.code),
      /OTP_MAX_ATTEMPTS_EXCEEDED/
    );
  });

  test('TC-BOUND-OTP-03: Prevents replay attack by rejecting already-used OTP code', () => {
    const email = 'user.replay@gmail.com';
    const { code } = service.sendLoginOtp(email);
    assert.ok(code);

    // First use: successful
    const res1 = service.verifyLoginOtp(email, code);
    assert.equal(res1.success, true);

    // Second use: must fail
    assert.throws(
      () => service.verifyLoginOtp(email, code),
      /OTP_EXPIRED_OR_NOT_FOUND/
    );
  });

  test('TC-BOUND-OTP-04: Rejects cross-purpose OTP attack (cannot use LOGIN OTP for PICKUP)', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Cross Purpose',
      contactEmail: 'cross@gmail.com',
      contactPhone: '+91 99999 11111'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    service.sendPickupOtp(booking.id, 'user-delivery-vijay');

    // Generate separate login OTP for same email
    const loginRes = service.sendLoginOtp('cross@gmail.com');
    assert.ok(loginRes.code);

    // Attempt to verify pickup using LOGIN OTP
    assert.throws(
      () => service.verifyPickupOtp(booking.id, 'user-delivery-vijay', loginRes.code!),
      /INVALID_OTP/
    );
  });

  test('TC-BOUND-OTP-05: Rejects cross-booking OTP attack (cannot use OTP from Booking A on Booking B)', () => {
    const bookingA = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'User A',
      contactEmail: 'sameuser@gmail.com',
      contactPhone: '+91 99999 11111'
    });

    const bookingB = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S24',
      issue: 'Camera',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'User B',
      contactEmail: 'sameuser@gmail.com',
      contactPhone: '+91 99999 11111'
    });

    service.assignStaff(bookingA.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(bookingA.id, 'user-delivery-vijay');
    const { code: codeA } = service.sendPickupOtp(bookingA.id, 'user-delivery-vijay');

    service.assignStaff(bookingB.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(bookingB.id, 'user-delivery-vijay');
    service.sendPickupOtp(bookingB.id, 'user-delivery-vijay');

    // Try applying codeA to bookingB
    assert.throws(
      () => service.verifyPickupOtp(bookingB.id, 'user-delivery-vijay', codeA),
      /INVALID_OTP/
    );
  });
});
