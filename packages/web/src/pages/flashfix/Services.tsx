import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Smartphone, Battery, Droplets, Plug2, Camera, AppWindow, Speaker, Cpu, Zap, ArrowRight, CheckCircle2 } from "lucide-react";

const SERVICES = [
  { name: "Screen Replacement", icon: Smartphone, desc: "Cracked or dead display? We replace with OEM-grade panels." },
  { name: "Battery Replacement", icon: Battery, desc: "Swollen, draining fast, or not charging? New battery, old phone feels new." },
  { name: "Water Damage", icon: Droplets, desc: "Immediate chemical cleaning and component-level ultrasonic treatment." },
  { name: "Charging Port", icon: Plug2, desc: "Loose or non-functional charging port replaced with precision components." },
  { name: "Camera Repair", icon: Camera, desc: "Blurry, black screen, or shattered sapphire lens — restored to factory clarity." },
  { name: "Back Glass", icon: AppWindow, desc: "Shattered back chassis restored with precision laser removal." },
  { name: "Speaker / Mic", icon: Speaker, desc: "Muffled audio, crackling ear speaker, or silent microphone diagnosed and repaired." },
  { name: "Software Recovery", icon: Cpu, desc: "Boot loops, firmware recovery, crash diagnostics, and data-safe flashing." },
];

const BRANDS = ["Apple", "Samsung", "Google", "OnePlus"] as const;
type BrandKey = (typeof BRANDS)[number];

const BRAND_MODELS: Record<BrandKey, string[]> = {
  Apple: [
    "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
    "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
    "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 11 Pro Max",
  ],
  Samsung: [
    "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25",
    "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S24 FE",
    "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23",
    "Galaxy Z Fold 6", "Galaxy Z Fold 5", "Galaxy Z Flip 6", "Galaxy Z Flip 5",
    "Galaxy A55 5G", "Galaxy A54 5G", "Galaxy A35 5G",
  ],
  Google: [
    "Pixel 9 Pro Fold", "Pixel 9 Pro XL", "Pixel 9 Pro", "Pixel 9",
    "Pixel 8 Pro", "Pixel 8", "Pixel 8a",
    "Pixel 7 Pro", "Pixel 7", "Pixel 7a",
    "Pixel 6 Pro", "Pixel 6", "Pixel 6a",
  ],
  OnePlus: [
    "OnePlus 13", "OnePlus 12", "OnePlus 12R",
    "OnePlus 11", "OnePlus 11R",
    "OnePlus Open", "Nord 4", "Nord CE4", "Nord 3",
  ],
};

export default function FlashfixServices() {
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>("Apple");
  const navigate = useNavigate();

  function handleSelectDevice(device: string) {
    sessionStorage.setItem(
      "ff_booking_draft",
      JSON.stringify({ step: 2, step1: { brand: selectedBrand, device } })
    );
    navigate("/flashfix/book");
  }

  return (
    <div className="pt-24 pb-20 bg-[var(--surface-bg)] min-h-screen text-[var(--text-primary)]">
      <div className="section-container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="text-[var(--accent-amber)] font-mono text-sm tracking-widest uppercase mb-3 block">
            Precision Repair Services
          </span>
          <h1 className="font-display font-bold text-[clamp(36px,6vw,72px)] leading-tight">
            WHAT WE <span className="text-[var(--accent-amber)]">FIX</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-4 max-w-xl mx-auto text-base md:text-lg font-light leading-relaxed">
            Certified technicians using OEM-spec diagnostic equipment and factory-grade replacement components.
          </p>
        </motion.div>

        {/* ─── Services Grid (No hardcoded durations) ─── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {SERVICES.map((service, i) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] hover:border-[var(--accent-amber)]/40 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 bg-[#ef8f0b]/10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 mb-6">
                    <Icon className="w-6 h-6 text-[#ef8f0b]" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2 text-[var(--text-primary)] group-hover:text-[var(--accent-amber)] transition-colors">
                    {service.name}
                  </h3>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed">{service.desc}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--surface-border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5 text-[var(--accent-amber)] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> OEM Tested
                  </span>
                  <Link
                    to="/flashfix/book"
                    className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent-amber)] transition-colors inline-flex items-center gap-1"
                  >
                    Select <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ─── Supported Flagship Devices Section ─── */}
        <div className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-3xl p-8 md:p-12 mb-16">
          <div className="max-w-2xl mb-8">
            <span className="text-[var(--accent-amber)] font-mono text-xs tracking-widest uppercase mb-2 block">
              Device Compatibility
            </span>
            <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-[var(--text-primary)]">
              Supported Flagship Devices
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Select your manufacturer below to inspect all certified supported models. Click any model to start a booking directly.
            </p>
          </div>

          {/* Brand Switcher Tabs */}
          <div className="flex flex-wrap gap-2.5 mb-8">
            {BRANDS.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  selectedBrand === brand
                    ? "bg-[#ef8f0b] text-black shadow-md"
                    : "bg-[var(--surface-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--surface-border)]"
                }`}
              >
                {brand}
              </button>
            ))}
          </div>

          {/* Device Model Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {BRAND_MODELS[selectedBrand].map((model) => (
              <button
                key={model}
                onClick={() => handleSelectDevice(model)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--surface-border)] hover:border-[#ef8f0b] text-left transition-all group"
              >
                <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[#ef8f0b] transition-colors">
                  {model}
                </span>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#ef8f0b] group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* Booking CTA Banner */}
        <div className="text-center py-8">
          <Link
            to="/flashfix/book"
            className="inline-flex items-center justify-center gap-2.5 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-lg px-10 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_25px_rgba(239,143,11,0.25)]"
          >
            <Zap className="w-5 h-5" />
            Book a Repair Now
          </Link>
        </div>
      </div>
    </div>
  );
}
