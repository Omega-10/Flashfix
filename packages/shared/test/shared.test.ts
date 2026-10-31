import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_ROLES,
  BOOKING_STATUSES,
  OTP_PURPOSES,
  SERVICE_PORTS,
  GEO_CONSTANTS,
  AUTH_CONSTANTS,
  ERROR_CODES,
  DISPOSABLE_EMAIL_DOMAINS,
  isDisposableEmail,
  haversineKm,
  getRadiusTier,
  calculateEstimatedMinutes,
  UserSchema,
  StoreSchema,
  NearbyStoreSchema,
  BookingSchema,
  BookingTrailSchema,
  OtpCodeSchema,
  InventoryItemSchema,
  SavedAddressSchema,
  ApiResponseSchema,
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
  CreateBookingRequestSchema,
} from '../src/index.js';

describe('Shared Constants', () => {
  it('should define all 4 user roles', () => {
    assert.deepEqual(USER_ROLES, ['CONSUMER', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']);
  });

  it('should define all 11 booking statuses in correct order', () => {
    assert.equal(BOOKING_STATUSES.length, 11);
    assert.equal(BOOKING_STATUSES[0], 'PENDING');
    assert.equal(BOOKING_STATUSES[1], 'CONFIRMED');
    assert.equal(BOOKING_STATUSES[2], 'PICKUP_EN_ROUTE');
    assert.equal(BOOKING_STATUSES[3], 'PICKUP_OTP_SENT');
    assert.equal(BOOKING_STATUSES[4], 'IN_TRANSIT');
    assert.equal(BOOKING_STATUSES[5], 'CUSTODY_OTP_SENT');
    assert.equal(BOOKING_STATUSES[6], 'IN_REPAIR');
    assert.equal(BOOKING_STATUSES[7], 'REPAIR_COMPLETE');
    assert.equal(BOOKING_STATUSES[8], 'RETURN_EN_ROUTE');
    assert.equal(BOOKING_STATUSES[9], 'DELIVERED');
    assert.equal(BOOKING_STATUSES[10], 'CANCELLED');
  });

  it('should define all 3 OTP purposes', () => {
    assert.deepEqual(OTP_PURPOSES, ['LOGIN', 'PICKUP', 'CUSTODY']);
  });

  it('should define correct microservice ports', () => {
    assert.equal(SERVICE_PORTS.AUTH_SERVICE, 3001);
    assert.equal(SERVICE_PORTS.BOOKING_SERVICE, 3002);
    assert.equal(SERVICE_PORTS.NOTIFY_SERVICE, 3005);
    assert.equal(SERVICE_PORTS.STORE_SERVICE, 3006);
    assert.equal(SERVICE_PORTS.ADMIN_API, 3007);
    assert.equal(SERVICE_PORTS.INVENTORY_SERVICE, 3008);
    assert.equal(SERVICE_PORTS.WEB_CLIENT, 5173);
    assert.equal(SERVICE_PORTS.ADMIN_PANEL, 5174);
    assert.equal(SERVICE_PORTS.GATEWAY, 80);
  });

  it('should bundle 200+ disposable email domains', () => {
    assert.ok(DISPOSABLE_EMAIL_DOMAINS.size >= 200, `Expected >= 200 domains, got ${DISPOSABLE_EMAIL_DOMAINS.size}`);
    assert.ok(DISPOSABLE_EMAIL_DOMAINS.has('mailinator.com'));
    assert.ok(DISPOSABLE_EMAIL_DOMAINS.has('tempmail.com'));
    assert.ok(DISPOSABLE_EMAIL_DOMAINS.has('10minutemail.com'));
    assert.ok(DISPOSABLE_EMAIL_DOMAINS.has('guerrillamail.com'));
  });

  it('should accurately detect disposable emails including subdomains', () => {
    assert.equal(isDisposableEmail('test@mailinator.com'), true);
    assert.equal(isDisposableEmail('user@sub.mailinator.com'), true);
    assert.equal(isDisposableEmail('john@temp-mail.org'), true);
    assert.equal(isDisposableEmail('user@gmail.com'), false);
    assert.equal(isDisposableEmail('user@company.co.in'), false);
    assert.equal(isDisposableEmail(''), false);
  });
});

describe('Geo Utilities', () => {
  it('should calculate accurate Haversine distance in km', () => {
    // Koramangala (12.9352, 77.6245) to Indiranagar (12.9784, 77.6408) is ~5.1 km
    const dist = haversineKm(12.9352, 77.6245, 12.9784, 77.6408);
    assert.ok(dist >= 5.0 && dist <= 5.4, `Expected ~5.1km, got ${dist}`);
  });

  it('should classify radius tiers correctly', () => {
    assert.equal(getRadiusTier(2.5), 'flash');
    assert.equal(getRadiusTier(3.0), 'flash');
    assert.equal(getRadiusTier(3.01), 'next-day');
    assert.equal(getRadiusTier(10.0), 'next-day');
    assert.equal(getRadiusTier(10.01), 'out-of-range');
  });

  it('should return estimated pickup minutes for flash and next-day tiers', () => {
    assert.equal(calculateEstimatedMinutes(2.5), 20);
    assert.equal(calculateEstimatedMinutes(7.0), 1440);
    assert.equal(calculateEstimatedMinutes(15.0), null);
  });
});

describe('Entity Schemas', () => {
  it('should validate valid User payload', () => {
    const validUser = {
      id: 'a0000000-0000-4000-a000-000000000001',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'CONSUMER',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = UserSchema.parse(validUser);
    assert.equal(parsed.name, 'John Doe');
    assert.equal(parsed.role, 'CONSUMER');
  });

  it('should validate valid Store and NearbyStore payload', () => {
    const validStore = {
      id: 'store-001',
      name: 'Flashfix — Koramangala',
      address: '12th Main, 4th Block, Koramangala',
      city: 'Bengaluru',
      lat: 12.9352,
      lng: 77.6245,
      services: ['Screen Replacement'],
      distanceKm: 2.1,
      tier: 'flash',
      estimatedPickupMinutes: 20,
      isFlashHero: true,
    };
    const parsed = NearbyStoreSchema.parse(validStore);
    assert.equal(parsed.id, 'store-001');
    assert.equal(parsed.isFlashHero, true);
  });

  it('should validate valid Booking and BookingTrail', () => {
    const validBooking = {
      id: 'FF-123456',
      trackingCode: 'TRK-123456',
      storeId: 'store-001',
      brand: 'Apple',
      deviceModel: 'iPhone 16 Pro Max',
      issueType: 'Screen Replacement',
      scheduledDate: '2026-11-01',
      scheduledTime: '10:00 AM',
      pickupAddress: 'Bellandur, Bengaluru',
      contactName: 'Rahul Sharma',
      contactEmail: 'rahul@example.com',
      contactPhone: '9876543210',
      status: 'PENDING',
      estimatedCostPaise: 1899900,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = BookingSchema.parse(validBooking);
    assert.equal(parsed.id, 'FF-123456');
    assert.equal(parsed.estimatedCostPaise, 1899900);

    const validTrail = {
      id: 'b0000000-0000-4000-a000-000000000001',
      bookingId: 'FF-123456',
      fromStatus: 'PENDING',
      toStatus: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };
    const parsedTrail = BookingTrailSchema.parse(validTrail);
    assert.equal(parsedTrail.toStatus, 'CONFIRMED');
  });

  it('should validate API Envelope Schema', () => {
    const envelope = ApiResponseSchema(UserSchema);
    const successResult = envelope.parse({
      success: true,
      data: {
        id: 'a0000000-0000-4000-a000-000000000001',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'ADMIN',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    assert.equal(successResult.success, true);
    assert.equal(successResult.data?.name, 'Jane Doe');

    const errorResult = envelope.parse({
      success: false,
      error: {
        code: ERROR_CODES.DISPOSABLE_EMAIL_NOT_ALLOWED,
        message: 'Disposable email addresses are not allowed',
      },
    });
    assert.equal(errorResult.success, false);
    assert.equal(errorResult.error?.code, 'DISPOSABLE_EMAIL_NOT_ALLOWED');
  });
});
