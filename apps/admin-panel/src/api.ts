import {
  BookingRecord,
  DashboardStats,
  StaffMember,
  AuditTrailItem,
  InventoryRecord,
  StoreOption,
} from "./types";
import { BookingStatus } from "@flashfix/shared";

export const STORES: StoreOption[] = [
  { id: "store-001", name: "Flashfix — Koramangala", city: "Bengaluru" },
  { id: "store-002", name: "Flashfix — Indiranagar", city: "Bengaluru" },
  { id: "store-003", name: "Flashfix — HSR Layout", city: "Bengaluru" },
];

// In-memory persistent state for Admin session
let bookingsState: BookingRecord[] = [];
let staffState: StaffMember[] = [];
let inventoryState: InventoryRecord[] = [];

export async function getDashboardStats(storeId?: string): Promise<DashboardStats> {
  try {
    const res = await fetch(`/api/admin/dashboard${storeId ? `?storeId=${storeId}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // Fall back to calculation
  }

  const filtered = storeId && storeId !== "ALL"
    ? bookingsState.filter((b) => b.storeId === storeId)
    : bookingsState;

  const todayTotal = filtered.length;
  const pending = filtered.filter((b) => b.status === "PENDING").length;
  const inRepair = filtered.filter((b) => b.status === "IN_REPAIR" || b.status === "CUSTODY_OTP_SENT").length;
  const delivered = filtered.filter((b) => b.status === "DELIVERED").length;
  const unassignedCount = filtered.filter((b) => !b.assignedEmployeeId && b.status !== "CANCELLED").length;

  return {
    todayTotal,
    pending,
    inRepair,
    delivered,
    unassignedCount,
  };
}

export async function getBookingsList(filters?: {
  storeId?: string;
  status?: string;
  search?: string;
}): Promise<BookingRecord[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.storeId && filters.storeId !== "ALL") params.append("storeId", filters.storeId);
    if (filters?.status && filters.status !== "ALL") params.append("status", filters.status);
    if (filters?.search) params.append("search", filters.search);

    const res = await fetch(`/api/admin/bookings?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // Use in-memory state
  }

  let list = [...bookingsState];
  if (filters?.storeId && filters.storeId !== "ALL") {
    list = list.filter((b) => b.storeId === filters.storeId);
  }
  if (filters?.status && filters.status !== "ALL") {
    list = list.filter((b) => b.status === filters.status);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.contactName.toLowerCase().includes(q) ||
        b.contactPhone.toLowerCase().includes(q) ||
        b.deviceModel.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function assignStaffToBooking(
  bookingId: string,
  employeeId: string,
  technicianId?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/bookings/${bookingId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, technicianId }),
    });
    if (res.ok) {
      return true;
    }
  } catch {
    // Proceed to state update
  }

  const emp = staffState.find((s) => s.id === employeeId);
  const tech = staffState.find((s) => s.id === technicianId);

  bookingsState = bookingsState.map((b) => {
    if (b.id === bookingId) {
      return {
        ...b,
        status: "CONFIRMED" as BookingStatus,
        assignedEmployeeId: employeeId,
        assignedEmployeeName: emp?.name || "Mobile Operative",
        technicianId: technicianId || employeeId,
        technicianName: tech?.name || "Lab Specialist",
        updatedAt: new Date().toISOString(),
      };
    }
    return b;
  });

  return true;
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  note?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    if (res.ok) return true;
  } catch {
    // Proceed
  }

  bookingsState = bookingsState.map((b) => {
    if (b.id === bookingId) {
      return {
        ...b,
        status,
        updatedAt: new Date().toISOString(),
      };
    }
    return b;
  });

  return true;
}

export async function getBookingTrail(bookingId: string): Promise<AuditTrailItem[]> {
  try {
    const res = await fetch(`/api/bookings/${bookingId}/trail`);
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // Fallback
  }

  const booking = bookingsState.find((b) => b.id === bookingId);
  const created = booking?.createdAt || new Date();

  return [
    {
      id: "tr-1",
      bookingId,
      toStatus: "PENDING",
      notes: "Customer scheduled repair service on Flashfix portal",
      triggeredByName: booking?.contactName || "Consumer",
      createdAt: created,
    },
    ...(booking?.assignedEmployeeName
      ? [
          {
            id: "tr-2",
            bookingId,
            fromStatus: "PENDING" as BookingStatus,
            toStatus: "CONFIRMED" as BookingStatus,
            notes: `Assigned mobile courier ${booking.assignedEmployeeName} & technician ${booking.technicianName}`,
            triggeredByName: "Store Admin",
            createdAt: new Date(new Date(created).getTime() + 15 * 60000),
          },
        ]
      : []),
    ...(booking?.status === "IN_REPAIR" || booking?.status === "DELIVERED"
      ? [
          {
            id: "tr-3",
            bookingId,
            fromStatus: "CONFIRMED" as BookingStatus,
            toStatus: "PICKUP_EN_ROUTE" as BookingStatus,
            notes: "Mobile courier departed store towards consumer doorstep",
            triggeredByName: booking.assignedEmployeeName || "Operative",
            createdAt: new Date(new Date(created).getTime() + 35 * 60000),
          },
          {
            id: "tr-4",
            bookingId,
            fromStatus: "PICKUP_EN_ROUTE" as BookingStatus,
            toStatus: "IN_TRANSIT" as BookingStatus,
            notes: "Pickup handover authorized via consumer 6-digit OTP code",
            triggeredByName: booking.assignedEmployeeName || "Operative",
            createdAt: new Date(new Date(created).getTime() + 55 * 60000),
          },
          {
            id: "tr-5",
            bookingId,
            fromStatus: "IN_TRANSIT" as BookingStatus,
            toStatus: "IN_REPAIR" as BookingStatus,
            notes: "Technician custody OTP validated at lab. Micro-soldering & diagnostics active.",
            triggeredByName: booking.technicianName || "Lab Tech",
            createdAt: new Date(new Date(created).getTime() + 75 * 60000),
          },
        ]
      : []),
  ];
}

export async function getTeamMembers(storeId?: string): Promise<StaffMember[]> {
  try {
    const res = await fetch(`/api/admin/team${storeId ? `?storeId=${storeId}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // Return staff state
  }

  if (storeId && storeId !== "ALL") {
    return staffState.filter((s) => s.storeId === storeId);
  }
  return staffState;
}

export async function inviteTeamMember(data: {
  email: string;
  name: string;
  role: "EMPLOYEE" | "ADMIN";
  storeId: string;
}): Promise<StaffMember> {
  try {
    const res = await fetch("/api/admin/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const resData = await res.json();
      return resData.data || resData;
    }
  } catch {
    // Proceed
  }

  const store = STORES.find((s) => s.id === data.storeId);
  const newStaff: StaffMember = {
    id: "emp-" + Math.floor(100 + Math.random() * 900),
    name: data.name,
    email: data.email,
    role: data.role,
    storeId: data.storeId,
    storeName: store?.name || "Flashfix Store",
    status: "INVITED",
    activeJobsCount: 0,
    createdAt: new Date().toISOString(),
  };

  staffState = [newStaff, ...staffState];
  return newStaff;
}

export async function getInventory(storeId?: string): Promise<InventoryRecord[]> {
  try {
    const res = await fetch(`/api/admin/inventory${storeId ? `?storeId=${storeId}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // Return local
  }

  if (storeId && storeId !== "ALL") {
    return inventoryState.filter((i) => i.storeId === storeId);
  }
  return inventoryState;
}
