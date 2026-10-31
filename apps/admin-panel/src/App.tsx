import { useState, useEffect, useCallback } from "react";
import Navbar, { AdminTab } from "./components/Navbar";
import DashboardView from "./components/DashboardView";
import BookingsView from "./components/BookingsView";
import TeamView from "./components/TeamView";
import InventoryView from "./components/InventoryView";
import BookingDetailModal from "./components/BookingDetailModal";
import AssignStaffModal from "./components/AssignStaffModal";
import InviteEmployeeModal from "./components/InviteEmployeeModal";
import {
  BookingRecord,
  DashboardStats,
  StaffMember,
  InventoryRecord,
} from "./types";
import {
  getDashboardStats,
  getBookingsList,
  getTeamMembers,
  getInventory,
} from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [selectedStore, setSelectedStore] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // State data
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
      console.error("Failed to load admin panel data:", err);
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

  function handleNavigateToBookings(filter?: string) {
    if (filter) {
      setStatusFilter(filter);
    }
    setActiveTab("bookings");
  }

  function handleAssignClick(booking: BookingRecord) {
    setBookingToAssign(booking);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f0eb] flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedStore={selectedStore}
        onStoreChange={(storeId) => {
          setSelectedStore(storeId);
          setLoading(true);
        }}
        unassignedCount={stats.unassignedCount}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-2 border-[#ef8f0b] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-mono text-xs uppercase tracking-widest text-[#807a75]">
              Loading Operations Telemetry...
            </p>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardView
                stats={stats}
                recentBookings={bookings}
                onSelectBooking={(b) => setSelectedBooking(b)}
                onNavigateToBookings={handleNavigateToBookings}
                onAssignBooking={handleAssignClick}
              />
            )}

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

            {activeTab === "team" && (
              <TeamView
                staffList={staff}
                selectedStore={selectedStore}
                onStoreChange={setSelectedStore}
                onOpenInviteModal={() => setIsInviteModalOpen(true)}
              />
            )}

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

      {/* Modals */}
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onBookingUpdated={() => {
          loadData();
          // Update selected booking with fresh data
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
    </div>
  );
}
