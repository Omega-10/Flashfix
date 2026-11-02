import {
  BookingRecord,
  DashboardStats,
  StaffMember,
  AuditTrailItem,
  InventoryRecord,
  StoreOption,
  StaffSession,
  SupportSettings,
} from "./types";
import { BookingStatus, UserRole } from "@flashfix/shared";

// Active stores cache (populated exclusively from /api/admin/stores)
export let STORES: StoreOption[] = [];

const STAFF_SESSION_KEY = "flashfix_staff_session";

export function getStaffSession(): StaffSession | null {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (raw) {
      return JSON.parse(raw) as StaffSession;
    }
    const ffUser = localStorage.getItem("ff_user");
    if (ffUser) {
      const parsed = JSON.parse(ffUser);
      if (parsed && parsed.role && parsed.role !== "CONSUMER") {
        const token = localStorage.getItem("accessToken") || "cookie-session";
        return { token, user: parsed };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function setStaffSession(session: StaffSession): void {
  try {
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error("Failed to save staff session:", err);
  }
}

export function clearStaffSession(): void {
  try {
    localStorage.removeItem(STAFF_SESSION_KEY);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("ff_user");
  } catch {
    // ignore
  }
}

export function isStaffAuthenticated(): boolean {
  return !!getStaffSession()?.user;
}

export function getStaffAuthHeaders(): Record<string, string> {
  const session = getStaffSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.token && session.token !== "cookie-session") {
    headers.Authorization = `Bearer ${session.token}`;
  }
  if (session?.user?.email) {
    headers["x-staff-email"] = session.user.email;
  }
  return headers;
}

export async function adminLogin(email: string, password: string): Promise<StaffSession> {
  const res = await fetch("/api/auth/staff-login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe: true }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.user) {
    throw new Error(data?.error?.message || "Invalid credentials or staff privileges not assigned.");
  }

  const session: StaffSession = {
    token: data.token || "cookie-session",
    user: data.user,
  };
  setStaffSession(session);
  return session;
}

export async function getStores(): Promise<StoreOption[]> {
  try {
    const res = await fetch("/api/admin/stores", {
      credentials: "include",
      headers: getStaffAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const list = data.data || data;
      if (Array.isArray(list)) {
        STORES = list;
        return list;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live stores:", err);
  }
  return STORES;
}

export async function createStore(storeData: {
  id?: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  hours?: string;
  lat?: number | string;
  lng?: number | string;
  assignedAdminIds?: string[];
}): Promise<StoreOption> {
  const res = await fetch("/api/admin/stores", {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify(storeData),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error?.message || "Failed to create store.");
  }

  await getStores();
  return data.data;
}

export async function toggleStoreStatus(storeId: string): Promise<boolean> {
  const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}/toggle`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify({ storeId, action: "toggle" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to toggle store status.");
  }
  await getStores();
  return true;
}

export async function deleteStore(storeId: string): Promise<boolean> {
  const res = await fetch(`/api/admin/stores/${encodeURIComponent(storeId)}`, {
    method: "DELETE",
    credentials: "include",
    headers: getStaffAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to delete store.");
  }
  await getStores();
  return true;
}

export async function assignStoreAdmins(storeId: string, adminUserIds: string[]): Promise<boolean> {
  const res = await fetch("/api/admin/stores/assign-admins", {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify({ storeId, adminUserIds, action: "assign_admins" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Failed to assign admins to store.");
  }

  await getStores();
  return true;
}

export async function getDashboardStats(storeId?: string): Promise<DashboardStats> {
  try {
    const res = await fetch(
      `/api/admin/dashboard${storeId && storeId !== "ALL" ? `?storeId=${encodeURIComponent(storeId)}` : ""}`,
      {
        credentials: "include",
        headers: getStaffAuthHeaders(),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch (err) {
    console.warn("Failed to fetch dashboard stats:", err);
  }

  return {
    todayTotal: 0,
    pending: 0,
    inRepair: 0,
    delivered: 0,
    unassignedCount: 0,
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

    const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
      credentials: "include",
      headers: getStaffAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const list = data.data || data;
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch bookings list:", err);
  }
  return [];
}

export async function getBookingById(id: string): Promise<BookingRecord | null> {
  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
      credentials: "include",
      headers: getStaffAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.data || data;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function assignStaffToBooking(
  bookingId: string,
  employeeId: string,
  technicianId?: string
): Promise<boolean> {
  const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/assign`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify({ employeeId, technicianId }),
  });
  return res.ok;
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  note?: string
): Promise<boolean> {
  const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify({ status, note }),
  });
  return res.ok;
}

