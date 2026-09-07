import { motion } from "framer-motion";

interface LocationGateProps {
  onEnable: () => void;
  error: string | null;
}

export default function LocationGate({ onEnable, error }: LocationGateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <div className="flex items-start gap-4 max-w-md">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber-soft)] border border-[rgba(245,158,11,0.2)] flex items-center justify-center shrink-0 mt-0.5">
          <svg viewBox="0 0 20 20" className="w-5 h-5 text-[var(--accent-amber)]" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="text-[var(--text-primary)] text-sm font-medium mb-1">
            Find the nearest Flashfix
          </p>
          <p className="text-[var(--text-muted)] text-xs leading-relaxed">
            Share your location to see which stores are Flash-eligible (≤3km) — same-day pickup & delivery.
          </p>
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[#EA580C] text-xs bg-[rgba(234,88,12,0.08)] border border-[rgba(234,88,12,0.2)] rounded-lg px-3 py-2 max-w-sm"
        >
          {error}
        </motion.p>
      )}

      <div className="flex gap-3 flex-wrap">
        <motion.button
          onClick={onEnable}
          className="btn-primary text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
            <path fillRule="evenodd" d="M3.05 3.05a7 7 0 019.9 9.9L8 17.9l-4.95-4.95a7 7 0 010-9.9zM8 9a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Enable Location
        </motion.button>
        <button
          onClick={() => window.open("/flashfix/services", "_self")}
          className="btn-ghost text-sm"
        >
          Browse Services Instead
        </button>
      </div>
    </motion.div>
  );
}
