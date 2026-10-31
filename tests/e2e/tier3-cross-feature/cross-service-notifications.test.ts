import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue
} from '../../mocks/index.ts';

test.describe('Tier 3: Cross-Feature Combinations - Inter-Service Notifications & Queue Synchronization', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-CROSS-NOTIF-01: Dispatches login OTP notification and checks #ef8f0b header styling', () => {
    const email = 'client@test.com';
    const { code } = service.sendLoginOtp(email);

    const notifs = mockNotificationQueue.getByRecipient(email);
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].templateType, 'otp-login');
    assert.equal(notifs[0].variables.code, code);
    assert.ok(notifs[0].bodyHtml.includes('#ef8f0b'));
    assert.ok(notifs[0].subject.includes(code!));
  });

  test('TC-CROSS-NOTIF-02: Dispatches booking confirmation email containing tracking code and link', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S25',
      issue: 'Water Damage',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Anil Rao',
      contactEmail: 'anil.rao@gmail.com',
      contactPhone: '+91 99000 12345'
    });

    const notifs = mockNotificationQueue.getByRecipient('anil.rao@gmail.com');
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].templateType, 'booking-confirmed');
    assert.equal(notifs[0].variables.bookingId, booking.id);
    assert.ok(notifs[0].bodyHtml.includes(`/flashfix/track/${booking.id}`));
  });

  test('TC-CROSS-NOTIF-03: Dispatches assignment notification to rider upon admin job assignment', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 9',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Kavita',
      contactEmail: 'kavita@gmail.com',
      contactPhone: '+91 99000 54321'
    });

    const rider = mockDb.findUserByEmail('delivery.vijay@flashfix.in')!;
    service.assignStaff(booking.id, 'user-admin-koramangala', rider.id, 'user-tech-rahul');

    const riderNotifs = mockNotificationQueue.getByRecipient(rider.email);
    assert.equal(riderNotifs.length, 1);
    assert.equal(riderNotifs[0].templateType, 'employee-assigned');
    assert.equal(riderNotifs[0].variables.bookingId, booking.id);
  });

  test('TC-CROSS-NOTIF-04: Dispatches doorstep pickup OTP to consumer with booking reference', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 14',
      issue: 'Screen',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Geeta',
      contactEmail: 'geeta@gmail.com',
      contactPhone: '+91 99000 11223'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');

    const notifs = mockNotificationQueue.getByRecipient('geeta@gmail.com');
    const pickupNotif = notifs.find((n) => n.templateType === 'pickup-otp');
    assert.ok(pickupNotif);
    assert.equal(pickupNotif.variables.code, code);
    assert.equal(pickupNotif.variables.bookingId, booking.id);
  });

  test('TC-CROSS-NOTIF-05: Dispatches custody OTP to assigned technician at service centre', () => {
    const booking = service.createBooking({
      brand: 'OnePlus',
      deviceModel: 'OnePlus 12',
      issue: 'Camera',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Manoj',
      contactEmail: 'manoj@gmail.com',
      contactPhone: '+91 99000 99887'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code: pickupCode } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pickupCode);

    const { code: custodyCode } = service.sendCustodyOtp(booking.id, 'user-delivery-vijay');

    const tech = mockDb.users.get('user-tech-rahul')!;
    const techNotifs = mockNotificationQueue.getByRecipient(tech.email);
    const custodyNotif = techNotifs.find((n) => n.templateType === 'custody-otp');
    assert.ok(custodyNotif);
    assert.equal(custodyNotif.variables.code, custodyCode);
    assert.equal(custodyNotif.variables.bookingId, booking.id);
  });

  test('TC-CROSS-NOTIF-06: Dispatches repair-complete notification to consumer upon fix completion', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15 Pro',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Priya',
      contactEmail: 'priya@gmail.com',
      contactPhone: '+91 99000 66554'
    });

    booking.status = 'IN_REPAIR';
    booking.technicianId = 'user-tech-rahul';
    mockDb.bookings.set(booking.id, booking);

    service.completeRepair(booking.id, 'user-tech-rahul', 420000);

    const notifs = mockNotificationQueue.getByRecipient('priya@gmail.com');
    const repairNotif = notifs.find((n) => n.templateType === 'repair-complete');
    assert.ok(repairNotif);
    assert.equal(repairNotif.variables.bookingId, booking.id);
  });
});
