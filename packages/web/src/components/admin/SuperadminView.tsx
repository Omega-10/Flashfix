import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Building2,
  Users,
  Activity,
  History,
  UserPlus,
  Boxes,
  Lock,
  Plus,
  Trash2,
  Power,
  UserCheck,
  X,
  MapPin,
  Settings,
  Save,
  CheckCircle2,
} from "lucide-react";
import { BookingRecord, StaffMember, InventoryRecord, StoreOption } from "./types";
import {
  STORES,
  updateTeamMemberRole,
  createStore,
  deleteStore,
  toggleStoreStatus,
  assignStoreAdmins,
  getSupportSettings,
  updateSupportSettings,
} from "./api";
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
  stores?: StoreOption[];
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
  stores = STORES,
}: SuperadminViewProps) {
  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  // Store Management Modals
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [storeToAssignAdmins, setStoreToAssignAdmins] = useState<StoreOption | null>(null);
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const [storeActionLoading, setStoreActionLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  // New Store Form State
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreId, setNewStoreId] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStoreCity, setNewStoreCity] = useState("Bengaluru");
  const [newStorePhone, setNewStorePhone] = useState("+91 80 4821 7700");
  const [newStoreLat, setNewStoreLat] = useState("12.9352");
  const [newStoreLng, setNewStoreLng] = useState("77.6245");
  const [newStoreAdminIds, setNewStoreAdminIds] = useState<string[]>([]);

  // Customizable Public Support Contact Settings
  const [supportEmail, setSupportEmail] = useState("support@flashfix.in");
  const [supportPhone, setSupportPhone] = useState("+91 80 4821 7700");
  const [supportHours, setSupportHours] = useState("9 AM – 9 PM, Mon–Sun");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    getSupportSettings().then((s) => {
      if (s.supportEmail) setSupportEmail(s.supportEmail);
      if (s.supportPhone) setSupportPhone(s.supportPhone);
      if (s.supportHours) setSupportHours(s.supportHours);
    });
  }, []);

  async function handleSaveSupportSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    setSettingsError(null);
    try {
      await updateSupportSettings({
        supportEmail: supportEmail.trim(),
        supportPhone: supportPhone.trim(),
        supportHours: supportHours.trim(),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: any) {
      setSettingsError(err?.message || "Failed to update support settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  // Compute platform-wide totals
  const totalBookings = bookings.length;
  const inRepairTotal = bookings.filter((b) => b.status === "IN_REPAIR" || b.status === "CUSTODY_OTP_SENT").length;
  const unassignedTotal = bookings.filter((b) => !b.assignedEmployeeId && b.status !== "CANCELLED").length;
  const lowStockItems = inventory.filter((item) => item.quantity <= item.minThreshold);

  // Filter available admin staff members
  const adminUsers = staff.filter((s) => s.role === "ADMIN");

  async function handleRoleChange(staffId: string, newRole: UserRole) {
    setUpdatingRoleFor(staffId);
    try {
      await updateTeamMemberRole(staffId, newRole);
      onRefreshData();
    } finally {
      setUpdatingRoleFor(null);
    }
  }

  async function handleCreateStore(e: React.FormEvent) {
    e.preventDefault();
    if (!newStoreName || !newStoreAddress) {
      setStoreError("Store name and address are required.");
      return;
    }

    setStoreActionLoading(true);
    setStoreError(null);

    try {
      const slugId = newStoreName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const generatedId = newStoreId.trim() || `hub-${slugId || Date.now().toString(36)}`;
      await createStore({
        id: generatedId,
        name: newStoreName.trim(),
        address: newStoreAddress.trim(),
        city: newStoreCity.trim(),
        phone: newStorePhone.trim(),
        lat: parseFloat(newStoreLat) || 12.9352,
        lng: parseFloat(newStoreLng) || 77.6245,
        assignedAdminIds: newStoreAdminIds,
      });

      setIsAddStoreOpen(false);
      // Reset form
      setNewStoreName("");
      setNewStoreId("");
      setNewStoreAddress("");
      setNewStoreAdminIds([]);
      onRefreshData();
    } catch (err: any) {
      setStoreError(err?.message || "Failed to create store.");
    } finally {
      setStoreActionLoading(false);
    }
  }

  async function handleToggleStore(storeId: string) {
    setStoreActionLoading(true);
    try {
      await toggleStoreStatus(storeId);
      onRefreshData();
    } finally {
      setStoreActionLoading(false);
    }
  }

  async function handleDeleteStore(storeId: string, storeName: string) {
    if (!confirm(`Are you sure you want to permanently remove "${storeName}"? Associated records and admin assignments will be removed.`)) {
      return;
    }
    setStoreActionLoading(true);
    try {
      await deleteStore(storeId);
      onRefreshData();
    } finally {
      setStoreActionLoading(false);
    }
  }

  function openAssignAdminsModal(store: StoreOption) {
    setStoreToAssignAdmins(store);
    const existing = (store.assignedAdmins || []).map((a) => a.id);
    setSelectedAdminIds(existing);
    setStoreError(null);
  }

  async function handleSaveAssignedAdmins() {
    if (!storeToAssignAdmins) return;
    setStoreActionLoading(true);
    setStoreError(null);
    try {
      await assignStoreAdmins(storeToAssignAdmins.id, selectedAdminIds);
      setStoreToAssignAdmins(null);
      onRefreshData();
    } catch (err: any) {
      setStoreError(err?.message || "Failed to assign admins.");
    } finally {
      setStoreActionLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-full">
      {/* ── Superadmin Executive Header ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#1a130b] via-[#141414] to-[#141414] border border-[#ef8f0b]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded-md bg-[#ef8f0b]/20 text-[#ef8f0b] text-xs font-mono font-bold">
              SUPERADMIN GOVERNANCE
            </span>
            <span className="text-xs text-[#807a75] font-mono">Platform-Wide Hub & Staff Control</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-[#f5f0eb]">
            Store Hub Governance & Network Telemetry
          </h1>
          <p className="text-xs text-[#a8a09a] mt-1 max-w-2xl">
            Live Store Management (Add, Remove, Toggle status), Admin assignments across single or multiple stores, staff role governance, and real-time operational telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => setIsAddStoreOpen(true)}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-4 py-2.5 transition-all shadow-md shadow-[#ef8f0b]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Store</span>
          </button>
          <button
            onClick={onOpenInviteModal}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-[rgba(255,255,255,0.1)] text-[#f5f0eb] font-semibold text-xs rounded-xl px-4 py-2.5 transition-all"
          >
            <UserPlus className="w-4 h-4 text-[#ef8f0b]" />
            <span>Invite Staff</span>
          </button>
        </div>
      </div>

      {/* ── Network Health KPI Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-mono text-[#807a75] uppercase">Live Store Hubs</span>
            <Building2 className="w-4 h-4 text-[#ef8f0b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-[#f5f0eb]">{stores.length}</div>
          <div className="text-[10px] text-[#807a75] mt-1 font-mono">
            {stores.filter((s) => s.isActive !== false).length} Active • {stores.filter((s) => s.isActive === false).length} Inactive
          </div>
        </div>

        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-xs font-mono text-[#807a75] uppercase">Network Volume</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-blue-400">{totalBookings}</div>
          <div className="text-[10px] text-[#807a75] mt-1 font-mono">{inRepairTotal} Active on Workbench</div>
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
            <span className="text-[11px] sm:text-xs font-mono text-[#807a75] uppercase">Parts Inventory</span>
            <Boxes className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-red-400">{lowStockItems.length}</div>
          <div className="text-[10px] text-[#807a75] mt-1 font-mono">SKUs Below Reorder Level</div>
        </div>
      </div>

      {/* ── STORE MANAGEMENT & HUB GOVERNANCE (R4) ── */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-base text-[#f5f0eb] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#ef8f0b]" />
              <span>Network Store Hubs Management</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#1e1e1e] text-[#ef8f0b] border border-[#ef8f0b]/20">
                {stores.length} Hubs
              </span>
            </h2>
            <p className="text-xs text-[#807a75]">
              Add, remove, toggle active status, and assign Store Admins (single or multi-store)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddStoreOpen(true)}
              className="text-xs font-semibold text-[#ef8f0b] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Store</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((s) => {
            const storeBookings = bookings.filter((b) => b.storeId === s.id);
            const storeInRepair = storeBookings.filter((b) => b.status === "IN_REPAIR" || b.status === "CUSTODY_OTP_SENT").length;
            const storeStaff = staff.filter((st) => st.storeId === s.id);
            const isSelected = selectedStore === s.id;
            const isActive = s.isActive !== false;
            const assignedAdmins = s.assignedAdmins || [];

            return (
              <div
                key={s.id}
                className={`p-5 rounded-2xl bg-[#141414] border transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-[#ef8f0b] shadow-lg shadow-[#ef8f0b]/10 bg-[#171512]"
                    : "border-[rgba(255,255,255,0.08)] hover:border-[#ef8f0b]/40"
                } ${!isActive ? "opacity-70" : ""}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-zinc-600"}`} />
                      <span className="font-bold text-sm text-[#f5f0eb] truncate">{s.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#807a75] px-2 py-0.5 bg-[#1a1a1a] rounded border border-[rgba(255,255,255,0.06)]">
                      {s.id}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#807a75] flex items-center gap-1.5 mb-3 truncate">
                    <MapPin className="w-3 h-3 text-[#ef8f0b] shrink-0" />
                    <span>{s.address}, {s.city}</span>
                  </p>

                  {/* Telemetry Stats */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-[#191919] border border-[rgba(255,255,255,0.04)] text-center mb-3">
                    <div>
                      <div className="text-[10px] font-mono text-[#807a75] uppercase">Orders</div>
                      <div className="font-bold text-xs text-[#f5f0eb] mt-0.5">{storeBookings.length}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#807a75] uppercase">In Repair</div>
                      <div className="font-bold text-xs text-blue-400 mt-0.5">{storeInRepair}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#807a75] uppercase">Staff</div>
                      <div className="font-bold text-xs text-[#a8a09a] mt-0.5">{storeStaff.length}</div>
                    </div>
                  </div>

                  {/* Assigned Store Admins */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#807a75]">
                        Assigned Store Admins:
                      </span>
                      <button
                        onClick={() => openAssignAdminsModal(s)}
                        className="text-[10px] text-[#ef8f0b] hover:underline font-medium"
                      >
                        + Manage
                      </button>
                    </div>

                    {assignedAdmins.length === 0 ? (
                      <p className="text-[11px] text-[#666] italic">No admins specifically assigned yet</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {assignedAdmins.map((admin) => (
                          <span
                            key={admin.id}
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            title={admin.email}
                          >
                            {admin.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Store Action Buttons */}
                <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onStoreChange(isSelected ? "ALL" : s.id)}
                    className={`min-h-[36px] flex-1 text-xs font-semibold rounded-xl py-1.5 transition-all flex items-center justify-center gap-1 ${
                      isSelected
                        ? "bg-[#ef8f0b] text-black"
                        : "bg-[#1e1e1e] hover:bg-[#252525] text-[#f5f0eb] border border-[rgba(255,255,255,0.08)]"
                    }`}
                  >
                    <span>{isSelected ? "Active Filter" : "Filter Hub"}</span>
                  </button>

                  <button
                    onClick={() => handleToggleStore(s.id)}
                    disabled={storeActionLoading}
                    title={isActive ? "Deactivate store" : "Activate store"}
                    className={`min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center border transition-all ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteStore(s.id, s.name)}
                    disabled={storeActionLoading}
                    title="Remove store permanently"
                    className="min-h-[36px] min-w-[36px] rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
              Assign administrative roles and store hub access (Super Admin, Store Admin, Technician, Delivery Rider)
            </p>
          </div>

          <button
            onClick={onOpenInviteModal}
            className="min-h-[44px] text-xs font-semibold text-[#ef8f0b] hover:underline flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Staff</span>
          </button>
        </div>

        <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden">
          {staff.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-[#807a75] mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-[#f5f0eb]">No Staff Members</h3>
              <p className="text-xs text-[#807a75] mt-1">
                No staff records in database. Click "Add Staff" or seed credentials to begin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1a1a1a] text-[#807a75] font-mono text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Staff Email</th>
                    <th className="px-5 py-3.5">Operative Name</th>
                    <th className="px-5 py-3.5">Assigned Store(s)</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Role Authority</th>
                    <th className="px-5 py-3.5 text-right">Access Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.06)] text-[#f5f0eb]">
                  {staff.map((member) => {
                    const isUpdating = updatingRoleFor === member.id;
                    const assignedStores = (member as any).assignedStoreIds || (member.storeId ? [member.storeId] : []);

                    return (
                      <tr key={member.id} className="hover:bg-[#1a1a1a]/60 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-[#ef8f0b] font-medium">
                          {member.email}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-[#f5f0eb]">{member.name}</div>
                          <div className="text-[10px] text-[#807a75]">{member.phone || "No phone"}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          {assignedStores.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {assignedStores.map((sid: string) => {
                                const st = stores.find((s) => s.id === sid);
                                return (
                                  <span
                                    key={sid}
                                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1e1e1e] text-[#f5f0eb] border border-[rgba(255,255,255,0.08)]"
                                  >
                                    {st?.name || sid}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[#666] italic">Platform wide / Unassigned</span>
                          )}
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
                            <option value="SUPER_ADMIN">SUPER_ADMIN (Network Director)</option>
                            <option value="ADMIN">ADMIN (Store Hub Admin)</option>
                            <option value="TECHNICIAN">TECHNICIAN (Lab Workbench)</option>
                            <option value="EMPLOYEE">EMPLOYEE (Delivery Rider)</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[10px] text-[#807a75]">
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <Lock className="w-3 h-3" />
                            <span>Authenticated</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Public Support Contact Configuration ── */}
      <div className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-base text-[#f5f0eb] flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#ef8f0b]" />
              <span>Public Support Contact & Operating Hours</span>
            </h2>
            <p className="text-xs text-[#807a75]">
              Customize support email, contact phone number, and operating hours displayed on the public website
            </p>
          </div>
          {settingsSaved && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved to live site</span>
            </span>
          )}
        </div>

        {settingsError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {settingsError}
          </div>
        )}

        <form onSubmit={handleSaveSupportSettings} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#807a75] mb-1.5">
              Support Email
            </label>
            <input
              type="email"
              required
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full h-10 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#807a75] mb-1.5">
              Contact Phone Number
            </label>
            <input
              type="text"
              required
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              className="w-full h-10 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#807a75] mb-1.5">
              Operating Hours
            </label>
            <input
              type="text"
              value={supportHours}
              onChange={(e) => setSupportHours(e.target.value)}
              className="w-full h-10 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-4 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingSettings ? "Saving..." : "Save Support Details"}</span>
            </button>
          </div>
        </form>
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
          {bookings.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-8 h-8 text-[#807a75] mx-auto mb-2 opacity-40" />
              <p className="text-xs text-[#807a75]">
                No customer bookings recorded yet. New service orders will appear here automatically in real time.
              </p>
            </div>
          ) : (
            bookings.slice(0, 5).map((b) => (
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
            ))
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 1: ADD NEW STORE                                    */}
      {/* ══════════════════════════════════════════════════════════ */}
      {isAddStoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#ef8f0b]" />
                <h3 className="font-bold text-lg text-[#f5f0eb]">Add New Store Hub</h3>
              </div>
              <button
                onClick={() => setIsAddStoreOpen(false)}
                className="text-[#807a75] hover:text-[#f5f0eb] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {storeError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {storeError}
              </div>
            )}

            <form onSubmit={handleCreateStore} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="Flashfix — Whitefield"
                    className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1">
                    Store ID / Code
                  </label>
                  <input
                    type="text"
                    value={newStoreId}
                    onChange={(e) => setNewStoreId(e.target.value)}
                    placeholder="hub-whitefield"
                    className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1">
                  Full Address *
                </label>
                <input
                  type="text"
                  required
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  placeholder="Plot 18, ITPB Main Rd, Whitefield"
                  className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newStoreCity}
                    onChange={(e) => setNewStoreCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1">
                    Phone Contact
                  </label>
                  <input
                    type="text"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    placeholder="+91 80 4821 7704"
                    className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={newStoreLat}
                    onChange={(e) => setNewStoreLat(e.target.value)}
                    placeholder="12.9698"
                    className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={newStoreLng}
                    onChange={(e) => setNewStoreLng(e.target.value)}
                    placeholder="77.7499"
                    className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-xl px-3.5 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                  />
                </div>
              </div>

              {/* Assign Admins for this store */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-2">
                  Assign Store Admins:
                </label>
                {adminUsers.length === 0 ? (
                  <p className="text-[11px] text-[#807a75] italic">No users with ADMIN role available.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-[#191919] border border-[rgba(255,255,255,0.06)]">
                    {adminUsers.map((admin) => {
                      const isChecked = newStoreAdminIds.includes(admin.id);
                      return (
                        <label
                          key={admin.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#222] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setNewStoreAdminIds(newStoreAdminIds.filter((id) => id !== admin.id));
                              } else {
                                setNewStoreAdminIds([...newStoreAdminIds, admin.id]);
                              }
                            }}
                            className="rounded border-zinc-700 text-[#ef8f0b] focus:ring-[#ef8f0b]"
                          />
                          <span className="font-medium text-[#f5f0eb]">{admin.name}</span>
                          <span className="text-[11px] text-[#807a75]">({admin.email})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.08)]">
                <button
                  type="button"
                  onClick={() => setIsAddStoreOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#807a75] hover:text-[#f5f0eb]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={storeActionLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs flex items-center gap-2 shadow-md shadow-[#ef8f0b]/20"
                >
                  {storeActionLoading ? "Adding..." : "Add Store to Network"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 2: ASSIGN ADMINS TO EXISTING STORE                  */}
      {/* ══════════════════════════════════════════════════════════ */}
      {storeToAssignAdmins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div>
                <h3 className="font-bold text-base text-[#f5f0eb]">Assign Store Admins</h3>
                <p className="text-xs text-[#ef8f0b] font-medium mt-0.5">{storeToAssignAdmins.name}</p>
              </div>
              <button
                onClick={() => setStoreToAssignAdmins(null)}
                className="text-[#807a75] hover:text-[#f5f0eb] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#807a75] mb-4">
              Select one or multiple administrators to manage bookings, inventory, and field staff for this store:
            </p>

            {adminUsers.length === 0 ? (
              <p className="text-xs text-[#807a75] italic py-4">No staff members have ADMIN role assigned.</p>
            ) : (
              <div className="space-y-2 mb-6 max-h-56 overflow-y-auto">
                {adminUsers.map((admin) => {
                  const isChecked = selectedAdminIds.includes(admin.id);
                  return (
                    <label
                      key={admin.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-blue-500/10 border-blue-500/30 text-[#f5f0eb]"
                          : "bg-[#191919] border-[rgba(255,255,255,0.06)] text-[#807a75] hover:border-[#ef8f0b]/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedAdminIds(selectedAdminIds.filter((id) => id !== admin.id));
                            } else {
                              setSelectedAdminIds([...selectedAdminIds, admin.id]);
                            }
                          }}
                          className="rounded border-zinc-700 text-[#ef8f0b] focus:ring-[#ef8f0b]"
                        />
                        <div>
                          <div className="font-semibold text-xs text-[#f5f0eb]">{admin.name}</div>
                          <div className="text-[11px] text-[#807a75]">{admin.email}</div>
                        </div>
                      </div>
                      {isChecked && <UserCheck className="w-4 h-4 text-blue-400" />}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.08)]">
              <button
                type="button"
                onClick={() => setStoreToAssignAdmins(null)}
                className="px-4 py-2 rounded-xl text-xs text-[#807a75] hover:text-[#f5f0eb]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={storeActionLoading}
                onClick={handleSaveAssignedAdmins}
                className="px-5 py-2.5 rounded-xl bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs shadow-md shadow-[#ef8f0b]/20"
              >
                {storeActionLoading ? "Saving..." : "Save Admin Assignments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
