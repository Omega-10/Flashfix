import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockDb,
  DomainLogicService,
  mockNotificationQueue
} from '../../mocks/index.ts';

test.describe('Tier 1: Feature Coverage - Two-Factor Physical Handover OTPs', () => {
  let service: DomainLogicService;

  test.beforeEach(() => {
    mockDb.reset();
    mockNotificationQueue.clear();
    service = new DomainLogicService(mockDb);
  });

  test('TC-OTP-01: Dispatches doorstep pickup OTP to consumer, sets status PICKUP_OTP_SENT, and records OTP', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Water Damage',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Mohan Lal',
      contactEmail: 'mohan.lal@gmail.com',
      contactPhone: '+91 98800 55443'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');

    const result = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    assert.equal(result.success, true);
    assert.equal(result.code.length, 6);

    const updatedBooking = mockDb.bookings.get(booking.id);
    assert.equal(updatedBooking?.status, 'PICKUP_OTP_SENT');

    // Verify OTP in DB
    const storedOtp = mockDb.findActiveOtp('mohan.lal@gmail.com', 'PICKUP', booking.id);
    assert.ok(storedOtp);
    assert.equal(storedOtp.purpose, 'PICKUP');
    assert.equal(storedOtp.code, result.code);
    assert.equal(storedOtp.used, false);

    // Verify notification queue
    const notif = mockNotificationQueue.getLatestOtp('mohan.lal@gmail.com', 'pickup-otp');
    assert.equal(notif, result.code);
  });

  test('TC-OTP-02: Verifies doorstep pickup OTP and transitions booking status to IN_TRANSIT', () => {
    const booking = service.createBooking({
      brand: 'Apple',
      deviceModel: 'iPhone 15',
      issue: 'Battery',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Mohan Lal',
      contactEmail: 'mohan.lal@gmail.com',
      contactPhone: '+91 98800 55443'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');

    const inTransitBooking = service.verifyPickupOtp(booking.id, 'user-delivery-vijay', code);
    assert.equal(inTransitBooking.status, 'IN_TRANSIT');

    // Ensure OTP marked used
    const active = mockDb.findActiveOtp('mohan.lal@gmail.com', 'PICKUP', booking.id);
    assert.equal(active, undefined);
  });

  test('TC-OTP-03: Dispatches store custody OTP to technician when device reaches service hub', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S25',
      issue: 'Screen Replacement',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'Nisha Pillai',
      contactEmail: 'nisha.p@gmail.com',
      contactPhone: '+91 98800 66778'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code: pickupCode } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pickupCode);

    // Rider arrives at hub, triggers custody OTP to technician
    const custodyRes = service.sendCustodyOtp(booking.id, 'user-delivery-vijay');
    assert.equal(custodyRes.success, true);
    assert.equal(custodyRes.code.length, 6);

    const b = mockDb.bookings.get(booking.id);
    assert.equal(b?.status, 'CUSTODY_OTP_SENT');

    // Check technician notification
    const tech = mockDb.users.get('user-tech-rahul');
    assert.ok(tech);
    const techOtp = mockNotificationQueue.getLatestOtp(tech.email, 'custody-otp');
    assert.equal(techOtp, custodyRes.code);
  });

  test('TC-OTP-04: Technician verifies Custody OTP and transitions booking to IN_REPAIR', () => {
    const booking = service.createBooking({
      brand: 'Samsung',
      deviceModel: 'Galaxy S25',
      issue: 'Screen Replacement',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '11:00 AM',
      contactName: 'Nisha Pillai',
      contactEmail: 'nisha.p@gmail.com',
      contactPhone: '+91 98800 66778'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    const { code: pickupCode } = service.sendPickupOtp(booking.id, 'user-delivery-vijay');
    service.verifyPickupOtp(booking.id, 'user-delivery-vijay', pickupCode);
    const { code: custodyCode } = service.sendCustodyOtp(booking.id, 'user-delivery-vijay');

    const inRepairBooking = service.verifyCustodyOtp(booking.id, 'user-tech-rahul', custodyCode);
    assert.equal(inRepairBooking.status, 'IN_REPAIR');
  });

  test('TC-OTP-05: Rejects incorrect pickup code and increments attempts', () => {
    const booking = service.createBooking({
      brand: 'Google',
      deviceModel: 'Pixel 9 Pro',
      issue: 'Camera Repair',
      storeId: 'store-blr-01',
      scheduledDate: '2026-11-02',
      scheduledTime: '10:00 AM',
      contactName: 'Bhavna K',
      contactEmail: 'bhavna.k@gmail.com',
      contactPhone: '+91 98800 11990'
    });

    service.assignStaff(booking.id, 'user-admin-koramangala', 'user-delivery-vijay', 'user-tech-rahul');
    service.startPickupEnRoute(booking.id, 'user-delivery-vijay');
    service.sendPickupOtp(booking.id, 'user-delivery-vijay');

    assert.throws(
      () => service.verifyPickupOtp(booking.id, 'user-delivery-vijay', '111111'),
      /INVALID_OTP/
    );

    const otpInDb = mockDb.findActiveOtp('bhavna.k@gmail.com', 'PICKUP', booking.id);
    assert.ok(otpInDb);
    assert.equal(otpInDb.attempts, 1);
  });

  test('TC-OTP-06: Verifies Brevo notification templates render with #ef8f0b brand styling', () => {
    const email = 'brand.check@gmail.com';
    service.sendLoginOtp(email);

    const notifs = mockNotificationQueue.getByRecipient(email);
    assert.equal(notifs.length, 1);
    assert.ok(notifs[0].bodyHtml.includes('#ef8f0b'));
    assert.ok(notifs[0].bodyHtml.includes('FLASHFIX'));
  });
});
