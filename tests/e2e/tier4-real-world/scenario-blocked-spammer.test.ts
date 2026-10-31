import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue
} from '../../mocks/index.ts';

test.describe('Tier 4: Real-World Scenarios - Untrusted Spammer vs Genuine Consumer', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-SCENARIO-03: Spammer using temporary burner emails is blocked; genuine consumer succeeds', () => {
    const maliciousBurners = [
      'bot.army1@mailinator.com',
      'spammer99@temp-mail.org',
      'fraudster@sharklasers.com',
      'fake.customer@10minutemail.com',
      'burner@yopmail.com'
    ];

    // 1. Spammer tries sendLoginOtp with disposable domains -> All blocked
    for (const email of maliciousBurners) {
      assert.throws(
        () => service.sendLoginOtp(email),
        /DISPOSABLE_EMAIL_NOT_ALLOWED/
      );
    }

    // Confirm no OTPs stored in DB for spammers
    for (const email of maliciousBurners) {
      const stored = mockDb.findActiveOtp(email, 'LOGIN');
      assert.equal(stored, undefined);
    }

    // Confirm no notifications dispatched to spammers
    assert.equal(mockNotificationQueue.getAll().length, 0);

    // 2. Spammer attempts direct booking creation with disposable email -> Blocked
    assert.throws(
      () =>
        service.createBooking({
          brand: 'Apple',
          deviceModel: 'iPhone 16 Pro',
          issue: 'Screen',
          storeId: 'store-blr-01',
          scheduledDate: '2026-11-02',
          scheduledTime: '10:00 AM',
          contactName: 'Spam Bot',
          contactEmail: 'bot.army1@mailinator.com',
          contactPhone: '+91 99999 99999'
        }),
      /DISPOSABLE_EMAIL_NOT_ALLOWED/
    );

    // 3. Genuine consumer arrives with verified Gmail
    const genuineEmail = 'doctor.radhika@gmail.com';
    const otpRes = service.sendLoginOtp(genuineEmail);
    assert.equal(otpRes.success, true);
    assert.ok(otpRes.code);

    // Notification queue contains only genuine user email
    const genuineNotifs = mockNotificationQueue.getByRecipient(genuineEmail);
    assert.equal(genuineNotifs.length, 1);
    assert.equal(genuineNotifs[0].templateType, 'otp-login');

    const auth = service.verifyLoginOtp(genuineEmail, otpRes.code);
    assert.equal(auth.success, true);

    const booking = service.createBooking({
      userId: auth.user.id,
      brand: 'Google',
      deviceModel: 'Pixel 9 Pro XL',
      issue: 'Camera Repair',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'Dr. Radhika',
      contactEmail: genuineEmail,
      contactPhone: '+91 98800 77665',
      estimatedCostPaise: 550000
    });

    assert.equal(booking.status, 'PENDING');
    assert.equal(mockDb.bookings.size, 1);
    assert.equal(mockDb.bookings.get(booking.id)?.contactEmail, genuineEmail);
  });
});
