import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Hero3D from "@/components/fortix/Hero3D";
import Magnetic from "@/components/ui/Magnetic";

gsap.registerPlugin(ScrollTrigger);

export default function FortixHome() {
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Cinematic fade-in for all fx-reveal elements
      gsap.utils.toArray<HTMLElement>(".fx-reveal").forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 1, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" }
          }
        );
      });
      
      // Parallax text
      gsap.to(".parallax-bg", {
        yPercent: 30,
        ease: "none",
        scrollTrigger: {
          trigger: ".parallax-container",
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      });
    }, sectionsRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionsRef} className="bg-[#050505] min-h-screen text-[var(--text-primary)] font-sans">

      {/* ─── ACT I: THE HOOK ─── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#f3910c] opacity-[0.04] blur-[150px] rounded-full pointer-events-none" />
        
        <div className="section-container relative z-10 w-full h-full flex flex-col items-center justify-center pt-20">
          
          <motion.div
            className="w-full h-[55vh] flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <Hero3D />
          </motion.div>

          <div className="text-center mt-[-40px] md:mt-[-80px] z-20 pointer-events-none">
            <motion.h1
              className="font-display font-bold text-[clamp(40px,8vw,120px)] leading-[0.9] tracking-tighter"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              ARMOR FOR <br />
              <span className="text-[#f3910c]">THE EVERYDAY.</span>
            </motion.h1>
            
            <motion.p
              className="mt-6 text-[var(--text-secondary)] font-mono text-sm md:text-base tracking-widest uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
            >
              0.33mm High-Aluminosilicate Glass // Engineered for Impact
            </motion.p>
          </div>
        </div>
      </section>

      {/* ─── ACT II: THE ANATOMY OF TRUST ─── */}
      <section className="py-32 md:py-48 relative border-t border-white/5 parallax-container">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" />
        
        <div className="section-container">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="order-2 lg:order-1">
              <span className="text-[#f3910c] font-mono text-sm tracking-widest uppercase mb-4 block fx-reveal">
                Material Science
              </span>
              <h2 className="font-display font-bold text-[clamp(32px,5vw,64px)] leading-[1] mb-8 fx-reveal">
                9H HARDNESS. <br />
                ZERO COMPROMISE.
              </h2>
              <div className="space-y-8 fx-reveal font-sans">
                <div className="relative pl-6 border-l border-white/10">
                  <div className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-[#f3910c]" />
                  <h4 className="text-lg font-bold mb-1">Oleophobic Plasma Coating</h4>
                  <p className="text-[var(--text-muted)] text-sm">Industrial-grade smudge and fingerprint resistance. Crystal clarity maintained.</p>
                </div>
                <div className="relative pl-6 border-l border-white/10">
                  <div className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-[#f3910c]" />
                  <h4 className="text-lg font-bold mb-1">Impact Distribution Layer</h4>
                  <p className="text-[var(--text-muted)] text-sm">Absorbs and dissipates kinetic energy upon corner or face drops.</p>
                </div>
                <div className="relative pl-6 border-l border-white/10">
                  <div className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-[#f3910c]" />
                  <h4 className="text-lg font-bold mb-1">Anti-Static Adhesive</h4>
                  <p className="text-[var(--text-muted)] text-sm">Bubble-free, flawless installation with 280/380AB tech.</p>
                </div>
              </div>
            </div>
            
            {/* Minimalist Graphic Representation */}
            <div className="order-1 lg:order-2 flex justify-center parallax-bg fx-reveal">
              <div className="relative w-full max-w-sm aspect-[4/5] border border-white/10 rounded-3xl bg-gradient-to-b from-white/5 to-transparent overflow-hidden backdrop-blur-sm">
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Abstract Glass Layers */}
                  <div className="w-3/4 h-3/4 border border-[#f3910c]/30 rounded-2xl transform rotate-6 absolute transition-all hover:rotate-12 hover:scale-105 duration-700" />
                  <div className="w-3/4 h-3/4 border border-white/20 rounded-2xl transform -rotate-3 absolute transition-all hover:-rotate-6 hover:scale-105 duration-700" />
                  <div className="w-3/4 h-3/4 bg-gradient-to-br from-white/10 to-transparent rounded-2xl absolute backdrop-blur-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ACT III: THE VELOCITY (Flashfix Integration) ─── */}
      <section className="py-32 relative bg-[#0D0D0D] overflow-hidden">
        <div className="absolute inset-0 bg-mesh-dark opacity-50" />
        <div className="section-container relative z-10 text-center">
          <span className="text-[#f3910c] font-mono text-sm tracking-widest uppercase mb-4 block fx-reveal">
            White-Glove Service
          </span>
          <h2 className="font-display font-bold text-[clamp(40px,7vw,90px)] leading-[0.9] mb-8 fx-reveal">
            BROKEN TO <span className="text-white/20">BRILLIANT.</span><br />
            IN 60 MINUTES.
          </h2>
          <p className="text-[var(--text-secondary)] font-sans max-w-xl mx-auto mb-12 fx-reveal">
            Don't trust premium devices to mall kiosks. Get Fortix armor installed at your door with Flashfix precision routing.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 fx-reveal pointer-events-auto">
            <Magnetic strength={0.4}>
              <Link to="/fortix/products" className="btn-primary w-full sm:w-auto text-lg px-8 py-4 z-20 relative">
                Shop Premium Gear
              </Link>
            </Magnetic>
            <Magnetic strength={0.4}>
              <Link to="/flashfix/book" className="btn-ghost w-full sm:w-auto text-lg px-8 py-4 z-20 relative">
                Book Flashfix Install
              </Link>
            </Magnetic>
          </div>
        </div>
      </section>

    </div>
  );
}
