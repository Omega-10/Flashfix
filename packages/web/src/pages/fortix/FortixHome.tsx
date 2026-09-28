import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const FORTIX_PRODUCTS = [
  {
    id: "fx-glass-pro",
    name: "Fortix Glass Pro",
    desc: "0.33mm Aluminosilicate Screen Guard",
    price: "₹999",
    tag: "Bestseller",
    img: "https://images.unsplash.com/photo-1601784551446-20c9e07cd5d9?auto=format&fit=crop&q=80&w=600&h=800",
  },
  {
    id: "fx-armor-case",
    name: "Fortix Armor Case",
    desc: "Aramid Fiber Magnetic Case",
    price: "₹1,499",
    tag: "New",
    img: "https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?auto=format&fit=crop&q=80&w=600&h=800",
  },
  {
    id: "fx-lens-shield",
    name: "Fortix Lens Shield",
    desc: "Sapphire Coating Camera Protector",
    price: "₹499",
    img: "https://images.unsplash.com/photo-1512054502232-10a0a035d672?auto=format&fit=crop&q=80&w=600&h=800",
  },
  {
    id: "fx-pod-vault",
    name: "Fortix Pod Vault",
    desc: "Impact Resistant Earbud Case",
    price: "₹799",
    img: "https://images.unsplash.com/photo-1606220588913-b3aec89710fa?auto=format&fit=crop&q=80&w=600&h=800",
  }
];

export default function FortixHome() {
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".fx-reveal").forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 1, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" }
          }
        );
      });
    }, sectionsRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionsRef} className="bg-[#0D0D0D] min-h-screen text-[var(--text-primary)] font-sans">

      {/* ─── ACT I: THE TYPOGRAPHIC HERO ─── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ef8f0b] opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />
        
        <div className="section-container relative z-10 w-full flex flex-col items-center justify-center pt-20">
          
          <div className="text-center z-20">
            <motion.div 
              className="flex items-center justify-center select-none mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              <span className="font-display font-bold text-[clamp(60px,12vw,180px)] tracking-wider text-[var(--text-primary)] uppercase drop-shadow-2xl leading-none">
                FORTI
              </span>
              <span 
                className="font-display font-bold text-[clamp(80px,14vw,200px)] text-[#ef8f0b] -ml-2 leading-none" 
              >
                ×
              </span>
            </motion.div>

            <motion.h1
              className="font-display font-semibold text-[clamp(24px,4vw,40px)] leading-tight tracking-tight text-[var(--text-primary)]/80"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              ARMOR FOR THE EVERYDAY.
            </motion.h1>
            
            <motion.p
              className="mt-6 text-[var(--text-secondary)] font-sans text-sm md:text-base max-w-lg mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
            >
              Engineered for absolute impact. Minimalist design, military-grade durability. We build the gear that protects your devices.
            </motion.p>

            <motion.div 
              className="mt-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
            >
              <a href="#products" className="inline-block bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold px-8 py-4 rounded-full transition-all duration-300 transform hover:scale-105">
                Explore Collection
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── ACT II: THE ANATOMY OF TRUST ─── */}
      <section className="py-24 relative border-t border-[var(--surface-border)]">
        <div className="section-container">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="order-2 lg:order-1 fx-reveal">
              <span className="text-[#ef8f0b] font-mono text-sm tracking-widest uppercase mb-4 block">
                Material Science
              </span>
              <h2 className="font-display font-bold text-[clamp(32px,5vw,56px)] leading-[1] mb-8">
                9H HARDNESS. <br />
                ZERO COMPROMISE.
              </h2>
              <div className="space-y-8 font-sans">
                <div className="relative pl-6 border-l border-[var(--surface-border)]">
                  <div className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-[#ef8f0b]" />
                  <h4 className="text-lg font-bold mb-1 text-[var(--text-primary)]">Oleophobic Plasma Coating</h4>
                  <p className="text-[var(--text-muted)] text-sm">Industrial-grade smudge and fingerprint resistance. Crystal clarity maintained.</p>
                </div>
                <div className="relative pl-6 border-l border-[var(--surface-border)]">
                  <div className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-[#ef8f0b]" />
                  <h4 className="text-lg font-bold mb-1 text-[var(--text-primary)]">Impact Distribution Layer</h4>
                  <p className="text-[var(--text-muted)] text-sm">Absorbs and dissipates kinetic energy upon corner or face drops.</p>
                </div>
              </div>
            </div>
            
            {/* Minimalist Graphic Representation */}
            <div className="order-1 lg:order-2 flex justify-center fx-reveal">
              <div className="relative w-full max-w-sm aspect-[4/5] border border-[var(--surface-border)] rounded-3xl bg-gradient-to-b from-white/5 to-transparent overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 flex items-center justify-center group cursor-crosshair">
                  {/* Abstract Glass Layers */}
                  <div className="w-3/4 h-3/4 border border-[#ef8f0b]/30 rounded-2xl transform rotate-6 absolute transition-all group-hover:rotate-12 group-hover:scale-105 duration-700" />
                  <div className="w-3/4 h-3/4 border border-[var(--surface-border)] rounded-2xl transform -rotate-3 absolute transition-all group-hover:-rotate-6 group-hover:scale-105 duration-700" />
                  <div className="w-3/4 h-3/4 bg-gradient-to-br from-white/10 to-transparent rounded-2xl absolute backdrop-blur-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ACT III: PRODUCT LISTING (Spigen/Cashify Inspired) ─── */}
      <section id="products" className="py-32 relative bg-[#111111]">
        <div className="section-container">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 fx-reveal">
            <div>
              <span className="text-[#ef8f0b] font-mono text-sm tracking-widest uppercase mb-4 block">
                The Collection
              </span>
              <h2 className="font-display font-bold text-4xl md:text-5xl">
                PREMIUM GEAR.
              </h2>
            </div>
            <Link to="/fortix/products" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-4 md:mt-0 font-medium">
              View All Products →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 fx-reveal">
            {FORTIX_PRODUCTS.map((product) => (
              <Link to={`/fortix/product/${product.id}`} key={product.id} className="group block bg-[#1A1A1A] rounded-2xl overflow-hidden border border-[var(--surface-border)] hover:border-[#ef8f0b]/30 transition-all duration-300">
                <div className="relative aspect-[4/5] bg-[#0D0D0D] overflow-hidden">
                  {product.tag && (
                    <span className="absolute top-4 left-4 bg-[#ef8f0b] text-black text-xs font-bold px-3 py-1 rounded-full z-10">
                      {product.tag}
                    </span>
                  )}
                  {/* Image with subtle zoom on hover */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 mix-blend-luminosity group-hover:mix-blend-normal"
                    style={{ backgroundImage: `url(${product.img})` }}
                  />
                  {/* Subtle vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent opacity-80" />
                </div>
                <div className="p-6">
                  <h3 className="font-display font-semibold text-lg text-[var(--text-primary)] mb-1 group-hover:text-[#ef8f0b] transition-colors">{product.name}</h3>
                  <p className="text-[var(--text-muted)] text-sm mb-4">{product.desc}</p>
                  <p className="font-mono text-lg text-[var(--text-primary)]">{product.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
