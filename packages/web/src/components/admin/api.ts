import {
  BookingRecord,
  DashboardStats,
  StaffMember,
  AuditTrailItem,
  InventoryRecord,
  StoreOption,
} from "./types";
import { BookingStatus, UserRole } from "@flashfix/shared";

export const STORES: StoreOption[] = [
  { id: "store-001", name: "Madhapur Flagship Lab", city: "Hyderabad", address: "Plot 14, Hitech City Main Rd, Madhapur", phone: "+91 40 4821 7701" },
  { id: "store-002", name: "Kondapur Express Centre", city: "Hyderabad", address: "Opp. Botanical Garden Road, Kondapur", phone: "+91 40 4821 7702" },
  { id: "store-003", name: "Banjara Hills Service Hub", city: "Hyderabad", address: "Road No. 12, Banjara Hills", phone: "+91 40 4821 7703" },
  { id: "store-004", name: "Gachibowli Tech Centre", city: "Hyderabad", address: "Financial District, Gachibowli", phone: "+91 40 4821 7704" },
];

const INITIAL_STAFF: StaffMember[] = [
  {
    id: "emp-001",
    name: "Vikram Reddy",
    email: "vikram.reddy@flashfix.in",
    phone: "+91 98490 11223",
    role: "EMPLOYEE",
    storeId: "store-001",
    storeName: "Madhapur Flagship Lab",
    status: "ACTIVE",
    activeJobsCount: 2,
    createdAt: "2026-08-15T09:00:00Z",
  },
  {
    id: "emp-002",
    name: "Arjun Verma",
    email: "arjun.verma@flashfix.in",
    phone: "+91 97000 44556",
    role: "EMPLOYEE",
    storeId: "store-001",
    storeName: "Madhapur Flagship Lab",
    status: "ACTIVE",
    activeJobsCount: 3,
    createdAt: "2026-08-20T10:00:00Z",
  },
  {
    id: "emp-003",
    name: "Pooja Hegde",
    email: "pooja.hegde@flashfix.in",
    phone: "+91 99887 76655",
    role: "ADMIN",
    storeId: "store-001",
    storeName: "Madhapur Flagship Lab",
    status: "ACTIVE",
    activeJobsCount: 0,
    createdAt: "2026-07-01T08:30:00Z",
  },
  {
    id: "emp-004",
    name: "Karthik Nair",
    email: "karthik.nair@flashfix.in",
    phone: "+91 94401 23456",
    role: "EMPLOYEE",
    storeId: "store-002",
    storeName: "Kondapur Express Centre",
    status: "ACTIVE",
    activeJobsCount: 1,
    createdAt: "2026-09-10T11:00:00Z",
  },
  {
    id: "emp-005",
    name: "Ananya Rao",
    email: "ananya.rao@flashfix.in",
    phone: "+91 91234 56789",
    role: "EMPLOYEE",
    storeId: "store-003",
    storeName: "Banjara Hills Service Hub",
    status: "INVITED",
    activeJobsCount: 0,
    createdAt: "2026-10-25T14:00:00Z",
  },
];

