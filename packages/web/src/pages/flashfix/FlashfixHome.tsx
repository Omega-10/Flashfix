import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MapPin, Zap, Smartphone, CheckCircle, Truck } from "lucide-react";
import { useGeolocation, type NearbyStore } from "@/hooks/useGeolocation";
import { useAppStore } from "@/store/appStore";
import LocationGate from "@/components/flashfix/LocationGate";
import StoreBadge from "@/components/flashfix/StoreBadge";
import StoreMap from "@/components/flashfix/StoreMap";

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

  const closest = stores[0];

  return (
    <div ref={sectionsRef} className="pt-16 bg-[var(--surface-bg)] text-[var(--text-primary)] min-h-screen font-sans">

      {/* ─── HERO ─── */}
      <section className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden border-b border-[var(--surface-border)]">
        {/* Cinematic Lighting */}
        <div className="absolute inset-0 bg-mesh-dark opacity-30 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] bg-[var(--accent-amber)] opacity-[0.05] blur-[100px] rounded-full pointer-events-none" />

        <div className="section-container relative z-10 py-32 flex flex-col items-center text-center">
          
          {/* Platform label */}
          <motion.div
            className="flex items-center justify-center gap-2 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/20">
              <Zap className="w-4 h-4 text-[var(--accent-amber)]" />
            </div>
            <span className="text-[var(--accent-amber)] font-mono text-sm uppercase tracking-widest font-semibold">Precision Repair Protocol</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="font-display font-extrabold text-[clamp(60px,10vw,160px)] leading-[0.85] tracking-tighter text-[var(--text-primary)] mb-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            YOUR PHONE.<br />
            <span className="text-[var(--accent-amber)]">FIXED.</span><br />
            <span className="text-[var(--text-muted)]">TODAY.</span>
          </motion.h1>

          {/* USP line */}
          <motion.p
            className="text-[var(--text-secondary)] text-lg md:text-2xl max-w-2xl font-light leading-relaxed mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
          >
            Same-day pickup, certified technicians, and flawless execution. <strong className="text-[var(--text-primary)] font-medium">This is Flashfix.</strong>
          </motion.p>

          {/* Location CTA */}
          <motion.div
            className="flex flex-col items-center justify-center w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            {step === "prompt" && (
              <LocationGate onEnable={handleEnableLocation} error={error} />
            )}

            {step === "loading" && (
              <div className="flex items-center gap-3 bg-[var(--surface-elevated)] border border-[var(--surface-border)] px-6 py-4 rounded-2xl shadow-lg">
                <div className="w-5 h-5 border-2 border-[var(--accent-amber)] border-t-transparent rounded-full animate-spin" />
                <span className="text-[var(--text-primary)] text-sm font-medium">Triangulating nearest facility...</span>
              </div>
            )}

            {step === "results" && closest && (
              <div className="flex flex-col items-center gap-8 w-full max-w-md">
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-4 bg-[var(--surface-elevated)] border border-[var(--accent-amber)]/30 p-2 pr-6 rounded-full shadow-lg w-full"
                  >
                    <div className="w-12 h-12 bg-[var(--accent-amber)] rounded-full flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-black" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[var(--text-primary)] text-sm font-bold">{closest.name}</span>
                      <span className="text-[var(--accent-amber)] text-xs font-mono">{closest.distanceKm}km away · Operational</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <Link to="/flashfix/book" className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(239,143,11,0.2)]">
                    <Zap className="w-5 h-5" />
                    Book Repair
                  </Link>
                  <Link to="/flashfix/services" className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-primary)] font-medium px-8 py-4 rounded-xl transition-all duration-300">
                    View Services
                  </Link>
                </div>
              </div>
            )}
          </motion.div>

        </div>
      </section>

      {/* ─── STORE MAP (visible after location granted) ─── */}
      <AnimatePresence>
        {step === "results" && stores.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="py-24 border-b border-[var(--surface-border)] bg-[var(--surface-bg)]"
          >
            <div className="section-container">
              <div className="ff-reveal mb-12 flex flex-col md:flex-row md:items-end justify-between">
                <div>
                  <h2 className="font-display font-bold text-4xl md:text-5xl mb-2">
                    ACTIVE <span className="text-[#ef8f0b]">HUBS</span>
                  </h2>
                  <p className="text-[var(--text-muted)] text-sm font-mono uppercase tracking-widest">
                    {stores.filter((s) => s.tier === "flash").length} Flash · {stores.filter((s) => s.tier === "next-day").length} Standard
                  </p>
                </div>
              </div>
              
              <div className="rounded-2xl overflow-hidden border border-[var(--surface-border)]">
                <StoreMap stores={stores} />
              </div>

              {/* Store list */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {stores.map((store, i) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.5 }}
                    className="bg-[var(--surface-elevated)] p-6 rounded-xl border border-[var(--surface-border)] hover:border-[#ef8f0b]/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[#ef8f0b] transition-colors">
                        {store.name}
                      </h3>
                      <StoreBadge store={store} size="sm" />
                    </div>
                    <p className="text-[var(--text-muted)] text-sm mb-2">{store.address}</p>
                    <p className="text-[#ef8f0b] text-xs font-mono mb-4">{store.hours}</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-[var(--surface-border)]">
                      <span className="text-[var(--text-primary)] text-sm font-bold flex items-center gap-1"><span className="text-[#ef8f0b]">★</span> {store.rating}</span>
                      <span className="text-[var(--text-muted)] text-xs">({store.reviews})</span>
                      <span className="text-[var(--text-primary)] bg-[#ef8f0b]/10 text-[#ef8f0b] px-2 py-1 rounded text-xs ml-auto font-mono">{store.distanceKm}km</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── HOW IT WORKS (Premium Story) ─── */}
      <section className="py-32">
        <div className="section-container">
          <div className="ff-reveal text-center mb-20">
            <span className="text-[#ef8f0b] font-mono text-sm tracking-widest uppercase mb-4 block">The Protocol</span>
            <h2 className="font-display font-bold text-[clamp(36px,5vw,60px)] leading-[1]">
              SURGICAL <span className="text-[var(--text-primary)]/20">PRECISION.</span><br />
              <span className="text-[#ef8f0b]">ZERO DOWNTIME.</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: MapPin, title: "TRIANGULATE", desc: "Share coordinates. We pinpoint the optimal repair hub." },
              { icon: Smartphone, title: "DIAGNOSE", desc: "Select hardware. Instant transparent pricing." },
              { icon: Truck, title: "EXTRACT", desc: "Our operative secures the device from your location." },
              { icon: CheckCircle, title: "RESTORE", desc: "100% functionality returned. Delivered same day." },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="ff-reveal relative p-8 bg-[var(--surface-elevated)] rounded-2xl border border-[var(--surface-border)] hover:border-[#ef8f0b]/50 hover:bg-[var(--surface-elevated)] transition-all duration-300 group">
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-[#ef8f0b] text-black font-bold font-mono rounded-full flex items-center justify-center text-lg z-10 shadow-[0_0_20px_rgba(239,143,11,0.3)]">
                    0{i + 1}
                  </div>
                  <Icon className="w-8 h-8 text-[#ef8f0b] mb-6 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                  <h3 className="font-display font-semibold text-xl mb-3 text-[var(--text-primary)]">{item.title}</h3>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
}
