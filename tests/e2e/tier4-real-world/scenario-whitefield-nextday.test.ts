import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue,
  calculateHaversineDistanceKm,
  calculateStoreTier
} from '../../mocks/index.ts';

test.describe('Tier 4: Real-World Scenarios - Next-Day Repair in Whitefield (>3km, <=10km)', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-SCENARIO-02: Whitefield customer (>3km) gets Next-Day repair window and completes full cycle', () => {
    // 1. Consumer in Brookefield (12.9650, 77.7100)
    // Whitefield store is at ITPL Main Rd (12.9698, 77.7499)
    const userLat = 12.965;
    const userLng = 77.71;

    const store = mockDb.stores.get('store-blr-03')!;
    const distanceKm = calculateHaversineDistanceKm(userLat, userLng, store.lat, store.lng);
    assert.ok(distanceKm > 3.0 && distanceKm <= 10.0, `Expected distance between 3 and 10 km, got ${distanceKm}km`);

    // 2. Verified tier classification
    const tier = calculateStoreTier(distanceKm);
    assert.equal(tier.tier, 'next-day');
    assert.equal(tier.isFlashHero, false);
    assert.equal(tier.estimatedPickupMinutes, 1440);

    // 3. User logs in
    const userEmail = 'kartik.whitefield@gmail.com';
    const { code: loginCode } = service.sendLoginOtp(userEmail);
    const auth = service.verifyLoginOtp(userEmail, loginCode!);

    // 4. Creates Next-Day booking for Galaxy S24 Ultra Battery Replacement
    const booking = service.createBooking({
      userId: auth.user.id,
      brand: 'Samsung',
      deviceModel: 'Galaxy S24 Ultra',
      issue: 'Battery Replacement',
      issueNotes: 'Battery drains rapidly under normal usage',
      storeId: store.id,
      scheduledDate: '2026-11-03',
      scheduledTime: '02:00 PM',
      pickupLat: userLat,
      pickupLng: userLng,
      pickupAddress: 'Villa 12, Prestige Boulevard, Brookefield, Bengaluru',
      contactName: 'Kartik V',
      contactEmail: userEmail,
      contactPhone: '+91 98451 22334',
      estimatedCostPaise: 450000 // ₹4,500.00
    });

    assert.equal(booking.status, 'PENDING');
    assert.equal(booking.storeId, 'store-blr-03');

    // 5. Staff assignment, pickup OTP, custody OTP, completion & delivery
    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code: pickupCode } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pickupCode);

    const { code: custodyCode } = service.sendCustodyOtp(booking.id, 'user-delivery-vijay');
    service.verifyCustodyOtp(booking.id, 'user-tech-rahul', custodyCode);

    service.completeRepair(booking.id, 'user-tech-rahul', 450000);
    service.startReturnEnRoute(booking.id, 'user-delivery-vijay');
    service.markDelivered(booking.id, 'user-delivery-vijay', 'ONLINE');

    assert.equal(booking.status, 'DELIVERED');
    assert.equal(booking.paymentStatus, 'PAID');
    assert.equal(booking.paymentMethod, 'ONLINE');

    // Confirm audit trail logged
    const trail = mockDb.getBookingTrail(booking.id);
    assert.equal(trail.length, 10);
  });
});