const INITIAL_BOOKINGS: BookingRecord[] = [
  {
    id: "FF-104921",
    trackingCode: "TRK-104921",
    storeId: "store-001",
    brand: "Apple",
    deviceModel: "iPhone 16 Pro Max",
    issueType: "Screen Replacement",
    issueDescription: "Cracked display glass, touch unresponsive on left quadrant",
    scheduledDate: "2026-10-31",
    scheduledTime: "11:00 AM",
    pickupAddress: "Villa 12, Jayabheri Silicon County, Hitech City, Hyderabad",
    pickupLat: 17.4483,
    pickupLng: 78.3742,
    contactName: "Srinivas Rao",
    contactEmail: "srinivas.rao@gmail.com",
    contactPhone: "+91 98491 22334",
    status: "PENDING",
    estimatedCostPaise: 899900,
    notes: "Requires genuine OEM Grade-A panel replacement",
    createdAt: "2026-10-31T07:30:00Z",
    updatedAt: "2026-10-31T07:30:00Z",
  },
  {
    id: "FF-104918",
    trackingCode: "TRK-104918",
    storeId: "store-001",
    brand: "Samsung",
    deviceModel: "Galaxy S24 Ultra",
    issueType: "Battery Replacement",
    issueDescription: "Battery drains within 3 hours, slight swelling noted on rear panel",
    scheduledDate: "2026-10-31",
    scheduledTime: "10:30 AM",
    pickupAddress: "Flat 504, Aparna CyberLife, Nallagandla, Hyderabad",
    pickupLat: 17.4712,
    pickupLng: 78.3154,
    contactName: "Neha Kulkarni",
    contactEmail: "neha.k@outlook.com",
    contactPhone: "+91 99881 12233",
    status: "CONFIRMED",
    assignedEmployeeId: "emp-001",
    assignedEmployeeName: "Vikram Reddy",
    technicianId: "emp-002",
    technicianName: "Arjun Verma",
    estimatedCostPaise: 399900,
    createdAt: "2026-10-31T06:15:00Z",
    updatedAt: "2026-10-31T07:00:00Z",
  },
  {
    id: "FF-104910",
    trackingCode: "TRK-104910",
    storeId: "store-001",
    brand: "Google",
    deviceModel: "Pixel 9 Pro XL",
    issueType: "Camera Fix",
    issueDescription: "Main wide sensor autofocus hunting continuously",
    scheduledDate: "2026-10-31",
    scheduledTime: "9:00 AM",
    pickupAddress: "Plot 89, Kavuri Hills, Madhapur, Hyderabad",
    pickupLat: 17.4389,
    pickupLng: 78.3982,
    contactName: "Pradeep Menon",
    contactEmail: "pradeep.menon@techcorp.in",
    contactPhone: "+91 97112 33445",
    status: "IN_REPAIR",
    assignedEmployeeId: "emp-001",
    assignedEmployeeName: "Vikram Reddy",
    technicianId: "emp-002",
    technicianName: "Arjun Verma",
    estimatedCostPaise: 449900,
    createdAt: "2026-10-31T05:00:00Z",
    updatedAt: "2026-10-31T08:15:00Z",
  },
  {
    id: "FF-104930",
    trackingCode: "TRK-104930",
    storeId: "store-001",
    brand: "Apple",
    deviceModel: "iPad Pro 13 (M4)",
    issueType: "Display Repair",
    issueDescription: "OLED line artifact on right edge, arrived at hub awaiting custody check-in",
    scheduledDate: "2026-10-31",
    scheduledTime: "11:30 AM",
    pickupAddress: "Tower 2, Cyber Towers, Hitech City, Hyderabad",
    pickupLat: 17.4504,
    pickupLng: 78.3809,
    contactName: "Rajesh Kannan",
    contactEmail: "rajesh.k@innovate.co",
    contactPhone: "+91 98840 99881",
    status: "CUSTODY_OTP_SENT",
    assignedEmployeeId: "emp-001",
    assignedEmployeeName: "Vikram Reddy",
    technicianId: "emp-002",
    technicianName: "Arjun Verma",
    custodyOtp: "592184",
    estimatedCostPaise: 1450000,
    createdAt: "2026-10-31T06:00:00Z",
    updatedAt: "2026-10-31T08:30:00Z",
  },
  {
    id: "FF-104905",
    trackingCode: "TRK-104905",
    storeId: "store-002",
    brand: "OnePlus",
    deviceModel: "OnePlus 12",
    issueType: "Charging Port",
    issueDescription: "SuperVOOC fast charging not triggering, loose Type-C connector",
    scheduledDate: "2026-10-31",
    scheduledTime: "12:00 PM",
    pickupAddress: "Tower 3, My Home Bhooja, Silpa Gram Craft Village, Rai Durg",
    pickupLat: 17.4342,
    pickupLng: 78.3791,
    contactName: "Ayesha Khan",
    contactEmail: "ayesha.khan@gmail.com",
    contactPhone: "+91 96554 11223",
    status: "PICKUP_EN_ROUTE",
    assignedEmployeeId: "emp-004",
    assignedEmployeeName: "Karthik Nair",
    technicianId: "emp-002",
    technicianName: "Arjun Verma",
    pickupOtp: "849201",
    estimatedCostPaise: 249900,
    createdAt: "2026-10-31T06:45:00Z",
    updatedAt: "2026-10-31T08:45:00Z",
  },
  {
    id: "FF-104935",
    trackingCode: "TRK-104935",
    storeId: "store-001",
    brand: "Apple",
    deviceModel: "MacBook Air (M3)",
    issueType: "Battery Replacement",
    issueDescription: "OEM battery calibration complete, QA testing passed 100%",
    scheduledDate: "2026-10-31",
    scheduledTime: "1:00 PM",
    pickupAddress: "Plot 45, Jubilee Hills Check Post, Hyderabad",
    pickupLat: 17.4285,
    pickupLng: 78.4112,
    contactName: "Sunita Reddy",
    contactEmail: "sunita.r@venture.in",
    contactPhone: "+91 97001 88772",
    status: "REPAIR_COMPLETE",
    assignedEmployeeId: "emp-001",
    assignedEmployeeName: "Vikram Reddy",
    technicianId: "emp-002",
    technicianName: "Arjun Verma",
    estimatedCostPaise: 1199900,
    finalCostPaise: 1199900,
    createdAt: "2026-10-31T04:30:00Z",
    updatedAt: "2026-10-31T09:00:00Z",
  },
  {
    id: "FF-104899",
    trackingCode: "TRK-104899",
    storeId: "store-001",
    brand: "Apple",
    deviceModel: "iPhone 15",
    issueType: "Back Glass",
    issueDescription: "Rear frosted glass fractured",
    scheduledDate: "2026-10-31",
    scheduledTime: "8:30 AM",
    pickupAddress: "Banjara Hills Road 2, Hyderabad",
    pickupLat: 17.4168,
    pickupLng: 78.4385,
    contactName: "Deepak Chawla",
    contactEmail: "deepak.c@finance.com",
    contactPhone: "+91 98112 99887",
    status: "DELIVERED",
    assignedEmployeeId: "emp-001",
    assignedEmployeeName: "Vikram Reddy",
    technicianId: "emp-002",
    technicianName: "Arjun Verma",
    estimatedCostPaise: 549900,
    finalCostPaise: 549900,
    createdAt: "2026-10-30T14:00:00Z",
    updatedAt: "2026-10-31T09:15:00Z",
  },
  {
    id: "FF-104892",
    trackingCode: "TRK-104892",
    storeId: "store-003",
    brand: "Samsung",
    deviceModel: "Galaxy Z Fold 6",
    issueType: "Screen Replacement",
    issueDescription: "Inner flexible display crease flickering",
    scheduledDate: "2026-10-31",
    scheduledTime: "2:00 PM",
    pickupAddress: "Jubilee Hills Road 36, Hyderabad",
    pickupLat: 17.4325,
    pickupLng: 78.4071,
    contactName: "Harsh Vardhan",
    contactEmail: "harsh.v@gmail.com",
    contactPhone: "+91 99000 88776",
    status: "PENDING",
    estimatedCostPaise: 1899900,
    createdAt: "2026-10-31T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z",
  },
];

