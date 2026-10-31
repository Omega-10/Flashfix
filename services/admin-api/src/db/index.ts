import crypto from 'node:crypto';
import type { BookingStatus, UserRole } from '@flashfix/shared';

export interface AdminBookingEntity {
  id: string;
  trackingCode: string;
  userId?: string | null;
  storeId: string;
  assignedEmployeeId?: string | null;
  technicianId?: string | null;
  brand: string;
  deviceModel: string;
  issueType: string;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: BookingStatus;
  estimatedCostPaise?: number | null;
  finalCostPaise?: number | null;
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserEntity {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string | null;
  phone?: string | null;
  createdAt: Date;
}

export interface AdminInventoryItemEntity {
  id: string;
  storeId: string;
  partName: string;
  sku?: string | null;
  compatibleWith: string[];
  quantity: number;
  minThreshold: number;
  unitCostPaise?: number | null;
  updatedAt: Date;
}

export interface AdminStats {
  todayTotal: number;
  pending: number;
  inRepair: number;
  delivered: number;
  unassignedCount: number;
  hasUnassignedAlert: boolean;
}

export interface AdminRepository {
  getStats(storeId?: string): Promise<AdminStats>;
  listBookings(filters?: {
    storeId?: string;
    status?: BookingStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminBookingEntity[]; total: number }>;
  findBookingById(id: string): Promise<AdminBookingEntity | null>;
  assignBooking(id: string, employeeId: string, technicianId?: string): Promise<AdminBookingEntity | null>;
  listTeam(storeId?: string): Promise<AdminUserEntity[]>;
  inviteMember(data: { name: string; email: string; role: 'EMPLOYEE' | 'ADMIN'; storeId: string }): Promise<AdminUserEntity>;
  listInventory(storeId?: string): Promise<AdminInventoryItemEntity[]>;
  updateInventoryStock(id: string, quantity: number): Promise<AdminInventoryItemEntity | null>;
  addBooking?(booking: AdminBookingEntity): void;
  reset?(): void;
}

export class InMemoryAdminRepository implements AdminRepository {
  public bookings = new Map<string, AdminBookingEntity>();
  public users = new Map<string, AdminUserEntity>();
  public inventory = new Map<string, AdminInventoryItemEntity>();

  constructor() {
    this.seed();
  }

  public reset(): void {
    this.bookings.clear();
    this.users.clear();
    this.inventory.clear();
    this.seed();
  }

