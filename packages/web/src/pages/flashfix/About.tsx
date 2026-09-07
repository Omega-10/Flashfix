import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";

gsap.registerPlugin(ScrollTrigger);

export default function FlashfixAbout() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".about-reveal").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.75, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" } });
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className="pt-24 pb-20">
      <div className="section-container">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-24 max-w-3xl"
        >
          <span className="platform-badge mb-4 inline-flex">Our Story</span>
          <h1 className="heading-flashfix text-[clamp(48px,7vw,96px)] mt-4 leading-[0.9]">
            WHY<br /><span className="text-amber-gradient">FLASH?</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg mt-6 max-w-xl leading-relaxed">
            Because nobody should spend a day without their phone waiting for a repair that takes 45 minutes.
          </p>
        </motion.div>

        {/* Mission statement */}
        <div className="about-reveal mb-20 py-12 border-y border-[var(--surface-border)]">
          <p className="text-[clamp(20px,3vw,32px)] text-[var(--text-primary)] leading-tight max-w-3xl font-light">
            "We built Flashfix because repair shops are stuck in 2010.
            You drop your phone off, wait 3 days, and pay more than expected.{" "}
            <span className="text-[var(--accent-amber)] font-medium">We come to you. We fix it. Same day.</span>"
          </p>
          <p className="text-[var(--text-muted)] text-sm mt-4 font-mono">— JP, Founder</p>
        </div>

        {/* Stats */}
        <div className="about-reveal grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {[
            { value: "3km", label: "Flash zone radius" },
            { value: "60 min", label: "Average repair time" },
            { value: "5", label: "Branches & growing" },
            { value: "4.8★", label: "Average rating" },
          ].map((stat) => (
            <div key={stat.label} className="card p-6 text-center">
              <p className="heading-flashfix text-4xl text-amber-gradient mb-1">{stat.value}</p>
              <p className="text-[var(--text-muted)] text-xs font-mono">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* How we're different */}
        <div className="about-reveal mb-20">
          <h2 className="heading-flashfix text-4xl mb-8">HOW WE'RE <span className="text-amber-gradient">DIFFERENT</span></h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { q: "Traditional repair shops", a: "You drop it off. Wait 3 days. Hope for the best.", bad: true },
              { q: "Flashfix", a: "We pick up from your door, fix it, deliver it back. Same day within 3km.", bad: false },
            ].map((item) => (
              <div key={item.q} className={`card p-6 ${!item.bad ? "card-amber" : ""}`}>
                <p className={`text-xs font-mono uppercase tracking-widest mb-2 ${item.bad ? "text-[var(--text-muted)]" : "text-[var(--accent-amber)]"}`}>
                  {item.q}
                </p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
