/**
 * Flashfix Platform Domain Logic & Business Rules Engine.
 * Implements reference specification for state machine, OTP generation,
 * booking validation, paise calculations, and audit trail logging.
 */

import {
  BookingRecord,
  BookingStatus,
  BookingTrailRecord,
  MockDatabase,
  OtpCodeRecord,
  OtpPurpose,
  UserRecord
} from './mock-db.ts';
import { mockNotificationQueue } from './mock-notify-queue.ts';
import { isDisposableEmail } from './disposable-domains.ts';

export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKUP_EN_ROUTE', 'CANCELLED'], // admin can cancel if not yet dispatched
  PICKUP_EN_ROUTE: ['PICKUP_OTP_SENT', 'CANCELLED'],
  PICKUP_OTP_SENT: ['IN_TRANSIT'],
  IN_TRANSIT: ['CUSTODY_OTP_SENT'],
  CUSTODY_OTP_SENT: ['IN_REPAIR'],
  IN_REPAIR: ['REPAIR_COMPLETE'],
  REPAIR_COMPLETE: ['RETURN_EN_ROUTE'],
  RETURN_EN_ROUTE: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

export class DomainLogicService {
  constructor(private db: MockDatabase) {}

  /**
   * Generates a 6-digit numeric OTP string.
   */
  public generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generates a unique booking ID conforming to FF-XXXXXX format.
   */
  public generateBookingId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `FF-${code}`;
  }

  /**
   * Validates paise currency representation.
   */
  public validatePaiseAmount(amount: any): { valid: boolean; error?: string } {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return { valid: false, error: 'Paise amount must be a number' };
    }
    if (!Number.isInteger(amount)) {
      return { valid: false, error: 'Paise amount must be an integer (no fractional paise)' };
    }
    if (amount < 0) {
      return { valid: false, error: 'Paise amount cannot be negative' };
    }
    const MAX_PAISE = 100_000_000; // 1,000,000 INR
    if (amount > MAX_PAISE) {
      return { valid: false, error: 'Paise amount exceeds maximum permitted platform threshold' };
    }
    return { valid: true };
  }

  /**
   * Challenges login with Brevo email OTP.
   * Blocks disposable emails with 400 Bad Request.
   */
  public sendLoginOtp(email: string): { success: boolean; message: string; code?: string } {
    if (!email || !email.includes('@')) {
      throw new Error('INVALID_EMAIL: Email address format is invalid');
    }

    if (isDisposableEmail(email)) {
      throw new Error('DISPOSABLE_EMAIL_NOT_ALLOWED: Temporary or disposable email addresses are blocked');
    }

    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const otpRecord: OtpCodeRecord = {
      id: `otp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: email.trim().toLowerCase(),
      code,
      purpose: 'LOGIN',
      expiresAt,
      attempts: 0,
      used: false,
      createdAt: new Date()
    };

    this.db.otpCodes.set(otpRecord.id, otpRecord);

    // Enqueue Brevo notification
    mockNotificationQueue.enqueue(email, 'otp-login', { code });

    return { success: true, message: 'OTP sent to email', code };
  }

  /**
   * Verifies login OTP.
   */
  public verifyLoginOtp(email: string, submittedCode: string): { success: boolean; accessToken: string; refreshToken: string; user: UserRecord } {
    const normalizedEmail = email.trim().toLowerCase();
    const activeOtp = this.db.findActiveOtp(normalizedEmail, 'LOGIN');

    if (!activeOtp) {
      throw new Error('OTP_EXPIRED_OR_NOT_FOUND: No active login OTP for this email');
    }

    if (activeOtp.attempts >= 5) {
      throw new Error('OTP_MAX_ATTEMPTS_EXCEEDED: Too many invalid attempts. Request a new OTP');
    }

    if (activeOtp.code !== submittedCode.trim()) {
      activeOtp.attempts += 1;
      throw new Error(`INVALID_OTP: Code does not match. Attempts remaining: ${5 - activeOtp.attempts}`);
    }

    // Mark used
    activeOtp.used = true;

    // Upsert user
    let user = this.db.findUserByEmail(normalizedEmail);
    if (!user) {
      user = {
        id: `user-${Date.now()}`,
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        role: 'CONSUMER',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.db.users.set(user.id, user);
    } else {
      user.emailVerified = true;
      user.updatedAt = new Date();
    }

    const accessToken = `jwt-access-${user.id}-${Date.now()}`;
    const refreshToken = `jwt-refresh-${user.id}-${Date.now()}`;

    return { success: true, accessToken, refreshToken, user };
  }

  /**
   * Creates a new booking.
   */
  public createBooking(params: {
    userId?: string | null;
    brand: string;
    deviceModel: string;
    issue: string;
    issueNotes?: string;
    storeId: string;
    scheduledDate: string;
    scheduledTime: string;
    pickupLat?: number;
    pickupLng?: number;
    pickupAddress?: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    estimatedCostPaise?: number;
  }): BookingRecord {
    if (isDisposableEmail(params.contactEmail)) {
      throw new Error('DISPOSABLE_EMAIL_NOT_ALLOWED: Booking contact email cannot be disposable');
    }

    if (params.estimatedCostPaise !== undefined) {
      const check = this.validatePaiseAmount(params.estimatedCostPaise);
      if (!check.valid) throw new Error(`INVALID_COST: ${check.error}`);
    }

    const bookingId = this.generateBookingId();
    const booking: BookingRecord = {
      id: bookingId,
      userId: params.userId || null,
      brand: params.brand,
      deviceModel: params.deviceModel,
      issue: params.issue,
      issueNotes: params.issueNotes || null,
      storeId: params.storeId,
      assignedEmployeeId: null,
      technicianId: null,
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
      pickupLat: params.pickupLat ?? null,
      pickupLng: params.pickupLng ?? null,
      pickupAddress: params.pickupAddress || null,
      contactName: params.contactName,
      contactEmail: params.contactEmail.trim().toLowerCase(),
      contactPhone: params.contactPhone,
      status: 'PENDING',
      estimatedCostPaise: params.estimatedCostPaise ?? 0,
      finalCostPaise: null,
      paymentStatus: 'UNPAID',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.db.bookings.set(booking.id, booking);

    // Initial audit trail
    this.recordTrail(booking.id, 'PENDING', params.userId || null, 'Booking created by customer');

    // Notification
    mockNotificationQueue.enqueue(booking.contactEmail, 'booking-confirmed', {
      bookingId: booking.id,
      device: `${booking.brand} ${booking.deviceModel}`,
      trackingLink: `/flashfix/track/${booking.id}`
    });

    return booking;
  }

  /**
   * Assigns staff to a booking (status -> CONFIRMED).
   */
  public assignStaff(
    bookingId: string,
    adminUserId: string,
    employeeId: string,
    technicianId: string
  ): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'CONFIRMED');

    booking.assignedEmployeeId = employeeId;
    booking.technicianId = technicianId;
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date();

    this.recordTrail(
      booking.id,
      'CONFIRMED',
      adminUserId,
      `Assigned to rider ${employeeId} & technician ${technicianId}`
    );

    const emp = this.db.users.get(employeeId);
    if (emp) {
      mockNotificationQueue.enqueue(emp.email, 'employee-assigned', { bookingId: booking.id });
    }

    return booking;
  }

  /**
   * Rider marks pickup en route (CONFIRMED -> PICKUP_EN_ROUTE).
   */
  public startPickupEnRoute(bookingId: string, employeeId: string): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'PICKUP_EN_ROUTE');
    booking.status = 'PICKUP_EN_ROUTE';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'PICKUP_EN_ROUTE', employeeId, 'Rider en route to consumer location');
    return booking;
  }

  /**
   * Dispatches Doorstep Pickup OTP to consumer.
   */
  public sendPickupOtp(bookingId: string, employeeId: string): { success: boolean; code: string } {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'PICKUP_OTP_SENT');
    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otpRecord: OtpCodeRecord = {
      id: `otp-pickup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: booking.contactEmail,
      code,
      purpose: 'PICKUP',
      bookingId: booking.id,
      expiresAt,
      attempts: 0,
      used: false,
      createdAt: new Date()
    };
    this.db.otpCodes.set(otpRecord.id, otpRecord);

    booking.status = 'PICKUP_OTP_SENT';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'PICKUP_OTP_SENT', employeeId, 'Pickup OTP sent to consumer');
    mockNotificationQueue.enqueue(booking.contactEmail, 'pickup-otp', {
      code,
      bookingId: booking.id
    });

    return { success: true, code };
  }

  /**
   * Verifies Doorstep Pickup OTP presented by consumer to rider (PICKUP_OTP_SENT -> IN_TRANSIT).
   */
  public verifyPickupOtp(bookingId: string, employeeId: string, submittedOtp: string): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'IN_TRANSIT');

    const activeOtp = this.db.findActiveOtp(booking.contactEmail, 'PICKUP', booking.id);
    if (!activeOtp) throw new Error('OTP_EXPIRED_OR_NOT_FOUND: Active pickup OTP not found');

    if (activeOtp.attempts >= 5) {
      throw new Error('OTP_MAX_ATTEMPTS_EXCEEDED');
    }

    if (activeOtp.code !== submittedOtp.trim()) {
      activeOtp.attempts += 1;
      throw new Error('INVALID_OTP: Pickup handover OTP does not match');
    }

    activeOtp.used = true;
    booking.status = 'IN_TRANSIT';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'IN_TRANSIT', employeeId, 'Doorstep handover verified; device in transit to hub');
    return booking;
  }

  /**
   * Dispatches Store Custody OTP to technician (IN_TRANSIT -> CUSTODY_OTP_SENT).
   */
  public sendCustodyOtp(bookingId: string, senderUserId: string): { success: boolean; code: string } {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'CUSTODY_OTP_SENT');

    if (!booking.technicianId) throw new Error('NO_TECHNICIAN_ASSIGNED');
    const technician = this.db.users.get(booking.technicianId);
    if (!technician) throw new Error('TECHNICIAN_NOT_FOUND');

    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otpRecord: OtpCodeRecord = {
      id: `otp-custody-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: technician.email,
      code,
      purpose: 'CUSTODY',
      bookingId: booking.id,
      expiresAt,
      attempts: 0,
      used: false,
      createdAt: new Date()
    };
    this.db.otpCodes.set(otpRecord.id, otpRecord);

    booking.status = 'CUSTODY_OTP_SENT';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'CUSTODY_OTP_SENT', senderUserId, 'Custody OTP dispatched to technician');
    mockNotificationQueue.enqueue(technician.email, 'custody-otp', {
      code,
      bookingId: booking.id
    });

    return { success: true, code };
  }

  /**
   * Technician verifies Custody OTP to take possession of device (CUSTODY_OTP_SENT -> IN_REPAIR).
   */
  public verifyCustodyOtp(bookingId: string, technicianUserId: string, submittedOtp: string): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'IN_REPAIR');

    const technician = this.db.users.get(technicianUserId);
    if (!technician) throw new Error('TECHNICIAN_NOT_FOUND');

    const activeOtp = this.db.findActiveOtp(technician.email, 'CUSTODY', booking.id);
    if (!activeOtp) throw new Error('OTP_EXPIRED_OR_NOT_FOUND: Custody OTP expired or not found');

    if (activeOtp.attempts >= 5) {
      throw new Error('OTP_MAX_ATTEMPTS_EXCEEDED');
    }

    if (activeOtp.code !== submittedOtp.trim()) {
      activeOtp.attempts += 1;
      throw new Error('INVALID_OTP: Custody handover OTP does not match');
    }

    activeOtp.used = true;
    booking.status = 'IN_REPAIR';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'IN_REPAIR', technicianUserId, 'Device received at service center workbench');
    return booking;
  }

  /**
   * Technician completes repair (IN_REPAIR -> REPAIR_COMPLETE).
   */
  public completeRepair(bookingId: string, technicianUserId: string, finalCostPaise?: number): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'REPAIR_COMPLETE');

    if (finalCostPaise !== undefined) {
      const check = this.validatePaiseAmount(finalCostPaise);
      if (!check.valid) throw new Error(`INVALID_COST: ${check.error}`);
      booking.finalCostPaise = finalCostPaise;
    }

    booking.status = 'REPAIR_COMPLETE';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'REPAIR_COMPLETE', technicianUserId, 'Repair completed and quality checked');
    mockNotificationQueue.enqueue(booking.contactEmail, 'repair-complete', {
      bookingId: booking.id
    });

    return booking;
  }

  /**
   * Dispatches repaired device for return delivery (REPAIR_COMPLETE -> RETURN_EN_ROUTE).
   */
  public startReturnEnRoute(bookingId: string, employeeId: string): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'RETURN_EN_ROUTE');
    booking.status = 'RETURN_EN_ROUTE';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'RETURN_EN_ROUTE', employeeId, 'Device out for return delivery');
    return booking;
  }

  /**
   * Marks repair successfully delivered (RETURN_EN_ROUTE -> DELIVERED).
   */
  public markDelivered(bookingId: string, employeeId: string, paymentMethod: string = 'QR'): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    this.assertTransition(booking.status, 'DELIVERED');
    booking.status = 'DELIVERED';
    booking.paymentMethod = paymentMethod;
    booking.paymentStatus = 'PAID';
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'DELIVERED', employeeId, `Device handed over to customer. Payment: ${paymentMethod}`);
    return booking;
  }

  /**
   * Cancels a booking (Only permitted from PENDING).
   */
  public cancelBooking(bookingId: string, userId: string, reason: string): BookingRecord {
    const booking = this.db.bookings.get(bookingId);
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    if (booking.status !== 'PENDING') {
      throw new Error(`CANNOT_CANCEL: Bookings can only be cancelled from PENDING status. Current status is ${booking.status}`);
    }

    booking.status = 'CANCELLED';
    booking.notes = reason;
    booking.updatedAt = new Date();

    this.recordTrail(booking.id, 'CANCELLED', userId, `Booking cancelled: ${reason}`);
    return booking;
  }

  /**
   * Records an immutable entry in the booking trail.
   */
  public recordTrail(
    bookingId: string,
    status: BookingStatus,
    changedByUserId: string | null,
    note?: string
  ): BookingTrailRecord {
    const trailEntry: BookingTrailRecord = {
      id: `trail-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookingId,
      status,
      changedByUserId,
      note: note || null,
      createdAt: new Date()
    };
    this.db.bookingTrail.set(trailEntry.id, trailEntry);
    return trailEntry;
  }

  /**
   * Asserts state transition validity.
   */
  public assertTransition(current: BookingStatus, next: BookingStatus): void {
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
      throw new Error(
        `ILLEGAL_STATUS_TRANSITION: Cannot jump from ${current} to ${next}. Allowed transitions: [${allowed.join(', ')}]`
      );
    }
  }
}
