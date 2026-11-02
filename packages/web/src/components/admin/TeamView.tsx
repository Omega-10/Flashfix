import { useState } from "react";
import {
  UserPlus,
  Shield,
  Store as StoreIcon,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import { StaffMember } from "./types";
import { STORES } from "./api";

interface TeamViewProps {
  staffList: StaffMember[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  onOpenInviteModal: () => void;
  onRefreshData?: () => void;
}

export default function TeamView({
  staffList,
  selectedStore,
  onStoreChange,
  onOpenInviteModal,
  onRefreshData,
}: TeamViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  function handleRefresh() {
    if (!onRefreshData) return;
    setIsRefreshing(true);
    onRefreshData();
    setTimeout(() => setIsRefreshing(false), 600);
  }
  const filteredStaff = selectedStore === "ALL"
    ? staffList
    : staffList.filter((s) => s.storeId === selectedStore);

  return (
    <div className="space-y-6 max-w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--ink)]">
            Operations Team & Technicians
          </h1>
          <p className="text-xs text-[var(--ink-muted)]">
            Manage store technicians, field couriers, and hub administrative access
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl px-3 py-2 text-xs">
            <StoreIcon className="w-3.5 h-3.5 text-[#ef8f0b]" />
            <select
              value={selectedStore}
              onChange={(e) => onStoreChange(e.target.value)}
              className="bg-transparent text-[var(--ink)] outline-none text-xs cursor-pointer"
            >
              <option value="ALL" className="bg-[var(--surface-1)]">All Stores</option>
              {STORES.map((s) => (
                <option key={s.id} value={s.id} className="bg-[var(--surface-1)]">{s.name}</option>
              ))}
            </select>
          </div>

          {onRefreshData && (
            <button
              onClick={handleRefresh}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--hairline-strong)] text-xs font-semibold text-[var(--ink)] transition-all"
              title="Refresh staff directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#ef8f0b] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}

          <button
            onClick={onOpenInviteModal}
            className="min-h-[44px] bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-[#ef8f0b]/20 flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Employee</span>
          </button>
        </div>
      </div>

      {/* Staff Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((staff) => (
          <div
            key={staff.id}
            className="p-5 rounded-2xl bg-[var(--surface-1)] border border-[var(--hairline)] hover:border-[#ef8f0b]/30 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-3)] border border-[var(--hairline)] flex items-center justify-center font-bold text-sm text-[#ef8f0b]">
                    {staff.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--ink)] leading-tight">
                      {staff.name}
                    </h3>
                    <span className="font-mono text-[10px] text-[#ef8f0b] block mt-0.5">
                      {staff.id}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                    staff.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {staff.status}
                </span>
              </div>

              <div className="space-y-2 py-3 border-y border-[var(--hairline)] text-xs text-[var(--ink-secondary)]">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#ef8f0b]" />
                  <span className="font-mono text-[11px] text-[var(--ink)] font-semibold">{staff.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StoreIcon className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  <span className="truncate">{staff.storeName || staff.storeId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  <span className="truncate text-[var(--ink-muted)]">{staff.email}</span>
                </div>
                {staff.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                    <span className="text-[var(--ink-muted)]">{staff.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--ink-muted)]">Current Load:</span>
              <span className="font-bold text-[#ef8f0b]">{staff.activeJobsCount || 0} active orders</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
