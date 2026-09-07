import { motion } from "framer-motion";

export default function LightningBolt() {
  return (
    <div className="relative w-full h-[500px] lg:h-[600px] flex items-center justify-center pointer-events-auto">
      {/* Container that user can interact with */}
      <motion.div
        className="relative z-10 w-full h-full flex items-center justify-center cursor-crosshair group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg
          viewBox="0 0 100 150"
          className="w-48 h-72 md:w-64 md:h-96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EA580C" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Core shape */}
          <motion.path
            d="M55 5L20 85h25l-10 60 60-90H65l10-50z"
            fill="url(#bolt-grad)"
            filter="url(#glow)"
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1, pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="group-hover:drop-shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all duration-300"
          />

          {/* Animated outline stroke */}
          <motion.path
            d="M55 5L20 85h25l-10 60 60-90H65l10-50z"
            stroke="#FEF3C7"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "linear", repeat: Infinity, repeatType: "loop" }}
            className="opacity-50"
          />
        </svg>

        {/* Dynamic Glow Particles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-amber-500 rounded-full w-2 h-2"
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 0],
              x: (Math.random() - 0.5) * 200,
              y: (Math.random() - 0.5) * 200,
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 2 + Math.random(),
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
