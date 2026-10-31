import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { inMemoryAuthRepo } from '../src/db/index.js';
import { signAccessToken } from '../src/middleware/auth.js';
import type { Server } from 'node:http';

test.describe('auth-service integration tests', () => {
  let app: ReturnType<typeof createApp>;
  let server: Server;
  let baseUrl: string;

  test.before(() => {
    process.env.NODE_ENV = 'test';
    app = createApp();
    server = app.listen(0);
    const address = server.address() as any;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  test.after(() => {
    server.close();
  });

  test.beforeEach(() => {
    inMemoryAuthRepo.reset();
  });

  test('POST /auth/send-otp rejects disposable email addresses with 400', async () => {
    const disposableEmails = [
      'spammer@mailinator.com',
      'user@10minutemail.com',
      'test@temp-mail.org',
      'hacker@guerrillamail.com',
      'burn@sharklasers.com',
      'subdomain@sub.mailinator.com',
    ];

    for (const email of disposableEmails) {
      const res = await fetch(`${baseUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
      assert.equal(body.error?.code, 'DISPOSABLE_EMAIL_NOT_ALLOWED');
    }
  });

  test('POST /auth/send-otp accepts legitimate email and stores hashed OTP', async () => {
    const email = 'consumer.genuine@gmail.com';
    const res = await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.code); // in non-production, code is provided

    const otpInDb = await inMemoryAuthRepo.findActiveOtp(email, 'LOGIN');
    assert.ok(otpInDb);
    assert.equal(otpInDb.email, email);
    assert.equal(otpInDb.verified, false);
  });

  test('POST /auth/verify-otp validates code and issues JWT tokens + user', async () => {
    const email = 'priya.sharma@gmail.com';
    const sendRes = await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const { code } = (await sendRes.json()) as any;

    const verifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyBody = (await verifyRes.json()) as any;
    assert.equal(verifyBody.success, true);
    assert.ok(verifyBody.data.accessToken);
    assert.ok(verifyBody.data.refreshToken);
    assert.equal(verifyBody.data.user.email, email);
    assert.equal(verifyBody.data.user.emailVerified, true);
    assert.equal(verifyBody.data.user.role, 'CONSUMER');

    // OTP should no longer be active
    const activeOtp = await inMemoryAuthRepo.findActiveOtp(email, 'LOGIN');
    assert.equal(activeOtp, null);
  });

  test('POST /auth/verify-otp increments attempts and blocks after 5 tries', async () => {
    const email = 'rajesh.kumar@gmail.com';
    await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // 5 invalid attempts
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: '000000' }),
      });
      assert.equal(res.status, 400);
    }

    // 6th attempt should return OTP_MAX_ATTEMPTS_EXCEEDED
    const res6 = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: '000000' }),
    });
    assert.equal(res6.status, 400);
    const body6 = (await res6.json()) as any;
    assert.equal(body6.error.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
  });

  test('POST /auth/refresh exchanges refresh token for new access token', async () => {
    const email = 'refresh.test@gmail.com';
    const sendRes = await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const { code } = (await sendRes.json()) as any;

    const verifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const { data } = (await verifyRes.json()) as any;

    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: data.refreshToken }),
    });

    assert.equal(refreshRes.status, 200);
    const refreshBody = (await refreshRes.json()) as any;
    assert.equal(refreshBody.success, true);
    assert.ok(refreshBody.data.accessToken);
  });

  test('GET /auth/google/callback issues tokens for OAuth profile', async () => {
    const res = await fetch(`${baseUrl}/auth/google/callback?code=mock-google-code`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.data.accessToken);
    assert.ok(body.data.user.email);
    assert.equal(body.data.user.emailVerified, true);
  });

  test('GET /auth/me and PATCH /auth/me profile management', async () => {
    const user = await inMemoryAuthRepo.findUserByEmail('consumer.anita@gmail.com');
    assert.ok(user);

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // GET /auth/me
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(meRes.status, 200);
    const meBody = (await meRes.json()) as any;
    assert.equal(meBody.data.email, 'consumer.anita@gmail.com');
    assert.equal(meBody.data.savedAddresses.length, 1);

    // PATCH /auth/me
    const updateRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Anita D.', phone: '+91 99999 88888' }),
    });
    assert.equal(updateRes.status, 200);
    const updateBody = (await updateRes.json()) as any;
    assert.equal(updateBody.data.name, 'Anita D.');
    assert.equal(updateBody.data.phone, '+91 99999 88888');
  });

  test('POST /auth/saved-addresses creates address for authenticated user', async () => {
    const user = await inMemoryAuthRepo.findUserByEmail('consumer.anita@gmail.com');
    assert.ok(user);

    const token = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const createRes = await fetch(`${baseUrl}/auth/saved-addresses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: 'Office',
        address: 'WeWork Galaxy, Residency Rd, Bengaluru',
        lat: 12.9716,
        lng: 77.5946,
      }),
    });

    assert.equal(createRes.status, 201);
    const body = (await createRes.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.label, 'Office');

    const getRes = await fetch(`${baseUrl}/auth/saved-addresses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = (await getRes.json()) as any;
    assert.equal(getBody.data.length, 2);
  });

  test('Admin endpoints: list users, update role, invite employee', async () => {
    const superadmin = await inMemoryAuthRepo.findUserByEmail('superadmin@flashfix.in');
    assert.ok(superadmin);

    const adminToken = signAccessToken({
      userId: superadmin.id,
      email: superadmin.email,
      role: superadmin.role,
    });

    // List users
    const listRes = await fetch(`${baseUrl}/auth/users?role=EMPLOYEE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as any;
    assert.ok(listBody.data.length >= 2);

    // Update role
    const consumer = await inMemoryAuthRepo.findUserByEmail('consumer.anita@gmail.com');
    assert.ok(consumer);

    const roleRes = await fetch(`${baseUrl}/auth/users/${consumer.id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'EMPLOYEE' }),
    });
    assert.equal(roleRes.status, 200);
    const roleBody = (await roleRes.json()) as any;
    assert.equal(roleBody.data.role, 'EMPLOYEE');

    // Invite new staff
    const inviteRes = await fetch(`${baseUrl}/auth/users/invite`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'new.tech@flashfix.in',
        name: 'New Technician',
        role: 'EMPLOYEE',
        storeId: 'store-001',
      }),
    });
    assert.equal(inviteRes.status, 201);
    const inviteBody = (await inviteRes.json()) as any;
    assert.equal(inviteBody.data.email, 'new.tech@flashfix.in');
  });
});
