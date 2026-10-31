import { useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  Smartphone,
  UserCheck,
  Eye,
  X,
  Store as StoreIcon,
} from "lucide-react";
import { BookingRecord } from "../types";
import { STORES } from "../api";
import { BOOKING_STATUSES } from "@flashfix/shared";

interface BookingsViewProps {
  bookings: BookingRecord[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  onSelectBooking: (booking: BookingRecord) => void;
  onAssignBooking: (booking: BookingRecord) => void;
  initialStatusFilter?: string;
}

export default function BookingsView({
  bookings,
  selectedStore,
  onStoreChange,
  onSelectBooking,
  onAssignBooking,
  initialStatusFilter = "ALL",
}: BookingsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [dateFilter, setDateFilter] = useState("");

  const filteredBookings = bookings.filter((b) => {
    // Store filter
    if (selectedStore !== "ALL" && b.storeId !== selectedStore) return false;

    // Status filter
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;

    // Date filter
    if (dateFilter && b.scheduledDate !== dateFilter) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchId = b.id.toLowerCase().includes(q);
      const matchName = b.contactName.toLowerCase().includes(q);
      const matchPhone = b.contactPhone.toLowerCase().includes(q);
      const matchModel = b.deviceModel.toLowerCase().includes(q);
      const matchBrand = b.brand.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPhone && !matchModel && !matchBrand) return false;
    }

    return true;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return { label: "Pending", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "CONFIRMED":
        return { label: "Assigned", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      case "PICKUP_EN_ROUTE":
      case "PICKUP_OTP_SENT":
        return { label: "Pickup En Route", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
      case "IN_TRANSIT":
        return { label: "In Transit", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
      case "IN_REPAIR":
      case "CUSTODY_OTP_SENT":
        return { label: "In Repair", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "REPAIR_COMPLETE":
        return { label: "Repair Done", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "RETURN_EN_ROUTE":
        return { label: "Return En Route", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
      case "DELIVERED":
        return { label: "Delivered", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "CANCELLED":
        return { label: "Cancelled", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
      default:
        return { label: status, color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
    }
  }

  function getStoreName(storeId: string) {
    const s = STORES.find((st) => st.id === storeId);
    return s ? s.name : storeId;
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f5f0eb]">
            Bookings & Dispatch Ledger
          </h1>
          <p className="text-xs text-[#807a75]">
            Manage, filter, and allocate staff to customer service orders
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#a8a09a]">
          <span>Showing: <strong className="text-[#f5f0eb]">{filteredBookings.length}</strong> entries</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#141414] border border-[rgba(255,255,255,0.08)] flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#807a75]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, customer name, phone, or model..."
            className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#f5f0eb] placeholder-[#807a75] outline-none focus:border-[#ef8f0b] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#807a75] hover:text-[#f5f0eb]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Store Filter */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs">
          <StoreIcon className="w-3.5 h-3.5 text-[#ef8f0b]" />
          <select
            value={selectedStore}
            onChange={(e) => onStoreChange(e.target.value)}
            className="bg-transparent text-[#f5f0eb] outline-none text-xs cursor-pointer"
          >
            <option value="ALL" className="bg-[#141414]">All Stores</option>
            {STORES.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#141414]">{s.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-[#ef8f0b]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-[#f5f0eb] outline-none text-xs cursor-pointer"
          >
            <option value="ALL" className="bg-[#141414]">All Statuses</option>
            {BOOKING_STATUSES.map((st) => (
              <option key={st} value={st} className="bg-[#141414]">{st}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-[#ef8f0b]" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent text-[#f5f0eb] outline-none text-xs cursor-pointer"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter("")} className="text-[#807a75] hover:text-[#f5f0eb]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bookings Ledger Table */}
      <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1a1a1a] text-[#807a75] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Customer Contact</th>
                <th className="px-5 py-3.5">Device & Problem</th>
                <th className="px-5 py-3.5">Assigned Store</th>
                <th className="px-5 py-3.5">Scheduled Slot</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Staff Assignment</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)] text-[#f5f0eb]">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-[#807a75]">
                    No bookings found matching selected filters.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const badge = getStatusBadge(b.status);
                  const isUnassigned = !b.assignedEmployeeName;
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-[#1a1a1a]/60 transition-colors cursor-pointer"
                      onClick={() => onSelectBooking(b)}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-[#ef8f0b]">
                        {b.id}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#f5f0eb]">{b.contactName}</div>
                        <div className="text-[11px] text-[#807a75]">{b.contactPhone}</div>
                        <div className="text-[10px] text-[#6b6460] truncate max-w-[140px]">{b.contactEmail}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-[#f5f0eb]">
                          <Smartphone className="w-3.5 h-3.5 text-[#ef8f0b]" />
                          <span>{b.brand} {b.deviceModel}</span>
                        </div>
                        <div className="text-[11px] text-[#a8a09a] mt-0.5">{b.issueType}</div>
                      </td>
                      <td className="px-5 py-4 text-[#a8a09a] text-[11px]">
                        {getStoreName(b.storeId)}
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-[#a8a09a]">
                        <div>{b.scheduledDate}</div>
                        <div className="text-[10px] text-[#807a75]">{b.scheduledTime}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.color}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-[11px] font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            Unassigned
                          </span>
                        ) : (
                          <div className="text-xs">
                            <span className="font-medium text-[#f5f0eb] block">{b.assignedEmployeeName}</span>
                            <span className="text-[10px] text-[#807a75] block font-mono">Tech: {b.technicianName}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {isUnassigned ? (
                            <button
                              onClick={() => onAssignBooking(b)}
                              className="bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Assign</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onAssignBooking(b)}
                              className="border border-[rgba(255,255,255,0.08)] hover:border-[#ef8f0b]/40 text-[#a8a09a] hover:text-[#ef8f0b] text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                              title="Reassign Staff"
                            >
                              Reassign
                            </button>
                          )}
                          <button
                            onClick={() => onSelectBooking(b)}
                            className="p-1.5 text-[#807a75] hover:text-[#f5f0eb] hover:bg-[#1e1e1e] rounded-lg transition-colors"
                            title="Audit Trail & Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
