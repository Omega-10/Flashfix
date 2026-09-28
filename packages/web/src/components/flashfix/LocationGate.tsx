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
      className="space-y-6 flex flex-col items-center"
    >
      <div className="flex flex-col items-center text-center gap-4 max-w-md">
        <div className="w-12 h-12 rounded-full bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/20 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 20 20" className="w-6 h-6 text-[var(--accent-amber)]" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="text-[var(--text-primary)] font-semibold mb-2 text-lg">
            Find the nearest Flashfix
          </p>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed font-light">
            Share your location to see which stores are Flash-eligible (&lt; 3km) — for same-day pickup & delivery.
          </p>
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[#ef8f0b] text-xs bg-[#ef8f0b]/10 border border-[#ef8f0b]/30 rounded-lg px-4 py-3 max-w-sm"
        >
          {error}
        </motion.p>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-md">
        <motion.button
          onClick={onEnable}
          className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(239,143,11,0.2)]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Enable Location
        </motion.button>
        <button
          onClick={() => window.open("/flashfix/services", "_self")}
          className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-primary)] font-medium px-8 py-4 rounded-xl transition-all duration-300"
        >
          Browse Services
        </button>
      </div>
    </motion.div>
  );
}
