import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_DATA } from '../db/seed.js';

describe('Seed Data Integrity', () => {
  it('should seed exactly 5 Bengaluru stores with matching IDs and coordinates', () => {
    assert.equal(SEED_DATA.stores.length, 5);
    const storeIds = SEED_DATA.stores.map((s) => s.id);
    assert.deepEqual(storeIds, ['store-001', 'store-002', 'store-003', 'store-004', 'store-005']);

    const koramangala = SEED_DATA.stores.find((s) => s.id === 'store-001')!;
    assert.equal(koramangala.city, 'Bengaluru');
    assert.equal(koramangala.lat, '12.935200');
    assert.equal(koramangala.lng, '77.624500');

    const indiranagar = SEED_DATA.stores.find((s) => s.id === 'store-002')!;
    assert.equal(indiranagar.lat, '12.978400');
    assert.equal(indiranagar.lng, '77.640800');
  });

  it('should seed 6 system users across all roles', () => {
    assert.equal(SEED_DATA.users.length, 6);
    const roles = SEED_DATA.users.map((u) => u.role);
    assert.ok(roles.includes('SUPER_ADMIN'));
    assert.ok(roles.includes('ADMIN'));
    assert.ok(roles.includes('EMPLOYEE'));
    assert.ok(roles.includes('CONSUMER'));
  });

  it('should seed bookings covering the repair lifecycle', () => {
    assert.equal(SEED_DATA.bookings.length, 6);
    const statuses = SEED_DATA.bookings.map((b) => b.status);
    assert.ok(statuses.includes('PENDING'));
    assert.ok(statuses.includes('CONFIRMED'));
    assert.ok(statuses.includes('IN_TRANSIT'));
    assert.ok(statuses.includes('IN_REPAIR'));
    assert.ok(statuses.includes('REPAIR_COMPLETE'));
    assert.ok(statuses.includes('DELIVERED'));
  });

  it('should store costs in paise (integers)', () => {
    for (const b of SEED_DATA.bookings) {
      if (b.estimatedCostPaise !== null) {
        assert.ok(Number.isInteger(b.estimatedCostPaise), `estimatedCostPaise must be integer: ${b.estimatedCostPaise}`);
      }
      if (b.finalCostPaise !== null) {
        assert.ok(Number.isInteger(b.finalCostPaise), `finalCostPaise must be integer: ${b.finalCostPaise}`);
      }
    }
  });

  it('should seed inventory items for phone repairs', () => {
    assert.ok(SEED_DATA.inventoryItems.length >= 5);
    const skus = SEED_DATA.inventoryItems.map((i) => i.sku);
    assert.ok(skus.includes('SKU-IP16PM-SCR'));
    assert.ok(skus.includes('SKU-S25U-BAT'));
  });
});
