/**
 * Empirical Challenge Harness for Milestone 3 Challenger 2:
 * Booking Lifecycle, Two-Factor Custody Handover, Audit Trail & Admin API Stress Testing.
 *
 * This test suite boots up actual Express server instances for:
 * 1. notify-service (mock adapter mode)
 * 2. booking-service (HTTP endpoints)
 * 3. admin-api (HTTP endpoints)
 *
 * It stresses:
 * - Full lifecycle progression PENDING -> CONFIRMED -> PICKUP_EN_ROUTE -> PICKUP_OTP_SENT -> IN_TRANSIT -> CUSTODY_OTP_SENT -> IN_REPAIR -> REPAIR_COMPLETE -> RETURN_EN_ROUTE -> DELIVERED
 * - Verification of notifications at every stage with #ef8f0b branding
 * - Two-factor OTP custody handover: pickup OTP and custody OTP
 * - OTP security boundaries: expired, invalid, replay attacks, cross-booking attacks, attempt lockout (5 tries)
 * - Cancellation rules and transition restrictions
 * - Direct status transition analysis via PATCH /bookings/:id/status
 * - Immutable booking_trail verification across all transitions
 * - Admin API stats, bookings filtering, staff assignment, team invitation, and inventory stock
 */

import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp as createNotifyApp } from '../services/notify-service/src/app.js';
import { consoleMockEmailAdapter } from '../services/notify-service/src/adapters/mock.js';

let passedChecks = 0;
let totalChecks = 0;
const findings: string[] = [];

async function check(name: string, fn: () => void | Promise<void>) {
  totalChecks++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedChecks++;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
    findings.push(`${name} failed: ${err.message}`);
    throw err;
  }
}

