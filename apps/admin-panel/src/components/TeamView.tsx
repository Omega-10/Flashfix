import {
  UserPlus,
  Shield,
  Phone,
  Mail,
  Store as StoreIcon,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { StaffMember } from "../types";
import { STORES } from "../api";

interface TeamViewProps {
  staffList: StaffMember[];
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  onOpenInviteModal: () => void;
}

export default function TeamView({
  staffList,
  selectedStore,
  onStoreChange,
  onOpenInviteModal,
}: TeamViewProps) {
  const filteredStaff = selectedStore === "ALL"
    ? staffList
    : staffList.filter((s) => s.storeId === selectedStore);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#f5f0eb]">
            Operations Team & Technicians
          </h1>
          <p className="text-xs text-[#807a75]">
            Manage store technicians, field couriers, and dispatch operatives
          </p>
        </div>

        <button
          onClick={onOpenInviteModal}
          className="inline-flex items-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-[#ef8f0b]/20 shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite New Employee</span>
        </button>
      </div>

      {/* Store Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#141414] border border-[rgba(255,255,255,0.08)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <StoreIcon className="w-4 h-4 text-[#ef8f0b]" />
          <span className="text-[#807a75]">Filter by Store Hub:</span>
          <select
            value={selectedStore}
            onChange={(e) => onStoreChange(e.target.value)}
            className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-lg px-2.5 py-1 text-xs text-[#f5f0eb] outline-none cursor-pointer"
          >
            <option value="ALL">All Hubs ({staffList.length} staff)</option>
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-mono text-[#807a75]">
          Active Staff: <strong className="text-[#f5f0eb]">{filteredStaff.length}</strong>
        </span>
      </div>

      {/* Staff Table */}
      <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1a1a1a] text-[#807a75] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Employee Name</th>
                <th className="px-5 py-3.5">Contact Details</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Assigned Hub</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Active Jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.06)] text-[#f5f0eb]">
              {filteredStaff.map((staff) => (
                <tr key={staff.id} className="hover:bg-[#1a1a1a]/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] flex items-center justify-center font-bold text-[#ef8f0b] text-xs">
                        {staff.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-[#f5f0eb]">{staff.name}</div>
                        <div className="font-mono text-[10px] text-[#807a75]">{staff.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[#a8a09a]">
                      <Mail className="w-3 h-3 text-[#807a75]" />
                      <span>{staff.email}</span>
                    </div>
                    {staff.phone && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#807a75] mt-0.5">
                        <Phone className="w-3 h-3 text-[#807a75]" />
                        <span>{staff.phone}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                        staff.role === "ADMIN"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {staff.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[#a8a09a]">
                    {staff.storeName || staff.storeId}
                  </td>
                  <td className="px-5 py-4">
                    {staff.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        Invite Pending
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-semibold text-[#ef8f0b]">
                    {staff.activeJobsCount || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
