import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Boxes,
  Store as StoreIcon,
  Bell,
  Wrench,
  Bike,
  Globe2,
} from "lucide-react";
import { AdminTab, AdminRole } from "./types";
import { STORES } from "./api";
import RoleSwitcher from "./RoleSwitcher";

interface AdminNavbarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  unassignedCount: number;
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
}

export default function AdminNavbar({
  activeTab,
  onTabChange,
  selectedStore,
  onStoreChange,
  unassignedCount,
  currentRole,
  onRoleChange,
}: AdminNavbarProps) {
  const tabs = [
    { id: "dashboard" as AdminTab, label: "Admin", icon: LayoutDashboard },
    { id: "superadmin" as AdminTab, label: "Superadmin", icon: Globe2 },
    { id: "technician" as AdminTab, label: "Technician", icon: Wrench },
    { id: "delivery" as AdminTab, label: "Delivery", icon: Bike },
    {
      id: "bookings" as AdminTab,
      label: "Bookings",
      icon: CalendarCheck,
      badge: unassignedCount > 0 ? unassignedCount : undefined,
    },
    { id: "team" as AdminTab, label: "Staff", icon: Users },
    { id: "inventory" as AdminTab, label: "Inventory", icon: Boxes },
  ];

  // Mobile primary tabs (4 dedicated views + bookings)
  const mobileTabs = [
    { id: "dashboard" as AdminTab, label: "Admin", icon: LayoutDashboard },
    { id: "superadmin" as AdminTab, label: "Super", icon: Globe2 },
    { id: "technician" as AdminTab, label: "Tech Lab", icon: Wrench },
    { id: "delivery" as AdminTab, label: "Courier", icon: Bike },
    {
      id: "bookings" as AdminTab,
      label: "Bookings",
      icon: CalendarCheck,
      badge: unassignedCount > 0 ? unassignedCount : undefined,
    },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.08)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Left: Brand & Title */}
            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#ef8f0b] flex items-center justify-center font-bold text-black text-base shadow-md shadow-[#ef8f0b]/20 shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-bold text-xs sm:text-sm tracking-wide text-white">
                      FLASHFIX
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider bg-[#ef8f0b]/10 text-[#ef8f0b] px-1.5 py-0.5 rounded border border-[#ef8f0b]/20 font-semibold">
                      OPS
                    </span>
                  </div>
                  <span className="hidden sm:block text-[10px] text-[#807a75] font-mono leading-none mt-0.5">
                    Integrated Staff & Admin Console
                  </span>
                </div>
              </div>

              {/* Desktop Navigation Tabs */}
              <nav className="hidden lg:flex items-center gap-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#1e1e1e] text-[#ef8f0b] border border-[rgba(255,255,255,0.08)] shadow-sm"
                          : "text-[#807a75] hover:text-[#f5f0eb] hover:bg-[#141414]"
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

            {/* Right: Controls & Role Switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Store Switcher */}
              <div className="hidden sm:flex items-center gap-1.5 bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-xl px-2.5 py-1.5 text-xs">
                <StoreIcon className="w-3.5 h-3.5 text-[#ef8f0b] shrink-0" />
                <select
                  value={selectedStore}
                  onChange={(e) => onStoreChange(e.target.value)}
                  className="bg-transparent text-[#f5f0eb] outline-none text-xs cursor-pointer font-medium max-w-[130px] md:max-w-[180px] truncate"
                >
                  <option value="ALL" className="bg-[#141414] text-[#f5f0eb]">
                    All Stores (Platform)
                  </option>
                  {STORES.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#141414] text-[#f5f0eb]">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notifications Alert Bell */}
              {unassignedCount > 0 && (
                <button
                  onClick={() => onTabChange("bookings")}
                  className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors relative shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
                  title={`${unassignedCount} unassigned orders require staff allocation`}
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                </button>
              )}

              {/* Role Switcher Pill */}
              <RoleSwitcher currentRole={currentRole} onRoleChange={onRoleChange} />
            </div>
          </div>

          {/* Tablet/Medium Subheader Navigation Row */}
          <div className="hidden md:flex lg:hidden items-center justify-between py-2 border-t border-[rgba(255,255,255,0.08)] overflow-x-auto gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                    isActive ? "bg-[#1e1e1e] text-[#ef8f0b]" : "text-[#807a75] hover:text-[#f5f0eb]"
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d]/95 backdrop-blur-lg border-t border-[rgba(255,255,255,0.1)] px-2 py-1 safe-area-pb"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-all relative ${
                  isActive
                    ? "text-[#ef8f0b] bg-[#1a1a1a]"
                    : "text-[#807a75] hover:text-[#f5f0eb] active:scale-95"
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
