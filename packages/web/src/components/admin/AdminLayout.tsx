import { Outlet } from "react-router-dom";
import { useThemeSync } from "@/hooks/useThemeSync";

export default function AdminLayout() {
  useThemeSync();
  return (
    <div className="admin-shell min-h-screen bg-[var(--canvas)] text-[var(--ink)] flex flex-col font-sans max-w-full overflow-x-hidden transition-colors duration-300 selection:bg-[#ef8f0b]/30">
      <Outlet />
    </div>
  );
}
