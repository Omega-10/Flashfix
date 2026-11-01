import { Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f0eb] flex flex-col font-sans max-w-full overflow-x-hidden selection:bg-[#ef8f0b]/30 selection:text-[#ef8f0b]">
      <Outlet />
    </div>
  );
}
