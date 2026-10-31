import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue,
  calculateHaversineDistanceKm,
  calculateStoreTier
} from '../../mocks/index.ts';

test.describe('Tier 3: Cross-Feature Combinations - Full Consumer Lifecycle Progression', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-CROSS-01: End-to-end consumer flow across all 9-11 steps with strict audit trail integrity', () => {
    // -------------------------------------------------------------
    // STEP 1: Consumer Authentication via Brevo OTP
    // -------------------------------------------------------------
    const consumerEmail = 'rohan.mehta@gmail.com';
    const otpRes = service.sendLoginOtp(consumerEmail);
    assert.equal(otpRes.success, true);
    assert.ok(otpRes.code);

    const authRes = service.verifyLoginOtp(consumerEmail, otpRes.code);
    assert.equal(authRes.success, true);
    assert.ok(authRes.accessToken);
    const consumerUser = authRes.user;
    assert.equal(consumerUser.email, consumerEmail);

    // -------------------------------------------------------------
    // STEP 2: Store Discovery & Flash Tier Calculation
    // -------------------------------------------------------------
    // Rohan is at Koramangala 5th Block (12.9340, 77.6200)
    const rohanLat = 12.934;
    const rohanLng = 77.62;

    const nearbyStores = Array.from(mockDb.stores.values()).map((store) => {
      const distanceKm = calculateHaversineDistanceKm(rohanLat, rohanLng, store.lat, store.lng);
      const tierInfo = calculateStoreTier(distanceKm);
      return { ...store, ...tierInfo };
    });
    nearbyStores.sort((a, b) => a.distanceKm - b.distanceKm);

    const closestStore = nearbyStores[0];
    assert.equal(closestStore.id, 'store-blr-01');
    assert.equal(closestStore.tier, 'flash');
    assert.equal(closestStore.isFlashHero, true);
    assert.equal(closestStore.estimatedPickupMinutes, 20);

    // -------------------------------------------------------------
    // STEP 3: Consumer Creates Booking (Status -> PENDING)
    // -------------------------------------------------------------
    const booking = service.createBooking({
      userId: consumerUser.id,
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issue: 'Screen Replacement',
      issueNotes: 'Upper corner hairline fracture',
      storeId: closestStore.id,
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      pickupLat: rohanLat,
      pickupLng: rohanLng,
      pickupAddress: 'House 42, 5th Cross, Koramangala 5th Block, Bengaluru',
      contactName: 'Rohan Mehta',
      contactEmail: consumerEmail,
      contactPhone: '+91 98200 45678',
      estimatedCostPaise: 1850000 // ₹18,500.00
    });

    assert.equal(booking.status, 'PENDING');
    assert.match(booking.id, /^FF-[A-Z0-9]{6}$/);

    // -------------------------------------------------------------
    // STEP 4: Store Admin Assigns Delivery Rider & Technician (Status -> CONFIRMED)
    // -------------------------------------------------------------
    const adminUser = mockDb.findUserByEmail('admin.koramangala@flashfix.in')!;
    const rider = mockDb.findUserByEmail('delivery.vijay@flashfix.in')!;
    const technician = mockDb.findUserByEmail('tech.rahul@flashfix.in')!;

    service.assignStaff(booking.id, adminUser.id, rider.id, technician.id);
    assert.equal(booking.status, 'CONFIRMED');
    assert.equal(booking.assignedEmployeeId, rider.id);
    assert.equal(booking.technicianId, technician.id);

    // -------------------------------------------------------------
    // STEP 5: Delivery Rider Dispatches En Route (Status -> PICKUP_EN_ROUTE)
    // -------------------------------------------------------------
    service.startPickupEnRoute(booking.id, rider.id);
    assert.equal(booking.status, 'PICKUP_EN_ROUTE');

    // -------------------------------------------------------------
    // STEP 6: Rider Reaches Doorstep, Dispatches Pickup OTP (Status -> PICKUP_OTP_SENT)
    // -------------------------------------------------------------
    const pickupOtpRes = service.sendPickupOtp(booking.id, rider.id);
    assert.equal(pickupOtpRes.success, true);
    assert.equal(booking.status, 'PICKUP_OTP_SENT');

    // -------------------------------------------------------------
    // STEP 7: Consumer Presents Pickup OTP to Rider (Status -> IN_TRANSIT)
    // -------------------------------------------------------------
    service.verifyPickupOtp(booking.id, rider.id, pickupOtpRes.code);
    assert.equal(booking.status, 'IN_TRANSIT');

    // -------------------------------------------------------------
    // STEP 8: Rider Arrives at Hub, Dispatches Custody OTP to Technician (Status -> CUSTODY_OTP_SENT)
    // -------------------------------------------------------------
    const custodyOtpRes = service.sendCustodyOtp(booking.id, rider.id);
    assert.equal(custodyOtpRes.success, true);
    assert.equal(booking.status, 'CUSTODY_OTP_SENT');

    // -------------------------------------------------------------
    // STEP 9: Technician Verifies Custody OTP (Status -> IN_REPAIR)
    // -------------------------------------------------------------
    service.verifyCustodyOtp(booking.id, technician.id, custodyOtpRes.code);
    assert.equal(booking.status, 'IN_REPAIR');

    // -------------------------------------------------------------
    // STEP 10: Technician Completes Repair (Status -> REPAIR_COMPLETE)
    // -------------------------------------------------------------
    service.completeRepair(booking.id, technician.id, 1850000);
    assert.equal(booking.status, 'REPAIR_COMPLETE');
    assert.equal(booking.finalCostPaise, 1850000);

    // -------------------------------------------------------------
    // STEP 11: Return Delivery En Route (Status -> RETURN_EN_ROUTE)
    // -------------------------------------------------------------
    service.startReturnEnRoute(booking.id, rider.id);
    assert.equal(booking.status, 'RETURN_EN_ROUTE');

    // -------------------------------------------------------------
    // STEP 12: Device Delivered & In-Person QR Payment Verified (Status -> DELIVERED)
    // -------------------------------------------------------------
    service.markDelivered(booking.id, rider.id, 'QR');
    assert.equal(booking.status, 'DELIVERED');
    assert.equal(booking.paymentStatus, 'PAID');
    assert.equal(booking.paymentMethod, 'QR');

    // -------------------------------------------------------------
    // STEP 13: Full Audit Trail Verification
    // -------------------------------------------------------------
    const trail = mockDb.getBookingTrail(booking.id);
    assert.equal(trail.length, 10);

    const expectedSequence = [
      'PENDING',
      'CONFIRMED',
      'PICKUP_EN_ROUTE',
      'PICKUP_OTP_SENT',
      'IN_TRANSIT',
      'CUSTODY_OTP_SENT',
      'IN_REPAIR',
      'REPAIR_COMPLETE',
      'RETURN_EN_ROUTE',
      'DELIVERED'
    ];
    assert.deepEqual(trail.map((t) => t.status), expectedSequence);

    // Actor checks on audit trail
    assert.equal(trail[0].changedByUserId, consumerUser.id);
    assert.equal(trail[1].changedByUserId, adminUser.id);
    assert.equal(trail[2].changedByUserId, rider.id);
    assert.equal(trail[3].changedByUserId, rider.id);
    assert.equal(trail[4].changedByUserId, rider.id);
    assert.equal(trail[5].changedByUserId, rider.id);
    assert.equal(trail[6].changedByUserId, technician.id);
    assert.equal(trail[7].changedByUserId, technician.id);
    assert.equal(trail[8].changedByUserId, rider.id);
    assert.equal(trail[9].changedByUserId, rider.id);

    // Monotonic timestamps
    for (let i = 1; i < trail.length; i++) {
      assert.ok(trail[i].createdAt.getTime() >= trail[i - 1].createdAt.getTime());
    }
  });
});
