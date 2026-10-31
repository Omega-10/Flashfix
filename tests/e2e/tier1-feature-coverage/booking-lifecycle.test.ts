import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue
} from '../../mocks/index.ts';

test.describe('Tier 1: Feature Coverage - Booking Lifecycle & Queries', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-BOOK-01: Creates booking with valid FF-XXXXXX ID format and initial status PENDING', () => {
    const booking = service.createBooking({
      userId: 'user-consumer-anita',
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issue: 'Screen Replacement',
      issueNotes: 'Front glass shattered, touch still responsive',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      pickupLat: 12.934,
      pickupLng: 77.62,
      pickupAddress: 'Flat 101, Koramangala 4th Block, Bengaluru',
      contactName: 'Anita Desai',
      contactEmail: 'consumer.anita@gmail.com',
      contactPhone: '+91 98800 12345',
      estimatedCostPaise: 1850000 // 18,500.00 INR
    });

    assert.ok(booking.id.startsWith('FF-'));
    assert.equal(booking.id.length, 9); // 'FF-' (3) + 6 chars
    assert.match(booking.id, /^FF-[A-Z0-9]{6}$/);
    assert.equal(booking.status, 'PENDING');
    assert.equal(booking.estimatedCostPaise, 1850000);
    assert.equal(booking.brand, 'Apple');
    assert.equal(booking.deviceModel, 'iPhone 15 Pro');

    // Check confirmation notification dispatched with tracking link
    const notifs = mockNotificationQueue.getByRecipient('consumer.anita@gmail.com');
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].templateType, 'booking-confirmed');
    assert.equal(notifs[0].variables.bookingId, booking.id);
  });

  test('TC-BOOK-02: Queries single booking by ID and retrieves consumer bookings via /bookings/mine', () => {
    const booking1 = service.createBooking({
      userId: 'user-consumer-anita',
      brand: 'Samsung',
      deviceModel: 'Galaxy S24 Ultra',
      issue: 'Battery Replacement',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-03',
      scheduledTime: '02:00 PM',
      contactName: 'Anita Desai',
      contactEmail: 'consumer.anita@gmail.com',
      contactPhone: '+91 98800 12345',
      estimatedCostPaise: 450000
    });

    const booking2 = service.createBooking({
      userId: 'user-consumer-anita',
      brand: 'Google',
      deviceModel: 'Pixel 8 Pro',
      issue: 'Camera Repair',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-04',
      scheduledTime: '04:00 PM',
      contactName: 'Anita Desai',
      contactEmail: 'consumer.anita@gmail.com',
      contactPhone: '+91 98800 12345',
      estimatedCostPaise: 650000
    });

    // Query single booking
    const fetched = mockDb.bookings.get(booking1.id);
    assert.ok(fetched);
    assert.equal(fetched.deviceModel, 'Galaxy S24 Ultra');

    // Query consumer's bookings
    const mine = mockDb.getBookingsByUser('user-consumer-anita');
    assert.equal(mine.length, 2);
    assert.ok(mine.some((b) => b.id === booking1.id));
    assert.ok(mine.some((b) => b.id === booking2.id));
  });

  test('TC-BOOK-03: Admin assigns employee and technician, transitioning status to CONFIRMED', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 16 Pro Max',
      issue: 'Back Glass',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-05',
      scheduledTime: '10:00 AM',
      contactName: 'Ramesh Patel',
      contactEmail: 'ramesh.p@gmail.com',
      contactPhone: '+91 98765 43210'
    });

    const updated = service.assignStaff(
      booking.id,
      'user-admin-koramangala',
      'user-delivery-vijay',
      'user-tech-rahul'
    );

    assert.equal(updated.status, 'CONFIRMED');
    assert.equal(updated.assignedEmployeeId, 'user-delivery-vijay');
    assert.equal(updated.technicianId, 'user-tech-rahul');

    // Verify employee received assignment email
    const employee = mockDb.users.get('user-delivery-vijay');
    assert.ok(employee);
    const empNotifs = mockNotificationQueue.getByRecipient(employee.email);
    assert.equal(empNotifs.length, 1);
    assert.equal(empNotifs[0].templateType, 'employee-assigned');
  });

  test('TC-BOOK-04: Transitions from IN_REPAIR to REPAIR_COMPLETE with final cost update', () => {
    const booking = service.createBooking({
      brand: 'OnePlus',
      deviceModel: 'OnePlus 12',
      issue: 'Charging Port',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '12:00 PM',
      contactName: 'Sunil Rao',
      contactEmail: 'sunil.r@gmail.com',
      contactPhone: '+91 97700 11223'
    });

    // Advance to IN_REPAIR
    booking.status = 'IN_REPAIR';
    booking.technicianId = 'user-tech-rahul';
    mockDb.bookings.set(booking.id, booking);

    const completed = service.completeRepair(booking.id, 'user-tech-rahul', 280000); // 2,800 INR
    assert.equal(completed.status, 'REPAIR_COMPLETE');
    assert.equal(completed.finalCostPaise, 280000);

    // Verify consumer received repair complete email
    const notifs = mockNotificationQueue.getByRecipient('sunil.r@gmail.com');
    assert.ok(notifs.some((n) => n.templateType === 'repair-complete'));
  });

  test('TC-BOOK-05: Transitions from RETURN_EN_ROUTE to DELIVERED and marks payment completed', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 14',
      issue: 'Battery Replacement',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '01:00 PM',
      contactName: 'Geeta Nair',
      contactEmail: 'geeta.nair@gmail.com',
      contactPhone: '+91 98450 99887'
    });

    booking.status = 'RETURN_EN_ROUTE';
    mockDb.bookings.set(booking.id, booking);

    const delivered = service.markDelivered(booking.id, 'user-delivery-vijay', 'QR');
    assert.equal(delivered.status, 'DELIVERED');
    assert.equal(delivered.paymentMethod, 'QR');
    assert.equal(delivered.paymentStatus, 'PAID');
  });

  test('TC-BOOK-06: Allows consumer to cancel booking when status is PENDING and records cancellation reason', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 9',
      issue: 'Speaker',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-06',
      scheduledTime: '03:00 PM',
      contactName: 'Tarun M',
      contactEmail: 'tarun.m@gmail.com',
      contactPhone: '+91 97400 33445'
    });

    const cancelled = service.cancelBooking(booking.id, 'user-consumer-tarun', 'Customer changed plans');
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.notes, 'Customer changed plans');
  });
});
