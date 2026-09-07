import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeSync } from "@/hooks/useThemeSync";
import Navbar from "./Navbar";

export default function RootLayout() {
  useThemeSync();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[var(--surface-bg)] text-[var(--text-primary)]">
      <Navbar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
