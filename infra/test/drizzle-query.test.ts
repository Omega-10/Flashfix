import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  users,
  stores,
  savedAddresses,
  bookings,
  bookingTrail,
  otpCodes,
  inventoryItems,
} from '../db/schema.js';

describe('Drizzle ORM Query & Type Stress Harness', () => {
  it('should verify schema table types and column access', () => {
    // Check users
    assert.equal(users.id.name, 'id');
    assert.equal(users.email.name, 'email');
    assert.equal(users.role.name, 'role');
    assert.equal(users.storeId.name, 'store_id');

    // Check stores
    assert.equal(stores.id.name, 'id');
    assert.equal(stores.adminId.name, 'admin_id');
    assert.equal(stores.lat.name, 'lat');
    assert.equal(stores.lng.name, 'lng');

    // Check bookings
    assert.equal(bookings.id.name, 'id');
    assert.equal(bookings.estimatedCostPaise.name, 'estimated_cost_paise');
    assert.equal(bookings.finalCostPaise.name, 'final_cost_paise');
    assert.equal(bookings.storeId.name, 'store_id');
    assert.equal(bookings.status.name, 'status');

    // Check savedAddresses
    assert.equal(savedAddresses.userId.name, 'user_id');

    // Check bookingTrail
    assert.equal(bookingTrail.bookingId.name, 'booking_id');
    assert.equal(bookingTrail.toStatus.name, 'to_status');

    // Check otpCodes
    assert.equal(otpCodes.bookingId.name, 'booking_id');
    assert.equal(otpCodes.purpose.name, 'purpose');

    // Check inventoryItems
    assert.equal(inventoryItems.storeId.name, 'store_id');
    assert.equal(inventoryItems.unitCostPaise.name, 'unit_cost_paise');
  });

  it('should verify precision and scale on all numeric coordinates', () => {
    // numeric(9, 6)
    const storeLat = stores.lat as unknown as { precision: number; scale: number };
    const storeLng = stores.lng as unknown as { precision: number; scale: number };
    assert.equal(storeLat.precision, 9);
    assert.equal(storeLat.scale, 6);
    assert.equal(storeLng.precision, 9);
    assert.equal(storeLng.scale, 6);

    const addrLat = savedAddresses.lat as unknown as { precision: number; scale: number };
    const addrLng = savedAddresses.lng as unknown as { precision: number; scale: number };
    assert.equal(addrLat.precision, 9);
    assert.equal(addrLat.scale, 6);
    assert.equal(addrLng.precision, 9);
    assert.equal(addrLng.scale, 6);

    const bookingLat = bookings.pickupLat as unknown as { precision: number; scale: number };
    const bookingLng = bookings.pickupLng as unknown as { precision: number; scale: number };
    assert.equal(bookingLat.precision, 9);
    assert.equal(bookingLat.scale, 6);
    assert.equal(bookingLng.precision, 9);
    assert.equal(bookingLng.scale, 6);

    // stores rating: numeric(3, 2)
    const storeRating = stores.rating as unknown as { precision: number; scale: number };
    assert.equal(storeRating.precision, 3);
    assert.equal(storeRating.scale, 2);
  });
});
