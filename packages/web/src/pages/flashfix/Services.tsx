import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const SERVICES = [
  { name: "Screen Replacement", time: "45–60 min", icon: "📱", desc: "Cracked or dead display? We replace with OEM-grade panels.", brands: ["iPhone", "Samsung", "Pixel"] },
  { name: "Battery Replacement", time: "30–45 min", icon: "🔋", desc: "Swollen, draining fast, or not charging? New battery, old phone feels new.", brands: ["All brands"] },
  { name: "Water Damage", time: "1–2 hrs", icon: "💧", desc: "Don't wait. Bring it in as fast as you can for best recovery odds.", brands: ["All brands"] },
  { name: "Charging Port", time: "45 min", icon: "🔌", desc: "Loose or non-functional charging port replaced with precision parts.", brands: ["iPhone", "Samsung", "OnePlus"] },
  { name: "Camera Repair", time: "60 min", icon: "📸", desc: "Blurry, black screen, or shattered lens — we fix or replace.", brands: ["iPhone", "Samsung", "Pixel"] },
  { name: "Back Glass", time: "45–75 min", icon: "🪟", desc: "Shattered back? Restored to smooth and professional.", brands: ["iPhone", "Samsung"] },
  { name: "Speaker / Mic", time: "30–45 min", icon: "🔊", desc: "Muffled calls or no sound? We diagnose and replace.", brands: ["All brands"] },
  { name: "Software Fix", time: "30–60 min", icon: "💻", desc: "Boot loops, factory reset recovery, software reinstall.", brands: ["All brands"] },
];

export default function FlashfixServices() {
  return (
    <div className="pt-24 pb-20">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-14"
        >
          <span className="platform-badge mb-4 inline-flex">Services</span>
          <h1 className="heading-flashfix text-[clamp(48px,6vw,80px)] mt-4">
            WHAT WE <span className="text-amber-gradient">FIX</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-3 max-w-lg">
            Every repair is done by certified technicians using quality parts.
            Flash zone (≤3km): same-day pickup & delivery.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((service, i) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="card p-6 group hover:shadow-amber-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                  {service.icon}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--surface-elevated)] px-2 py-1 rounded-full">
                  {service.time}
                </span>
              </div>
              <h3 className="heading-flashfix text-xl mb-2 group-hover:text-[var(--accent-amber)] transition-colors">
                {service.name.toUpperCase()}
              </h3>
              <p className="text-[var(--text-muted)] text-xs leading-relaxed mb-4">{service.desc}</p>
              <div className="flex flex-wrap gap-1">
                {service.brands.map((b) => (
                  <span key={b} className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-elevated)] px-2 py-0.5 rounded-full">
                    {b}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link to="/flashfix/book" className="btn-primary text-base px-10 py-4">
            ⚡ Book a Repair Now
          </Link>
        </div>
      </div>
    </div>
  );
}
