import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Story() {
  const container = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      const panels = gsap.utils.toArray<HTMLElement>(".story-panel");
      
      gsap.to(panels, {
        xPercent: -100 * (panels.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: ".story-container",
          pin: true,
          scrub: 1,
          snap: 1 / (panels.length - 1),
          end: () => "+=" + (container.current?.offsetWidth || 1000) * (panels.length - 1),
        }
      });
    }, container);
    
    return () => ctx.revert();
  }, []);

  return (
    <div ref={container} className="story-container w-full h-screen overflow-hidden bg-[var(--surface-bg)] relative">
      <div className="flex w-[300vw] h-full">
        
        {/* Panel 1: The Problem (Flashfix) */}
        <div className="story-panel w-screen h-full flex flex-col justify-center px-12 md:px-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh-dark opacity-30" />
          <div className="relative z-10 max-w-2xl">
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-[var(--accent-amber)] uppercase tracking-widest mb-4"
            >
              The Problem
            </motion.p>
            <h1 className="heading-flashfix text-[clamp(48px,6vw,80px)] mb-6 leading-tight">
              YOUR PHONE BREAKS.<br/>
              <span className="text-[var(--text-muted)]">LIFE STOPS.</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-lg mb-8 leading-relaxed max-w-xl font-light">
              We were tired of repair shops telling us it takes 3 days to fix a screen. 
              Or forcing you to drive across town during rush hour. 
            </p>
            <div className="w-16 h-1 bg-amber-gradient" />
          </div>
          
          <div className="absolute bottom-10 right-10 flex items-center gap-2 opacity-50 animate-pulse">
            <span className="text-xs font-mono uppercase tracking-widest">Scroll</span>
            <span>→</span>
          </div>
        </div>

        {/* Panel 2: The Solution (Flashfix) */}
        <div className="story-panel w-screen h-full flex flex-col justify-center px-12 md:px-24 relative bg-[#111]">
          <div className="relative z-10 max-w-2xl">
            <p className="font-mono text-[var(--accent-amber)] uppercase tracking-widest mb-4">
              The Solution
            </p>
            <h1 className="heading-flashfix text-[clamp(48px,6vw,80px)] mb-6 leading-tight">
              WE COME TO YOU.<br/>
              <span className="text-amber-gradient">SAME DAY.</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-lg mb-8 leading-relaxed max-w-xl font-light">
              Flashfix was built for speed. If you are within 3km of our hubs, we pick it up, 
              fix it with OEM-grade parts, and bring it back before your work day ends.
            </p>
            <Link to="/flashfix" className="btn-primary inline-flex items-center gap-2">
              Explore Flashfix ⚡
            </Link>
          </div>
        </div>

        {/* Panel 3: The Next Step (Fortix) */}
        <div className="story-panel w-screen h-full flex flex-col justify-center px-12 md:px-24 relative bg-[#151515]">
          <div className="absolute inset-0 bg-mesh-dark opacity-50" />
          <div className="relative z-10 max-w-2xl">
            <p className="font-mono text-[var(--accent-amber)] uppercase tracking-widest mb-4">
              The Next Step
            </p>
            <h1 className="heading-fortix text-[clamp(40px,5vw,70px)] mb-6 leading-tight">
              Protect it after<br/>
              <span className="text-amber-gradient">we fix it.</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-lg mb-8 leading-relaxed max-w-xl font-light">
              We noticed our customers buying cheap cases that caused their screens to break again. 
              So we built <strong className="text-[var(--text-primary)]">Fortix</strong> — a curated collection of premium accessories that actually protect your device.
            </p>
            <Link to="/fortix" className="btn-primary inline-flex items-center gap-2">
              Explore Fortix ×
            </Link>
          </div>
        </div>
        
      </div>
    </div>
  );
}
