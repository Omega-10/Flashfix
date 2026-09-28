import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Smartphone, Battery, Droplets, Plug2, Camera, AppWindow, Speaker, Cpu, Zap } from "lucide-react";

const SERVICES = [
  { name: "Screen Replacement", time: "45–60 min", icon: Smartphone, desc: "Cracked or dead display? We replace with OEM-grade panels.", brands: ["iPhone", "Samsung", "Pixel"] },
  { name: "Battery Replacement", time: "30–45 min", icon: Battery, desc: "Swollen, draining fast, or not charging? New battery, old phone feels new.", brands: ["All brands"] },
  { name: "Water Damage", time: "1–2 hrs", icon: Droplets, desc: "Don't wait. Bring it in as fast as you can for best recovery odds.", brands: ["All brands"] },
  { name: "Charging Port", time: "45 min", icon: Plug2, desc: "Loose or non-functional charging port replaced with precision parts.", brands: ["iPhone", "Samsung", "OnePlus"] },
  { name: "Camera Repair", time: "60 min", icon: Camera, desc: "Blurry, black screen, or shattered lens — we fix or replace.", brands: ["iPhone", "Samsung", "Pixel"] },
  { name: "Back Glass", time: "45–75 min", icon: AppWindow, desc: "Shattered back? Restored to smooth and professional.", brands: ["iPhone", "Samsung"] },
  { name: "Speaker / Mic", time: "30–45 min", icon: Speaker, desc: "Muffled calls or no sound? We diagnose and replace.", brands: ["All brands"] },
  { name: "Software Fix", time: "30–60 min", icon: Cpu, desc: "Boot loops, factory reset recovery, software reinstall.", brands: ["All brands"] },
];

export default function FlashfixServices() {
  return (
    <div className="pt-24 pb-20 bg-[var(--surface-bg)] min-h-screen">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="text-[var(--accent-amber)] font-mono text-sm tracking-widest uppercase mb-4 block">The Arsenal</span>
          <h1 className="font-display font-bold text-[clamp(40px,7vw,80px)] mt-4 leading-tight">
            WHAT WE <span className="text-[var(--accent-amber)]">FIX</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-6 max-w-xl mx-auto text-lg font-light leading-relaxed">
            Every repair is done by certified technicians using OEM-grade parts.
            Flash zone (&lt; 3km): same-day pickup & delivery.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((service, i) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-2xl p-6 group hover:border-[var(--accent-amber)]/30 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-12 h-12 bg-[#ef8f0b]/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-[#ef8f0b]" />
                  </div>
                  <span className="font-mono text-xs text-[var(--text-muted)] bg-[var(--surface-bg)] px-3 py-1 rounded-full border border-[var(--surface-border)]">
                    {service.time}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg mb-3 text-[var(--text-primary)] group-hover:text-[var(--accent-amber)] transition-colors">
                  {service.name.toUpperCase()}
                </h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6 h-10">{service.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {service.brands.map((b) => (
                    <span key={b} className="text-xs font-medium text-[var(--text-muted)] bg-[var(--surface-bg)] px-3 py-1 rounded border border-[var(--surface-border)]">
                      {b}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-20 text-center">
          <Link to="/flashfix/book" className="inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-lg px-10 py-5 rounded-xl transition-all duration-300 transform hover:scale-105">
            <Zap className="w-5 h-5" />
            Book a Repair Now
          </Link>
        </div>
      </div>
    </div>
  );
}
