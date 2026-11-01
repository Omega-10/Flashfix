import { useState } from "react";
import {
  ShieldAlert,
  Building2,
  Users,
  Activity,
  History,
  UserPlus,
  ArrowRight,
  Boxes,
  Lock,
} from "lucide-react";
import { BookingRecord, StaffMember, InventoryRecord } from "./types";
import { STORES, updateTeamMemberRole } from "./api";
import { UserRole } from "@flashfix/shared";

interface SuperadminViewProps {
  bookings: BookingRecord[];
  staff: StaffMember[];
  inventory: InventoryRecord[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  onOpenInviteModal: () => void;
  onSelectBooking: (booking: BookingRecord) => void;
  onRefreshData: () => void;
}

export default function SuperadminView({
  bookings,
  staff,
  inventory,
  selectedStore,
  onStoreChange,
  onOpenInviteModal,
  onSelectBooking,
  onRefreshData,
}: SuperadminViewProps) {
  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  // Compute platform-wide totals
  const totalBookings = bookings.length;
  const inRepairTotal = bookings.filter((b) => b.status === "IN_REPAIR" || b.status === "CUSTODY_OTP_SENT").length;
  const unassignedTotal = bookings.filter((b) => !b.assignedEmployeeId && b.status !== "CANCELLED").length;
  const lowStockItems = inventory.filter((item) => item.quantity <= item.minThreshold);

  async function handleRoleChange(staffId: string, newRole: UserRole) {
    setUpdatingRoleFor(staffId);
    try {
      await updateTeamMemberRole(staffId, newRole);
      onRefreshData();
    } finally {
      setUpdatingRoleFor(null);
    }
  }

  return (
    <div className="space-y-8 max-w-full">
      {/* ── Superadmin Executive Header ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#1a130b] via-[#141414] to-[#141414] border border-[#ef8f0b]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded-md bg-[#ef8f0b]/20 text-[#ef8f0b] text-xs font-mono font-bold">
              PLATFORM DIRECTOR
            </span>
            <span className="text-xs text-[#807a75] font-mono">Central Hyderabad Hub Control</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-[#f5f0eb]">
            Cross-Hub Governance & Network Telemetry
          </h1>
          <p className="text-xs text-[#a8a09a] mt-1 max-w-2xl">
            Multi-store capacity balancing, staff role provisioning, low-stock threshold monitoring, and network-wide administrative authority.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenInviteModal}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-4 py-2.5 transition-all shadow-md shadow-[#ef8f0b]/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Staff Member</span>
          </button>
        </div>
      </div>

      {/* ── Network Health KPI Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-mono text-[#807a75] uppercase">Network Volume</span>
            <Building2 className="w-4 h-4 text-[#ef8f0b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-[#f5f0eb]">{totalBookings}</div>
          <div className="text-[10px] text-[#807a75] mt-1 font-mono">Across 4 Hyderabad Hubs</div>
        </div>

        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-mono text-[#807a75] uppercase">Lab Workbenches</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-blue-400">{inRepairTotal}</div>
          <div className="text-[10px] text-[#807a75] mt-1 font-mono">Hardware in Diagnostics</div>
        </div>

        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-mono text-[#807a75] uppercase">Unassigned Orders</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-amber-400">{unassignedTotal}</div>
          <div className="text-[10px] text-[#807a75] mt-1 font-mono">Awaiting Staff Dispatch</div>
        </div>

        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-mono text-[#807a75] uppercase">Parts Low-Stock</span>
            <Boxes className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-red-400">{lowStockItems.length}</div>
          <div className="text-[10px] text-[#807a75] mt-1 font-mono">SKUs Below Reorder Level</div>
        </div>
      </div>

      {/* ── Multi-Store Comparison & Rebalancer Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-base text-[#f5f0eb] flex items-center gap-2">
              <span>Cross-Hub Performance Comparison</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#807a75]">
                {STORES.length} Stores
              </span>
            </h2>
            <p className="text-xs text-[#807a75]">
              Real-time balance metrics across Hyderabad locations
            </p>
          </div>

          <div className="text-xs text-[#807a75] font-mono hidden sm:block">
            Filter: <span className="text-[#ef8f0b] font-bold">{selectedStore === "ALL" ? "All Hubs" : selectedStore}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STORES.map((s) => {
            const storeBookings = bookings.filter((b) => b.storeId === s.id);
            const storeInRepair = storeBookings.filter((b) => b.status === "IN_REPAIR" || b.status === "CUSTODY_OTP_SENT").length;
            const storeUnassigned = storeBookings.filter((b) => !b.assignedEmployeeId && b.status !== "CANCELLED").length;
            const storeStaff = staff.filter((st) => st.storeId === s.id);
            const isSelected = selectedStore === s.id;

            return (
              <div
                key={s.id}
                className={`p-5 rounded-2xl bg-[#141414] border transition-all ${
                  isSelected
                    ? "border-[#ef8f0b] shadow-lg shadow-[#ef8f0b]/10 bg-[#171512]"
                    : "border-[rgba(255,255,255,0.08)] hover:border-[#ef8f0b]/40"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-[#ef8f0b] shrink-0" />
                    <span className="font-bold text-sm text-[#f5f0eb] truncate">{s.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[#807a75] px-1.5 py-0.5 bg-[#1a1a1a] rounded">
                    {s.id}
                  </span>
                </div>

                <p className="text-[11px] text-[#807a75] mb-4 truncate">{s.address}</p>

                <div className="space-y-2 py-3 border-y border-[rgba(255,255,255,0.06)] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#807a75]">Active Orders:</span>
                    <span className="font-mono font-bold text-[#f5f0eb]">{storeBookings.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#807a75]">Lab Bench Load:</span>
                    <span className="font-mono font-bold text-blue-400">{storeInRepair} active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#807a75]">Unassigned:</span>
                    <span className={`font-mono font-bold ${storeUnassigned > 0 ? "text-amber-400" : "text-[#807a75]"}`}>
                      {storeUnassigned}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#807a75]">Assigned Staff:</span>
                    <span className="font-mono font-bold text-[#a8a09a]">{storeStaff.length} operatives</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => onStoreChange(isSelected ? "ALL" : s.id)}
                    className={`min-h-[44px] w-full text-xs font-semibold rounded-xl py-2 transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? "bg-[#ef8f0b] text-black"
                        : "bg-[#1e1e1e] hover:bg-[#252525] text-[#f5f0eb] border border-[rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <span>{isSelected ? "Filter Active (Reset)" : "Isolate Hub Telemetry"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Staff Role Governance & Permissions Matrix ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-base text-[#f5f0eb] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#ef8f0b]" />
              <span>Role Governance & Authority Matrix</span>
            </h2>
            <p className="text-xs text-[#807a75]">
              Assign administrative privileges and store hub associations
            </p>
          </div>

          <button
            onClick={onOpenInviteModal}
            className="min-h-[44px] text-xs font-semibold text-[#ef8f0b] hover:underline flex items-center gap-1"
          >
            <span>+ Add Staff</span>
          </button>
        </div>

        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1a1a1a] text-[#807a75] font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Staff ID</th>
                  <th className="px-5 py-3.5">Operative</th>
                  <th className="px-5 py-3.5">Assigned Hub</th>
                  <th className="px-5 py-3.5">Active Jobs</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Role Authority</th>
                  <th className="px-5 py-3.5 text-right">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.06)] text-[#f5f0eb]">
                {staff.map((member) => {
                  const isUpdating = updatingRoleFor === member.id;
                  return (
                    <tr key={member.id} className="hover:bg-[#1a1a1a]/60 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[#ef8f0b] font-bold">
                        {member.id}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-[#f5f0eb]">{member.name}</div>
                        <div className="text-[11px] text-[#807a75]">{member.email}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[#a8a09a]">
                        {member.storeName || member.storeId}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        <span className="px-2 py-0.5 rounded bg-[#1e1e1e] text-[#f5f0eb]">
                          {member.activeJobsCount || 0} active
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                            member.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          disabled={isUpdating}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                          className="min-h-[38px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] rounded-lg px-2.5 py-1 text-xs text-[#f5f0eb] outline-none cursor-pointer focus:border-[#ef8f0b]"
                        >
                          <option value="EMPLOYEE">EMPLOYEE (Field / Tech)</option>
                          <option value="ADMIN">ADMIN (Store Hub Admin)</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN (Network Director)</option>
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[10px] text-[#807a75]">
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <Lock className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Global Audit & Administrative Overrides ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-base text-[#f5f0eb] flex items-center gap-2">
              <History className="w-4 h-4 text-[#ef8f0b]" />
              <span>Platform-Wide Custody & Status Audit Feed</span>
            </h2>
            <p className="text-xs text-[#807a75]">
              Real-time immutable log of state transitions across the network
            </p>
          </div>
        </div>

        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 space-y-3">
          {bookings.slice(0, 5).map((b) => (
            <div
              key={b.id}
              onClick={() => onSelectBooking(b)}
              className="p-3 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] hover:border-[#ef8f0b]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#ef8f0b]">{b.id}</span>
                <div>
                  <div className="text-xs font-semibold text-[#f5f0eb]">
                    {b.brand} {b.deviceModel} — {b.issueType}
                  </div>
                  <div className="text-[11px] text-[#807a75]">
                    Customer: {b.contactName} ({b.contactPhone}) • Hub: {b.storeId}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1e1e1e] text-[#a8a09a] border border-[rgba(255,255,255,0.08)]">
                  {b.status}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBooking(b);
                  }}
                  className="min-h-[44px] text-xs font-semibold text-[#ef8f0b] hover:underline"
                >
                  Inspect & Override →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
