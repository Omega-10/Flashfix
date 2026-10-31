import crypto from 'node:crypto';
import type { UserRole, OtpPurpose } from '@flashfix/shared';

export interface UserEntity {
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

export interface OtpCodeEntity {
  id: string;
  email: string;
  codeHash: string;
  purpose: OtpPurpose;
  bookingId?: string | null;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

export interface SavedAddressEntity {
  id: string;
  userId: string;
  label?: string | null;
  address: string;
  landmark?: string | null;
  lat: number;
  lng: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface AuthRepository {
  findUserById(id: string): Promise<UserEntity | null>;
  findUserByEmail(email: string): Promise<UserEntity | null>;
  findUserByGoogleId(googleId: string): Promise<UserEntity | null>;
  upsertUser(data: {
    email: string;
    name?: string;
    role?: UserRole;
    googleId?: string | null;
    avatarUrl?: string | null;
    emailVerified?: boolean;
    phone?: string | null;
    storeId?: string | null;
  }): Promise<UserEntity>;
  updateUser(id: string, updates: Partial<UserEntity>): Promise<UserEntity | null>;
  listUsers(filters?: { role?: UserRole; storeId?: string }): Promise<UserEntity[]>;

  saveOtp(otp: {
    email: string;
    codeHash: string;
    purpose: OtpPurpose;
    bookingId?: string | null;
    expiresAt: Date;
  }): Promise<OtpCodeEntity>;
  findActiveOtp(email: string, purpose: OtpPurpose): Promise<OtpCodeEntity | null>;
  incrementOtpAttempts(id: string): Promise<void>;
  markOtpVerified(id: string): Promise<void>;

  getSavedAddresses(userId: string): Promise<SavedAddressEntity[]>;
  createSavedAddress(data: Omit<SavedAddressEntity, 'id' | 'createdAt'>): Promise<SavedAddressEntity>;
  reset?(): void;
}

export class InMemoryAuthRepository implements AuthRepository {
  private users = new Map<string, UserEntity>();
  private otps = new Map<string, OtpCodeEntity>();
  private addresses = new Map<string, SavedAddressEntity>();

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.users.clear();
    this.otps.clear();
    this.addresses.clear();
    this.seed();
  }

  private seed(): void {
    const defaultUsers: UserEntity[] = [
      {
        id: '00000000-0000-4000-a000-000000000001',
        name: 'Flashfix Platform Admin',
        email: 'superadmin@flashfix.in',
        phone: '+919999900001',
        role: 'SUPER_ADMIN',
        emailVerified: true,
        storeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '00000000-0000-4000-a000-000000000002',
        name: 'Koramangala Store Manager',
        email: 'admin.koramangala@flashfix.in',
        phone: '+919999900002',
        role: 'ADMIN',
        emailVerified: true,
        storeId: 'store-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '00000000-0000-4000-a000-000000000004',
        name: 'Rajesh Kumar',
        email: 'delivery.rajesh@flashfix.in',
        phone: '+919876500004',
        role: 'EMPLOYEE',
        emailVerified: true,
        storeId: 'store-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '00000000-0000-4000-a000-000000000005',
        name: 'Vikram Singh',
        email: 'tech.vikram@flashfix.in',
        phone: '+919876500005',
        role: 'EMPLOYEE',
        emailVerified: true,
        storeId: 'store-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '00000000-0000-4000-a000-000000000006',
        name: 'Anita Desai',
        email: 'consumer.anita@gmail.com',
        phone: '+919876500006',
        role: 'CONSUMER',
        emailVerified: true,
        storeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const u of defaultUsers) {
      this.users.set(u.id, u);
    }

    const defaultAddress: SavedAddressEntity = {
      id: 'addr-00000000-0000-4000-a000-000000000001',
      userId: '00000000-0000-4000-a000-000000000006',
      label: 'Home',
      address: 'Prestige Ozone, Whitefield, Bengaluru',
      landmark: 'Near Forum Value Mall',
      lat: 12.9698,
      lng: 77.7499,
      isDefault: true,
      createdAt: new Date(),
    };
    this.addresses.set(defaultAddress.id, defaultAddress);
  }

  async findUserById(id: string): Promise<UserEntity | null> {
    return this.users.get(id) || null;
  }

  async findUserByEmail(email: string): Promise<UserEntity | null> {
    const target = email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === target) return u;
    }
    return null;
  }

