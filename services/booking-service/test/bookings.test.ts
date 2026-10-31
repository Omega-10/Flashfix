import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { inMemoryBookingRepo } from '../src/db/index.js';
import type { Server } from 'node:http';

test.describe('booking-service integration tests', () => {
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
    inMemoryBookingRepo.reset();
  });

  test('TC-BOOK-01: Creates booking with valid FF-XXXXXX ID format and initial status PENDING', async () => {
    const res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store-blr-01',
        brand: 'Apple',
        deviceModel: 'iPhone 15 Pro Max',
        issueType: 'Screen Replacement',
        issueDescription: 'Cracked outer glass',
        scheduledDate: '2026-11-01',
        scheduledTime: '11:00 AM',
        pickupAddress: 'Prestige Acropolis, Koramangala, Bengaluru',
        pickupLat: 12.934,
        pickupLng: 77.623,
        contactName: 'Rohit Sharma',
        contactEmail: 'rohit.sharma@gmail.com',
        contactPhone: '+91 98800 11223',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.match(body.data.id, /^FF-[A-Z0-9]{6}$/);
    assert.equal(body.data.status, 'PENDING');

    // Audit trail should have initial entry
    const trailRes = await fetch(`${baseUrl}/bookings/${body.data.id}/trail`);
    const trailBody = (await trailRes.json()) as any;
    assert.equal(trailBody.success, true);
    assert.equal(trailBody.data.length, 1);
    assert.equal(trailBody.data[0].toStatus, 'PENDING');
  });

  test('TC-BOOK-02: Rejects booking creation with disposable email', async () => {
    const res = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store-blr-01',
        brand: 'Apple',
        deviceModel: 'iPhone 14',
        issueType: 'Battery Service',
        scheduledDate: '2026-11-01',
        scheduledTime: '11:00 AM',
        pickupAddress: '80 Feet Road, Bengaluru',
        contactName: 'Bad Actor',
        contactEmail: 'spammer@mailinator.com',
        contactPhone: '+91 98800 11223',
      }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.equal(body.error.code, 'DISPOSABLE_EMAIL_NOT_ALLOWED');
  });

  test('TC-BOOK-03: Full two-factor custody handover lifecycle and audit trail', async () => {
    // 1. Create booking
    const createRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store-blr-01',
        brand: 'Samsung',
        deviceModel: 'Galaxy S24 Ultra',
        issueType: 'Screen Replacement',
        scheduledDate: '2026-11-01',
        scheduledTime: '02:00 PM',
        pickupAddress: '4th Block, Koramangala',
        contactName: 'Sneha Patel',
        contactEmail: 'sneha.patel@gmail.com',
        contactPhone: '+91 98765 43210',
      }),
    });
    const bookingId = ((await createRes.json()) as any).data.id;

    // 2. Admin assign staff -> CONFIRMED
    const assignRes = await fetch(`${baseUrl}/admin/bookings/${bookingId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: '00000000-0000-4000-a000-000000000004', // Rajesh delivery
        technicianId: '00000000-0000-4000-a000-000000000005', // Vikram tech
      }),
    });
    assert.equal(assignRes.status, 200);
    assert.equal(((await assignRes.json()) as any).data.status, 'CONFIRMED');

    // 3. Start pickup -> PICKUP_EN_ROUTE
    const startPickupRes = await fetch(`${baseUrl}/bookings/${bookingId}/start-pickup`, { method: 'POST' });
    assert.equal(startPickupRes.status, 200);
    assert.equal(((await startPickupRes.json()) as any).data.status, 'PICKUP_EN_ROUTE');

    // 4. Send pickup OTP -> PICKUP_OTP_SENT
    const sendOtpRes = await fetch(`${baseUrl}/bookings/${bookingId}/send-pickup-otp`, { method: 'POST' });
    assert.equal(sendOtpRes.status, 200);
    const { code: pickupCode } = (await sendOtpRes.json()) as any;
    assert.ok(pickupCode);

    // 5. Verify pickup OTP -> IN_TRANSIT
    const verifyPickupRes = await fetch(`${baseUrl}/bookings/${bookingId}/verify-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: pickupCode }),
    });
    assert.equal(verifyPickupRes.status, 200);
    assert.equal(((await verifyPickupRes.json()) as any).data.status, 'IN_TRANSIT');

    // 6. Send custody OTP -> CUSTODY_OTP_SENT
    const sendCustodyRes = await fetch(`${baseUrl}/bookings/${bookingId}/send-custody-otp`, { method: 'POST' });
    assert.equal(sendCustodyRes.status, 200);
    const { code: custodyCode } = (await sendCustodyRes.json()) as any;
    assert.ok(custodyCode);

    // 7. Verify custody OTP -> IN_REPAIR
    const verifyCustodyRes = await fetch(`${baseUrl}/bookings/${bookingId}/verify-custody`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: custodyCode }),
    });
    assert.equal(verifyCustodyRes.status, 200);
    assert.equal(((await verifyCustodyRes.json()) as any).data.status, 'IN_REPAIR');

    // 8. Repair complete -> REPAIR_COMPLETE
    const completeRes = await fetch(`${baseUrl}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REPAIR_COMPLETE', finalCostPaise: 499900 }),
    });
    assert.equal(completeRes.status, 200);
    assert.equal(((await completeRes.json()) as any).data.status, 'REPAIR_COMPLETE');

    // 9. Return en route -> RETURN_EN_ROUTE
    const returnRes = await fetch(`${baseUrl}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RETURN_EN_ROUTE' }),
    });
    assert.equal(returnRes.status, 200);

    // 10. Delivered -> DELIVERED
    const deliverRes = await fetch(`${baseUrl}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    assert.equal(deliverRes.status, 200);
    const deliveredData = ((await deliverRes.json()) as any).data;
    assert.equal(deliveredData.status, 'DELIVERED');
    assert.equal(deliveredData.paymentStatus, 'PAID');

    // 11. Inspect Audit Trail
    const trailRes = await fetch(`${baseUrl}/bookings/${bookingId}/trail`);
    const trail = ((await trailRes.json()) as any).data;
    assert.ok(trail.length >= 8);
    const statuses = trail.map((t: any) => t.toStatus);
    assert.deepEqual(statuses, [
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
    ]);
  });

  test('TC-BOOK-04: Consumer can cancel booking when status is PENDING', async () => {
    const createRes = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store-blr-01',
        brand: 'OnePlus',
        deviceModel: 'OnePlus 12',
        issueType: 'Charging Port',
        scheduledDate: '2026-11-01',
        scheduledTime: '04:00 PM',
        pickupAddress: 'Indiranagar, Bengaluru',
        contactName: 'Kunal Sen',
        contactEmail: 'kunal.sen@gmail.com',
        contactPhone: '+91 99000 88776',
      }),
    });
    const bookingId = ((await createRes.json()) as any).data.id;

    const cancelRes = await fetch(`${baseUrl}/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Issue resolved itself' }),
    });
    assert.equal(cancelRes.status, 200);
    const body = (await cancelRes.json()) as any;
    assert.equal(body.data.status, 'CANCELLED');
  });
});
