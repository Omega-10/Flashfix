import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService
} from '../../mocks/index.ts';

test.describe('Tier 2: Boundary & Corner Cases - Booking Transition Jumps & Illegal States', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    service = new DomainLogicService(mockDb);
  });

  test('TC-BOUND-TRANS-01: Prohibits illegal jump from PENDING directly to IN_REPAIR', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Skip Test',
      contactEmail: 'skip@gmail.com',
      contactPhone: '+91 99999 00000'
    });

    assert.equal(booking.status, 'PENDING');

    assert.throws(
      () => service.assertTransition(booking.status, 'IN_REPAIR'),
      /ILLEGAL_STATUS_TRANSITION.*Cannot jump from PENDING to IN_REPAIR/
    );
  });

  test('TC-BOUND-TRANS-02: Prohibits illegal jump from CONFIRMED directly to DELIVERED', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S24',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Direct Delivered',
      contactEmail: 'direct@gmail.com',
      contactPhone: '+91 99999 00000'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    assert.equal(booking.status, 'CONFIRMED');

    assert.throws(
      () => service.assertTransition(booking.status, 'DELIVERED'),
      /ILLEGAL_STATUS_TRANSITION.*Cannot jump from CONFIRMED to DELIVERED/
    );
  });

  test('TC-BOUND-TRANS-03: Prohibits illegal jump from IN_TRANSIT directly to DELIVERED without repair', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 9',
      issue: 'Charging',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Transit Skip',
      contactEmail: 'transit@gmail.com',
      contactPhone: '+91 99999 00000'
    });

    booking.status = 'IN_TRANSIT';

    assert.throws(
      () => service.assertTransition(booking.status, 'DELIVERED'),
      /ILLEGAL_STATUS_TRANSITION.*Cannot jump from IN_TRANSIT to DELIVERED/
    );
  });

  test('TC-BOUND-TRANS-04: Prohibits backward status regression from IN_REPAIR back to PENDING', () => {
    const booking = service.createBooking({
      brand: 'OnePlus',
      deviceModel: 'OnePlus 12',
      issue: 'Camera',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Back Regression',
      contactEmail: 'back@gmail.com',
      contactPhone: '+91 99999 00000'
    });

    booking.status = 'IN_REPAIR';

    assert.throws(
      () => service.assertTransition(booking.status, 'PENDING'),
      /ILLEGAL_STATUS_TRANSITION.*Cannot jump from IN_REPAIR to PENDING/
    );
  });

  test('TC-BOUND-TRANS-05: Prohibits customer cancellation once device is IN_TRANSIT or IN_REPAIR', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 16 Pro',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Cancel Test',
      contactEmail: 'cancel@gmail.com',
      contactPhone: '+91 99999 00000'
    });

    booking.status = 'IN_TRANSIT';
    mockDb.bookings.set(booking.id, booking);

    assert.throws(
      () => service.cancelBooking(booking.id, 'user-consumer', 'Changed my mind'),
      /CANNOT_CANCEL.*can only be cancelled from PENDING status/
    );
  });

  test('TC-BOUND-TRANS-06: Terminal status DELIVERED permits zero subsequent status transitions', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Terminal Test',
      contactEmail: 'terminal@gmail.com',
      contactPhone: '+91 99999 00000'
    });

    booking.status = 'DELIVERED';

    for (const target of ['PENDING', 'CONFIRMED', 'IN_REPAIR', 'CANCELLED'] as const) {
      assert.throws(
        () => service.assertTransition(booking.status, target),
        /ILLEGAL_STATUS_TRANSITION/
      );
    }
  });
});
