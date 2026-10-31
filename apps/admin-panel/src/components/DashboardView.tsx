import {
  Calendar,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Smartphone,
} from "lucide-react";
import { DashboardStats, BookingRecord } from "../types";
import { STORES } from "../api";

interface DashboardViewProps {
  stats: DashboardStats;
  recentBookings: BookingRecord[];
  onSelectBooking: (booking: BookingRecord) => void;
  onNavigateToBookings: (filter?: string) => void;
  onAssignBooking: (booking: BookingRecord) => void;
}

export default function DashboardView({
  stats,
  recentBookings,
  onSelectBooking,
  onNavigateToBookings,
  onAssignBooking,
}: DashboardViewProps) {
  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return { label: "Pending", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "CONFIRMED":
        return { label: "Assigned", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      case "PICKUP_EN_ROUTE":
        return { label: "Pickup En Route", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
      case "IN_TRANSIT":
        return { label: "In Transit", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
      case "IN_REPAIR":
        return { label: "In Repair", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "DELIVERED":
        return { label: "Delivered", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      default:
        return { label: status, color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Unassigned Bookings Alert Banner ── */}
      {stats.unassignedCount > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#f5f0eb] flex items-center gap-2">
                <span>Dispatch Attention Required:</span>
                <span className="font-mono text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {stats.unassignedCount} Unassigned Booking{stats.unassignedCount > 1 ? "s" : ""}
                </span>
              </h3>
              <p className="text-xs text-[#a8a09a] mt-0.5">
                New repair orders have been registered and require technician & mobile courier allocation.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToBookings("PENDING")}
            className="inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-5 py-2.5 transition-all shadow-md shadow-[#ef8f0b]/20 shrink-0"
          >
            <span>Assign Technicians Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Top KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Today's Bookings */}
        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#807a75]">
              Total Today
            </span>
            <div className="p-2 rounded-xl bg-[#1e1e1e] text-[#f5f0eb] border border-[rgba(255,255,255,0.06)]">
              <Calendar className="w-4 h-4 text-[#ef8f0b]" />
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-[#f5f0eb]">
            {stats.todayTotal}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#a8a09a] mt-2 font-mono">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Active Service Intake</span>
          </div>
        </div>

        {/* KPI 2: Pending Assignment */}
        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#807a75]">
              Pending Approval
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-amber-400">
            {stats.pending}
          </div>
          <div className="text-[11px] text-[#a8a09a] mt-2 font-mono">
            Awaiting Staff Assignment
          </div>
        </div>

        {/* KPI 3: In Active Repair */}
        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#807a75]">
              Active In-Repair
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-blue-400">
            {stats.inRepair}
          </div>
          <div className="text-[11px] text-[#a8a09a] mt-2 font-mono">
            Under Diagnostics & Fix
          </div>
        </div>

        {/* KPI 4: Delivered Today */}
        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#807a75]">
              Delivered Today
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-emerald-400">
            {stats.delivered}
          </div>
          <div className="text-[11px] text-[#a8a09a] mt-2 font-mono">
            100% Quality Checked
          </div>
        </div>
      </div>

      {/* ── Active Hubs Overview ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base text-[#f5f0eb]">
            Hyderabad Store Hubs & Workload
          </h2>
          <span className="text-xs font-mono text-[#807a75]">
            4 Active Operational Hubs
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STORES.map((s, idx) => {
            const storeBookings = recentBookings.filter((b) => b.storeId === s.id);
            return (
              <div
                key={s.id}
                className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 hover:border-[#ef8f0b]/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#ef8f0b] font-bold">
                    HUB #{idx + 1}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <h3 className="font-semibold text-sm text-[#f5f0eb] mb-1">
                  {s.name}
                </h3>
                <p className="text-xs text-[#807a75] mb-3">{s.city}</p>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <span className="text-[#a8a09a]">Current Queue</span>
                  <span className="font-mono font-bold text-[#f5f0eb]">
                    {storeBookings.length} Orders
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Live Bookings Stream ── */}
      <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-[#f5f0eb]">
              Real-time Repair Intake & Stream
            </h2>
            <p className="text-xs text-[#807a75]">
              Live bookings across all Hyderabad service regions
            </p>
          </div>
          <button
            onClick={() => onNavigateToBookings("ALL")}
            className="text-xs font-medium text-[#ef8f0b] hover:underline flex items-center gap-1"
          >
            <span>View All Bookings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1a1a1a] text-[#807a75] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Booking ID</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Hardware & Issue</th>
                <th className="px-5 py-3.5">Pickup Window</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Assigned Crew</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)] text-[#f5f0eb]">
              {recentBookings.slice(0, 6).map((b) => {
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
                      <div className="font-medium text-[#f5f0eb]">{b.contactName}</div>
                      <div className="text-[11px] text-[#807a75]">{b.contactPhone}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Smartphone className="w-3.5 h-3.5 text-[#ef8f0b]" />
                        <span>{b.brand} {b.deviceModel}</span>
                      </div>
                      <div className="text-[11px] text-[#a8a09a]">{b.issueType}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-[11px] text-[#a8a09a]">
                      <div>{b.scheduledDate}</div>
                      <div>{b.scheduledTime}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.color}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {isUnassigned ? (
                        <span className="text-amber-400 font-mono text-[11px] font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                          Unassigned
                        </span>
                      ) : (
                        <div className="text-[#a8a09a]">
                          <div className="text-[#f5f0eb] font-medium">{b.assignedEmployeeName}</div>
                          <div className="text-[10px] text-[#807a75]">Tech: {b.technicianName}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isUnassigned ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssignBooking(b);
                          }}
                          className="bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-3 py-1 rounded-lg transition-all"
                        >
                          Assign
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBooking(b);
                          }}
                          className="text-[#a8a09a] hover:text-[#ef8f0b] font-medium text-xs px-2 py-1"
                        >
                          View Detail
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
