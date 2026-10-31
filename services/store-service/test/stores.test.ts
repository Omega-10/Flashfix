import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { inMemoryStoreRepo } from '../src/db/index.js';
import type { Server } from 'node:http';

test.describe('store-service integration tests', () => {
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
    inMemoryStoreRepo.reset();
  });

  test('GET /health returns status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'store-service');
  });

  test('GET /stores lists all active stores with numeric coordinates', async () => {
    const res = await fetch(`${baseUrl}/stores`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 5);

    for (const store of body.data) {
      assert.equal(typeof store.lat, 'number');
      assert.equal(typeof store.lng, 'number');
      assert.ok(!Number.isNaN(store.lat));
      assert.ok(!Number.isNaN(store.lng));
    }
  });

  test('GET /stores/nearby calculates Haversine distance and attaches ⚡ Flash badge (<=3km)', async () => {
    // Exact location in Koramangala 4th block near 80 Feet Road (lat: 12.9352, lng: 77.6245)
    const res = await fetch(`${baseUrl}/stores/nearby?lat=12.9352&lng=77.6245`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.success, true);

    const nearest = body.data[0];
    assert.equal(nearest.id, 'store-blr-01');
    assert.equal(nearest.name, 'Flashfix Koramangala Hub');
    assert.equal(nearest.distanceKm, 0);
    assert.equal(nearest.tier, 'flash');
    assert.equal(nearest.isFlashHero, true);
    assert.ok(nearest.estimatedPickupMinutes <= 25);
  });

  test('GET /stores/nearby assigns next-day tier for distance between 3km and 10km', async () => {
    // Location ~5.5km from Koramangala hub
    // e.g. HSR Layout sector 1: 12.9116, 77.6389
    const res = await fetch(`${baseUrl}/stores/nearby?lat=12.9116&lng=77.6389`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;

    const store = body.data.find((s: any) => s.id === 'store-blr-01');
    assert.ok(store);
    assert.ok(store.distanceKm > 2.0);
    // Closest store will be sorted first
    assert.ok(body.data[0].distanceKm <= body.data[1].distanceKm);
  });

  test('GET /stores/nearby assigns out-of-range for distance > 10km', async () => {
    // Distant coordinates (Hosur, > 35km away)
    const res = await fetch(`${baseUrl}/stores/nearby?lat=12.7409&lng=77.8253`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;

    for (const store of body.data) {
      assert.ok(store.distanceKm > 10.0);
      assert.equal(store.tier, 'out-of-range');
      assert.equal(store.isFlashHero, false);
      assert.equal(store.estimatedPickupMinutes, null);
    }
  });

  test('Handles string coordinates in database safely with parseFloat()', async () => {
    // Add store with string coordinates (like Postgres numeric column returns)
    await inMemoryStoreRepo.createStore({
      id: 'store-custom-str',
      name: 'Custom String Store',
      address: 'Test Address',
      city: 'Bengaluru',
      lat: '12.9360',
      lng: '77.6250',
      hours: '09:00 - 21:00',
      services: ['Screen Replacement'],
      rating: 4.5,
      reviewCount: 10,
      isActive: true,
    });

    const res = await fetch(`${baseUrl}/stores/nearby?lat=12.9352&lng=77.6245`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;

    const found = body.data.find((s: any) => s.id === 'store-custom-str');
    assert.ok(found);
    assert.equal(typeof found.lat, 'number');
    assert.equal(typeof found.lng, 'number');
    assert.equal(found.lat, 12.936);
    assert.equal(found.lng, 77.625);
    assert.equal(found.tier, 'flash');
    assert.equal(found.isFlashHero, true);
  });
});