export async function getBookingTrail(bookingId: string): Promise<AuditTrailItem[]> {
  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/trail`, {
      credentials: "include",
      headers: getStaffAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const list = data.data || data;
      if (Array.isArray(list)) return list;
    }
  } catch {
    // ignore
  }
  return [];
}

export async function getTeamMembers(storeId?: string): Promise<StaffMember[]> {
  try {
    const res = await fetch(
      `/api/admin/team${storeId && storeId !== "ALL" ? `?storeId=${encodeURIComponent(storeId)}` : ""}`,
      {
        credentials: "include",
        headers: getStaffAuthHeaders(),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const list = data.data || data;
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch team members:", err);
  }
  return [];
}

export async function inviteTeamMember(data: {
  email: string;
  name: string;
  phone?: string;
  password?: string;
  role: "EMPLOYEE" | "ADMIN" | "TECHNICIAN" | "SUPER_ADMIN";
  storeId: string;
}): Promise<StaffMember> {
  const res = await fetch("/api/admin/team", {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify(data),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData?.error?.message || "Failed to add staff member.");
  }
  return resData.data || resData;
}

export async function updateTeamMemberRole(
  staffId: string,
  newRole: UserRole,
  storeId?: string
): Promise<boolean> {
  const res = await fetch(`/api/admin/team/${encodeURIComponent(staffId)}/role`, {
    method: "PATCH",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify({ role: newRole, storeId }),
  });
  return res.ok;
}

export async function getInventory(storeId?: string): Promise<InventoryRecord[]> {
  try {
    const res = await fetch(
      `/api/admin/inventory${storeId && storeId !== "ALL" ? `?storeId=${encodeURIComponent(storeId)}` : ""}`,
      {
        credentials: "include",
        headers: getStaffAuthHeaders(),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const list = data.data || data;
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch inventory:", err);
  }
  return [];
}

export async function upsertInventoryItem(data: {
  id?: string;
  storeId: string;
  partName: string;
  sku: string;
  compatibleWith: string[] | string;
  quantity: number;
  minThreshold: number;
  unitCostPaise: number;
}): Promise<InventoryRecord> {
  const res = await fetch("/api/admin/inventory", {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify(data),
  });
  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(resData?.error?.message || "Failed to save inventory item.");
  }
  return resData.data;
}

export async function updateInventoryStock(
  itemId: string,
  newQuantity: number
): Promise<boolean> {
  const res = await fetch(`/api/admin/inventory/${encodeURIComponent(itemId)}/stock`, {
    method: "PATCH",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify({ quantity: newQuantity }),
  });
  return res.ok;
}

export async function getSupportSettings(): Promise<SupportSettings> {
  try {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (res.ok) {
      const body = await res.json();
      return body.data || body;
    }
  } catch {
    // ignore
  }
  return {
    supportEmail: "support@flashfix.in",
    supportPhone: "+91 80 4821 7700",
    supportHours: "9 AM – 9 PM, Mon–Sun",
  };
}

export async function updateSupportSettings(settings: SupportSettings): Promise<SupportSettings> {
  const res = await fetch("/api/admin/settings", {
    method: "PUT",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify(settings),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to update support settings.");
  }
  return data.data;
}

export async function startPickupRoute(bookingId: string): Promise<boolean> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/start-pickup`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
  });
  return res.ok;
}

export async function sendPickupOtp(bookingId: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/send-pickup-otp`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, message: data?.error?.message || "Failed to send pickup OTP." };
  }
  return { success: true, message: data.message || "Pickup OTP sent to customer email." };
}

export async function verifyPickupOtp(
  bookingId: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  if (!otp || otp.length !== 6) {
    return { success: false, error: "6-digit verification code is required." };
  }

  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/verify-pickup`, {
      method: "POST",
      credentials: "include",
      headers: getStaffAuthHeaders(),
      body: JSON.stringify({ otp }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      return { success: true };
    }
    return {
      success: false,
      error: data?.error?.message || "Invalid verification code. Please ask the customer for the 6-digit pickup code.",
    };
  } catch {
    return { success: false, error: "Network error while verifying pickup code." };
  }
}

export async function sendCustodyOtp(bookingId: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/send-custody-otp`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, message: data?.error?.message || "Failed to send custody OTP." };
  }
  return { success: true, message: data.message || "Custody OTP dispatched to lab technician." };
}

export async function verifyCustodyOtp(
  bookingId: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  if (!otp || otp.length !== 6) {
    return { success: false, error: "6-digit verification code is required." };
  }

  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/verify-custody`, {
      method: "POST",
      credentials: "include",
      headers: getStaffAuthHeaders(),
      body: JSON.stringify({ otp }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      return { success: true };
    }
    return {
      success: false,
      error: data?.error?.message || "Invalid custody code.",
    };
  } catch {
    return { success: false, error: "Network error while verifying custody code." };
  }
}

export async function markRepairComplete(
  bookingId: string,
  finalCostPaise?: number,
  note?: string
): Promise<boolean> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/repair-complete`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
    body: JSON.stringify({ finalCostPaise, note }),
  });
  return res.ok;
}

export async function startReturnDelivery(bookingId: string): Promise<boolean> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/start-return`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
  });
  return res.ok;
}

export async function completeDelivery(bookingId: string): Promise<boolean> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/deliver`, {
    method: "POST",
    credentials: "include",
    headers: getStaffAuthHeaders(),
  });
  return res.ok;
}