const INITIAL_INVENTORY: InventoryRecord[] = [
  {
    id: "inv-001",
    storeId: "store-001",
    partName: "iPhone 16 Pro Max OLED Panel",
    sku: "APL-SCR-16PM-OEM",
    compatibleWith: ["iPhone 16 Pro Max"],
    quantity: 3,
    minThreshold: 5,
    unitCostPaise: 550000,
    updatedAt: "2026-10-30T10:00:00Z",
  },
  {
    id: "inv-002",
    storeId: "store-001",
    partName: "Galaxy S24 Ultra 5000mAh Battery",
    sku: "SAM-BAT-S24U-OEM",
    compatibleWith: ["Galaxy S24 Ultra"],
    quantity: 8,
    minThreshold: 4,
    unitCostPaise: 210000,
    updatedAt: "2026-10-29T15:00:00Z",
  },
  {
    id: "inv-003",
    storeId: "store-001",
    partName: "Pixel 9 Pro Main Camera Module",
    sku: "GOOG-CAM-P9P-GEN",
    compatibleWith: ["Pixel 9 Pro", "Pixel 9 Pro XL"],
    quantity: 2,
    minThreshold: 3,
    unitCostPaise: 280000,
    updatedAt: "2026-10-28T12:00:00Z",
  },
  {
    id: "inv-004",
    storeId: "store-001",
    partName: "OnePlus 12 Sub-Board & Charging Port",
    sku: "OP-SUB-12-OEM",
    compatibleWith: ["OnePlus 12", "OnePlus 12R"],
    quantity: 12,
    minThreshold: 5,
    unitCostPaise: 120000,
    updatedAt: "2026-10-29T09:00:00Z",
  },
  {
    id: "inv-005",
    storeId: "store-001",
    partName: "iPhone 15 Pro Titanium Back Assembly",
    sku: "APL-BCK-15P-NAT",
    compatibleWith: ["iPhone 15 Pro"],
    quantity: 1,
    minThreshold: 4,
    unitCostPaise: 380000,
    updatedAt: "2026-10-30T16:30:00Z",
  },
];

