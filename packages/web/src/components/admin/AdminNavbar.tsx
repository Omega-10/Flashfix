import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Boxes,
  Store as StoreIcon,
  Wrench,
  Bike,
  Globe2,
  LogOut,
} from "lucide-react";
import { AdminTab, AdminRole, StoreOption } from "./types";
import { STORES } from "./api";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface AdminNavbarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  unassignedCount: number;
  currentRole: AdminRole;
  staffUser?: {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    storeId?: string | null;
    storeIds?: string[];
  } | null;
  onLogout: () => void;
  stores?: StoreOption[];
}

export default function AdminNavbar({
  activeTab,
  onTabChange,
  selectedStore,
  onStoreChange,
  unassignedCount,
  currentRole,
  staffUser,
  onLogout,
  stores = STORES,
}: AdminNavbarProps) {
  // Determine accessible tabs based on real authenticated role
  const allTabs = [
    { id: "superadmin" as AdminTab, label: "Superadmin", icon: Globe2, roles: ["SUPER_ADMIN"] },
    { id: "dashboard" as AdminTab, label: "Store Admin", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN"] },
    { id: "technician" as AdminTab, label: "Technician", icon: Wrench, roles: ["SUPER_ADMIN", "TECHNICIAN"] },
    { id: "delivery" as AdminTab, label: "Delivery", icon: Bike, roles: ["SUPER_ADMIN", "COURIER", "EMPLOYEE"] },
    {
      id: "bookings" as AdminTab,
      label: "Bookings",
      icon: CalendarCheck,
      badge: unassignedCount > 0 ? unassignedCount : undefined,
      roles: ["SUPER_ADMIN", "ADMIN", "TECHNICIAN", "COURIER", "EMPLOYEE"],
    },
    { id: "team" as AdminTab, label: "Staff", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
    { id: "inventory" as AdminTab, label: "Inventory", icon: Boxes, roles: ["SUPER_ADMIN", "ADMIN", "TECHNICIAN"] },
  ];

  const visibleTabs = allTabs.filter((t) => t.roles.includes(currentRole));

  // Determine selectable stores for this staff member
  const accessibleStores = stores.filter((s) => {
    if (currentRole === "SUPER_ADMIN") return true;
    if (staffUser?.storeIds && staffUser.storeIds.length > 0) {
      return staffUser.storeIds.includes(s.id);
    }
    if (staffUser?.storeId) {
      return staffUser.storeId === s.id;
    }
    return true;
  });

  function getRoleBadgeStyle(role: AdminRole) {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-[#ef8f0b]/15 text-[#ef8f0b] border-[#ef8f0b]/30";
      case "ADMIN":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "TECHNICIAN":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "COURIER":
      case "EMPLOYEE":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      default:
        return "bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--hairline-strong)]";
    }
  }

  function getRoleLabel(role: AdminRole) {
    switch (role) {
      case "SUPER_ADMIN":
        return "SUPER ADMIN";
      case "ADMIN":
        return "STORE ADMIN";
      case "TECHNICIAN":
        return "TECHNICIAN";
      case "COURIER":
      case "EMPLOYEE":
        return "DELIVERY RIDER";
      default:
        return role;
    }
  }

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[var(--canvas)] backdrop-blur-md border-b border-[var(--hairline)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Left: Brand & Navigation */}
            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              <button
                type="button"
                onClick={() => onTabChange(visibleTabs[0]?.id ?? "bookings")}
                className="heading-flashfix text-xl tracking-[0.12em] uppercase text-[var(--ink)] hover:text-[#ef8f0b] transition-colors"
                aria-label="Go to workspace home"
              >
                FLASHFIX
              </button>

              {/* Desktop Navigation Tabs */}
              <nav className="hidden lg:flex items-center gap-1">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[var(--surface-3)] text-[#ef8f0b] border border-[var(--hairline)] shadow-sm"
                          : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-1)]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#ef8f0b] text-black">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right: Store Switcher & Staff Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Store Switcher */}
              <div className="hidden sm:flex items-center gap-1.5 bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl px-2.5 py-1.5 text-xs">
                <StoreIcon className="w-3.5 h-3.5 text-[#ef8f0b] shrink-0" />
                {currentRole === "SUPER_ADMIN" ? (
                  <select
                    value={selectedStore}
                    onChange={(e) => onStoreChange(e.target.value)}
                    className="bg-transparent text-[var(--ink)] outline-none text-xs cursor-pointer font-medium max-w-[130px] md:max-w-[180px] truncate"
                  >
                    <option value="ALL" className="bg-[var(--surface-1)] text-[var(--ink)]">
                      All Stores (Platform)
                    </option>
                    {accessibleStores.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[var(--surface-1)] text-[var(--ink)]">
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : accessibleStores.length > 1 ? (
                  <select
                    value={selectedStore}
                    onChange={(e) => onStoreChange(e.target.value)}
                    className="bg-transparent text-[var(--ink)] outline-none text-xs cursor-pointer font-medium max-w-[130px] md:max-w-[180px] truncate"
                  >
                    <option value="ALL" className="bg-[var(--surface-1)] text-[var(--ink)]">
                      My Assigned Stores ({accessibleStores.length})
                    </option>
                    {accessibleStores.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[var(--surface-1)] text-[var(--ink)]">
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[var(--ink)] font-medium text-xs truncate max-w-[160px]">
                    {accessibleStores[0]?.name || "Assigned Store"}
                  </span>
                )}
              </div>

              <ThemeToggle />

              {/* Staff User Identity Badge */}
              <div className="flex items-center gap-2 pl-2 border-l border-[var(--hairline)]">
                <div className="hidden md:flex flex-col items-end text-right">
                  <span className="text-xs font-semibold text-[var(--ink)] leading-tight">
                    {staffUser?.name || "Staff Member"}
                  </span>
                  <span className="text-[10px] text-[var(--ink-muted)] font-mono leading-tight truncate max-w-[140px]">
                    {staffUser?.email}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold tracking-wider uppercase border shrink-0 ${getRoleBadgeStyle(
                    currentRole
                  )}`}
                >
                  {getRoleLabel(currentRole)}
                </span>

                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl bg-[var(--surface-1)] hover:bg-red-500/10 border border-[var(--hairline)] hover:border-red-500/30 text-[var(--ink-muted)] hover:text-red-400 transition-colors ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tablet/Medium Subheader Navigation Row */}
          <div className="hidden md:flex lg:hidden items-center justify-between py-2 border-t border-[var(--hairline)] overflow-x-auto gap-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                    isActive ? "bg-[var(--surface-3)] text-[#ef8f0b]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#ef8f0b] text-black">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile Sticky Bottom Navigation Bar (<= 480px) */}
      <nav
        aria-label="Mobile Staff Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--canvas)] backdrop-blur-lg border-t border-[var(--hairline-strong)] px-2 py-1 safe-area-pb"
      >
        <div className={`grid gap-1 ${visibleTabs.length >= 5 ? "grid-cols-5" : `grid-cols-${visibleTabs.length}`}`}>
          {visibleTabs.slice(0, 5).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-all relative ${
                  isActive
                    ? "text-[#ef8f0b] bg-[var(--surface-2)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] active:scale-95"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 px-1 py-0.1 text-[9px] font-mono font-bold rounded-full bg-[#ef8f0b] text-black">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium mt-0.5 leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
