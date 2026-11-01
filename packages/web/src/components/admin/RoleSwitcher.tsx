import { Shield, Wrench, Bike, Building2, ChevronDown } from "lucide-react";
import { AdminRole } from "./types";
import { useState, useRef, useEffect } from "react";

interface RoleSwitcherProps {
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
}

export default function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roles: { id: AdminRole; label: string; sub: string; icon: typeof Shield; color: string }[] = [
    {
      id: "SUPER_ADMIN",
      label: "Super Admin",
      sub: "Platform Director (Cross-Hub)",
      icon: Shield,
      color: "text-[#ef8f0b] bg-[#ef8f0b]/10 border-[#ef8f0b]/30",
    },
    {
      id: "ADMIN",
      label: "Store Admin",
      sub: "Madhapur Flagship Lab",
      icon: Building2,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      id: "TECHNICIAN",
      label: "Lab Technician",
      sub: "Arjun Verma (Hardware Bench)",
      icon: Wrench,
      color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    },
    {
      id: "COURIER",
      label: "Delivery Rider",
      sub: "Vikram Reddy (Mobile Field)",
      icon: Bike,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    },
  ];

  const active = roles.find((r) => r.id === currentRole) || roles[0];
  const ActiveIcon = active.icon;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#141414] hover:bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] hover:border-[#ef8f0b]/40 rounded-xl px-2.5 py-1.5 transition-all text-left"
        title="Switch active staff view / role"
      >
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${active.color} border`}>
          <ActiveIcon className="w-3.5 h-3.5" />
        </div>
        <div className="hidden sm:block text-left pr-1">
          <div className="text-[11px] font-bold text-[#f5f0eb] leading-tight flex items-center gap-1.5">
            <span>{active.label}</span>
          </div>
          <div className="text-[9px] text-[#807a75] font-mono leading-none truncate max-w-[110px]">
            {active.sub}
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#807a75] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#141414] border border-[rgba(255,255,255,0.12)] rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#807a75] border-b border-[rgba(255,255,255,0.06)] mb-1">
            Switch Perspective
          </div>
          <div className="space-y-1">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = r.id === currentRole;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    onRoleChange(r.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] shadow-sm"
                      : "hover:bg-[#1a1a1a]"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${r.color} border shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#f5f0eb] flex items-center justify-between">
                      <span>{r.label}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ef8f0b]" />
                      )}
                    </div>
                    <div className="text-[10px] text-[#807a75] font-mono truncate">
                      {r.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
