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
} from "@/components/admin/types";
import {
  getDashboardStats,
  getBookingsList,
  getTeamMembers,
  getInventory,
} from "@/components/admin/api";

interface AdminPageProps {
  initialTab?: AdminTab;
}

export default function AdminPage({ initialTab }: AdminPageProps) {
  const { tab: paramTab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  // Validate or determine active tab from route param or prop
  const validTabs: AdminTab[] = [
    "dashboard",
    "superadmin",
    "technician",
    "delivery",
    "bookings",
    "team",
    "inventory",
  ];

  const derivedTab = (paramTab && validTabs.includes(paramTab as AdminTab)
    ? (paramTab as AdminTab)
    : initialTab || "dashboard");

  const [activeTab, setActiveTab] = useState<AdminTab>(derivedTab);
  const [currentRole, setCurrentRole] = useState<AdminRole>("SUPER_ADMIN");
  const [selectedStore, setSelectedStore] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Keep state synchronized with URL param
  useEffect(() => {
    if (paramTab && validTabs.includes(paramTab as AdminTab)) {
      setActiveTab(paramTab as AdminTab);
    }
  }, [paramTab]);

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
      const [statsData, bookingsData, staffData, inventoryData] = await Promise.all([
        getDashboardStats(selectedStore),
        getBookingsList({ storeId: selectedStore }),
        getTeamMembers(selectedStore),
        getInventory(selectedStore),
      ]);

      setStats(statsData);
      setBookings(bookingsData);
      setStaff(staffData);
      setInventory(inventoryData);
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

  function handleRoleChange(role: AdminRole) {
    setCurrentRole(role);
    switch (role) {
      case "SUPER_ADMIN":
        handleTabChange("superadmin");
        break;
      case "ADMIN":
        handleTabChange("dashboard");
        break;
      case "TECHNICIAN":
        handleTabChange("technician");
        break;
      case "COURIER":
        handleTabChange("delivery");
        break;
    }
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
        onRoleChange={handleRoleChange}
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
