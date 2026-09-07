import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Removed placeholder PhoneModel as requested

const FEATURED_CATEGORIES = [
  { label: "Cases", count: 24, icon: "📱" },
  { label: "Screen Guards", count: 18, icon: "🛡" },
  { label: "Chargers", count: 8, icon: "⚡" },
  { label: "Watch Bands", count: 12, icon: "⌚" },
  { label: "Earbud Cases", count: 9, icon: "🎧" },
  { label: "Cables", count: 6, icon: "🔌" },
];

const BRANDS = ["Apple", "Samsung", "Google Pixel", "OnePlus"];

export default function FortixHome() {
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".fx-reveal").forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 44 },
          { opacity: 1, y: 0, duration: 0.75, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none reverse" }
          }
        );
      });
    }, sectionsRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionsRef} className="pt-16">

      {/* ─── HERO: 3D product + headline ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-mesh-dark opacity-70" />

        <div className="section-container relative z-10 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: Text */}
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <span className="platform-badge">◆ Premium Accessories</span>
              </motion.div>

              <motion.h1
                className="heading-fortix text-[clamp(48px,6vw,80px)] mt-6 mb-4"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                Gear up your<br />
                <span className="text-amber-gradient">premium device.</span>
              </motion.h1>

              <motion.p
                className="text-[var(--text-secondary)] text-base mb-8 max-w-md leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35 }}
              >
                Curated accessories for Apple, Samsung S-series, Pixel, and OnePlus.
                Premium materials. Precision fit. Nothing generic.
              </motion.p>

              {/* Brand pills */}
              <motion.div
                className="flex flex-wrap gap-2 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {BRANDS.map((brand) => (
                  <span key={brand} className="badge-out-of-range text-xs">{brand}</span>
                ))}
              </motion.div>

              <motion.div
                className="flex gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Link to="/fortix/products" className="btn-primary">
                  Shop Collection
                </Link>
                <Link to="/fortix/about" className="btn-ghost">
                  Our Story
                </Link>
              </motion.div>
            </div>

            {/* Right: Typographic Hero Graphic */}
            <motion.div
              className="h-[400px] lg:h-[600px] flex items-center justify-center relative"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute inset-0 bg-amber-500 opacity-5 blur-[120px] rounded-full" />
              <motion.div 
                className="relative z-10 flex items-center select-none"
                animate={{ y: [-10, 10, -10] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="heading-fortix text-[clamp(80px,12vw,140px)] tracking-wider text-[var(--text-primary)] uppercase drop-shadow-2xl">
                  FORTI
                </span>
                <span 
                  className="heading-fortix text-[clamp(100px,14vw,160px)] text-[var(--accent-amber)] -ml-2 leading-none" 
                  style={{ textShadow: "0 0 40px rgba(245,158,11,0.5)" }}
                >
                  ×
                </span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── CATEGORIES ─── */}
      <section className="py-24 border-t border-[var(--surface-border)]">
        <div className="section-container">
          <div className="fx-reveal flex items-end justify-between mb-10">
            <div>
              <span className="platform-badge mb-3 inline-flex">Collections</span>
              <h2 className="heading-fortix text-4xl mt-2">
                Shop by <span className="text-amber-gradient">category</span>
              </h2>
            </div>
            <Link to="/fortix/products" className="btn-ghost text-sm">
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURED_CATEGORIES.map((cat) => (
              <motion.div
                key={cat.label}
                className="fx-reveal card p-5 text-center cursor-pointer group"
                whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(245,158,11,0.15)" }}
                transition={{ duration: 0.25 }}
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">
                  {cat.icon}
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-amber)] transition-colors">
                  {cat.label}
                </p>
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">{cat.count} items</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURED PRODUCTS ─── */}
      <section className="py-24">
        <div className="section-container">
          <div className="fx-reveal flex items-end justify-between mb-10">
            <div>
              <span className="platform-badge mb-3 inline-flex">Trending</span>
              <h2 className="heading-fortix text-4xl mt-2">
                Featured <span className="text-amber-gradient">gear</span>
              </h2>
            </div>
            <Link to="/fortix/products" className="btn-ghost text-sm hidden sm:inline-flex">
              Explore Collection →
            </Link>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { id: "1", name: "MagSafe Silicone Case", brand: "Apple", price: 1999, originalPrice: 2499, color: "#EA580C" },
              { id: "2", name: "Armor Grip S24 Ultra", brand: "Samsung", price: 1499, color: "#1E293B" },
              { id: "3", name: "Edge-to-Edge Glass", brand: "Universal", price: 899, originalPrice: 1299, badge: "Bestseller", color: "#64748B" },
              { id: "4", name: "65W GaN Fast Charger", brand: "Universal", price: 2999, badge: "New", color: "#F59E0B" }
            ].map((p, i) => (
              <motion.div
                key={p.id}
                className="fx-reveal card group cursor-pointer overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6, boxShadow: "0 12px 40px rgba(245,158,11,0.12)" }}
                onClick={() => window.open("/fortix/products", "_self")}
              >
                <div className="aspect-square flex items-center justify-center relative overflow-hidden" style={{ background: `${p.color}18` }}>
                  <div className="w-20 h-20 rounded-2xl transition-transform duration-500 group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${p.color}40, ${p.color}80)`, boxShadow: `0 8px 30px ${p.color}30` }} />
                  {p.badge && (
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--surface-border)]">
                        {p.badge}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1">{p.brand}</div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)] leading-tight mb-2 line-clamp-1">{p.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-[var(--text-primary)] font-mono">₹{p.price.toLocaleString("en-IN")}</span>
                    {p.originalPrice && <span className="text-[var(--text-muted)] text-xs line-through font-mono">₹{p.originalPrice.toLocaleString("en-IN")}</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-8 text-center sm:hidden">
            <Link to="/fortix/products" className="btn-ghost text-sm">Explore Collection →</Link>
          </div>
        </div>
      </section>

      {/* ─── USP FEATURE STRIP ─── */}
      <section className="py-20 bg-[var(--surface-elevated)] border-y border-[var(--surface-border)]">
        <div className="section-container">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "◆",
                title: "Only premium brands",
                desc: "Apple, Samsung S-series, Pixel, OnePlus. We don't stock generic.",
              },
              {
                icon: "⚡",
                title: "Precision fit, always",
                desc: "Every accessory is device-specific. Buttons line up. Ports breathe.",
              },
              {
                icon: "✦",
                title: "Certified & tested",
                desc: "MFi certified for Apple. Drop-tested. No corners cut.",
              },
            ].map((item) => (
              <div key={item.title} className="fx-reveal">
                <div className="text-[var(--accent-amber)] text-2xl mb-4 font-mono">{item.icon}</div>
                <h3 className="heading-fortix text-xl mb-2">{item.title}</h3>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-28 text-center">
        <div className="section-container">
          <div className="fx-reveal">
            <h2 className="heading-fortix text-[clamp(36px,5vw,64px)] mb-4">
              Your device deserves{" "}
              <span className="text-amber-gradient">what it wears.</span>
            </h2>
            <p className="text-[var(--text-muted)] mb-10 max-w-md mx-auto">
              Browse the full collection — cases, guards, cables, and more.
            </p>
            <Link to="/fortix/products" className="btn-primary text-base px-10 py-4">
              Shop Now →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