  private seed(): void {
    // Seed users
    const seedUsers: AdminUserEntity[] = [
      {
        id: '00000000-0000-4000-a000-000000000001',
        name: 'Flashfix Platform Admin',
        email: 'superadmin@flashfix.in',
        role: 'SUPER_ADMIN',
        createdAt: new Date(),
      },
      {
        id: '00000000-0000-4000-a000-000000000002',
        name: 'Koramangala Store Manager',
        email: 'admin.koramangala@flashfix.in',
        role: 'ADMIN',
        storeId: 'store-blr-01',
        createdAt: new Date(),
      },
      {
        id: '00000000-0000-4000-a000-000000000004',
        name: 'Rajesh Kumar',
        email: 'delivery.rajesh@flashfix.in',
        role: 'EMPLOYEE',
        storeId: 'store-blr-01',
        createdAt: new Date(),
      },
      {
        id: '00000000-0000-4000-a000-000000000005',
        name: 'Vikram Singh',
        email: 'tech.vikram@flashfix.in',
        role: 'EMPLOYEE',
        storeId: 'store-blr-01',
        createdAt: new Date(),
      },
    ];
    for (const u of seedUsers) {
      this.users.set(u.id, u);
    }

    // Seed bookings
    const today = new Date().toISOString().split('T')[0];
    const seedBookings: AdminBookingEntity[] = [
      {
        id: 'FF-BKG001',
        trackingCode: 'FF-BKG001',
        storeId: 'store-blr-01',
        brand: 'Apple',
        deviceModel: 'iPhone 15 Pro',
        issueType: 'Screen Replacement',
        scheduledDate: today,
        scheduledTime: '10:00 AM',
        pickupAddress: 'Koramangala 4th Block, Bengaluru',
        contactName: 'Rohit Sen',
        contactEmail: 'rohit@example.com',
        contactPhone: '+91 98800 11111',
        status: 'PENDING',
        assignedEmployeeId: null,
        technicianId: null,
        paymentStatus: 'UNPAID',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'FF-BKG002',
        trackingCode: 'FF-BKG002',
        storeId: 'store-blr-01',
        brand: 'Samsung',
        deviceModel: 'Galaxy S24',
        issueType: 'Battery Service',
        scheduledDate: today,
        scheduledTime: '12:00 PM',
        pickupAddress: 'HSR Layout, Bengaluru',
        contactName: 'Ananya Roy',
        contactEmail: 'ananya@example.com',
        contactPhone: '+91 98800 22222',
        status: 'IN_REPAIR',
        assignedEmployeeId: '00000000-0000-4000-a000-000000000004',
        technicianId: '00000000-0000-4000-a000-000000000005',
        paymentStatus: 'UNPAID',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'FF-BKG003',
        trackingCode: 'FF-BKG003',
        storeId: 'store-blr-01',
        brand: 'Google',
        deviceModel: 'Pixel 8 Pro',
        issueType: 'Camera Repair',
        scheduledDate: today,
        scheduledTime: '02:00 PM',
        pickupAddress: 'Indiranagar, Bengaluru',
        contactName: 'Kavita Das',
        contactEmail: 'kavita@example.com',
        contactPhone: '+91 98800 33333',
        status: 'DELIVERED',
        assignedEmployeeId: '00000000-0000-4000-a000-000000000004',
        technicianId: '00000000-0000-4000-a000-000000000005',
        paymentStatus: 'PAID',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    for (const b of seedBookings) {
      this.bookings.set(b.id, b);
    }

    // Seed inventory items
    const seedInventory: AdminInventoryItemEntity[] = [
      {
        id: 'inv-001',
        storeId: 'store-blr-01',
        partName: 'OLED Display Panel',
        sku: 'DISP-IP15P-01',
        compatibleWith: ['iPhone 15 Pro'],
        quantity: 12,
        minThreshold: 5,
        unitCostPaise: 850000,
        updatedAt: new Date(),
      },
      {
        id: 'inv-002',
        storeId: 'store-blr-01',
        partName: 'High Capacity Battery 4400mAh',
        sku: 'BATT-GS24-01',
        compatibleWith: ['Galaxy S24', 'Galaxy S24+'],
        quantity: 8,
        minThreshold: 4,
        unitCostPaise: 250000,
        updatedAt: new Date(),
      },
    ];
    for (const inv of seedInventory) {
      this.inventory.set(inv.id, inv);
    }
  }

  public addBooking(booking: AdminBookingEntity): void {
    this.bookings.set(booking.id, booking);
  }

  async getStats(storeId?: string): Promise<AdminStats> {
    let list = Array.from(this.bookings.values());
    if (storeId) {
      list = list.filter((b) => b.storeId === storeId);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = list.filter((b) => b.scheduledDate === todayStr || b.createdAt.toISOString().startsWith(todayStr));

    const todayTotal = todayBookings.length;
    const pending = list.filter((b) => b.status === 'PENDING').length;
    const inRepair = list.filter((b) => b.status === 'IN_REPAIR').length;
    const delivered = list.filter((b) => b.status === 'DELIVERED').length;
    const unassignedCount = list.filter((b) => b.status === 'PENDING' || !b.assignedEmployeeId).length;

    return {
      todayTotal,
      pending,
      inRepair,
      delivered,
      unassignedCount,
      hasUnassignedAlert: unassignedCount > 0,
    };
  }

  async listBookings(filters?: {
    storeId?: string;
    status?: BookingStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AdminBookingEntity[]; total: number }> {
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

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const items = list.slice(offset, offset + limit);
    return { items, total };
  }

  async findBookingById(id: string): Promise<AdminBookingEntity | null> {
    return this.bookings.get(id) || null;
  }

  async assignBooking(id: string, employeeId: string, technicianId?: string): Promise<AdminBookingEntity | null> {
    const booking = this.bookings.get(id);
    if (!booking) return null;

    booking.assignedEmployeeId = employeeId;
    booking.technicianId = technicianId || null;
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date();

    this.bookings.set(id, booking);
    return booking;
  }

  async listTeam(storeId?: string): Promise<AdminUserEntity[]> {
    let list = Array.from(this.users.values()).filter((u) => u.role === 'EMPLOYEE' || u.role === 'ADMIN');
    if (storeId) {
      list = list.filter((u) => !u.storeId || u.storeId === storeId);
    }
    return list;
  }

  async inviteMember(data: { name: string; email: string; role: 'EMPLOYEE' | 'ADMIN'; storeId: string }): Promise<AdminUserEntity> {
    const member: AdminUserEntity = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email.trim().toLowerCase(),
      role: data.role,
      storeId: data.storeId,
      createdAt: new Date(),
    };
    this.users.set(member.id, member);
    return member;
  }

  async listInventory(storeId?: string): Promise<AdminInventoryItemEntity[]> {
    let list = Array.from(this.inventory.values());
    if (storeId) {
      list = list.filter((i) => i.storeId === storeId);
    }
    return list;
  }

  async updateInventoryStock(id: string, quantity: number): Promise<AdminInventoryItemEntity | null> {
    const item = this.inventory.get(id);
    if (!item) return null;
    item.quantity = quantity;
    item.updatedAt = new Date();
    this.inventory.set(id, item);
    return item;
  }
}

export const inMemoryAdminRepo = new InMemoryAdminRepository();

export function getAdminRepository(): AdminRepository {
  return inMemoryAdminRepo;
}
