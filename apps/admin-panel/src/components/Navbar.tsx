
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Boxes,
  Shield,
  Store as StoreIcon,
  Bell,
} from "lucide-react";
import { STORES } from "../api";

export type AdminTab = "dashboard" | "bookings" | "team" | "inventory";

interface NavbarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  selectedStore: string;
  onStoreChange: (storeId: string) => void;
  unassignedCount: number;
}

export default function Navbar({
  activeTab,
  onTabChange,
  selectedStore,
  onStoreChange,
  unassignedCount,
}: NavbarProps) {
  const tabs = [
    { id: "dashboard" as AdminTab, label: "Dashboard", icon: LayoutDashboard },
    {
      id: "bookings" as AdminTab,
      label: "Bookings",
      icon: CalendarCheck,
      badge: unassignedCount > 0 ? unassignedCount : undefined,
    },
    { id: "team" as AdminTab, label: "Team & Staff", icon: Users },
    { id: "inventory" as AdminTab, label: "Parts Inventory", icon: Boxes },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.08)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Title */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ef8f0b] flex items-center justify-center font-bold text-black text-base shadow-md shadow-[#ef8f0b]/20">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-wide text-white">
                    FLASHFIX
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider bg-[#ef8f0b]/10 text-[#ef8f0b] px-1.5 py-0.5 rounded border border-[#ef8f0b]/20 font-semibold">
                    OPS CONSOLE
                  </span>
                </div>
                <span className="text-[10px] text-[#807a75] block font-mono">
                  Port 5174 • Central Operations Hub
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#1e1e1e] text-[#ef8f0b] border border-[rgba(255,255,255,0.08)] shadow-sm"
                        : "text-[#807a75] hover:text-[#f5f0eb] hover:bg-[#141414]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
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

          {/* Right: Store Selector & User Info */}
          <div className="flex items-center gap-3">
            {/* Store Switcher */}
            <div className="flex items-center gap-2 bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-1.5 text-xs">
              <StoreIcon className="w-3.5 h-3.5 text-[#ef8f0b]" />
              <select
                value={selectedStore}
                onChange={(e) => onStoreChange(e.target.value)}
                className="bg-transparent text-[#f5f0eb] outline-none text-xs cursor-pointer font-medium"
              >
                <option value="ALL" className="bg-[#141414] text-[#f5f0eb]">
                  All Stores (Platform View)
                </option>
                {STORES.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#141414] text-[#f5f0eb]">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notifications Indicator */}
            {unassignedCount > 0 && (
              <div
                onClick={() => onTabChange("bookings")}
                className="cursor-pointer p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors relative"
                title={`${unassignedCount} unassigned bookings require attention`}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              </div>
            )}

            {/* Super Admin Badge */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[rgba(255,255,255,0.08)]">
              <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-xs font-bold text-[#ef8f0b]">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="text-left text-xs">
                <span className="font-semibold text-[#f5f0eb] block text-[11px] leading-tight">
                  Ops Director
                </span>
                <span className="text-[10px] text-[#807a75] font-mono leading-none">
                  SUPER_ADMIN
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-[rgba(255,255,255,0.08)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium ${
                  isActive ? "text-[#ef8f0b]" : "text-[#807a75]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
