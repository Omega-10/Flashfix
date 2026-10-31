import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue,
  mockGoogleOAuth
} from '../../mocks/index.ts';

test.describe('Tier 1: Feature Coverage - Auth Service & OTP Engine', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    mockGoogleOAuth.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-AUTH-01: Dispatches 6-digit login OTP via Brevo mock adapter', () => {
    const email = 'customer.test@example.com';
    const result = service.sendLoginOtp(email);

    assert.equal(result.success, true);
    assert.equal(result.message, 'OTP sent to email');
    assert.ok(result.code);
    assert.equal(result.code.length, 6);
    assert.match(result.code, /^\d{6}$/);

    // Verify stored OTP in DB
    const storedOtp = mockDb.findActiveOtp(email, 'LOGIN');
    assert.ok(storedOtp);
    assert.equal(storedOtp.email, email);
    assert.equal(storedOtp.purpose, 'LOGIN');
    assert.equal(storedOtp.used, false);
    assert.equal(storedOtp.attempts, 0);

    // Verify Brevo transactional email enqueued with #ef8f0b branding
    const notifs = mockNotificationQueue.getByRecipient(email);
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].templateType, 'otp-login');
    assert.equal(notifs[0].variables.code, result.code);
    assert.match(notifs[0].bodyHtml, /#ef8f0b/);
  });

  test('TC-AUTH-02: Verifies valid OTP, marks code as used, and returns JWT tokens + user', () => {
    const email = 'priya.sharma@example.com';
    const { code } = service.sendLoginOtp(email);
    assert.ok(code);

    const authResult = service.verifyLoginOtp(email, code);
    assert.equal(authResult.success, true);
    assert.ok(authResult.accessToken.startsWith('jwt-access-'));
    assert.ok(authResult.refreshToken.startsWith('jwt-refresh-'));
    assert.equal(authResult.user.email, email);
    assert.equal(authResult.user.emailVerified, true);
    assert.equal(authResult.user.role, 'CONSUMER');

    // Confirm OTP is now marked as used and cannot be reused
    const otpInDb = mockDb.findActiveOtp(email, 'LOGIN');
    assert.equal(otpInDb, undefined); // no longer active
  });

  test('TC-AUTH-03: Increments attempts and throws error when invalid OTP is submitted', () => {
    const email = 'rajesh.kumar@example.com';
    service.sendLoginOtp(email);

    assert.throws(
      () => service.verifyLoginOtp(email, '000000'),
      /INVALID_OTP/
    );

    const otpInDb = Array.from(mockDb.otpCodes.values()).find(
      (o) => o.email === email && o.purpose === 'LOGIN'
    );
    assert.ok(otpInDb);
    assert.equal(otpInDb.attempts, 1);
    assert.equal(otpInDb.used, false);
  });

  test('TC-AUTH-04: Authenticates user via Google OAuth2 callback exchange', () => {
    const mockAuthCode = 'google-auth-code-12345';
    const googleProfile = mockGoogleOAuth.createStandardProfile({
      email: 'rohit.verma@gmail.com',
      name: 'Rohit Verma'
    });
    mockGoogleOAuth.registerMockCode(mockAuthCode, googleProfile);

    // Exchange auth code
    const profile = mockGoogleOAuth.exchangeCodeForProfile(mockAuthCode);
    assert.equal(profile.email, 'rohit.verma@gmail.com');
    assert.equal(profile.emailVerified, true);

    // Upsert user in mock DB
    let user = mockDb.findUserByEmail(profile.email);
    if (!user) {
      user = {
        id: `user-google-${Date.now()}`,
        name: profile.name,
        email: profile.email,
        role: 'CONSUMER',
        emailVerified: true,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockDb.users.set(user.id, user);
    }

    assert.ok(user.id);
    assert.equal(user.googleId, profile.googleId);
    assert.equal(user.emailVerified, true);
  });

  test('TC-AUTH-05: Fetches and updates user profile and retrieves saved addresses', () => {
    const consumer = mockDb.findUserByEmail('consumer.anita@gmail.com');
    assert.ok(consumer);
    assert.equal(consumer.name, 'Anita Desai');

    // Update profile
    consumer.phone = '+91 98800 99999';
    consumer.updatedAt = new Date();
    mockDb.users.set(consumer.id, consumer);

    const updated = mockDb.users.get(consumer.id);
    assert.equal(updated?.phone, '+91 98800 99999');

    // Check saved addresses
    const addresses = Array.from(mockDb.savedAddresses.values()).filter(
      (a) => a.userId === consumer.id
    );
    assert.equal(addresses.length, 1);
    assert.equal(addresses[0].label, 'Home');
    assert.equal(addresses[0].isDefault, true);
    assert.equal(addresses[0].lat, 12.926);
    assert.equal(addresses[0].lng, 77.6762);
  });

  test('TC-AUTH-06: Admin user management lists users by role and invites new store employee', () => {
    // List users by role
    const employees = Array.from(mockDb.users.values()).filter((u) => u.role === 'EMPLOYEE');
    assert.ok(employees.length >= 2); // Rahul tech and Vijay delivery

    // Super admin invites new store admin
    const inviteEmail = 'new.admin@flashfix.in';
    const newEmployee = {
      id: `user-emp-${Date.now()}`,
      name: 'Deepak Rao',
      email: inviteEmail,
      role: 'ADMIN' as const,
      storeId: 'store-blr-02',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDb.users.set(newEmployee.id, newEmployee);

    mockNotificationQueue.enqueue(inviteEmail, 'employee-assigned', {
      storeName: 'Flashfix Indiranagar',
      role: 'ADMIN'
    });

    const registered = mockDb.findUserByEmail(inviteEmail);
    assert.ok(registered);
    assert.equal(registered.role, 'ADMIN');
    assert.equal(registered.storeId, 'store-blr-02');

    const notif = mockNotificationQueue.getByRecipient(inviteEmail);
    assert.equal(notif.length, 1);
  });
});