// Persistent module-level state for session
let bookingsState: BookingRecord[] = [...INITIAL_BOOKINGS];
let staffState: StaffMember[] = [...INITIAL_STAFF];
let inventoryState: InventoryRecord[] = [...INITIAL_INVENTORY];

export async function getDashboardStats(storeId?: string): Promise<DashboardStats> {
  try {
    const res = await fetch(`/api/admin/dashboard${storeId && storeId !== "ALL" ? `?storeId=${storeId}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // Fall back to in-memory computation
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
        b.deviceModel.toLowerCase().includes(q) ||
        b.brand.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getBookingById(id: string): Promise<BookingRecord | null> {
  try {
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // Fall back to in-memory
  }
  return bookingsState.find((b) => b.id === id) || null;
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
        assignedEmployeeName: emp?.name || "Mobile Courier",
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
        notes: note ? (b.notes ? `${b.notes} | ${note}` : note) : b.notes,
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
    ...(booking?.status === "PICKUP_EN_ROUTE" || booking?.status === "PICKUP_OTP_SENT" || booking?.status === "IN_TRANSIT" || booking?.status === "CUSTODY_OTP_SENT" || booking?.status === "IN_REPAIR" || booking?.status === "REPAIR_COMPLETE" || booking?.status === "RETURN_EN_ROUTE" || booking?.status === "DELIVERED"
      ? [
          {
            id: "tr-3",
            bookingId,
            fromStatus: "CONFIRMED" as BookingStatus,
            toStatus: "PICKUP_EN_ROUTE" as BookingStatus,
            notes: "Mobile courier departed store towards consumer doorstep",
            triggeredByName: booking.assignedEmployeeName || "Vikram Reddy",
            createdAt: new Date(new Date(created).getTime() + 35 * 60000),
          },
        ]
      : []),
    ...(booking?.status === "IN_TRANSIT" || booking?.status === "CUSTODY_OTP_SENT" || booking?.status === "IN_REPAIR" || booking?.status === "REPAIR_COMPLETE" || booking?.status === "RETURN_EN_ROUTE" || booking?.status === "DELIVERED"
      ? [
          {
            id: "tr-4",
            bookingId,
            fromStatus: "PICKUP_OTP_SENT" as BookingStatus,
            toStatus: "IN_TRANSIT" as BookingStatus,
            notes: "Pickup handover authorized via consumer 6-digit OTP code",
            triggeredByName: booking.assignedEmployeeName || "Vikram Reddy",
            createdAt: new Date(new Date(created).getTime() + 55 * 60000),
          },
        ]
      : []),
    ...(booking?.status === "IN_REPAIR" || booking?.status === "REPAIR_COMPLETE" || booking?.status === "RETURN_EN_ROUTE" || booking?.status === "DELIVERED"
      ? [
          {
            id: "tr-5",
            bookingId,
            fromStatus: "CUSTODY_OTP_SENT" as BookingStatus,
            toStatus: "IN_REPAIR" as BookingStatus,
            notes: "Technician custody OTP validated at lab. Hardware diagnostics and repair active.",
            triggeredByName: booking.technicianName || "Arjun Verma",
            createdAt: new Date(new Date(created).getTime() + 75 * 60000),
          },
        ]
      : []),
    ...(booking?.status === "REPAIR_COMPLETE" || booking?.status === "RETURN_EN_ROUTE" || booking?.status === "DELIVERED"
      ? [
          {
            id: "tr-6",
            bookingId,
            fromStatus: "IN_REPAIR" as BookingStatus,
            toStatus: "REPAIR_COMPLETE" as BookingStatus,
            notes: "OEM parts installed, complete multi-point QA checks verified.",
            triggeredByName: booking.technicianName || "Arjun Verma",
            createdAt: new Date(new Date(created).getTime() + 110 * 60000),
          },
        ]
      : []),
  ];
}

export async function getTeamMembers(storeId?: string): Promise<StaffMember[]> {
  try {
    const res = await fetch(`/api/admin/team${storeId && storeId !== "ALL" ? `?storeId=${storeId}` : ""}`);
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

export async function updateTeamMemberRole(
  staffId: string,
  newRole: UserRole
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/team/${staffId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) return true;
  } catch {
    // In-memory update
  }

  staffState = staffState.map((s) => (s.id === staffId ? { ...s, role: newRole } : s));
  return true;
}

export async function getInventory(storeId?: string): Promise<InventoryRecord[]> {
  try {
    const res = await fetch(`/api/admin/inventory${storeId && storeId !== "ALL" ? `?storeId=${storeId}` : ""}`);
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

export async function updateInventoryStock(
  itemId: string,
  newQuantity: number
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/inventory/${itemId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQuantity }),
    });
    if (res.ok) return true;
  } catch {
    // Proceed
  }

  inventoryState = inventoryState.map((i) =>
    i.id === itemId ? { ...i, quantity: newQuantity, updatedAt: new Date().toISOString() } : i
  );
  return true;
}

// ─────────────────────────────────────────────────────────────
// Physical Handover & Two-Factor OTP Operations
// ─────────────────────────────────────────────────────────────

export async function startPickupRoute(bookingId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/bookings/${bookingId}/start-pickup`, { method: "POST" });
    if (res.ok) return true;
  } catch {
    // Fallback
  }
  return updateBookingStatus(bookingId, "PICKUP_EN_ROUTE", "Courier started transit towards customer doorstep");
}

export async function sendPickupOtp(bookingId: string): Promise<{ success: boolean; otp?: string; message?: string }> {
  const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
  try {
    const res = await fetch(`/api/bookings/${bookingId}/send-pickup-otp`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      return { success: true, otp: data.otp || generatedOtp, message: "Pickup OTP dispatched to customer via email" };
    }
  } catch {
    // Fallback
  }

  bookingsState = bookingsState.map((b) =>
    b.id === bookingId ? { ...b, status: "PICKUP_OTP_SENT" as BookingStatus, pickupOtp: generatedOtp } : b
  );
  return { success: true, otp: generatedOtp, message: `Doorstep OTP [${generatedOtp}] generated & dispatched to customer email.` };
}

export async function verifyPickupOtp(
  bookingId: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/bookings/${bookingId}/verify-pickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      bookingsState = bookingsState.map((item) =>
        item.id === bookingId ? { ...item, status: "IN_TRANSIT" as BookingStatus, updatedAt: new Date().toISOString() } : item
      );
      return { success: true };
    }
    if (data?.error?.message) {
      return { success: false, error: data.error.message };
    }
  } catch {
    // Fallback verification below
  }

  if (!otp || otp.length !== 6) {
    return { success: false, error: "6-digit OTP code required" };
  }

  const b = bookingsState.find((item) => item.id === bookingId);
  const isDemo = process.env.NODE_ENV !== "production" && otp === "123456";
  const isMatch = (b?.pickupOtp && b.pickupOtp === otp) || isDemo;

  if (!isMatch) {
    return { success: false, error: "Invalid doorstep verification code. Please request customer to provide the 6-digit OTP." };
  }

  // Consume OTP and advance status to prevent replay
  bookingsState = bookingsState.map((item) => {
    if (item.id === bookingId) {
      const updated = { ...item, status: "IN_TRANSIT" as BookingStatus, updatedAt: new Date().toISOString() };
      delete updated.pickupOtp;
      return updated;
    }
    return item;
  });
  return { success: true };
}

export async function sendCustodyOtp(bookingId: string): Promise<{ success: boolean; otp?: string; message?: string }> {
  const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
  try {
    const res = await fetch(`/api/bookings/${bookingId}/send-custody-otp`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      const code = data.otp || generatedOtp;
      bookingsState = bookingsState.map((b) =>
        b.id === bookingId ? { ...b, status: "CUSTODY_OTP_SENT" as BookingStatus, custodyOtp: code } : b
      );
      return { success: true, otp: code, message: "Custody OTP dispatched to lab technician" };
    }
  } catch {
    // Fallback
  }

  bookingsState = bookingsState.map((b) =>
    b.id === bookingId ? { ...b, status: "CUSTODY_OTP_SENT" as BookingStatus, custodyOtp: generatedOtp } : b
  );
  return { success: true, otp: generatedOtp, message: `Custody handover OTP [${generatedOtp}] sent to lab technician.` };
}

export async function verifyCustodyOtp(
  bookingId: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/bookings/${bookingId}/verify-custody`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      bookingsState = bookingsState.map((item) =>
        item.id === bookingId ? { ...item, status: "IN_REPAIR" as BookingStatus, updatedAt: new Date().toISOString() } : item
      );
      return { success: true };
    }
    if (data?.error?.message) {
      return { success: false, error: data.error.message };
    }
  } catch {
    // Fallback verification below
  }

  if (!otp || otp.length !== 6) {
    return { success: false, error: "6-digit OTP code required" };
  }

  const b = bookingsState.find((item) => item.id === bookingId);
  const isDemo = process.env.NODE_ENV !== "production" && otp === "123456";
  const isMatch = (b?.custodyOtp && b.custodyOtp === otp) || isDemo;

  if (!isMatch) {
    return { success: false, error: "Invalid custody verification code. Please verify the code displayed on technician console." };
  }

  // Consume OTP and advance status to prevent replay
  bookingsState = bookingsState.map((item) => {
    if (item.id === bookingId) {
      const updated = { ...item, status: "IN_REPAIR" as BookingStatus, updatedAt: new Date().toISOString() };
      delete updated.custodyOtp;
      return updated;
    }
    return item;
  });
  return { success: true };
}

export async function markRepairComplete(
  bookingId: string,
  finalCostPaise?: number,
  note?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REPAIR_COMPLETE", finalCostPaise, note }),
    });
    if (res.ok) return true;
  } catch {
    // Fallback below
  }

  try {
    const res = await fetch(`/api/bookings/${bookingId}/repair-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalCostPaise, note }),
    });
    if (res.ok) return true;
  } catch {
    // Fallback below
  }

  bookingsState = bookingsState.map((b) =>
    b.id === bookingId
      ? {
          ...b,
          status: "REPAIR_COMPLETE" as BookingStatus,
          finalCostPaise: finalCostPaise || b.estimatedCostPaise,
          notes: note ? (b.notes ? `${b.notes} | ${note}` : note) : b.notes,
          updatedAt: new Date().toISOString(),
        }
      : b
  );
  return true;
}

export async function startReturnDelivery(bookingId: string): Promise<boolean> {
  return updateBookingStatus(bookingId, "RETURN_EN_ROUTE", "Device repair complete; return courier departed hub towards customer doorstep");
}

export async function completeDelivery(bookingId: string): Promise<boolean> {
  return updateBookingStatus(bookingId, "DELIVERED", "Device returned and verified by customer. Service complete.");
}
