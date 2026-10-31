import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { inMemoryInventoryRepo } from '../src/db/index.js';
import type { Server } from 'node:http';

test.describe('inventory-service integration tests', () => {
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
    inMemoryInventoryRepo.reset();
  });

  test('GET /inventory returns parts list', async () => {
    const res = await fetch(`${baseUrl}/inventory?storeId=store-blr-01`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 2);
  });

  test('GET /inventory/:id returns single item', async () => {
    const res = await fetch(`${baseUrl}/inventory/inv-001`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.partName, 'OLED Display Panel');
  });

  test('POST /inventory creates new inventory part', async () => {
    const res = await fetch(`${baseUrl}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: 'store-blr-01',
        partName: 'Pixel 9 Pro Camera Module',
        sku: 'CAM-PX9P-01',
        compatibleWith: ['Pixel 9 Pro', 'Pixel 9 Pro XL'],
        quantity: 5,
        minThreshold: 2,
        unitCostPaise: 420000,
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.equal(body.data.partName, 'Pixel 9 Pro Camera Module');
    assert.equal(body.data.quantity, 5);
  });

  test('PATCH /inventory/:id/stock and POST /inventory/deduct manages stock', async () => {
    // Increase stock by +10
    const stockRes = await fetch(`${baseUrl}/inventory/inv-001/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: 10 }),
    });
    assert.equal(stockRes.status, 200);
    const stockBody = (await stockRes.json()) as any;
    assert.equal(stockBody.data.quantity, 22); // initial 12 + 10 = 22

    // Deduct 2 parts upon repair completion
    const deductRes = await fetch(`${baseUrl}/inventory/deduct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'inv-001', quantity: 2 }),
    });
    assert.equal(deductRes.status, 200);
    const deductBody = (await deductRes.json()) as any;
    assert.equal(deductBody.data.quantity, 20); // 22 - 2 = 20
  });
});
