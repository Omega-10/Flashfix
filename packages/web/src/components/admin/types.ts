import { BookingStatus, UserRole } from "@flashfix/shared";

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "TECHNICIAN" | "COURIER";

export type AdminTab =
  | "dashboard"
  | "superadmin"
  | "technician"
  | "delivery"
  | "bookings"
  | "team"
  | "inventory";

export interface DashboardStats {
  todayTotal: number;
  pending: number;
  inRepair: number;
  delivered: number;
  unassignedCount: number;
}

export interface BookingRecord {
  id: string;
  trackingCode?: string;
  userId?: string;
  storeId: string;
  brand: string;
  deviceModel: string;
  issueType: string;
  issueDescription?: string | null;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: BookingStatus;
  estimatedCostPaise?: number | null;
  finalCostPaise?: number | null;
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  pickupOtp?: string | null;
  custodyOtp?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface AuditTrailItem {
  id: string;
  bookingId: string;
  fromStatus?: BookingStatus;
  toStatus: BookingStatus;
  triggeredByName?: string;
  notes?: string | null;
  createdAt: string | Date;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  storeId: string;
  storeName?: string;
  status: "ACTIVE" | "INVITED" | "OFFLINE";
  activeJobsCount?: number;
  createdAt: string | Date;
}

export interface InventoryRecord {
  id: string;
  storeId: string;
  partName: string;
  sku: string;
  compatibleWith: string[];
  quantity: number;
  minThreshold: number;
  unitCostPaise: number;
  updatedAt?: string | Date;
}

export interface StoreOption {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  activeCount?: number;
}
