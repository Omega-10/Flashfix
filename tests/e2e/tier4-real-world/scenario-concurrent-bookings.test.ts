import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue
} from '../../mocks/index.ts';

test.describe('Tier 4: Real-World Scenarios - Concurrent Bookings & Audit Isolation', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-SCENARIO-04: Multiple simultaneous bookings across different hubs maintain strict data isolation', () => {
    // -------------------------------------------------------------
    // Simultaneous Booking Creation
    // -------------------------------------------------------------
    const bookingKoramangala = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issue: 'Screen Replacement',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Customer Koramangala',
      contactEmail: 'cust.kora@gmail.com',
      contactPhone: '+91 99001 11111',
      estimatedCostPaise: 1850000
    });

    const bookingIndiranagar = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S25 Ultra',
      issue: 'Back Glass',
      storeId: 'store-blr-02',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:30 AM',
      contactName: 'Customer Indiranagar',
      contactEmail: 'cust.indi@gmail.com',
      contactPhone: '+91 99002 22222',
      estimatedCostPaise: 850000
    });

    const bookingHSR = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 9',
      issue: 'Battery Replacement',
      storeId: 'store-blr-04',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'Customer HSR',
      contactEmail: 'cust.hsr@gmail.com',
      contactPhone: '+91 99003 33333',
      estimatedCostPaise: 380000
    });

    // 1. Verify IDs are unique and distinct
    const ids = [bookingKoramangala.id, bookingIndiranagar.id, bookingHSR.id];
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 3);

    // 2. Parallel Staff Assignments
    service.assignStaff(bookingKoramangala.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.assignStaff(bookingIndiranagar.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.assignStaff(bookingHSR.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');

    // 3. Parallel Pickup OTP Generations
    service.startPickupEnRoute(bookingKoramangala.id, 'user-delivery-vijay');
    const { code: otpKora } = service.sendPickupOtp(bookingKoramangala.id, 'user-delivery-vijay');

    service.startPickupEnRoute(bookingIndiranagar.id, 'user-delivery-vijay');
    const { code: otpIndi } = service.sendPickupOtp(bookingIndiranagar.id, 'user-delivery-vijay');

    // Cross-verification attempt must fail
    assert.throws(
      () => service.verifyPickupOtp(bookingKoramangala.id, 'user-delivery-vijay', otpIndi),
      /INVALID_OTP/
    );

    // Legitimate verification succeeds
    service.verifyPickupOtp(bookingKoramangala.id, 'user-delivery-vijay', otpKora);
    service.verifyPickupOtp(bookingIndiranagar.id, 'user-delivery-vijay', otpIndi);

    assert.equal(bookingKoramangala.status, 'IN_TRANSIT');
    assert.equal(bookingIndiranagar.status, 'IN_TRANSIT');
    assert.equal(bookingHSR.status, 'CONFIRMED'); // HSR remains at CONFIRMED

    // 4. Verify complete audit trail segregation
    const trailKora = mockDb.getBookingTrail(bookingKoramangala.id);
    const trailIndi = mockDb.getBookingTrail(bookingIndiranagar.id);
    const trailHSR = mockDb.getBookingTrail(bookingHSR.id);

    assert.equal(trailKora.length, 5);
    assert.equal(trailIndi.length, 5);
    assert.equal(trailHSR.length, 2);

    for (const t of trailKora) {
      assert.equal(t.bookingId, bookingKoramangala.id);
    }
    for (const t of trailIndi) {
      assert.equal(t.bookingId, bookingIndiranagar.id);
    }
    for (const t of trailHSR) {
      assert.equal(t.bookingId, bookingHSR.id);
    }
  });
});
