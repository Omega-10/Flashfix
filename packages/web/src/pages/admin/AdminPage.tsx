import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminNavbar from "@/components/admin/AdminNavbar";
import DashboardView from "@/components/admin/DashboardView";
import SuperadminView from "@/components/admin/SuperadminView";
import TechnicianView from "@/components/admin/TechnicianView";
import DeliveryPersonView from "@/components/admin/DeliveryPersonView";
import BookingsView from "@/components/admin/BookingsView";
import TeamView from "@/components/admin/TeamView";
import InventoryView from "@/components/admin/InventoryView";
import BookingDetailModal from "@/components/admin/BookingDetailModal";
import AssignStaffModal from "@/components/admin/AssignStaffModal";
import InviteEmployeeModal from "@/components/admin/InviteEmployeeModal";
import OtpVerificationModal from "@/components/admin/OtpVerificationModal";
import {
  AdminTab,
  AdminRole,
  BookingRecord,
  DashboardStats,
  StaffMember,
  InventoryRecord,
  StoreOption,
  StaffSessionUser,
} from "@/components/admin/types";
import {
  getDashboardStats,
  getBookingsList,
  getTeamMembers,
  getInventory,
  getStores,
  getStaffSession,
  clearStaffSession,
  STORES,
} from "@/components/admin/api";

interface AdminPageProps {
  initialTab?: AdminTab;
}