  async findUserByGoogleId(googleId: string): Promise<UserEntity | null> {
    for (const u of this.users.values()) {
      if (u.googleId === googleId) return u;
    }
    return null;
  }

  async upsertUser(data: {
    email: string;
    name?: string;
    role?: UserRole;
    googleId?: string | null;
    avatarUrl?: string | null;
    emailVerified?: boolean;
    phone?: string | null;
    storeId?: string | null;
  }): Promise<UserEntity> {
    const existing = await this.findUserByEmail(data.email);
    if (existing) {
      const updated: UserEntity = {
        ...existing,
        name: data.name ?? existing.name,
        role: data.role ?? existing.role,
        googleId: data.googleId !== undefined ? data.googleId : existing.googleId,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl,
        emailVerified: data.emailVerified ?? existing.emailVerified,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        storeId: data.storeId !== undefined ? data.storeId : existing.storeId,
        updatedAt: new Date(),
      };
      this.users.set(existing.id, updated);
      return updated;
    }

    const newUser: UserEntity = {
      id: crypto.randomUUID(),
      email: data.email.trim().toLowerCase(),
      name: data.name || data.email.split('@')[0],
      role: data.role || 'CONSUMER',
      emailVerified: data.emailVerified ?? false,
      googleId: data.googleId || null,
      avatarUrl: data.avatarUrl || null,
      phone: data.phone || null,
      storeId: data.storeId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<UserEntity>): Promise<UserEntity | null> {
    const existing = this.users.get(id);
    if (!existing) return null;
    const updated: UserEntity = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async listUsers(filters?: { role?: UserRole; storeId?: string }): Promise<UserEntity[]> {
    let list = Array.from(this.users.values());
    if (filters?.role) {
      list = list.filter((u) => u.role === filters.role);
    }
    if (filters?.storeId) {
      list = list.filter((u) => u.storeId === filters.storeId);
    }
    return list;
  }

  async saveOtp(otp: {
    email: string;
    codeHash: string;
    purpose: OtpPurpose;
    bookingId?: string | null;
    expiresAt: Date;
  }): Promise<OtpCodeEntity> {
    const record: OtpCodeEntity = {
      id: crypto.randomUUID(),
      email: otp.email.trim().toLowerCase(),
      codeHash: otp.codeHash,
      purpose: otp.purpose,
      bookingId: otp.bookingId || null,
      expiresAt: otp.expiresAt,
      attempts: 0,
      verified: false,
      createdAt: new Date(),
    };
    this.otps.set(record.id, record);
    return record;
  }

  async findActiveOtp(email: string, purpose: OtpPurpose): Promise<OtpCodeEntity | null> {
    const target = email.trim().toLowerCase();
    const now = new Date();
    // Find latest matching OTP that hasn't expired and hasn't been verified
    const matching = Array.from(this.otps.values())
      .filter((o) => o.email.toLowerCase() === target && o.purpose === purpose && !o.verified && o.expiresAt > now)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return matching[0] || null;
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    const otp = this.otps.get(id);
    if (otp) {
      otp.attempts += 1;
      this.otps.set(id, otp);
    }
  }

  async markOtpVerified(id: string): Promise<void> {
    const otp = this.otps.get(id);
    if (otp) {
      otp.verified = true;
      this.otps.set(id, otp);
    }
  }

  async getSavedAddresses(userId: string): Promise<SavedAddressEntity[]> {
    return Array.from(this.addresses.values()).filter((a) => a.userId === userId);
  }

  async createSavedAddress(data: Omit<SavedAddressEntity, 'id' | 'createdAt'>): Promise<SavedAddressEntity> {
    const record: SavedAddressEntity = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
    };
    this.addresses.set(record.id, record);
    return record;
  }
}

export function getAuthRepository(): AuthRepository {
  // If DATABASE_URL is set and not mock, can wrap Drizzle / pg repository
  // For hermetic offline execution and test reliability, InMemoryAuthRepository is provided.
  return inMemoryAuthRepo;
}

export const inMemoryAuthRepo = new InMemoryAuthRepository();
