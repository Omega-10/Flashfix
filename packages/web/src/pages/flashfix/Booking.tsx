import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Step1Data { device: string; issue: string }
interface Step2Data { name: string; phone: string; address: string }
interface Step3Data { date: string; time: string; storeId: string }

const DEVICES = ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 series", "Samsung Galaxy S25", "Samsung Galaxy S24", "Pixel 9 Pro", "Other"];
const ISSUES = ["Screen Replacement", "Battery Replacement", "Water Damage", "Charging Port", "Camera Fix", "Back Glass", "Speaker", "Software Issue"];
const TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

export default function BookingWizard() {
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>({ device: "", issue: "" });
  const [step2, setStep2] = useState<Step2Data>({ name: "", phone: "", address: "" });
  const [step3, setStep3] = useState<Step3Data>({ date: "", time: "", storeId: "store-001" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: step3.storeId,
          service: step1.issue,
          name: step2.name,
          phone: step2.phone,
          date: step3.date,
          time: step3.time,
        }),
      });
      const data = (await res.json()) as { booking: { id: string } };
      setConfirmed({ id: data.booking.id });
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="pt-32 pb-20">
        <div className="section-container max-w-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="card-amber p-10 text-center"
          >
            <motion.div
              className="w-16 h-16 bg-amber-gradient rounded-full flex items-center justify-center mx-auto mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#0D0D0D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <h2 className="heading-flashfix text-4xl mb-2">BOOKED!</h2>
            <p className="text-[var(--text-muted)] text-sm mb-4">Your repair has been scheduled.</p>
            <div className="bg-[var(--surface-elevated)] rounded-xl p-4 mb-6">
              <p className="font-mono text-xs text-[var(--text-muted)] mb-1">Booking ID</p>
              <p className="font-mono text-[var(--accent-amber)] font-bold">{confirmed.id}</p>
            </div>
            <p className="text-[var(--text-muted)] text-xs">
              Our technician will contact you shortly. Keep this ID for reference.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20">
      <div className="section-container max-w-2xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <span className="platform-badge mb-4 inline-flex">Book Repair</span>
          <h1 className="heading-flashfix text-[clamp(40px,5vw,60px)] mt-3">
            LET'S <span className="text-amber-gradient">FIX</span> IT.
          </h1>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step > s
                    ? "bg-amber-gradient text-[#0D0D0D]"
                    : step === s
                    ? "bg-[var(--surface-elevated)] border border-[var(--accent-amber)] text-[var(--accent-amber)]"
                    : "bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[var(--text-muted)]"
                }`}
              >
                {step > s ? (
                  <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : s}
              </div>
              {s < 3 && (
                <div
                  className="h-px w-12 transition-all duration-500"
                  style={{ background: step > s ? "var(--accent-amber)" : "var(--surface-border)" }}
                />
              )}
            </div>
          ))}
          <span className="font-mono text-[10px] text-[var(--text-muted)] ml-2 uppercase tracking-widest">
            Step {step} of 3
          </span>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="card p-8 space-y-6">
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-3">
                    Your Device
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {DEVICES.map((d) => (
                      <button
                        key={d}
                        onClick={() => setStep1((p) => ({ ...p, device: d }))}
                        className={`text-sm text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                          step1.device === d
                            ? "border-[var(--accent-amber)] bg-[rgba(245,158,11,0.08)] text-[var(--accent-amber)]"
                            : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[rgba(245,158,11,0.3)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-3">
                    What's broken?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ISSUES.map((issue) => (
                      <button
                        key={issue}
                        onClick={() => setStep1((p) => ({ ...p, issue }))}
                        className={`text-sm text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                          step1.issue === issue
                            ? "border-[var(--accent-amber)] bg-[rgba(245,158,11,0.08)] text-[var(--accent-amber)]"
                            : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[rgba(245,158,11,0.3)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {issue}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!step1.device || !step1.issue}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Your Details →
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="card p-8 space-y-5">
                {[
                  { key: "name" as const, label: "Full Name", type: "text", placeholder: "John Doe" },
                  { key: "phone" as const, label: "Phone Number", type: "tel", placeholder: "+91 98765 43210" },
                  { key: "address" as const, label: "Pickup Address", type: "text", placeholder: "Your full address" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={step2[field.key]}
                      onChange={(e) => setStep2((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-amber)] transition-colors"
                    />
                  </div>
                ))}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(1)} className="btn-ghost flex-1">← Back</button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!step2.name || !step2.phone || !step2.address}
                    className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next: Schedule →
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="card p-8 space-y-6">
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">Date</label>
                  <input
                    type="date"
                    value={step3.date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setStep3((p) => ({ ...p, date: e.target.value }))}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-amber)] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-3">Time Slot</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setStep3((p) => ({ ...p, time: t }))}
                        className={`text-xs py-2.5 rounded-xl border transition-all ${
                          step3.time === t
                            ? "border-[var(--accent-amber)] bg-[rgba(245,158,11,0.08)] text-[var(--accent-amber)]"
                            : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[rgba(245,158,11,0.3)]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[var(--surface-elevated)] rounded-xl p-4 space-y-2">
                  <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-3">Summary</p>
                  {[
                    ["Device", step1.device],
                    ["Issue", step1.issue],
                    ["Name", step2.name],
                    ["Phone", step2.phone],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-xs text-[var(--text-muted)]">{k}</span>
                      <span className="text-xs text-[var(--text-primary)] font-medium">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-ghost flex-1">← Back</button>
                  <button
                    onClick={submit}
                    disabled={!step3.date || !step3.time || submitting}
                    className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-[#0D0D0D] border-t-transparent rounded-full animate-spin" />
                        Booking…
                      </span>
                    ) : "Confirm Booking ⚡"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