export default function AdminPage({ initialTab }: AdminPageProps) {
  const { tab: paramTab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // Validate or determine active tab from route param or prop
  const tabAliasMap: Record<string, AdminTab> = {
    overview: "dashboard",
    runs: "delivery",
    queue: "technician",
    staff: "team",
    stores: "superadmin",
    settings: "superadmin",
  };
  const resolvedParamTab = paramTab ? (tabAliasMap[paramTab] || paramTab) : undefined;

  const validTabs: AdminTab[] = [
    "dashboard",
    "superadmin",
    "technician",
    "delivery",
    "bookings",
    "team",
    "inventory",
  ];

  const derivedTab = (resolvedParamTab && validTabs.includes(resolvedParamTab as AdminTab)
    ? (resolvedParamTab as AdminTab)
    : initialTab || "dashboard");

  const [activeTab, setActiveTab] = useState<AdminTab>(derivedTab);
  const [staffUser, setStaffUser] = useState<StaffSessionUser | null>(null);
  const [currentRole, setCurrentRole] = useState<AdminRole>("ADMIN");
  const [selectedStore, setSelectedStore] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [stores, setStores] = useState<StoreOption[]>(STORES);

  // Authentication & Session Guard
  useEffect(() => {
    let cancelled = false;
    async function verifyStaff() {
      const session = getStaffSession();
      if (session?.user) {
        if (!cancelled) {
          setStaffUser(session.user);
          const role = session.user.role;
          setCurrentRole(role);
          if (role === "SUPER_ADMIN") {
            setSelectedStore("ALL");
          } else if (session.user.storeIds && session.user.storeIds.length > 0) {
            setSelectedStore(session.user.storeIds[0]);
          } else if (session.user.storeId) {
            setSelectedStore(session.user.storeId);
          }
        }
        return;
      }

      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) navigate("/login", { replace: true });
          return;
        }
        const data = await res.json();
        const me = data?.user || data?.data;
        if (!me || me.role === "CONSUMER") {
          if (!cancelled) navigate("/login", { replace: true });
          return;
        }
        if (!cancelled) {
          setStaffUser(me);
          setCurrentRole(me.role);
          if (me.role === "SUPER_ADMIN") {
            setSelectedStore("ALL");
          } else if (me.storeIds && me.storeIds.length > 0) {
            setSelectedStore(me.storeIds[0]);
          } else if (me.storeId) {
            setSelectedStore(me.storeId);
          }
        }
      } catch {
        if (!cancelled) navigate("/login", { replace: true });
      }
    }
    verifyStaff();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Keep state synchronized with URL param and check role authority
  useEffect(() => {
    if (resolvedParamTab && validTabs.includes(resolvedParamTab as AdminTab)) {
      const tab = resolvedParamTab as AdminTab;
      if (tab === "superadmin" && currentRole !== "SUPER_ADMIN") {
        navigate("/admin/dashboard", { replace: true });
        return;
      }
      if (tab === "technician" && currentRole !== "SUPER_ADMIN" && currentRole !== "TECHNICIAN") {
        navigate("/admin/dashboard", { replace: true });
        return;
      }
      if (
        tab === "delivery" &&
        currentRole !== "SUPER_ADMIN" &&
        currentRole !== "COURIER" &&
        currentRole !== "EMPLOYEE"
      ) {
        navigate("/admin/dashboard", { replace: true });
        return;
      }
      setActiveTab(tab);
    }
  }, [resolvedParamTab, currentRole, navigate]);

  // Operational telemetry state
  const [stats, setStats] = useState<DashboardStats>({
    todayTotal: 0,
    pending: 0,
    inRepair: 0,
    delivered: 0,
    unassignedCount: 0,
  });
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [bookingToAssign, setBookingToAssign] = useState<BookingRecord | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [otpModalConfig, setOtpModalConfig] = useState<{
    bookingId: string;
    purpose: "PICKUP" | "CUSTODY";
    title: string;
    description: string;
    onSuccess: () => void;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsData, bookingsData, staffData, inventoryData, storesData] = await Promise.all([
        getDashboardStats(selectedStore),
        getBookingsList({ storeId: selectedStore }),
        getTeamMembers(selectedStore),
        getInventory(selectedStore),
        getStores(),
      ]);

      setStats(statsData);
      setBookings(bookingsData);
      setStaff(staffData);
      setInventory(inventoryData);
      if (storesData && storesData.length > 0) {
        setStores(storesData);
      }
    } catch (err) {
      console.error("Failed to load operations telemetry:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Periodic 30s background sync
  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  function handleTabChange(tab: AdminTab) {
    setActiveTab(tab);
    navigate(`/admin/${tab}`);
  }

  function handleLogout() {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    clearStaffSession();
    navigate("/login", { replace: true });
  }

  function handleNavigateToBookings(filter?: string) {
    if (filter) {
      setStatusFilter(filter);
    }
    handleTabChange("bookings");
  }

  function handleAssignClick(booking: BookingRecord) {
    setBookingToAssign(booking);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f0eb] flex flex-col font-sans">
      <AdminNavbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        selectedStore={selectedStore}
        onStoreChange={(storeId) => {
          setSelectedStore(storeId);
          setLoading(true);
        }}
        unassignedCount={stats.unassignedCount}
        currentRole={currentRole}
        staffUser={staffUser}
        onLogout={handleLogout}
        stores={stores}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-20 md:pb-8">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-2 border-[#ef8f0b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-mono text-xs uppercase tracking-widest text-[#807a75]">
              Loading Operations Telemetry...
            </p>
          </div>
        ) : (
          <>
            {/* 1. Admin View */}
            {activeTab === "dashboard" && (
              <DashboardView
                stats={stats}
                recentBookings={bookings}
                onSelectBooking={(b) => setSelectedBooking(b)}
                onNavigateToBookings={handleNavigateToBookings}
                onAssignBooking={handleAssignClick}
              />
            )}

            {/* 2. Superadmin View */}
            {activeTab === "superadmin" && (
              <SuperadminView
                bookings={bookings}
                staff={staff}
                inventory={inventory}
                selectedStore={selectedStore}
                onStoreChange={setSelectedStore}
                onOpenInviteModal={() => setIsInviteModalOpen(true)}
                onSelectBooking={(b) => setSelectedBooking(b)}
                onRefreshData={loadData}
                stores={stores}
              />
            )}

            {/* 3. Technician View */}
            {activeTab === "technician" && (
              <TechnicianView
                bookings={bookings}
                inventory={inventory}
                selectedStore={selectedStore}
                onSelectBooking={(b) => setSelectedBooking(b)}
                onOpenOtpModal={(cfg) => setOtpModalConfig(cfg)}
                onRefreshData={loadData}
              />
            )}

            {/* 4. Delivery Person View */}
            {activeTab === "delivery" && (
              <DeliveryPersonView
                bookings={bookings}
                selectedStore={selectedStore}
                onSelectBooking={(b) => setSelectedBooking(b)}
                onOpenOtpModal={(cfg) => setOtpModalConfig(cfg)}
                onRefreshData={loadData}
              />
            )}

            {/* 5. Bookings Ledger */}
            {activeTab === "bookings" && (
              <BookingsView
                bookings={bookings}
                selectedStore={selectedStore}
                onStoreChange={setSelectedStore}
                onSelectBooking={(b) => setSelectedBooking(b)}
                onAssignBooking={handleAssignClick}
                initialStatusFilter={statusFilter}
              />
            )}

            {/* 6. Team & Staff */}
            {activeTab === "team" && (
              <TeamView
                staffList={staff}
                selectedStore={selectedStore}
                onStoreChange={setSelectedStore}
                onOpenInviteModal={() => setIsInviteModalOpen(true)}
              />
            )}

            {/* 7. Parts Inventory */}
            {activeTab === "inventory" && (
              <InventoryView
                inventory={inventory}
                selectedStore={selectedStore}
                onStoreChange={setSelectedStore}
              />
            )}
          </>
        )}
      </main>

      {/* ── Operations Modals ── */}
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onBookingUpdated={() => {
          loadData();
          if (selectedBooking) {
            getBookingsList().then((list) => {
              const fresh = list.find((b) => b.id === selectedBooking.id);
              if (fresh) setSelectedBooking(fresh);
            });
          }
        }}
        onOpenAssignModal={(b) => {
          setSelectedBooking(null);
          setBookingToAssign(b);
        }}
      />

      <AssignStaffModal
        booking={bookingToAssign}
        staffList={staff}
        onClose={() => setBookingToAssign(null)}
        onAssigned={() => {
          loadData();
        }}
      />

      {isInviteModalOpen && (
        <InviteEmployeeModal
          onClose={() => setIsInviteModalOpen(false)}
          onInvited={() => {
            loadData();
          }}
        />
      )}

      {otpModalConfig && (
        <OtpVerificationModal
          config={otpModalConfig}
          onClose={() => setOtpModalConfig(null)}
        />
      )}
    </div>
  );
}
