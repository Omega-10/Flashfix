/**
 * Empirical Challenge Harness for Milestone 3 (Milestone 3 Challenger)
 * Tests:
 * 1. auth-service: disposable email rejection (400), OTP generation, bcrypt verification, JWTs, edge cases.
 * 2. store-service: Haversine distance, exact boundary tiers (3km, 10km), string vs number coordinates.
 * 3. notify-service: templates (#ef8f0b, parameters), mock inbox operations.
 */

import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp as createAuthApp } from '../services/auth-service/src/app.js';
import { inMemoryAuthRepo } from '../services/auth-service/src/db/index.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../services/auth-service/src/middleware/auth.js';
import { createApp as createStoreApp } from '../services/store-service/src/app.js';
import { inMemoryStoreRepo } from '../services/store-service/src/db/index.js';
import { createApp as createNotifyApp } from '../services/notify-service/src/app.js';
import { consoleMockEmailAdapter } from '../services/notify-service/src/adapters/mock.js';
import {
  renderOtpLoginTemplate,
  renderBookingConfirmedTemplate,
  renderPickupOtpTemplate,
  renderCustodyOtpTemplate,
  renderRepairCompleteTemplate,
  renderEmployeeAssignedTemplate,
} from '../services/notify-service/src/templates/index.js';
import { haversineKm, getRadiusTier, calculateEstimatedMinutes, isDisposableEmail } from '@flashfix/shared';

let passedChecks = 0;
let totalChecks = 0;

