import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  calculateHaversineDistanceKm,
  calculateStoreTier
} from '../../mocks/index.ts';

test.describe('Tier 1: Feature Coverage - Store Directory & Haversine Flash Badge', () => {
  test.beforeEach(() => {
    mockDb.reset();
  });

  test('TC-STORE-01: Contains 5 active Bengaluru stores with valid coordinates and services', () => {
    const stores = Array.from(mockDb.stores.values()).filter((s) => s.isActive);
    assert.equal(stores.length, 5);

    const storeIds = stores.map((s) => s.id);
    assert.ok(storeIds.includes('store-blr-01')); // Koramangala
    assert.ok(storeIds.includes('store-blr-02')); // Indiranagar
    assert.ok(storeIds.includes('store-blr-03')); // Whitefield
    assert.ok(storeIds.includes('store-blr-04')); // HSR Layout
    assert.ok(storeIds.includes('store-blr-05')); // Jayanagar

    for (const store of stores) {
      assert.ok(store.lat > 12.0 && store.lat < 14.0, `Store ${store.id} latitude out of Bengaluru range`);
      assert.ok(store.lng > 77.0 && store.lng < 78.5, `Store ${store.id} longitude out of Bengaluru range`);
      assert.ok(store.services.length >= 2, `Store ${store.id} must offer multiple services`);
      assert.ok(store.hours.includes('-'), `Store ${store.id} must define operational hours`);
    }
  });

  test('TC-STORE-02: Accurately calculates Haversine distance between Koramangala customer and Hub', () => {
    // Customer at Koramangala 5th Block (12.9340, 77.6200)
    // Store at Koramangala 4th Block (12.9352, 77.6245)
    const custLat = 12.934;
    const custLng = 77.62;
    const store = mockDb.stores.get('store-blr-01')!;

    const dist = calculateHaversineDistanceKm(custLat, custLng, store.lat, store.lng);
    assert.ok(dist >= 0.4 && dist <= 0.6, `Calculated distance ${dist} km outside expected ~0.5 km range`);
  });

  test('TC-STORE-03: Grants ⚡ Flash badge (tier: flash, isFlashHero: true, 20m ETA) for distance <= 3.0km', () => {
    const dist1 = 0.5;
    const dist2 = 2.99;
    const dist3 = 3.0;

    for (const d of [dist1, dist2, dist3]) {
      const tierResult = calculateStoreTier(d);
      assert.equal(tierResult.tier, 'flash', `Distance ${d} should be flash tier`);
      assert.equal(tierResult.isFlashHero, true);
      assert.equal(tierResult.estimatedPickupMinutes, 20);
    }
  });

  test('TC-STORE-04: Classifies distance between 3.01km and 10.0km as next-day tier without Flash badge', () => {
    const distances = [3.01, 5.5, 7.8, 10.0];

    for (const d of distances) {
      const tierResult = calculateStoreTier(d);
      assert.equal(tierResult.tier, 'next-day', `Distance ${d} should be next-day tier`);
      assert.equal(tierResult.isFlashHero, false);
      assert.equal(tierResult.estimatedPickupMinutes, 1440);
    }
  });

  test('TC-STORE-05: Classifies distance > 10.0km as out-of-range tier with null ETA', () => {
    const distances = [10.01, 15.0, 25.5, 50.0];

    for (const d of distances) {
      const tierResult = calculateStoreTier(d);
      assert.equal(tierResult.tier, 'out-of-range', `Distance ${d} should be out-of-range tier`);
      assert.equal(tierResult.isFlashHero, false);
      assert.equal(tierResult.estimatedPickupMinutes, null);
    }
  });

  test('TC-STORE-06: Queries and sorts nearby stores in ascending order of geographic distance', () => {
    // Customer near HSR Layout Sector 1 (12.9120, 77.6390)
    const userLat = 12.912;
    const userLng = 77.639;

    const enriched = Array.from(mockDb.stores.values()).map((store) => {
      const distanceKm = calculateHaversineDistanceKm(userLat, userLng, store.lat, store.lng);
      const tierInfo = calculateStoreTier(distanceKm);
      return {
        ...store,
        ...tierInfo
      };
    });

    enriched.sort((a, b) => a.distanceKm - b.distanceKm);

    // HSR Layout store should be closest (< 0.2 km)
    assert.equal(enriched[0].id, 'store-blr-04');
    assert.ok(enriched[0].distanceKm < 0.2);
    assert.equal(enriched[0].tier, 'flash');
    assert.equal(enriched[0].isFlashHero, true);

    // Verify monotonically increasing distance
    for (let i = 1; i < enriched.length; i++) {
      assert.ok(enriched[i].distanceKm >= enriched[i - 1].distanceKm);
    }
  });
});
