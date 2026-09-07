import { motion } from "framer-motion";
import { useAppStore } from "@/store/appStore";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useAppStore();
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative w-12 h-6 rounded-full border border-[var(--surface-border)] bg-[var(--surface-elevated)] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-amber)] focus-visible:outline-offset-2"
      whileTap={{ scale: 0.94 }}
    >
      {/* Track shimmer */}
      <div className="absolute inset-0 bg-amber-gradient opacity-0 transition-opacity duration-300"
        style={{ opacity: isDark ? 0 : 0.15 }} />

      {/* Thumb */}
      <motion.div
        className="absolute top-0.5 w-5 h-5 rounded-full flex items-center justify-center"
        style={{
          background: isDark ? "rgba(245,158,11,0.15)" : "var(--accent-amber)",
          border: isDark ? "1px solid rgba(245,158,11,0.4)" : "none",
        }}
        animate={{ x: isDark ? 2 : 22 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        {isDark ? (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
            <path d="M10 6a4 4 0 01-4.95 3.89A4 4 0 016 2.08 4 4 0 0110 6z" fill="#F59E0B" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
            <circle cx="6" cy="6" r="2.5" fill="#0D0D0D" />
            <path d="M6 1v1M6 10v1M1 6h1M10 6h1M2.64 2.64l.7.7M8.66 8.66l.7.7M2.64 9.36l.7-.7M8.66 3.34l.7-.7"
              stroke="#0D0D0D" strokeWidth="1" strokeLinecap="round" />
          </svg>
        )}
      </motion.div>
    </motion.button>
  );
}
