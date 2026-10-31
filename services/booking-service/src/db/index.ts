import crypto from 'node:crypto';
import type { BookingStatus, OtpPurpose, UserRole } from '@flashfix/shared';

export interface BookingEntity {
  id: string; // 'FF-XXXXXX'
  trackingCode: string;
  userId?: string | null;
  storeId: string;
  assignedEmployeeId?: string | null;
  technicianId?: string | null;

  brand: string;
  deviceModel: string;
  issueType: string;
  issueDescription?: string | null;

  scheduledDate: string;
  scheduledTime: string;

  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress: string;

  contactName: string;
  contactEmail: string;
  contactPhone: string;

  status: BookingStatus;
  estimatedCostPaise?: number | null;
  finalCostPaise?: number | null;
  paymentMethod?: string | null;
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';

  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingTrailEntity {
  id: string;
  bookingId: string;
  fromStatus?: BookingStatus | null;
  toStatus: BookingStatus;
  triggeredByUserId?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface BookingOtpEntity {
  id: string;
  email: string;
  code: string;
  codeHash?: string;
  purpose: OtpPurpose;
  bookingId: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

export interface UserLookup {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string | null;
}

export interface StoreLookup {
  id: string;
  name: string;
  address: string;
}

export interface BookingRepository {
  createBooking(booking: BookingEntity): Promise<BookingEntity>;
  findBookingById(id: string): Promise<BookingEntity | null>;
  listBookingsByUser(userId?: string, email?: string): Promise<BookingEntity[]>;
  updateBooking(id: string, updates: Partial<BookingEntity>): Promise<BookingEntity | null>;
  listBookings(filters?: {
    storeId?: string;
    status?: BookingStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BookingEntity[]; total: number }>;

  addTrailEntry(entry: Omit<BookingTrailEntity, 'id' | 'createdAt'>): Promise<BookingTrailEntity>;
  getTrail(bookingId: string): Promise<BookingTrailEntity[]>;

  saveOtp(otp: Omit<BookingOtpEntity, 'id' | 'attempts' | 'verified' | 'createdAt'>): Promise<BookingOtpEntity>;
  findActiveOtp(bookingId: string, purpose: OtpPurpose): Promise<BookingOtpEntity | null>;
  markOtpVerified(id: string): Promise<void>;
  incrementOtpAttempts(id: string): Promise<void>;

  findUserById(id: string): Promise<UserLookup | null>;
  findStoreById(id: string): Promise<StoreLookup | null>;

  reset?(): void;
}

export class InMemoryBookingRepository implements BookingRepository {
  private bookings = new Map<string, BookingEntity>();
  private trails: BookingTrailEntity[] = [];
  private otps = new Map<string, BookingOtpEntity>();
  private users = new Map<string, UserLookup>();
  private stores = new Map<string, StoreLookup>();

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.bookings.clear();
    this.trails = [];
    this.otps.clear();
    this.users.clear();
    this.stores.clear();
    this.seed();
  }

  private seed(): void {
    // Seed test users
    const seedUsers: UserLookup[] = [
      {
        id: '00000000-0000-4000-a000-000000000001',
        name: 'Flashfix Platform Admin',
        email: 'superadmin@flashfix.in',
        role: 'SUPER_ADMIN',
      },
      {
        id: '00000000-0000-4000-a000-000000000002',
        name: 'Koramangala Store Manager',
        email: 'admin.koramangala@flashfix.in',
        role: 'ADMIN',
        storeId: 'store-blr-01',
      },
      {
        id: '00000000-0000-4000-a000-000000000004',
        name: 'Rajesh Kumar',
        email: 'delivery.rajesh@flashfix.in',
        role: 'EMPLOYEE',
        storeId: 'store-blr-01',
      },
      {
        id: '00000000-0000-4000-a000-000000000005',
        name: 'Vikram Singh',
        email: 'tech.vikram@flashfix.in',
        role: 'EMPLOYEE',
        storeId: 'store-blr-01',
      },
      {
        id: '00000000-0000-4000-a000-000000000006',
        name: 'Anita Desai',
        email: 'consumer.anita@gmail.com',
        role: 'CONSUMER',
      },
    ];
    for (const u of seedUsers) {
      this.users.set(u.id, u);
    }

    // Seed test stores
    const seedStores: StoreLookup[] = [
      {
        id: 'store-blr-01',
        name: 'Flashfix Koramangala Hub',
        address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru',
      },
      {
        id: 'store-blr-02',
        name: 'Flashfix Indiranagar',
        address: '100 Feet Rd, Indiranagar, Bengaluru',
      },
      {
        id: 'store-blr-03',
        name: 'Flashfix Whitefield',
        address: 'ITPL Main Rd, Whitefield, Bengaluru',
      },
    ];
    for (const s of seedStores) {
      this.stores.set(s.id, s);
    }
  }

  async createBooking(booking: BookingEntity): Promise<BookingEntity> {
    this.bookings.set(booking.id, booking);
    return booking;
  }

  async findBookingById(id: string): Promise<BookingEntity | null> {
    return this.bookings.get(id) || null;
  }

  async listBookingsByUser(userId?: string, email?: string): Promise<BookingEntity[]> {
    const list = Array.from(this.bookings.values()).filter((b) => {
      if (userId && b.userId === userId) return true;
      if (email && b.contactEmail.toLowerCase() === email.toLowerCase()) return true;
      return false;
    });
    // Sort descending by created
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateBooking(id: string, updates: Partial<BookingEntity>): Promise<BookingEntity | null> {
    const existing = this.bookings.get(id);
    if (!existing) return null;
    const updated: BookingEntity = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.bookings.set(id, updated);
    return updated;
  }

  async listBookings(filters?: {
    storeId?: string;
    status?: BookingStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: BookingEntity[]; total: number }> {
    let list = Array.from(this.bookings.values());

    if (filters?.storeId) {
      list = list.filter((b) => b.storeId === filters.storeId);
    }
    if (filters?.status) {
      list = list.filter((b) => b.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.contactName.toLowerCase().includes(q) ||
          b.contactPhone.toLowerCase().includes(q) ||
          b.deviceModel.toLowerCase().includes(q)
      );
    }

    const total = list.length;
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    const items = list.slice(offset, offset + limit);

    return { items, total };
  }

  async addTrailEntry(entry: Omit<BookingTrailEntity, 'id' | 'createdAt'>): Promise<BookingTrailEntity> {
    const record: BookingTrailEntity = {
      id: crypto.randomUUID(),
      ...entry,
      createdAt: new Date(),
    };
    this.trails.push(record);
    return record;
  }

  async getTrail(bookingId: string): Promise<BookingTrailEntity[]> {
    return this.trails
      .filter((t) => t.bookingId === bookingId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async saveOtp(otp: Omit<BookingOtpEntity, 'id' | 'attempts' | 'verified' | 'createdAt'>): Promise<BookingOtpEntity> {
    const record: BookingOtpEntity = {
      id: crypto.randomUUID(),
      ...otp,
      attempts: 0,
      verified: false,
      createdAt: new Date(),
    };
    this.otps.set(record.id, record);
    return record;
  }

  async findActiveOtp(bookingId: string, purpose: OtpPurpose): Promise<BookingOtpEntity | null> {
    const now = new Date();
    const list = Array.from(this.otps.values())
      .filter((o) => o.bookingId === bookingId && o.purpose === purpose && !o.verified && o.expiresAt > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return list[0] || null;
  }

  async markOtpVerified(id: string): Promise<void> {
    const otp = this.otps.get(id);
    if (otp) {
      otp.verified = true;
      this.otps.set(id, otp);
    }
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    const otp = this.otps.get(id);
    if (otp) {
      otp.attempts += 1;
      this.otps.set(id, otp);
    }
  }

  async findUserById(id: string): Promise<UserLookup | null> {
    return this.users.get(id) || null;
  }

  async findStoreById(id: string): Promise<StoreLookup | null> {
    return this.stores.get(id) || null;
  }
}

export const inMemoryBookingRepo = new InMemoryBookingRepository();

export function getBookingRepository(): BookingRepository {
  return inMemoryBookingRepo;
}
