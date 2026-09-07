import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGeolocation, type NearbyStore } from "@/hooks/useGeolocation";
import { useAppStore } from "@/store/appStore";
import LocationGate from "@/components/flashfix/LocationGate";
import StoreBadge from "@/components/flashfix/StoreBadge";
import StoreMap from "@/components/flashfix/StoreMap";
import LightningBolt from "@/components/ui/LightningBolt";

gsap.registerPlugin(ScrollTrigger);

export default function FlashfixHome() {
  const [step, setStep] = useState<"prompt" | "loading" | "results">("prompt");
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { requestLocation, fetchNearbyStores } = useGeolocation();
  const userLocation = useAppStore((s) => s.userLocation);
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userLocation) return;
    // If location already granted (persisted), fetch immediately
    fetchNearbyStores(userLocation.lat, userLocation.lng)
      .then((data) => { setStores(data); setStep("results"); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".ff-reveal").forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" }
          }
        );
      });
    }, sectionsRef);
    return () => ctx.revert();
  }, [step]);

  async function handleEnableLocation() {
    setStep("loading");
    setError(null);
    try {
      const pos = await requestLocation();
      const data = await fetchNearbyStores(pos.coords.latitude, pos.coords.longitude);
      setStores(data);
      setStep("results");
    } catch {
      setError("Couldn't get your location. Please allow location access and try again.");
      setStep("prompt");
    }
  }

  // Best nearby store for hero display
  const closest = stores[0];

  return (
    <div ref={sectionsRef} className="pt-16">

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-mesh-dark" />
        <div className="absolute inset-0 bg-[var(--surface-bg)] opacity-60" />

        {/* Big background type */}
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none" aria-hidden>
          <motion.span
            className="heading-flashfix text-[clamp(140px,22vw,320px)] text-white/[0.025] leading-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            FLASH
          </motion.span>
        </div>

        <div className="section-container relative z-10 py-24 flex flex-col lg:flex-row items-center gap-12">
          <div className="max-w-2xl flex-1">

            {/* Platform label */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <span className="platform-badge">⚡ Repair as a Service</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="heading-flashfix text-[clamp(56px,8vw,120px)] mt-6 leading-[0.9]"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              YOUR PHONE.<br />
              <span className="text-amber-gradient">FIXED.</span><br />
              <span className="text-[var(--text-muted)]">TODAY.</span>
            </motion.h1>

            {/* USP line */}
            <motion.p
              className="text-[var(--text-secondary)] text-lg mt-6 mb-10 max-w-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
            >
              Same-day pickup & delivery within 3km.
              That's why we're called <strong className="text-[var(--accent-amber)]">Flash</strong>Fix.
            </motion.p>

            {/* Location CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              {step === "prompt" && (
                <LocationGate onEnable={handleEnableLocation} error={error} />
              )}

              {step === "loading" && (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[var(--accent-amber)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[var(--text-muted)] text-sm">Finding stores near you…</span>
                </div>
              )}

              {step === "results" && closest && (
                <div className="space-y-4">
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      className="inline-flex items-center gap-3"
                    >
                      <StoreBadge store={closest} size="lg" />
                      <span className="text-[var(--text-muted)] text-sm">
                        {closest.name} · {closest.distanceKm}km away
                      </span>
                    </motion.div>
                  </AnimatePresence>
                  <div className="flex gap-3 flex-wrap">
                    <Link to="/flashfix/book" className="btn-primary">
                      Book Repair ⚡
                    </Link>
                    <Link to="/flashfix/services" className="btn-ghost">
                      See Services
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          <div className="flex-1 hidden lg:block">
            <LightningBolt />
          </div>
        </div>

        {/* Amber bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-amber)] to-transparent opacity-20" />
      </section>

      {/* ─── STORE MAP (visible after location granted) ─── */}
      <AnimatePresence>
        {step === "results" && stores.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="py-20"
          >
            <div className="section-container">
              <div className="ff-reveal mb-8">
                <h2 className="heading-flashfix text-4xl mb-2">
                  STORES <span className="text-amber-gradient">NEAR YOU</span>
                </h2>
                <p className="text-[var(--text-muted)] text-sm">
                  {stores.filter((s) => s.tier === "flash").length} Flash-eligible ·{" "}
                  {stores.filter((s) => s.tier === "next-day").length} Next-Day ·{" "}
                  {stores.length} total
                </p>
              </div>
              <StoreMap stores={stores} />

              {/* Store list */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                {stores.map((store, i) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.5 }}
                    className="card p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                        {store.name}
                      </h3>
                      <StoreBadge store={store} size="sm" />
                    </div>
                    <p className="text-[var(--text-muted)] text-xs mb-2">{store.address}</p>
                    <p className="text-[var(--text-muted)] text-xs mb-3">{store.hours}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--accent-amber)] text-xs">★ {store.rating}</span>
                      <span className="text-[var(--text-muted)] text-xs">({store.reviews})</span>
                      <span className="text-[var(--text-muted)] text-xs ml-auto">{store.distanceKm}km</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24 border-t border-[var(--surface-border)]">
        <div className="section-container">
          <div className="ff-reveal text-center mb-16">
            <span className="platform-badge mb-4 inline-flex">Process</span>
            <h2 className="heading-flashfix text-[clamp(36px,5vw,60px)] mt-3">
              HOW IT <span className="text-amber-gradient">WORKS</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "LOCATE", desc: "Share your location. We find the nearest Flashfix in seconds." },
              { step: "02", title: "BOOK", desc: "Pick your device, issue, and slot. Takes 60 seconds." },
              { step: "03", title: "WE COME", desc: "Our tech picks up your device from your doorstep." },
              { step: "04", title: "FIXED", desc: "Repaired and back in your hands — same day if you're within 3km." },
            ].map((item) => (
              <div key={item.step} className="ff-reveal bg-[var(--surface-elevated)] p-6 relative overflow-hidden border-l-4 border-l-[var(--accent-amber)] border-y border-r border-[var(--surface-border)] rounded-r-xl shadow-lg hover:shadow-amber-sm transition-all duration-300 group">
                <div
                  className="absolute top-0 right-0 w-16 h-16 bg-amber-gradient opacity-10 rounded-bl-full group-hover:opacity-20 transition-opacity"
                  aria-hidden
                />
                <div className="font-mono text-xs text-[var(--text-muted)] mb-3 uppercase tracking-widest">
                  Step {item.step}
                </div>
                <h3 className="heading-flashfix text-xl mb-2 group-hover:text-[var(--accent-amber)] transition-colors">{item.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed relative z-10">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SERVICES PREVIEW ─── */}
      <section className="py-24">
        <div className="section-container">
          <div className="ff-reveal flex items-end justify-between mb-10">
            <h2 className="heading-flashfix text-4xl">
              WHAT WE <span className="text-amber-gradient">FIX</span>
            </h2>
            <Link to="/flashfix/services" className="btn-ghost text-sm">
              All Services →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: "📱", label: "Screen" },
              { icon: "🔋", label: "Battery" },
              { icon: "💧", label: "Water Damage" },
              { icon: "🔌", label: "Charging Port" },
              { icon: "📸", label: "Camera" },
              { icon: "🔊", label: "Speaker" },
            ].map((s) => (
              <div key={s.label} className="ff-reveal card p-4 text-center cursor-pointer group">
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-200">{s.icon}</div>
                <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--accent-amber)] transition-colors">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
