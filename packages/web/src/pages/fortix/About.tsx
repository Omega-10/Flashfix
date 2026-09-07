import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function FortixAbout() {
  return (
    <div className="pt-24 pb-20">
      <div className="section-container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-24 max-w-3xl"
        >
          <span className="platform-badge mb-4 inline-flex">◆ Our Story</span>
          <h1 className="heading-fortix text-[clamp(48px,6vw,84px)] mt-4">
            Accessories deserve{" "}
            <span className="text-amber-gradient">better curation.</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg mt-6 max-w-xl leading-relaxed">
            Fortix was born from one frustration: you spend ₹90,000 on an iPhone and then 
            settle for a ₹150 Chinese case that scratches the finish and breaks in a week.
          </p>
        </motion.div>

        <div className="py-12 border-y border-[var(--surface-border)] mb-20">
          <p className="text-[clamp(18px,2.5vw,28px)] text-[var(--text-primary)] leading-tight max-w-3xl font-light">
            "We only stock what we'd put on our own devices.{" "}
            <span className="text-[var(--accent-amber)] font-medium">
              If it doesn't fit perfectly, it doesn't ship.
            </span>"
          </p>
          <p className="text-[var(--text-muted)] text-sm mt-4 font-mono">— Fortix Team</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            { title: "Only what fits", desc: "Every accessory is verified for precise fit on the specific device model. No 'compatible with most' vagueness." },
            { title: "Certified materials", desc: "MFi certified for Apple. Tested cases. Screen guards with verified hardness ratings. No shortcuts." },
            { title: "Premium only", desc: "We curate, not collect. Apple, Samsung S-series, Pixel, OnePlus. The best devices get the best gear." },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.3 }}
              className="card p-6"
            >
              <div className="w-8 h-px bg-amber-gradient mb-4" />
              <h3 className="heading-fortix text-xl mb-3">{item.title}</h3>
              <p className="text-[var(--text-muted)] text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/fortix/products" className="btn-primary px-10 py-4">
            Explore the Collection →
          </Link>
        </div>
      </div>
    </div>
  );
}
