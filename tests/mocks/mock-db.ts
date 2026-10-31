/**
 * Hermetic In-Memory Database Fallback for Flashfix Platform.
 * Mirrors Drizzle ORM schema and relational constraints.
 */

export type UserRole = 'CONSUMER' | 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PICKUP_EN_ROUTE'
  | 'PICKUP_OTP_SENT'
  | 'IN_TRANSIT'
  | 'CUSTODY_OTP_SENT'
  | 'IN_REPAIR'
  | 'REPAIR_COMPLETE'
  | 'RETURN_EN_ROUTE'
  | 'DELIVERED'
  | 'CANCELLED';

export type OtpPurpose = 'LOGIN' | 'PICKUP' | 'CUSTODY';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  emailVerified: boolean;
  googleId?: string | null;
  avatarUrl?: string | null;
  storeId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedAddressRecord {
  id: string;
  userId: string;
  label?: string | null;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface OtpCodeRecord {
  id: string;
  email: string;
  code: string;
  purpose: OtpPurpose;
  bookingId?: string | null;
  expiresAt: Date;
  attempts: number;
  used: boolean;
  createdAt: Date;
}

export interface StoreRecord {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  phone?: string | null;
  hours: string;
  services: string[];
  rating: number;
  reviewCount: number;
  isActive: boolean;
  adminId?: string | null;
}

export interface BookingRecord {
  id: string; // FF-XXXXXX
  userId?: string | null;
  brand: string;
  deviceModel: string;
  issue: string;
  issueNotes?: string | null;
  storeId?: string | null;
  assignedEmployeeId?: string | null;
  technicianId?: string | null;
  scheduledDate: string;
  scheduledTime: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string | null;
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

export interface BookingTrailRecord {
  id: string;
  bookingId: string;
  status: BookingStatus;
  changedByUserId?: string | null;
  note?: string | null;
  createdAt: Date;
}

export interface InventoryItemRecord {
  id: string;
  storeId?: string | null;
  partName: string;
  partSku?: string | null;
  compatibleWith: string[];
  quantity: number;
  reorderLevel: number;
  unitCostPaise?: number | null;
  updatedAt: Date;
}

export class MockDatabase {
  public users = new Map<string, UserRecord>();
  public savedAddresses = new Map<string, SavedAddressRecord>();
  public otpCodes = new Map<string, OtpCodeRecord>();
  public stores = new Map<string, StoreRecord>();
  public bookings = new Map<string, BookingRecord>();
  public bookingTrail = new Map<string, BookingTrailRecord>();
  public inventoryItems = new Map<string, InventoryItemRecord>();

  constructor() {
    this.seed();
  }

  /**
   * Resets all tables and re-seeds baseline data.
   */
  public reset(): void {
    this.users.clear();
    this.savedAddresses.clear();
    this.otpCodes.clear();
    this.stores.clear();
    this.bookings.clear();
    this.bookingTrail.clear();
    this.inventoryItems.clear();
    this.seed();
  }

  /**
   * Seeds baseline stores and test accounts.
   */
  private seed(): void {
    // 5 Bengaluru Stores
    const seedStores: StoreRecord[] = [
      {
        id: 'store-blr-01',
        name: 'Flashfix Koramangala Hub',
        address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9352,
        lng: 77.6245,
        phone: '+91 80 4001 0001',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Water Damage', 'Camera Repair'],
        rating: 4.85,
        reviewCount: 342,
        isActive: true,
        adminId: 'user-admin-koramangala'
      },
      {
        id: 'store-blr-02',
        name: 'Flashfix Indiranagar',
        address: '100 Feet Rd, Indiranagar, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9784,
        lng: 77.6408,
        phone: '+91 80 4001 0002',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Charging Port', 'Back Glass'],
        rating: 4.9,
        reviewCount: 512,
        isActive: true
      },
      {
        id: 'store-blr-03',
        name: 'Flashfix Whitefield',
        address: 'ITPL Main Rd, Whitefield, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9698,
        lng: 77.7499,
        phone: '+91 80 4001 0003',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Logic Board Repair'],
        rating: 4.75,
        reviewCount: 220,
        isActive: true
      },
      {
        id: 'store-blr-04',
        name: 'Flashfix HSR Layout',
        address: '27th Main Rd, Sector 1, HSR Layout, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9116,
        lng: 77.6389,
        phone: '+91 80 4001 0004',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'Speaker Repair'],
        rating: 4.8,
        reviewCount: 198,
        isActive: true
      },
      {
        id: 'store-blr-05',
        name: 'Flashfix Jayanagar',
        address: '11th Main Rd, 4th Block, Jayanagar, Bengaluru',
        city: 'Bengaluru',
        lat: 12.9308,
        lng: 77.5838,
        phone: '+91 80 4001 0005',
        hours: '09:00 - 21:00',
        services: ['Screen Replacement', 'Battery Service', 'General Diagnostics'],
        rating: 4.88,
        reviewCount: 410,
        isActive: true
      }
    ];

    for (const store of seedStores) {
      this.stores.set(store.id, store);
    }

    // Seed Users
    const seedUsers: UserRecord[] = [
      {
        id: 'user-superadmin-01',
        name: 'Platform Super Admin',
        email: 'superadmin@flashfix.in',
        phone: '+91 99000 00001',
        role: 'SUPER_ADMIN',
        emailVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'user-admin-koramangala',
        name: 'Koramangala Store Admin',
        email: 'admin.koramangala@flashfix.in',
        phone: '+91 99000 00002',
        role: 'ADMIN',
        storeId: 'store-blr-01',
        emailVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'user-tech-rahul',
        name: 'Rahul Sharma (Technician)',
        email: 'tech.rahul@flashfix.in',
        phone: '+91 99000 00003',
        role: 'EMPLOYEE',
        storeId: 'store-blr-01',
        emailVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'user-delivery-vijay',
        name: 'Vijay Kumar (Rider)',
        email: 'delivery.vijay@flashfix.in',
        phone: '+91 99000 00004',
        role: 'EMPLOYEE',
        storeId: 'store-blr-01',
        emailVerified: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z')
      },
      {
        id: 'user-consumer-anita',
        name: 'Anita Desai',
        email: 'consumer.anita@gmail.com',
        phone: '+91 98800 12345',
        role: 'CONSUMER',
        emailVerified: true,
        createdAt: new Date('2026-02-01T00:00:00Z'),
        updatedAt: new Date('2026-02-01T00:00:00Z')
      }
    ];

    for (const u of seedUsers) {
      this.users.set(u.id, u);
    }

    // Seed Saved Address for consumer
    this.savedAddresses.set('addr-anita-01', {
      id: 'addr-anita-01',
      userId: 'user-consumer-anita',
      label: 'Home',
      address: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
      lat: 12.926,
      lng: 77.6762,
      isDefault: true,
      createdAt: new Date()
    });

    // Seed Skeleton Inventory
    this.inventoryItems.set('inv-screen-ip15p', {
      id: 'inv-screen-ip15p',
      storeId: 'store-blr-01',
      partName: 'iPhone 15 Pro OLED Display Assembly',
      partSku: 'SKU-DISP-IP15P-OEM',
      compatibleWith: ['iPhone 15 Pro'],
      quantity: 14,
      reorderLevel: 5,
      unitCostPaise: 1850000, // 18,500.00 INR
      updatedAt: new Date()
    });
  }

  // --- Helper Queries ---
  public findUserByEmail(email: string): UserRecord | undefined {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return undefined;
  }

  public findActiveOtp(email: string, purpose: OtpPurpose, bookingId?: string | null): OtpCodeRecord | undefined {
    const normalized = email.trim().toLowerCase();
    const now = new Date();
    for (const otp of this.otpCodes.values()) {
      if (
        otp.email.toLowerCase() === normalized &&
        otp.purpose === purpose &&
        !otp.used &&
        otp.expiresAt > now &&
        (bookingId === undefined || otp.bookingId === bookingId)
      ) {
        return otp;
      }
    }
    return undefined;
  }

  public getBookingsByUser(userId: string): BookingRecord[] {
    return Array.from(this.bookings.values()).filter((b) => b.userId === userId);
  }

  public getBookingTrail(bookingId: string): BookingTrailRecord[] {
    return Array.from(this.bookingTrail.values())
      .filter((t) => t.bookingId === bookingId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export const mockDb = new MockDatabase();
