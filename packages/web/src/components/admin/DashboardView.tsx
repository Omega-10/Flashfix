import { useState } from "react";
import {
  Calendar,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Smartphone,
  UserCheck,
  Eye,
  Store as StoreIcon,
  RefreshCw,
} from "lucide-react";
import { DashboardStats, BookingRecord } from "./types";
import { STORES } from "./api";

interface DashboardViewProps {
  stats: DashboardStats;
  recentBookings: BookingRecord[];
  onSelectBooking: (booking: BookingRecord) => void;
  onNavigateToBookings: (filter?: string) => void;
  onAssignBooking: (booking: BookingRecord) => void;
  onRefreshData?: () => void;
}

export default function DashboardView({
  stats,
  recentBookings,
  onSelectBooking,
  onNavigateToBookings,
  onAssignBooking,
  onRefreshData,
}: DashboardViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleRefresh() {
    if (!onRefreshData) return;
    setIsRefreshing(true);
    onRefreshData();
    setTimeout(() => setIsRefreshing(false), 600);
  }
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
      case "CUSTODY_OTP_SENT":
      case "IN_REPAIR":
        return { label: "In Repair", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "REPAIR_COMPLETE":
        return { label: "Repair Done", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "RETURN_EN_ROUTE":
        return { label: "Return En Route", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
      case "DELIVERED":
        return { label: "Delivered", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      default:
        return { label: status, color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
    }
  }

  function getStoreName(storeId?: string | null): string {
    if (!storeId) return "Unassigned Hub";
    const s = STORES.find((st) => st.id === storeId);
    return s?.name || storeId;
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-full">
      {/* ── Unassigned Bookings Alert Banner ── */}
      {stats.unassignedCount > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--surface-1)] border border-[var(--hairline)] border-l-4 border-l-[#ef8f0b] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[#ef8f0b] shrink-0" />
            <div>
              <h3 className="font-semibold text-sm text-[var(--ink)]">
                {stats.unassignedCount} booking{stats.unassignedCount > 1 ? "s" : ""} waiting for assignment
              </h3>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                Assign a technician and pickup partner to start these repairs.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToBookings("PENDING")}
            className="min-h-[40px] inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-4 py-2 transition-colors shrink-0"
          >
            <span>Review</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Top 4 KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* KPI 1: Today's Bookings */}
        <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)]">
              Total Today
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-[var(--surface-3)] text-[var(--ink)] border border-[var(--hairline)]">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ef8f0b]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-[var(--ink)]">
            {stats.todayTotal}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[var(--ink-secondary)] mt-1.5 sm:mt-2 font-mono">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>Active Service Intake</span>
          </div>
        </div>

        {/* KPI 2: Pending Assignment / Unassigned */}
        <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)]">
              Unassigned
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-amber-400">
            {stats.unassignedCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[var(--ink-secondary)] mt-1.5 sm:mt-2 font-mono">
            Awaiting Staff Allocation
          </div>
        </div>

        {/* KPI 3: In Active Repair */}
        <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)]">
              In Repair
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-blue-400">
            {stats.inRepair}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[var(--ink-secondary)] mt-1.5 sm:mt-2 font-mono">
            Under Diagnostics & Fix
          </div>
        </div>

        {/* KPI 4: Delivered Today */}
        <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)]">
              Delivered
            </span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-400">
            {stats.delivered}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[var(--ink-secondary)] mt-1.5 sm:mt-2 font-mono">
            100% Quality Checked
          </div>
        </div>
      </div>

      {/* ── Active Hubs Overview ── */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="font-bold text-sm sm:text-base text-[var(--ink)]">
            Hyderabad Store Hubs & Workload
          </h2>
          <span className="text-[10px] sm:text-xs font-mono text-[var(--ink-muted)]">
            4 Active Operational Hubs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STORES.map((store) => {
            const storeBookings = recentBookings.filter((b) => b.storeId === store.id);
            const inRepairCount = storeBookings.filter((b) => b.status === "IN_REPAIR" || b.status === "CUSTODY_OTP_SENT").length;
            const unassigned = storeBookings.filter((b) => !b.assignedEmployeeId && b.status !== "CANCELLED").length;

            return (
              <div
                key={store.id}
                className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--hairline)] hover:border-[#ef8f0b]/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="w-4 h-4 text-[#ef8f0b]" />
                    <span className="font-mono text-xs font-bold text-[var(--ink)] truncate">
                      {(store?.name || store?.id || "Hub").split(" ")[0]}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--ink-muted)]">
                    {store.id}
                  </span>
                </div>

                <div className="text-[11px] text-[var(--ink-muted)] truncate mb-3">
                  {store.address || store.city}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--hairline)] text-center text-xs">
                  <div>
                    <span className="block text-[10px] text-[var(--ink-muted)]">Total</span>
                    <span className="font-mono font-bold text-[var(--ink)]">{storeBookings.length}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--ink-muted)]">In Lab</span>
                    <span className="font-mono font-bold text-amber-400">{inRepairCount}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--ink-muted)]">Pending</span>
                    <span className={`font-mono font-bold ${unassigned > 0 ? "text-amber-400" : "text-[var(--ink-muted)]"}`}>
                      {unassigned}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Bookings Ledger Preview ── */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-[var(--ink)]">
              Recent Service Orders
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--ink-muted)]">
              Real-time dispatch intake from consumer portal
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onRefreshData && (
              <button
                onClick={handleRefresh}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--hairline-strong)] text-xs font-semibold text-[var(--ink)] transition-all"
                title="Refresh recent orders"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#ef8f0b] ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            )}
            <button
              onClick={() => onNavigateToBookings()}
              className="text-xs font-medium text-[#ef8f0b] hover:underline flex items-center gap-1 min-h-[44px] sm:min-h-0"
            >
              <span>View All ({recentBookings.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-2)] text-[var(--ink-muted)] font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Customer Contact</th>
                  <th className="px-5 py-3.5">Device & Problem</th>
                  <th className="px-5 py-3.5">Assigned Store</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Staff Assignment</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)] text-[var(--ink)]">
                {recentBookings.slice(0, 6).map((b) => {
                  const badge = getStatusBadge(b.status);
                  const isUnassigned = !b.assignedEmployeeName;
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                      onClick={() => onSelectBooking(b)}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-[#ef8f0b]">
                        {b.id}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[var(--ink)]">{b.contactName}</div>
                        <div className="text-[11px] text-[var(--ink-muted)]">{b.contactPhone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-[var(--ink)]">
                          <Smartphone className="w-3.5 h-3.5 text-[#ef8f0b]" />
                          <span>{b.brand} {b.deviceModel}</span>
                        </div>
                        <div className="text-[11px] text-[var(--ink-secondary)] mt-0.5">{b.issueType}</div>
                      </td>
                      <td className="px-5 py-4 text-[var(--ink-secondary)] text-[11px]">
                        {getStoreName(b.storeId)}
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
                            <span className="font-medium text-[var(--ink)] block">{b.assignedEmployeeName}</span>
                            <span className="text-[10px] text-[var(--ink-muted)] block font-mono">Tech: {b.technicianName}</span>
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
                              className="border border-[var(--hairline)] hover:border-[#ef8f0b]/40 text-[var(--ink-secondary)] hover:text-[#ef8f0b] text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Reassign
                            </button>
                          )}
                          <button
                            onClick={() => onSelectBooking(b)}
                            className="p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] rounded-lg transition-colors"
                            title="Audit Trail & Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Stacked Card View (<= 480px width) */}
        <div className="md:hidden space-y-3">
          {recentBookings.slice(0, 6).map((b) => {
            const badge = getStatusBadge(b.status);
            const isUnassigned = !b.assignedEmployeeName;
            return (
              <div
                key={b.id}
                onClick={() => onSelectBooking(b)}
                className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--hairline)] active:bg-[var(--surface-2)] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-[#ef8f0b] font-bold">{b.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="text-sm font-semibold text-[var(--ink)]">
                  {b.brand} {b.deviceModel}
                </div>
                <div className="text-xs text-[var(--ink-muted)] mt-0.5">{b.issueType}</div>

                <div className="text-xs text-[var(--ink-secondary)] mt-3 pt-2.5 border-t border-[var(--hairline)] flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[var(--ink)] font-medium block">{b.contactName}</span>
                    <span className="text-[10px] text-[var(--ink-muted)]">{b.scheduledTime} • {(getStoreName(b.storeId) || "Hub").split(" ")[0]}</span>
                  </div>

                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                    {isUnassigned ? (
                      <button
                        onClick={() => onAssignBooking(b)}
                        className="min-h-[44px] bg-[#ef8f0b] text-black font-semibold text-xs px-3 py-2 rounded-xl flex items-center gap-1 active:scale-95"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assign</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectBooking(b)}
                        className="min-h-[44px] text-[#ef8f0b] font-semibold text-xs px-3 py-2 rounded-xl border border-[#ef8f0b]/30"
                      >
                        Details →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
