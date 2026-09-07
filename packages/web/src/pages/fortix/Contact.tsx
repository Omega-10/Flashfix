import { useState } from "react";
import { motion } from "framer-motion";

export default function FortixContact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  return (
    <div className="pt-24 pb-20">
      <div className="section-container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="platform-badge mb-4 inline-flex">◆ Contact</span>
            <h1 className="heading-fortix text-[clamp(40px,5vw,64px)] mt-4">
              Let's <span className="text-amber-gradient">talk.</span>
            </h1>
            <p className="text-[var(--text-secondary)] mt-4 mb-8 max-w-sm leading-relaxed">
              Bulk orders, partnerships, or just a question about what fits your device — we're here.
            </p>
            <div className="space-y-4">
              {[
                { label: "Email", value: "hello@fortix.in", icon: "✉" },
                { label: "Instagram", value: "@fortix.in", icon: "◆" },
                { label: "Response time", value: "Usually within 4 hours", icon: "🕐" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-amber-soft)] border border-[rgba(245,158,11,0.2)] flex items-center justify-center text-sm">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{item.label}</p>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            {sent ? (
              <div className="card p-8 text-center">
                <div className="text-4xl mb-4">◆</div>
                <h3 className="heading-fortix text-2xl mb-2">Message received!</h3>
                <p className="text-[var(--text-muted)] text-sm">We'll be in touch within a few hours.</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="card p-8 space-y-5">
                {[
                  { key: "name" as const, label: "Name", type: "text", placeholder: "Your name" },
                  { key: "email" as const, label: "Email", type: "email", placeholder: "you@email.com" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-amber)] transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">Message</label>
                  <textarea
                    rows={4}
                    placeholder="What's on your mind?"
                    value={form.message}
                    onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-amber)] transition-colors resize-none"
                  />
                </div>
                <button type="submit" className="btn-primary w-full">Send →</button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
