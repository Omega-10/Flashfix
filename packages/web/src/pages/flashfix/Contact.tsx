import { useState } from "react";
import { motion } from "framer-motion";

export default function FlashfixContact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true); // demo: no actual submission
  }

  return (
    <div className="pt-24 pb-20">
      <div className="section-container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Left: Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="platform-badge mb-4 inline-flex">Get in Touch</span>
            <h1 className="heading-flashfix text-[clamp(40px,5vw,72px)] mt-4">
              TALK TO <span className="text-amber-gradient">FLASHFIX</span>
            </h1>
            <p className="text-[var(--text-secondary)] mt-4 mb-8 max-w-sm leading-relaxed">
              Questions about a repair? Partnership? Franchise inquiry? We're fast offline too.
            </p>

            <div className="space-y-4">
              {[
                { label: "Email", value: "hello@flashfix.in", icon: "✉" },
                { label: "Phone", value: "+91 98765 43210", icon: "📞" },
                { label: "Hours", value: "9 AM – 9 PM, Mon–Sun", icon: "🕐" },
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

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            {sent ? (
              <div className="card-amber p-8 text-center">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="heading-flashfix text-2xl mb-2">MESSAGE SENT!</h3>
                <p className="text-[var(--text-muted)] text-sm">We'll get back to you within a few hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card p-8 space-y-5">
                {[
                  { key: "name" as const, label: "Name", type: "text", placeholder: "Your full name" },
                  { key: "email" as const, label: "Email", type: "email", placeholder: "you@email.com" },
                  { key: "phone" as const, label: "Phone", type: "tel", placeholder: "+91 98765 43210" },
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
                    placeholder="What can we help you with?"
                    value={form.message}
                    onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-amber)] transition-colors resize-none"
                  />
                </div>
                <button type="submit" className="btn-primary w-full">Send Message</button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
