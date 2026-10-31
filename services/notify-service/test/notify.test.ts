import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { consoleMockEmailAdapter } from '../src/adapters/mock.js';
import type { Server } from 'node:http';

test.describe('notify-service unit & integration tests', () => {
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
    consoleMockEmailAdapter.clear();
  });

  test('GET /health returns status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'notify-service');
  });

  test('POST /notify/otp-login dispatches email and stores in test inbox', async () => {
    const res = await fetch(`${baseUrl}/notify/otp-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', code: '482910' }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);

    const inbox = consoleMockEmailAdapter.getInbox();
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].to, 'user@example.com');
    assert.match(inbox[0].subject, /482910/);
    assert.match(inbox[0].html, /#ef8f0b/);
    assert.match(inbox[0].html, /482910/);
  });

  test('POST /notify/booking-confirmed dispatches tracking code with #ef8f0b', async () => {
    const res = await fetch(`${baseUrl}/notify/booking-confirmed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'consumer@example.com',
        bookingId: 'FF-884920',
        customerName: 'Pooja Hegde',
        deviceModel: 'iPhone 15 Pro',
        scheduledDate: '2026-11-01',
        scheduledTime: '10:00 AM',
        storeName: 'Flashfix Koramangala Hub',
      }),
    });

    assert.equal(res.status, 200);
    const inbox = consoleMockEmailAdapter.getInbox();
    assert.equal(inbox.length, 1);
    assert.match(inbox[0].subject, /FF-884920/);
    assert.match(inbox[0].html, /track\/FF-884920/);
    assert.match(inbox[0].html, /#ef8f0b/);
  });

  test('POST /notify/pickup-otp dispatches doorstep verification code', async () => {
    const res = await fetch(`${baseUrl}/notify/pickup-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'consumer@example.com',
        code: '334455',
        bookingId: 'FF-123456',
        employeeName: 'Rajesh Rider',
      }),
    });

    assert.equal(res.status, 200);
    const inbox = consoleMockEmailAdapter.getInbox();
    assert.equal(inbox.length, 1);
    assert.match(inbox[0].subject, /334455/);
    assert.match(inbox[0].html, /Rajesh Rider/);
  });

  test('POST /notify/custody-otp dispatches custody verification code', async () => {
    const res = await fetch(`${baseUrl}/notify/custody-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tech@example.com',
        code: '998877',
        bookingId: 'FF-123456',
        technicianName: 'Vikram Singh',
      }),
    });

    assert.equal(res.status, 200);
    const inbox = consoleMockEmailAdapter.getInbox();
    assert.equal(inbox.length, 1);
    assert.match(inbox[0].subject, /998877/);
    assert.match(inbox[0].html, /Vikram Singh/);
  });

  test('GET /notify/test-inbox and POST /notify/test-inbox/clear manage test queue', async () => {
    await fetch(`${baseUrl}/notify/otp-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', code: '111222' }),
    });

    const getRes = await fetch(`${baseUrl}/notify/test-inbox`);
    const getBody = (await getRes.json()) as any;
    assert.equal(getBody.data.length, 1);

    const clearRes = await fetch(`${baseUrl}/notify/test-inbox/clear`, { method: 'POST' });
    assert.equal(clearRes.status, 200);

    const getResAfter = await fetch(`${baseUrl}/notify/test-inbox`);
    const getBodyAfter = (await getResAfter.json()) as any;
    assert.equal(getBodyAfter.data.length, 0);
  });
});
