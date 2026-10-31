import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  isDisposableEmail,
  DISPOSABLE_DOMAINS
} from '../../mocks/index.ts';

test.describe('Tier 1: Feature Coverage - Disposable Email Deny-List & Guard', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    service = new DomainLogicService(mockDb);
  });

  test('TC-DISP-01: Contains at least 200 distinct disposable domains in the deny-list', () => {
    assert.ok(
      DISPOSABLE_DOMAINS.size >= 200,
      `Expected >= 200 disposable domains, found ${DISPOSABLE_DOMAINS.size}`
    );
  });

  test('TC-DISP-02: Rejects send-otp for mailinator.com and throws DISPOSABLE_EMAIL_NOT_ALLOWED', () => {
    const email = 'spammer@mailinator.com';
    assert.equal(isDisposableEmail(email), true);

    assert.throws(
      () => service.sendLoginOtp(email),
      /DISPOSABLE_EMAIL_NOT_ALLOWED/
    );
  });

  test('TC-DISP-03: Rejects send-otp for 10minutemail.com and 10minutemail.net', () => {
    for (const domain of ['10minutemail.com', '10minutemail.net', '10minutemail.org']) {
      const email = `testuser@${domain}`;
      assert.equal(isDisposableEmail(email), true);
      assert.throws(
        () => service.sendLoginOtp(email),
        /DISPOSABLE_EMAIL_NOT_ALLOWED/
      );
    }
  });

  test('TC-DISP-04: Rejects send-otp for guerrillamail family (guerrillamail.com, sharklasers.com)', () => {
    const badEmails = [
      'temp1@guerrillamail.com',
      'temp2@guerrillamail.biz',
      'temp3@sharklasers.com',
      'temp4@guerrillamailblock.com'
    ];

    for (const email of badEmails) {
      assert.equal(isDisposableEmail(email), true);
      assert.throws(
        () => service.sendLoginOtp(email),
        /DISPOSABLE_EMAIL_NOT_ALLOWED/
      );
    }
  });

  test('TC-DISP-05: Rejects send-otp for yopmail.com and temp-mail.org', () => {
    const badEmails = [
      'throwaway@yopmail.com',
      'burner@temp-mail.org',
      'test@tempmail.com',
      'user@trashmail.com'
    ];

    for (const email of badEmails) {
      assert.equal(isDisposableEmail(email), true);
      assert.throws(
        () => service.sendLoginOtp(email),
        /DISPOSABLE_EMAIL_NOT_ALLOWED/
      );
    }
  });

  test('TC-DISP-06: Allows legitimate consumer email providers through cleanly', () => {
    const validEmails = [
      'arjun.kapoor@gmail.com',
      'sneha.n@yahoo.co.in',
      'kiran.v@outlook.com',
      'vikram@tcs.com',
      'user@company.flashfix.in'
    ];

    for (const email of validEmails) {
      assert.equal(isDisposableEmail(email), false);
      const res = service.sendLoginOtp(email);
      assert.equal(res.success, true);
    }
  });

  test('TC-DISP-07: Rejects booking creation when contact email uses a disposable domain', () => {
    assert.throws(
      () =>
        service.createBooking({
          brand: 'Apple',
          deviceModel: 'iPhone 15 Pro',
          issue: 'Screen Replacement',
          storeId: 'store-blr-01',
          scheduledDate: '2026-11-01',
          scheduledTime: '10:00 AM',
          contactName: 'Scammer',
          contactEmail: 'fraud@mailinator.com',
          contactPhone: '+91 99999 88888'
        }),
      /DISPOSABLE_EMAIL_NOT_ALLOWED/
    );
  });
});
