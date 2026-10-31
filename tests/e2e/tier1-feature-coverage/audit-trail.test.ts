import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService
} from '../../mocks/index.ts';

test.describe('Tier 1: Feature Coverage - Immutable Booking Audit Trail', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    service = new DomainLogicService(mockDb);
  });

  test('TC-TRAIL-01: Creates initial audit trail entry upon booking creation', () => {
    const booking = service.createBooking({
      userId: 'user-consumer-anita',
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issue: 'Screen Replacement',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Anita Desai',
      contactEmail: 'consumer.anita@gmail.com',
      contactPhone: '+91 98800 12345'
    });

    const trail = mockDb.getBookingTrail(booking.id);
    assert.equal(trail.length, 1);
    assert.equal(trail[0].bookingId, booking.id);
    assert.equal(trail[0].status, 'PENDING');
    assert.equal(trail[0].changedByUserId, 'user-consumer-anita');
    assert.ok(trail[0].note?.includes('created by customer'));
  });

  test('TC-TRAIL-02: Appends immutable audit trail entries sequentially across multiple transitions', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S24',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'Kunal G',
      contactEmail: 'kunal.g@gmail.com',
      contactPhone: '+91 98800 22334'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    service.verifyPickupOtp(booking.id, 'user-delivery-vijay', code);

    const trail = mockDb.getBookingTrail(booking.id);
    assert.equal(trail.length, 5);

    const statuses = trail.map((t) => t.status);
    assert.deepEqual(statuses, [
      'PENDING',
      'CONFIRMED',
      'PICKUP_EN_ROUTE',
      'PICKUP_OTP_SENT',
      'IN_TRANSIT'
    ]);
  });

  test('TC-TRAIL-03: Captures distinct actor user IDs across admin, employee, and technician roles', () => {
    const booking = service.createBooking({
      userId: 'user-consumer-anita',
      brand: 'OnePlus',
      deviceModel: 'OnePlus 12',
      issue: 'Charging Port',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-03',
      scheduledTime: '01:00 PM',
      contactName: 'Anita Desai',
      contactEmail: 'consumer.anita@gmail.com',
      contactPhone: '+91 98800 12345'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');

    const trail = mockDb.getBookingTrail(booking.id);
    assert.equal(trail[0].changedByUserId, 'user-consumer-anita');
    assert.equal(trail[1].changedByUserId, 'user-admin-koramangala');
    assert.equal(trail[2].changedByUserId, 'user-delivery-vijay');
  });

  test('TC-TRAIL-04: Preserves notes and timestamps for repair completion and delivery', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 13',
      issue: 'Back Glass',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-04',
      scheduledTime: '02:00 PM',
      contactName: 'Vivek S',
      contactEmail: 'vivek.s@gmail.com',
      contactPhone: '+91 98800 44556'
    });

    booking.status = 'IN_REPAIR';
    booking.technicianId = 'user-tech-rahul';
    mockDb.bookings.set(booking.id, booking);

    service.completeRepair(booking.id, 'user-tech-rahul', 350000);
    service.startReturnEnRoute(booking.id, 'user-delivery-vijay');
    service.markDelivered(booking.id, 'user-delivery-vijay', 'ONLINE');

    const trail = mockDb.getBookingTrail(booking.id);
    const lastEntry = trail[trail.length - 1];
    assert.equal(lastEntry.status, 'DELIVERED');
    assert.ok(lastEntry.note?.includes('Payment: ONLINE'));
    assert.ok(lastEntry.createdAt instanceof Date);
  });

  test('TC-TRAIL-05: Returns audit trail sorted by chronological createdAt timestamp for /bookings/:id/trail', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 8',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-05',
      scheduledTime: '10:00 AM',
      contactName: 'Devika P',
      contactEmail: 'devika.p@gmail.com',
      contactPhone: '+91 98800 77889'
    });

    service.recordTrail(booking.id, 'CONFIRMED', 'admin', 'Step 1');
    service.recordTrail(booking.id, 'PICKUP_EN_ROUTE', 'rider', 'Step 2');

    const trail = mockDb.getBookingTrail(booking.id);
    for (let i = 1; i < trail.length; i++) {
      assert.ok(
        trail[i].createdAt.getTime() >= trail[i - 1].createdAt.getTime(),
        'Trail entries must be monotonically non-decreasing in time'
      );
    }
  });
});
