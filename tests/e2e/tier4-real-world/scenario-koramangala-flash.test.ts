import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue,
  calculateHaversineDistanceKm,
  calculateStoreTier
} from '../../mocks/index.ts';

test.describe('Tier 4: Real-World Scenarios - Flash Repair in Koramangala (<=3km, 20m window)', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-SCENARIO-01: Full Koramangala ⚡ Flash repair workflow with screen replacement', () => {
    // 1. Consumer in Koramangala opens app, allows location (12.9345, 77.6210)
    const userLat = 12.9345;
    const userLng = 77.621;

    // 2. Geo lookup detects nearest hub (store-blr-01: Koramangala Hub at 12.9352, 77.6245)
    const store = mockDb.stores.get('store-blr-01')!;
    const distanceKm = calculateHaversineDistanceKm(userLat, userLng, store.lat, store.lng);
    assert.ok(distanceKm < 1.0, `Expected distance < 1km, got ${distanceKm}km`);

    const tier = calculateStoreTier(distanceKm);
    assert.equal(tier.tier, 'flash');
    assert.equal(tier.isFlashHero, true);
    assert.equal(tier.estimatedPickupMinutes, 20);

    // 3. User authenticates via Brevo OTP
    const userEmail = 'aaditya.sharma@gmail.com';
    const { code: loginOtp } = service.sendLoginOtp(userEmail);
    assert.ok(loginOtp);
    const auth = service.verifyLoginOtp(userEmail, loginOtp);
    assert.ok(auth.accessToken);

    // 4. Creates Flash booking for iPhone 15 Pro Screen Replacement
    const booking = service.createBooking({
      userId: auth.user.id,
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issue: 'Screen Replacement',
      issueNotes: 'Cracked outer glass, touch functional',
      storeId: store.id,
      scheduledDate: '2026-11-01',
      scheduledTime: '11:00 AM',
      pickupLat: userLat,
      pickupLng: userLng,
      pickupAddress: 'Flat 301, Coral Heights, 4th Block, Koramangala, Bengaluru',
      contactName: 'Aaditya Sharma',
      contactEmail: userEmail,
      contactPhone: '+91 99801 23456',
      estimatedCostPaise: 1850000 // ₹18,500.00
    });
    assert.equal(booking.status, 'PENDING');

    // 5. Store admin assigns Vijay (Rider) and Rahul (Technician)
    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    assert.equal(booking.status, 'CONFIRMED');

    // 6. Rider rushes to location (< 20 mins)
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code: pickupOtp } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    assert.equal(booking.status, 'PICKUP_OTP_SENT');

    // 7. Doorstep handover verified via OTP
    service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pickupOtp);
    assert.equal(booking.status, 'IN_TRANSIT');

    // 8. Rider arrives at hub, transfers custody to technician Rahul
    const { code: custodyOtp } = service.sendCustodyOtp(booking.id, 'user-delivery-vijay');
    service.verifyCustodyOtp(booking.id, 'user-tech-rahul', custodyOtp);
    assert.equal(booking.status, 'IN_REPAIR');

    // 9. Technician consumes replacement screen part from inventory
    const part = mockDb.inventoryItems.get('inv-screen-ip15p')!;
    assert.equal(part.partSku, 'SKU-DISP-IP15P-OEM');
    const initialQty = part.quantity;
    part.quantity -= 1;
    mockDb.inventoryItems.set(part.id, part);
    assert.equal(mockDb.inventoryItems.get(part.id)?.quantity, initialQty - 1);

    // 10. Repair complete -> Return delivery -> Delivered with QR payment
    service.completeRepair(booking.id, 'user-tech-rahul', 1850000);
    assert.equal(booking.status, 'REPAIR_COMPLETE');

    service.startReturnEnRoute(booking.id, 'user-delivery-vijay');
    service.markDelivered(booking.id, 'user-delivery-vijay', 'QR');
    assert.equal(booking.status, 'DELIVERED');
    assert.equal(booking.paymentStatus, 'PAID');

    // 11. Verify complete timeline
    const trail = mockDb.getBookingTrail(booking.id);
    assert.equal(trail.length, 10);
    assert.equal(trail[trail.length - 1].status, 'DELIVERED');
  });
});