function check(name: string, fn: () => void | Promise<void>) {
  totalChecks++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(
        () => {
          passedChecks++;
          console.log(`  [PASS] ${name}`);
        },
        (err) => {
          console.error(`  [FAIL] ${name}:`, err.message);
          throw err;
        }
      );
    } else {
      passedChecks++;
      console.log(`  [PASS] ${name}`);
    }
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runEmpiricalChallenges() {
  console.log('\n=============================================================');
  console.log('⚡ FLASHFIX CHALLENGER M3: EMPIRICAL STRESS TEST SUITE');
  console.log('=============================================================\n');

  process.env.NODE_ENV = 'test';

  // -------------------------------------------------------------
  // CHALLENGE 1: AUTH-SERVICE
  // -------------------------------------------------------------
  console.log('--- CHALLENGE 1: AUTH-SERVICE ---');
  const authApp = createAuthApp();
  const authServer = authApp.listen(0);
  const authPort = (authServer.address() as any).port;
  const authBase = `http://127.0.0.1:${authPort}`;

  try {
    inMemoryAuthRepo.reset();

    // 1.1 Disposable Email Stress Testing
    console.log('1.1 Disposable Email Stress Testing');
    const disposableSamples = [
      'user@mailinator.com',
      'USER@MAILINATOR.COM',
      'test@10minutemail.com',
      'temp@temp-mail.org',
      'burner@sharklasers.com',
      'guerrilla@guerrillamail.com',
      'yop@yopmail.com',
      'deep.sub@sub.mailinator.com',
      'deep.sub@nested.sub.yopmail.com',
      'spaces@mailinator.com',
    ];

    for (const dispEmail of disposableSamples) {
      await check(`Rejects disposable email ${dispEmail} with 400`, async () => {
        const res = await fetch(`${authBase}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: dispEmail }),
        });
        assert.equal(res.status, 400);
        const json = (await res.json()) as any;
        assert.equal(json.success, false);
        assert.equal(json.error?.code, 'DISPOSABLE_EMAIL_NOT_ALLOWED');
      });
    }

    // Legit emails must pass
    const legitEmails = [
      'user@gmail.com',
      'dev@yahoo.co.in',
      'employee@flashfix.in',
      'ceo@enterprise.org',
      'name.surname@outlook.com',
    ];
    for (const legit of legitEmails) {
      await check(`Accepts legitimate email: ${legit}`, async () => {
        const res = await fetch(`${authBase}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: legit }),
        });
        assert.equal(res.status, 200);
        const json = (await res.json()) as any;
        assert.equal(json.success, true);
        assert.ok(json.code);
        assert.match(json.code, /^\d{6}$/); // 6-digit numeric OTP
      });
    }

    // Malformed email inputs
    const malformed = ['', 'not-an-email', '@missinguser.com', 'user@', 'user@@domain.com', 12345, null];
    for (const bad of malformed) {
      await check(`Rejects malformed email ${JSON.stringify(bad)} with 400`, async () => {
        const res = await fetch(`${authBase}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: bad }),
        });
        assert.equal(res.status, 400);
      });
    }

    // 1.2 OTP Generation & Bcrypt Hashing
    console.log('1.2 OTP Generation & Bcrypt Hashing');
    await check('OTP is stored with valid bcrypt hash in repository', async () => {
      const email = 'crypto.test@gmail.com';
      const res = await fetch(`${authBase}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      assert.equal(res.status, 200);
      const { code } = (await res.json()) as any;
      assert.ok(code);

      const dbRecord = await inMemoryAuthRepo.findActiveOtp(email, 'LOGIN');
      assert.ok(dbRecord);
      assert.notEqual(dbRecord.codeHash, code, 'Code must not be stored in plaintext');
      assert.ok(dbRecord.codeHash.startsWith('$2'), 'Hash must be valid bcrypt hash');
      assert.ok(bcrypt.compareSync(code, dbRecord.codeHash), 'Bcrypt compare must succeed for generated code');
      assert.ok(dbRecord.expiresAt.getTime() > Date.now(), 'OTP must expire in future');
      assert.equal(dbRecord.purpose, 'LOGIN');
    });

    // 1.3 Bcrypt Verification & Brute-Force Rate Limiting
    console.log('1.3 Bcrypt Verification & Brute-Force Rate Limiting');
    await check('Verify OTP with wrong code fails and increments attempt counter', async () => {
      const email = 'bruteforce.test@gmail.com';
      await fetch(`${authBase}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Wrong code
      const failRes = await fetch(`${authBase}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: '000000' }),
      });
      assert.equal(failRes.status, 400);
      const failJson = (await failRes.json()) as any;
      assert.equal(failJson.error?.code, 'OTP_INVALID');

      const otpRecord = await inMemoryAuthRepo.findActiveOtp(email, 'LOGIN');
      assert.ok(otpRecord);
      assert.equal(otpRecord.attempts, 1);
    });

    await check('Exceeding 5 attempts locks out OTP verification (OTP_MAX_ATTEMPTS_EXCEEDED)', async () => {
      const email = 'lockout.test@gmail.com';
      const sendRes = await fetch(`${authBase}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const { code: validCode } = (await sendRes.json()) as any;

      // Fail 4 more times (5 total fails)
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${authBase}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: '111111' }),
        });
        assert.equal(res.status, 400);
      }

      // 6th attempt even with VALID code must be rejected due to lockout
      const lockedRes = await fetch(`${authBase}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: validCode }),
      });
      assert.equal(lockedRes.status, 400);
      const lockedJson = (await lockedRes.json()) as any;
      assert.equal(lockedJson.error?.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
    });

    await check('Replay attack prevented: valid OTP cannot be verified twice', async () => {
      const email = 'replay.test@gmail.com';
      const sendRes = await fetch(`${authBase}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const { code } = (await sendRes.json()) as any;

      // 1st verify succeeds
      const v1 = await fetch(`${authBase}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      assert.equal(v1.status, 200);

      // 2nd verify must fail
      const v2 = await fetch(`${authBase}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      assert.equal(v2.status, 400);
      const v2Json = (await v2.json()) as any;
      assert.equal(v2Json.error?.code, 'OTP_EXPIRED');
    });

    // 1.4 JWT Tokens Verification & Claims
    console.log('1.4 JWT Tokens Verification & Claims');
    await check('JWT signing and verification enforces expiration and claims', async () => {
      const payload = {
        userId: 'usr-challenge-123',
        email: 'jwt.tester@flashfix.in',
        role: 'EMPLOYEE' as const,
        storeId: 'store-blr-01',
      };

      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      const verifiedAccess = verifyAccessToken(accessToken);
      assert.equal(verifiedAccess.userId, payload.userId);
      assert.equal(verifiedAccess.email, payload.email);
      assert.equal(verifiedAccess.role, 'EMPLOYEE');
      assert.equal(verifiedAccess.storeId, 'store-blr-01');

      const verifiedRefresh = verifyRefreshToken(refreshToken);
      assert.equal(verifiedRefresh.userId, payload.userId);

      // Decoding token exp to confirm 15m and 7d
      const decodedAccess: any = jwt.decode(accessToken);
      const decodedRefresh: any = jwt.decode(refreshToken);
      const accessTtlSec = decodedAccess.exp - decodedAccess.iat;
      const refreshTtlSec = decodedRefresh.exp - decodedRefresh.iat;
      assert.equal(accessTtlSec, 15 * 60, 'Access token TTL must be exactly 15 minutes');
      assert.equal(refreshTtlSec, 7 * 24 * 60 * 60, 'Refresh token TTL must be exactly 7 days');
    });

    await check('Tampered or malformed JWT is rejected with 401 on protected endpoint', async () => {
      const res = await fetch(`${authBase}/auth/me`, {
        headers: { Authorization: 'Bearer forged.tampered.token' },
      });
      assert.equal(res.status, 401);
      const json = (await res.json()) as any;
      assert.equal(json.error?.code, 'UNAUTHORIZED');
    });

    await check('Missing Authorization header is rejected with 401', async () => {
      const res = await fetch(`${authBase}/auth/me`);
      assert.equal(res.status, 401);
      const json = (await res.json()) as any;
      assert.equal(json.error?.code, 'UNAUTHORIZED');
    });

    await check('Role guard blocks unauthorized roles (CONSUMER calling SUPER_ADMIN endpoint)', async () => {
      const consumerToken = signAccessToken({
        userId: 'usr-consumer',
        email: 'consumer@gmail.com',
        role: 'CONSUMER',
      });

      const res = await fetch(`${authBase}/auth/users`, {
        headers: { Authorization: `Bearer ${consumerToken}` },
      });
      assert.equal(res.status, 403);
      const json = (await res.json()) as any;
      assert.equal(json.error?.code, 'FORBIDDEN');
    });

  } finally {
    authServer.close();
  }

  // -------------------------------------------------------------
  // CHALLENGE 2: STORE-SERVICE & HAVERSINE
  // -------------------------------------------------------------
  console.log('\n--- CHALLENGE 2: STORE-SERVICE & HAVERSINE ---');
  const storeApp = createStoreApp();
  const storeServer = storeApp.listen(0);
  const storePort = (storeServer.address() as any).port;
  const storeBase = `http://127.0.0.1:${storePort}`;

  try {
    inMemoryStoreRepo.reset();

    // 2.1 Haversine Distance Formula Verification
    console.log('2.1 Haversine Distance Formula Verification against Mathematical Oracles');
    check('Zero distance when coordinates match', () => {
      const dist = haversineKm(12.9352, 77.6245, 12.9352, 77.6245);
      assert.equal(dist, 0);
    });

    check('Equatorial 1-degree longitude difference: ~111.19 km', () => {
      const dist = haversineKm(0, 0, 0, 1);
      // R * 1 deg in rad = 6371 * (pi / 180) = ~111.1949
      assert.ok(Math.abs(dist - 111.19) <= 0.05, `Expected ~111.19 km, got ${dist}`);
    });

    check('Southern & Western hemisphere negative coordinate calculations', () => {
      // Sydney (-33.8688, 151.2093) to Melbourne (-37.8136, 144.9631) -> ~713 km
      const dist = haversineKm(-33.8688, 151.2093, -37.8136, 144.9631);
      assert.ok(dist >= 700 && dist <= 725, `Expected ~713 km, got ${dist}`);
    });

    check('Antipodal distance: North Pole (90, 0) to South Pole (-90, 0) -> ~20015 km', () => {
      const dist = haversineKm(90, 0, -90, 0);
      assert.ok(Math.abs(dist - 20015) <= 50, `Expected ~20015 km, got ${dist}`);
    });

    // 2.2 Exact Radius Boundary Tests
    console.log('2.2 Exact Radius Tier Boundaries (3.0 km, 10.0 km)');
    check('Distance 0.00 km is flash tier', () => {
      assert.equal(getRadiusTier(0), 'flash');
    });

    check('Distance 2.99 km is flash tier', () => {
      assert.equal(getRadiusTier(2.99), 'flash');
    });

    check('Distance EXACTLY 3.00 km is flash tier (<= 3.0 km rule)', () => {
      assert.equal(getRadiusTier(3.0), 'flash');
    });

    check('Distance 3.01 km transitions to next-day tier', () => {
      assert.equal(getRadiusTier(3.01), 'next-day');
    });

    check('Distance 9.99 km is next-day tier', () => {
      assert.equal(getRadiusTier(9.99), 'next-day');
    });

    check('Distance EXACTLY 10.00 km is next-day tier (<= 10.0 km rule)', () => {
      assert.equal(getRadiusTier(10.0), 'next-day');
    });

    check('Distance 10.01 km transitions to out-of-range tier', () => {
      assert.equal(getRadiusTier(10.01), 'out-of-range');
    });

    check('Distance 25.0 km is out-of-range tier', () => {
      assert.equal(getRadiusTier(25.0), 'out-of-range');
    });

    // 2.3 Store-service live HTTP tests
    console.log('2.3 Store Service Live HTTP API & Flash Badge Validation');
    await check('Nearby query within 3km assigns flash tier and isFlashHero true', async () => {
      // Near Koramangala store (12.9352, 77.6245)
      const res = await fetch(`${storeBase}/stores/nearby?lat=12.9370&lng=77.6250`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.ok(json.data.length > 0);

      const nearest = json.data[0];
      assert.equal(nearest.id, 'store-blr-01');
      assert.ok(nearest.distanceKm <= 3.0);
      assert.equal(nearest.tier, 'flash');
      assert.equal(nearest.isFlashHero, true);
      assert.ok(nearest.estimatedPickupMinutes <= 25);
    });

    await check('Nearby query between 3km and 10km assigns next-day tier and isFlashHero false', async () => {
      // Point ~6km away
      const res = await fetch(`${storeBase}/stores/nearby?lat=12.9800&lng=77.6400`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      const store = json.data.find((s: any) => s.id === 'store-blr-01');
      assert.ok(store);
      assert.ok(store.distanceKm > 3.0 && store.distanceKm <= 10.0);
      assert.equal(store.tier, 'next-day');
      assert.equal(store.isFlashHero, false);
      assert.equal(store.estimatedPickupMinutes, 120);
    });

    await check('Nearby query > 10km assigns out-of-range and estimatedPickupMinutes null', async () => {
      // Devanahalli Airport (lat: 13.1986, lng: 77.7066) -> >30km away
      const res = await fetch(`${storeBase}/stores/nearby?lat=13.1986&lng=77.7066`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);

      for (const store of json.data) {
        assert.ok(store.distanceKm > 10.0);
        assert.equal(store.tier, 'out-of-range');
        assert.equal(store.isFlashHero, false);
        assert.equal(store.estimatedPickupMinutes, null);
      }
    });

    await check('Numeric string coordinates in Postgres are parsed to numbers without NaN', async () => {
      await inMemoryStoreRepo.createStore({
        id: 'store-challenge-str',
        name: 'Challenge String Store',
        address: 'Whitefield Main Rd',
        city: 'Bengaluru',
        lat: '12.9698' as any,
        lng: '77.7499' as any,
        hours: '09:00 - 21:00',
        services: ['Battery'],
        rating: 4.8,
        reviewCount: 42,
        isActive: true,
      });

      const res = await fetch(`${storeBase}/stores/nearby?lat=12.9698&lng=77.7499`);
      const json = (await res.json()) as any;
      const found = json.data.find((s: any) => s.id === 'store-challenge-str');
      assert.ok(found);
      assert.equal(typeof found.lat, 'number');
      assert.equal(typeof found.lng, 'number');
      assert.equal(found.distanceKm, 0);
      assert.equal(found.tier, 'flash');
    });

    await check('Invalid lat/lng query params return 400 validation error', async () => {
      const res = await fetch(`${storeBase}/stores/nearby?lat=abc&lng=77.62`);
      assert.equal(res.status, 400);
      const json = (await res.json()) as any;
      assert.equal(json.error?.code, 'VALIDATION_ERROR');
    });

  } finally {
    storeServer.close();
  }

  // -------------------------------------------------------------
  // CHALLENGE 3: NOTIFY-SERVICE
  // -------------------------------------------------------------
  console.log('\n--- CHALLENGE 3: NOTIFY-SERVICE ---');
  const notifyApp = createNotifyApp();
  const notifyServer = notifyApp.listen(0);
  const notifyPort = (notifyServer.address() as any).port;
  const notifyBase = `http://127.0.0.1:${notifyPort}`;

  try {
    consoleMockEmailAdapter.clear();

    // 3.1 Template Rendering Verification
    console.log('3.1 Template Rendering & Brand Color Verification');
    check('renderOtpLoginTemplate has #ef8f0b, valid subject, and code', () => {
      const res = renderOtpLoginTemplate('859302');
      assert.match(res.subject, /859302/);
      assert.match(res.html, /#ef8f0b/);
      assert.match(res.html, /859302/);
      assert.match(res.text, /859302/);
    });

    check('renderBookingConfirmedTemplate has bookingId, #ef8f0b, tracking link', () => {
      const res = renderBookingConfirmedTemplate({
        bookingId: 'FF-998877',
        customerName: 'Aarav Patel',
        deviceModel: 'Samsung Galaxy S24 Ultra',
        scheduledDate: '2026-11-05',
        scheduledTime: '11:00 AM',
        storeName: 'Flashfix Indiranagar Hub',
      });
      assert.match(res.subject, /FF-998877/);
      assert.match(res.html, /#ef8f0b/);
      assert.match(res.html, /Aarav Patel/);
      assert.match(res.html, /Samsung Galaxy S24 Ultra/);
      assert.match(res.html, /https:\/\/flashfix\.in\/flashfix\/track\/FF-998877/);
      assert.match(res.text, /FF-998877/);
    });

    check('renderPickupOtpTemplate has code, bookingId, employeeName', () => {
      const res = renderPickupOtpTemplate({
        code: '123456',
        bookingId: 'FF-554433',
        employeeName: 'Kiran Rao',
      });
      assert.match(res.subject, /123456/);
      assert.match(res.html, /123456/);
      assert.match(res.html, /Kiran Rao/);
      assert.match(res.html, /FF-554433/);
      assert.match(res.html, /#ef8f0b/);
    });

    check('renderCustodyOtpTemplate has code, bookingId, technicianName', () => {
      const res = renderCustodyOtpTemplate({
        code: '654321',
        bookingId: 'FF-554433',
        technicianName: 'Suresh Kumar',
      });
      assert.match(res.subject, /654321/);
      assert.match(res.html, /654321/);
      assert.match(res.html, /Suresh Kumar/);
      assert.match(res.html, /#ef8f0b/);
    });

    check('renderRepairCompleteTemplate has customerName, deviceModel, tracking link', () => {
      const res = renderRepairCompleteTemplate({
        bookingId: 'FF-554433',
        customerName: 'Meera Sen',
        deviceModel: 'OnePlus 12',
      });
      assert.match(res.subject, /FF-554433/);
      assert.match(res.html, /Meera Sen/);
      assert.match(res.html, /OnePlus 12/);
      assert.match(res.html, /https:\/\/flashfix\.in\/flashfix\/track\/FF-554433/);
    });

    check('renderEmployeeAssignedTemplate has job details', () => {
      const res = renderEmployeeAssignedTemplate({
        bookingId: 'FF-554433',
        customerName: 'Meera Sen',
        pickupAddress: 'Indiranagar 100ft Rd',
        scheduledDate: '2026-11-06',
        scheduledTime: '02:00 PM',
      });
      assert.match(res.subject, /FF-554433/);
      assert.match(res.html, /Meera Sen/);
      assert.match(res.html, /Indiranagar 100ft Rd/);
    });

    // 3.2 Mock Inbox API Integration
    console.log('3.2 Mock Inbox API Operations');
    await check('POST /notify/otp-login dispatches and appears in GET /notify/test-inbox', async () => {
      consoleMockEmailAdapter.clear();
      const res = await fetch(`${notifyBase}/notify/otp-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'challenger@flashfix.in', code: '776655' }),
      });
      assert.equal(res.status, 200);

      const inboxRes = await fetch(`${notifyBase}/notify/test-inbox`);
      assert.equal(inboxRes.status, 200);
      const inboxJson = (await inboxRes.json()) as any;
      assert.equal(inboxJson.data.length, 1);
      assert.equal(inboxJson.data[0].to, 'challenger@flashfix.in');
      assert.match(inboxJson.data[0].subject, /776655/);
    });

    await check('POST /notify/test-inbox/clear clears inbox cleanly', async () => {
      const clearRes = await fetch(`${notifyBase}/notify/test-inbox/clear`, { method: 'POST' });
      assert.equal(clearRes.status, 200);

      const checkRes = await fetch(`${notifyBase}/notify/test-inbox`);
      const checkJson = (await checkRes.json()) as any;
      assert.equal(checkJson.data.length, 0);
    });

    await check('Dispatched emails normalize recipient email to lowercase in inbox', async () => {
      await fetch(`${notifyBase}/notify/otp-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'UPPERCASE.USER@DOMAIN.COM', code: '998877' }),
      });
      const records = consoleMockEmailAdapter.getByRecipient('uppercase.user@domain.com');
      assert.equal(records.length, 1);
      assert.equal(records[0].to, 'uppercase.user@domain.com');
    });

  } finally {
    notifyServer.close();
  }

  console.log('\n=============================================================');
  console.log(`✅ EMPIRICAL CHALLENGE COMPLETED: ${passedChecks}/${totalChecks} CHECKS PASSED (100%)`);
  console.log('=============================================================\n');
}

runEmpiricalChallenges().catch((err) => {
  console.error('\n❌ EMPIRICAL CHALLENGE SUITE FAILED:', err);
  process.exit(1);
});