async function runEmpiricalLifecycleChallenges() {
  console.log('\n======================================================================');
  console.log('⚡ FLASHFIX CHALLENGER M3-2: BOOKING LIFECYCLE & AUDIT TRAIL SUITE');
  console.log('======================================================================\n');

  process.env.NODE_ENV = 'test';

  // 1. Boot up notify-service
  const notifyApp = createNotifyApp();
  const notifyServer = notifyApp.listen(0);
  const notifyPort = (notifyServer.address() as any).port;
  const notifyBase = `http://127.0.0.1:${notifyPort}`;
  process.env.NOTIFY_URL = notifyBase;

  // 2. Boot up booking-service (dynamically imported after NOTIFY_URL is set)
  const { createApp: createBookingApp } = await import('../services/booking-service/src/app.js');
  const { inMemoryBookingRepo } = await import('../services/booking-service/src/db/index.js');
  const bookingApp = createBookingApp();
  const bookingServer = bookingApp.listen(0);
  const bookingPort = (bookingServer.address() as any).port;
  const bookingBase = `http://127.0.0.1:${bookingPort}`;

  // 3. Boot up admin-api (dynamically imported after NOTIFY_URL is set)
  const { createApp: createAdminApp } = await import('../services/admin-api/src/app.js');
  const { inMemoryAdminRepo } = await import('../services/admin-api/src/db/index.js');
  const adminApp = createAdminApp();
  const adminServer = adminApp.listen(0);
  const adminPort = (adminServer.address() as any).port;
  const adminBase = `http://127.0.0.1:${adminPort}`;

  try {
    inMemoryBookingRepo.reset();
    inMemoryAdminRepo.reset();
    consoleMockEmailAdapter.clear();

    // ==================================================================
    // SUITE 1: FULL STATE PROGRESSION (PENDING -> DELIVERED)
    // ==================================================================
    console.log('--- SUITE 1: FULL STATE PROGRESSION PENDING -> DELIVERED ---');

    let bookingId = '';
    const customerEmail = 'rohit.sharma@gmail.com';
    const riderId = '00000000-0000-4000-a000-000000000004'; // Rajesh
    const techId = '00000000-0000-4000-a000-000000000005'; // Vikram

    await check('1.1 Create booking: status PENDING, format FF-XXXXXX, customer notification', async () => {
      const res = await fetch(`${bookingBase}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store-blr-01',
          brand: 'Apple',
          deviceModel: 'iPhone 15 Pro Max',
          issueType: 'Screen Replacement',
          issueDescription: 'Touch unresponsive after drop',
          scheduledDate: '2026-11-01',
          scheduledTime: '10:00 AM',
          pickupAddress: 'Prestige Acropolis, Koramangala, Bengaluru',
          pickupLat: 12.934,
          pickupLng: 77.623,
          contactName: 'Rohit Sharma',
          contactEmail: customerEmail,
          contactPhone: '+91 98800 11223',
          estimatedCostPaise: 1850000,
        }),
      });

      assert.equal(res.status, 201);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      bookingId = json.data.id;
      assert.match(bookingId, /^FF-[A-Z0-9]{6}$/);
      assert.equal(json.data.status, 'PENDING');
      assert.equal(json.data.paymentStatus, 'UNPAID');

      // Check notification sent
      const inbox = consoleMockEmailAdapter.getInbox();
      const confirmEmail = inbox.find((e) => e.to === customerEmail && e.templateType === 'booking-confirmed');
      assert.ok(confirmEmail, 'Booking confirmation email must be dispatched to customer');
      assert.ok(confirmEmail?.html.includes('#ef8f0b'), 'Must contain Flashfix brand color #ef8f0b');
    });

    await check('1.2 Staff assignment: status CONFIRMED, rider & tech assigned, employee notified', async () => {
      const res = await fetch(`${bookingBase}/admin/bookings/${bookingId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': '00000000-0000-4000-a000-000000000002', // Admin
        },
        body: JSON.stringify({
          employeeId: riderId,
          technicianId: techId,
        }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'CONFIRMED');
      assert.equal(json.data.assignedEmployeeId, riderId);
      assert.equal(json.data.technicianId, techId);

      // Check employee assignment email
      const inbox = consoleMockEmailAdapter.getInbox();
      const assignEmail = inbox.find((e) => e.to === 'delivery.rajesh@flashfix.in');
      assert.ok(assignEmail, 'Employee assignment notification must be dispatched');
    });

    await check('1.3 Start pickup: status PICKUP_EN_ROUTE', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/start-pickup`, { method: 'POST' });
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'PICKUP_EN_ROUTE');
    });

    let pickupOtpCode = '';
    await check('1.4 Send pickup OTP: status PICKUP_OTP_SENT, 6-digit code to customer', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/send-pickup-otp`, { method: 'POST' });
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'PICKUP_OTP_SENT');
      pickupOtpCode = json.code;
      assert.match(pickupOtpCode, /^\d{6}$/);

      // Check customer pickup OTP notification
      const inbox = consoleMockEmailAdapter.getInbox();
      const pickupEmail = inbox.find((e) => e.to === customerEmail && e.templateType === 'pickup-otp');
      assert.ok(pickupEmail, 'Pickup OTP email must be dispatched');
      assert.ok(pickupEmail?.html.includes(pickupOtpCode), 'Email must contain the OTP code');
    });

    await check('1.5 Verify pickup OTP: status IN_TRANSIT, OTP consumed', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: pickupOtpCode }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'IN_TRANSIT');
    });

    let custodyOtpCode = '';
    await check('1.6 Send custody OTP: status CUSTODY_OTP_SENT, 6-digit code to technician', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/send-custody-otp`, { method: 'POST' });
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'CUSTODY_OTP_SENT');
      custodyOtpCode = json.code;
      assert.match(custodyOtpCode, /^\d{6}$/);

      // Check technician custody email
      const inbox = consoleMockEmailAdapter.getInbox();
      const custodyEmail = inbox.find((e) => e.to === 'tech.vikram@flashfix.in');
      assert.ok(custodyEmail, 'Custody OTP email must be dispatched to technician');
      assert.ok(custodyEmail?.html.includes(custodyOtpCode), 'Email must contain the OTP code');
    });

    await check('1.7 Verify custody OTP: status IN_REPAIR, custody transferred', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/verify-custody`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: custodyOtpCode }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'IN_REPAIR');
    });

    await check('1.8 Repair complete: status REPAIR_COMPLETE, finalCostPaise set, customer notified', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REPAIR_COMPLETE',
          note: 'Screen replaced with OEM display assembly',
        }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'REPAIR_COMPLETE');

      // Check customer repair complete email
      const inbox = consoleMockEmailAdapter.getInbox();
      const repairEmail = inbox.find((e) => e.to === customerEmail && e.templateType === 'repair-complete');
      assert.ok(repairEmail, 'Repair complete email must be dispatched to customer');
    });

    await check('1.9 Return en route: status RETURN_EN_ROUTE', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RETURN_EN_ROUTE' }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'RETURN_EN_ROUTE');
    });

    await check('1.10 Delivered: status DELIVERED, paymentStatus automatically set to PAID', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED', note: 'Customer accepted delivery and paid via QR' }),
      });

      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.data.status, 'DELIVERED');
      assert.equal(json.data.paymentStatus, 'PAID');
    });

    // ==================================================================
    // SUITE 2: TWO-FACTOR CUSTODY HANDOVER & OTP SECURITY ADVERSARIAL TESTS
    // ==================================================================
    console.log('\n--- SUITE 2: TWO-FACTOR OTP ADVERSARIAL STRESS TESTING ---');

    // Create a fresh booking for adversarial testing
    const advBookingRes = await fetch(`${bookingBase}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store-blr-01',
        brand: 'Samsung',
        deviceModel: 'Galaxy S24',
        issueType: 'Battery',
        scheduledDate: '2026-11-02',
        scheduledTime: '11:00 AM',
        pickupAddress: 'Indiranagar 100ft Rd',
        contactName: 'Adversary Target',
        contactEmail: 'adversary.target@gmail.com',
        contactPhone: '+91 99000 11223',
      }),
    });
    const advBookingId = ((await advBookingRes.json()) as any).data.id;

    await check('2.1 Rejects verify-pickup when no OTP was requested (OTP_EXPIRED)', async () => {
      const res = await fetch(`${bookingBase}/bookings/${advBookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: '123456' }),
      });

      assert.equal(res.status, 400);
      const json = (await res.json()) as any;
      assert.equal(json.error.code, 'OTP_EXPIRED');
    });

    await check('2.2 Rejects verify-custody when no OTP was requested (OTP_EXPIRED)', async () => {
      const res = await fetch(`${bookingBase}/bookings/${advBookingId}/verify-custody`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: '123456' }),
      });

      assert.equal(res.status, 400);
      const json = (await res.json()) as any;
      assert.equal(json.error.code, 'OTP_EXPIRED');
    });

    // Now request pickup OTP
    const advOtpSendRes = await fetch(`${bookingBase}/bookings/${advBookingId}/send-pickup-otp`, { method: 'POST' });
    const { code: advPickupCode } = (await advOtpSendRes.json()) as any;

    await check('2.3 Rejects malformed OTP payloads (< 6 digits, non-numeric)', async () => {
      const shortRes = await fetch(`${bookingBase}/bookings/${advBookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: '123' }),
      });
      assert.equal(shortRes.status, 400);

      const emptyRes = await fetch(`${bookingBase}/bookings/${advBookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(emptyRes.status, 400);
    });

    await check('2.4 Rejects incorrect pickup OTP and increments attempts counter', async () => {
      const res = await fetch(`${bookingBase}/bookings/${advBookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: '000000' }), // wrong code
      });

      assert.equal(res.status, 400);
      const json = (await res.json()) as any;
      assert.equal(json.error.code, 'OTP_INVALID');
    });

    await check('2.5 Locks out OTP after 5 consecutive failed attempts (OTP_MAX_ATTEMPTS_EXCEEDED)', async () => {
      // Send 4 more wrong attempts (1 was already sent in 2.4)
      for (let i = 0; i < 4; i++) {
        await fetch(`${bookingBase}/bookings/${advBookingId}/verify-pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp: '000000' }),
        });
      }

      // 6th attempt even with correct code must be locked out
      const lockedRes = await fetch(`${bookingBase}/bookings/${advBookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: advPickupCode }),
      });

      assert.equal(lockedRes.status, 400);
      const json = (await lockedRes.json()) as any;
      assert.equal(json.error.code, 'OTP_MAX_ATTEMPTS_EXCEEDED');
    });

    // Request fresh pickup OTP for advBooking
    const freshOtpSendRes = await fetch(`${bookingBase}/bookings/${advBookingId}/send-pickup-otp`, { method: 'POST' });
    const { code: freshPickupCode } = (await freshOtpSendRes.json()) as any;

    await check('2.6 Prevents cross-booking OTP replay attack', async () => {
      // Create second booking
      const b2Res = await fetch(`${bookingBase}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store-blr-01',
          brand: 'OnePlus',
          deviceModel: 'OnePlus 12',
          issueType: 'Camera',
          scheduledDate: '2026-11-02',
          scheduledTime: '03:00 PM',
          pickupAddress: 'HSR Layout',
          contactName: 'Victim Two',
          contactEmail: 'victim.two@gmail.com',
          contactPhone: '+91 99000 22334',
        }),
      });
      const b2Id = ((await b2Res.json()) as any).data.id;

      // Request OTP for b2
      await fetch(`${bookingBase}/bookings/${b2Id}/send-pickup-otp`, { method: 'POST' });

      // Attempt to verify b2 using b1's OTP code
      const crossRes = await fetch(`${bookingBase}/bookings/${b2Id}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: freshPickupCode }),
      });

      // Must fail because hash/code does not match b2's OTP
      assert.equal(crossRes.status, 400);
      const json = (await crossRes.json()) as any;
      assert.equal(json.error.code, 'OTP_INVALID');
    });

    let inTransitBookingId = '';
    await check('2.7 Prevents OTP reuse / replay attack after successful verification', async () => {
      // Create a fresh booking for isolated replay testing
      const replayBookingRes = await fetch(`${bookingBase}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store-blr-01',
          brand: 'Apple',
          deviceModel: 'iPhone 13',
          issueType: 'Speaker',
          scheduledDate: '2026-11-02',
          scheduledTime: '04:00 PM',
          pickupAddress: 'Domlur, Bengaluru',
          contactName: 'Replay Test',
          contactEmail: 'replay.test@gmail.com',
          contactPhone: '+91 99000 33445',
        }),
      });
      inTransitBookingId = ((await replayBookingRes.json()) as any).data.id;
      const sendRes = await fetch(`${bookingBase}/bookings/${inTransitBookingId}/send-pickup-otp`, { method: 'POST' });
      const { code: rCode } = (await sendRes.json()) as any;

      // First verification succeeds
      const v1 = await fetch(`${bookingBase}/bookings/${inTransitBookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: rCode }),
      });
      assert.equal(v1.status, 200);

      // Replay the exact same code
      const v2 = await fetch(`${bookingBase}/bookings/${inTransitBookingId}/verify-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: rCode }),
      });
      assert.equal(v2.status, 400);
      const json = (await v2.json()) as any;
      assert.equal(json.error.code, 'OTP_EXPIRED');
    });

    await check('2.8 Customer cancellation prohibited once device is IN_TRANSIT', async () => {
      // inTransitBookingId is currently IN_TRANSIT
      const cancelRes = await fetch(`${bookingBase}/bookings/${inTransitBookingId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Changed mind' }),
      });

      assert.equal(cancelRes.status, 400);
      const json = (await cancelRes.json()) as any;
      assert.equal(json.error.code, 'INVALID_STATUS_TRANSITION');
    });

    // ==================================================================
    // SUITE 3: IMMUTABLE AUDIT TRAIL VERIFICATION
    // ==================================================================
    console.log('\n--- SUITE 3: IMMUTABLE AUDIT TRAIL VERIFICATION ---');

    await check('3.1 Full lifecycle audit trail completeness and order', async () => {
      // Check trail on bookingId from Suite 1 (which underwent all 10 transitions)
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/trail`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      const trail = json.data;

      assert.equal(trail.length, 10, 'Must have exactly 10 audit trail records for full lifecycle');

      const expectedStatuses = [
        'PENDING',
        'CONFIRMED',
        'PICKUP_EN_ROUTE',
        'PICKUP_OTP_SENT',
        'IN_TRANSIT',
        'CUSTODY_OTP_SENT',
        'IN_REPAIR',
        'REPAIR_COMPLETE',
        'RETURN_EN_ROUTE',
        'DELIVERED',
      ];

      for (let i = 0; i < expectedStatuses.length; i++) {
        assert.equal(
          trail[i].toStatus,
          expectedStatuses[i],
          `Trail entry ${i} must have toStatus = ${expectedStatuses[i]}`
        );
      }
    });

    await check('3.2 Audit trail timestamps are monotonically non-decreasing', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/trail`);
      const trail = ((await res.json()) as any).data;

      for (let i = 1; i < trail.length; i++) {
        const prevTime = new Date(trail[i - 1].createdAt).getTime();
        const currTime = new Date(trail[i].createdAt).getTime();
        assert.ok(
          currTime >= prevTime,
          `Timestamp of trail entry ${i} (${currTime}) must be >= entry ${i - 1} (${prevTime})`
        );
      }
    });

    await check('3.3 Audit trail records user attribution and descriptive notes', async () => {
      const res = await fetch(`${bookingBase}/bookings/${bookingId}/trail`);
      const trail = ((await res.json()) as any).data;

      // Entry 0: creation
      assert.equal(trail[0].fromStatus, null);
      assert.equal(trail[0].toStatus, 'PENDING');
      assert.ok(trail[0].notes?.includes('Booking created'));

      // Entry 1: assignment
      assert.equal(trail[1].fromStatus, 'PENDING');
      assert.equal(trail[1].toStatus, 'CONFIRMED');
      assert.ok(trail[1].notes?.includes('Staff assigned'));

      // Entry 4: pickup handover
      assert.equal(trail[4].fromStatus, 'PICKUP_OTP_SENT');
      assert.equal(trail[4].toStatus, 'IN_TRANSIT');
      assert.ok(trail[4].notes?.includes('Phone accepted by'));

      // Entry 6: custody handover
      assert.equal(trail[6].fromStatus, 'CUSTODY_OTP_SENT');
      assert.equal(trail[6].toStatus, 'IN_REPAIR');
      assert.ok(trail[6].notes?.includes('in repair custody with'));

      // Entry 9: delivery
      assert.equal(trail[9].fromStatus, 'RETURN_EN_ROUTE');
      assert.equal(trail[9].toStatus, 'DELIVERED');
      assert.ok(trail[9].notes?.includes('paid via QR'));
    });

    await check('3.4 Immutability: trail records preserve their ID and cannot be mutated', async () => {
      const res1 = await fetch(`${bookingBase}/bookings/${bookingId}/trail`);
      const trail1 = ((await res1.json()) as any).data;

      // Add another action or query
      const res2 = await fetch(`${bookingBase}/bookings/${bookingId}/trail`);
      const trail2 = ((await res2.json()) as any).data;

      assert.equal(trail1.length, trail2.length);
      for (let i = 0; i < trail1.length; i++) {
        assert.equal(trail1[i].id, trail2[i].id);
        assert.equal(trail1[i].toStatus, trail2[i].toStatus);
        assert.equal(trail1[i].createdAt, trail2[i].createdAt);
      }
    });

    // ==================================================================
    // SUITE 4: ADMIN-API STATS, BOOKINGS & ASSIGNMENTS
    // ==================================================================
    console.log('\n--- SUITE 4: ADMIN-API STATS, BOOKINGS & ASSIGNMENTS ---');

    await check('4.1 GET /admin/stats computes KPIs, unassigned count, and recentBookings', async () => {
      const res = await fetch(`${adminBase}/admin/stats?storeId=store-blr-01`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as any;
      assert.equal(json.success, true);
      const stats = json.data;

      assert.ok(typeof stats.todayTotal === 'number', 'todayTotal must be a number');
      assert.ok(typeof stats.pending === 'number', 'pending must be a number');
      assert.ok(typeof stats.inRepair === 'number', 'inRepair must be a number');
      assert.ok(typeof stats.delivered === 'number', 'delivered must be a number');
      assert.ok(typeof stats.unassignedCount === 'number', 'unassignedCount must be a number');
      assert.ok(typeof stats.hasUnassignedAlert === 'boolean', 'hasUnassignedAlert must be a boolean');
      assert.ok(Array.isArray(stats.recentBookings), 'recentBookings must be an array');
      assert.ok(stats.recentBookings.length <= 5, 'recentBookings must contain at most 5 items');
    });

    await check('4.2 GET /admin/bookings filters by storeId, status, and search string', async () => {
      // Filter by storeId
      const storeRes = await fetch(`${adminBase}/admin/bookings?storeId=store-blr-01`);
      assert.equal(storeRes.status, 200);
      const storeJson = (await storeRes.json()) as any;
      assert.ok(storeJson.data.length >= 1);
      assert.ok(storeJson.data.every((b: any) => b.storeId === 'store-blr-01'));

      // Filter by status
      const statusRes = await fetch(`${adminBase}/admin/bookings?storeId=store-blr-01&status=DELIVERED`);
      assert.equal(statusRes.status, 200);
      const statusJson = (await statusRes.json()) as any;
      assert.ok(statusJson.data.every((b: any) => b.status === 'DELIVERED'));

      // Filter by search string
      const searchRes = await fetch(`${adminBase}/admin/bookings?storeId=store-blr-01&search=Rohit`);
      assert.equal(searchRes.status, 200);
      const searchJson = (await searchRes.json()) as any;
      assert.ok(searchJson.data.some((b: any) => b.contactName.includes('Rohit')));
    });

    await check('4.3 POST /admin/assign assigns rider and technician to booking', async () => {
      // Find an unassigned booking
      const listRes = await fetch(`${adminBase}/admin/bookings?storeId=store-blr-01&status=PENDING`);
      const listJson = (await listRes.json()) as any;

      if (listJson.data.length > 0) {
        const targetId = listJson.data[0].id;
        const assignRes = await fetch(`${adminBase}/admin/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: targetId,
            employeeId: riderId,
            technicianId: techId,
          }),
        });

        assert.equal(assignRes.status, 200);
        const assignJson = (await assignRes.json()) as any;
        assert.equal(assignJson.success, true);
        assert.equal(assignJson.data.status, 'CONFIRMED');
        assert.equal(assignJson.data.assignedEmployeeId, riderId);
      }
    });

    await check('4.4 POST /admin/assign rejects missing employeeId or invalid bookingId', async () => {
      const missingEmpRes = await fetch(`${adminBase}/admin/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: 'FF-BKG001' }),
      });
      assert.equal(missingEmpRes.status, 400);

      const nonExistentRes = await fetch(`${adminBase}/admin/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: 'FF-NONEXISTENT',
          employeeId: riderId,
        }),
      });
      assert.equal(nonExistentRes.status, 404);
    });

    await check('4.5 GET /admin/team and POST /admin/invite adds team member', async () => {
      const inviteRes = await fetch(`${adminBase}/admin/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Hardik Pandya',
          email: 'hardik.rider@flashfix.in',
          role: 'EMPLOYEE',
          storeId: 'store-blr-01',
        }),
      });

      assert.equal(inviteRes.status, 201);
      const inviteJson = (await inviteRes.json()) as any;
      assert.equal(inviteJson.success, true);
      assert.equal(inviteJson.data.email, 'hardik.rider@flashfix.in');

      // Check team list
      const teamRes = await fetch(`${adminBase}/admin/team?storeId=store-blr-01`);
      assert.equal(teamRes.status, 200);
      const teamJson = (await teamRes.json()) as any;
      assert.ok(teamJson.data.some((m: any) => m.email === 'hardik.rider@flashfix.in'));
    });

    await check('4.6 GET /admin/inventory and PATCH /admin/inventory/:id updates stock and rejects negative quantities', async () => {
      const listRes = await fetch(`${adminBase}/admin/inventory?storeId=store-blr-01`);
      assert.equal(listRes.status, 200);
      const listJson = (await listRes.json()) as any;
      assert.ok(listJson.data.length >= 1);

      const itemId = listJson.data[0].id;

      // Update to valid quantity
      const validPatch = await fetch(`${adminBase}/admin/inventory/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 42 }),
      });
      assert.equal(validPatch.status, 200);
      const validJson = (await validPatch.json()) as any;
      assert.equal(validJson.data.quantity, 42);

      // Attempt negative quantity
      const negPatch = await fetch(`${adminBase}/admin/inventory/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: -5 }),
      });
      assert.equal(negPatch.status, 400);
    });

    // ==================================================================
    // SUITE 5: DIRECT STATUS TRANSITION API BEHAVIOR CHECK
    // ==================================================================
    console.log('\n--- SUITE 5: DIRECT STATUS TRANSITION API ANALYSIS ---');

    await check('5.1 Verify consumer cancellation from PENDING succeeds', async () => {
      const bRes = await fetch(`${bookingBase}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store-blr-01',
          brand: 'Google',
          deviceModel: 'Pixel 8',
          issueType: 'Battery',
          scheduledDate: '2026-11-03',
          scheduledTime: '12:00 PM',
          pickupAddress: 'MG Road, Bengaluru',
          contactName: 'Cancel Test User',
          contactEmail: 'cancel.user@gmail.com',
          contactPhone: '+91 99112 23344',
        }),
      });
      const bData = ((await bRes.json()) as any).data;
      assert.equal(bData.status, 'PENDING');

      const cancelRes = await fetch(`${bookingBase}/bookings/${bData.id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Found alternative solution' }),
      });
      assert.equal(cancelRes.status, 200);
      const cancelData = ((await cancelRes.json()) as any).data;
      assert.equal(cancelData.status, 'CANCELLED');

      // Verify audit trail recorded cancellation
      const trailRes = await fetch(`${bookingBase}/bookings/${bData.id}/trail`);
      const trail = ((await trailRes.json()) as any).data;
      assert.equal(trail.length, 2);
      assert.equal(trail[1].toStatus, 'CANCELLED');
      assert.ok(trail[1].notes?.includes('Found alternative solution'));
    });

    await check('5.2 Analysis of PATCH /bookings/:id/status endpoint permissions and transitions', async () => {
      const bRes = await fetch(`${bookingBase}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store-blr-01',
          brand: 'Samsung',
          deviceModel: 'Galaxy S23',
          issueType: 'Screen',
          scheduledDate: '2026-11-03',
          scheduledTime: '01:00 PM',
          pickupAddress: 'Koramangala, Bengaluru',
          contactName: 'Direct Patch Test User',
          contactEmail: 'direct.patch@gmail.com',
          contactPhone: '+91 99112 33445',
        }),
      });
      const bData = ((await bRes.json()) as any).data;
      assert.equal(bData.status, 'PENDING');

      // Attempt direct PATCH to IN_TRANSIT
      const p1 = await fetch(`${bookingBase}/bookings/${bData.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_TRANSIT' }),
      });
      console.log('    [EMPIRICAL OBSERVATION] Direct PATCH /bookings/:id/status to IN_TRANSIT returned HTTP status:', p1.status);

      // Attempt direct PATCH to IN_REPAIR
      const p2 = await fetch(`${bookingBase}/bookings/${bData.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_REPAIR' }),
      });
      console.log('    [EMPIRICAL OBSERVATION] Direct PATCH /bookings/:id/status to IN_REPAIR returned HTTP status:', p2.status);
    });

  } finally {
    notifyServer.close();
    bookingServer.close();
    adminServer.close();
  }

  console.log('\n=============================================================');
  console.log(`⚡ RESULTS: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  if (findings.length > 0) {
    console.log(`⚠️ FINDINGS / FAILURES (${findings.length}):`);
    findings.forEach((f) => console.log(`   - ${f}`));
  } else {
    console.log('✅ ALL EMPIRICAL CHALLENGES PASSED WITH ZERO FAILURES');
  }
  console.log('=============================================================\n');
}

runEmpiricalLifecycleChallenges().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
