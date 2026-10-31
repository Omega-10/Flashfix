import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { inMemoryAdminRepo } from '../src/db/index.js';
import type { Server } from 'node:http';

test.describe('admin-api integration tests', () => {
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
    inMemoryAdminRepo.reset();
  });

  test('GET /admin/stats computes dashboard KPI stats and raises unassigned alert', async () => {
    const res = await fetch(`${baseUrl}/admin/stats?storeId=store-blr-01`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);

    const stats = body.data;
    assert.ok(stats.todayTotal >= 1);
    assert.ok(stats.pending >= 1);
    assert.ok(stats.unassignedCount >= 1);
    assert.equal(stats.hasUnassignedAlert, true);
    assert.ok(Array.isArray(stats.recentBookings));
  });

  test('GET /admin/bookings filters store bookings by status and search', async () => {
    const res = await fetch(`${baseUrl}/admin/bookings?storeId=store-blr-01&status=PENDING`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 1);
    for (const b of body.data) {
      assert.equal(b.status, 'PENDING');
      assert.equal(b.storeId, 'store-blr-01');
    }
  });

  test('POST /admin/assign assigns rider and technician to unassigned booking', async () => {
    const res = await fetch(`${baseUrl}/admin/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: 'FF-BKG001',
        employeeId: '00000000-0000-4000-a000-000000000004',
        technicianId: '00000000-0000-4000-a000-000000000005',
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'CONFIRMED');
    assert.equal(body.data.assignedEmployeeId, '00000000-0000-4000-a000-000000000004');
  });

  test('POST /admin/invite invites new technician to store team', async () => {
    const res = await fetch(`${baseUrl}/admin/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Suresh Raina',
        email: 'suresh.tech@flashfix.in',
        role: 'EMPLOYEE',
        storeId: 'store-blr-01',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.email, 'suresh.tech@flashfix.in');

    const teamRes = await fetch(`${baseUrl}/admin/team?storeId=store-blr-01`);
    const teamBody = (await teamRes.json()) as any;
    assert.ok(teamBody.data.some((m: any) => m.email === 'suresh.tech@flashfix.in'));
  });

  test('GET /admin/inventory and PATCH /admin/inventory/:id updates stock', async () => {
    const listRes = await fetch(`${baseUrl}/admin/inventory?storeId=store-blr-01`);
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as any;
    assert.ok(listBody.data.length >= 1);

    const itemId = listBody.data[0].id;
    const patchRes = await fetch(`${baseUrl}/admin/inventory/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 25 }),
    });

    assert.equal(patchRes.status, 200);
    const patchBody = (await patchRes.json()) as any;
    assert.equal(patchBody.data.quantity, 25);
  });
});
