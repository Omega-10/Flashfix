import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Search } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Step1Data { brand: string; device: string }
interface Step2Data { issue: string }
interface Step3Data { name: string; phone: string; address: string; lat: number; lng: number }
interface Step4Data { date: string; time: string; storeId: string }

const BRANDS = ["Apple", "Samsung", "Google", "OnePlus"];
const DEVICES: Record<string, string[]> = {
  Apple: ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 15 Pro", "iPhone 14 series", "iPhone 13 series"],
  Samsung: ["Galaxy S25 Ultra", "Galaxy S24 Ultra", "Galaxy S23 Ultra", "Galaxy Z Fold 6", "Galaxy Z Flip 6"],
  Google: ["Pixel 9 Pro XL", "Pixel 9 Pro", "Pixel 8 Pro", "Pixel 7a"],
  OnePlus: ["OnePlus 13", "OnePlus 12", "OnePlus Open", "Nord 4"],
};

const ISSUES = ["Screen Replacement", "Battery Replacement", "Water Damage", "Charging Port", "Camera Fix", "Back Glass", "Speaker", "Software Issue"];
const TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

export default function BookingWizard() {
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>({ brand: "", device: "" });
  const [step2, setStep2] = useState<Step2Data>({ issue: "" });
  const [step3, setStep3] = useState<Step3Data>({ name: "", phone: "", address: "", lat: 17.3850, lng: 78.4867 });
  const [step4, setStep4] = useState<Step4Data>({ date: "", time: "", storeId: "store-001" });
  
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Initialize Map when Step 3 mounts
  useEffect(() => {
    if (step === 3 && mapRef.current && !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        center: [step3.lat, step3.lng],
        zoom: 13,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(leafletMap.current);

      const customIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px; height:16px; background:#ef8f0b; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      markerRef.current = L.marker([step3.lat, step3.lng], { icon: customIcon, draggable: true })
        .addTo(leafletMap.current)
        .on("dragend", (e) => {
          const marker = e.target;
          const position = marker.getLatLng();
          setStep3(p => ({ ...p, lat: position.lat, lng: position.lng }));
        });

      leafletMap.current.on("click", (e: any) => {
        markerRef.current?.setLatLng(e.latlng);
        setStep3(p => ({ ...p, lat: e.latlng.lat, lng: e.latlng.lng }));
      });
    }

    return () => {
      if (step !== 3 && leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [step]);

  async function handleSearch() {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);
        leafletMap.current?.setView([newLat, newLng], 15);
        markerRef.current?.setLatLng([newLat, newLng]);
        setStep3(p => ({ ...p, lat: newLat, lng: newLng, address: display_name }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      // Mock API delay
      await new Promise(r => setTimeout(r, 1500));
      setConfirmed({ id: "BKG-" + Math.floor(Math.random() * 1000000) });
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="pt-32 pb-20 min-h-screen bg-[var(--surface-bg)] text-[var(--text-primary)]">
        <div className="section-container max-w-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[var(--surface-elevated)] rounded-2xl border border-[var(--surface-border)] p-10 text-center shadow-lg"
          >
            <motion.div
              className="w-16 h-16 bg-[var(--accent-amber)]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[var(--accent-amber)]/30"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            >
              <CheckCircle className="w-8 h-8 text-[var(--accent-amber)]" />
            </motion.div>
            <h2 className="font-display font-bold text-3xl mb-2">Request Confirmed</h2>
            <p className="text-[var(--text-secondary)] mb-6 text-sm">
              Your service request is securely logged in our protocol. ID: <strong className="text-[var(--text-primary)] font-mono">{confirmed.id}</strong>
            </p>
            <div className="bg-[var(--surface-bg)] rounded-xl p-4 text-left border border-[var(--surface-border)] mb-8">
              <p className="text-sm text-[var(--text-primary)] font-medium mb-1">Operative Dispatch</p>
              <p className="text-xs text-[var(--text-muted)]">Our technician will arrive at {step3.address} on {step4.date} at {step4.time}.</p>
            </div>
            <button onClick={() => window.location.href = "/"} className="inline-flex items-center justify-center bg-[var(--accent-amber)] text-black font-semibold rounded-xl px-8 py-3 transition-colors hover:bg-[#d87c09]">
              Return Home
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 min-h-screen bg-[var(--surface-bg)] text-[var(--text-primary)]">
      <div className="section-container max-w-2xl">
        <div className="mb-12 flex justify-between items-center px-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div className={`w-3 h-3 rounded-full mb-2 transition-colors ${step >= i ? "bg-[var(--accent-amber)]" : "bg-[var(--surface-border)]"}`} />
              <span className={`text-[10px] font-mono tracking-widest uppercase ${step >= i ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)]"}`}>
                Step {i}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="bg-[var(--surface-elevated)] p-8 rounded-2xl border border-[var(--surface-border)] shadow-sm"
            >
              <div className="space-y-8">
                {/* Brand Selection */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-4">
                    1. Select Manufacturer
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {BRANDS.map((b) => (
                      <button
                        key={b}
                        onClick={() => setStep1({ brand: b, device: "" })}
                        className={`text-sm px-5 py-2.5 rounded-full border transition-all duration-200 ${
                          step1.brand === b
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] font-medium"
                            : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)]/30 hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Device Selection */}
                {step1.brand && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-4">
                      2. Select Device Model
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {DEVICES[step1.brand].map((d) => (
                        <button
                          key={d}
                          onClick={() => setStep1(p => ({ ...p, device: d }))}
                          className={`text-sm text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                            step1.device === d
                              ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] font-medium"
                              : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)]/30 hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={!step1.device}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--surface-bg)] font-semibold rounded-xl px-6 py-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
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
              className="bg-[var(--surface-elevated)] p-8 rounded-2xl border border-[var(--surface-border)] shadow-sm"
            >
              <div className="space-y-8">
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-4">
                    What needs to be fixed?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {ISSUES.map((issue) => (
                      <button
                        key={issue}
                        onClick={() => setStep2({ issue })}
                        className={`text-sm text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                          step2.issue === issue
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] font-medium"
                            : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)]/30 hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {issue}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex items-center justify-center px-6 py-4 rounded-xl border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!step2.issue}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--surface-bg)] font-semibold rounded-xl px-6 py-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Set Location
                    <ArrowRight className="w-4 h-4" />
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
              className="bg-[var(--surface-elevated)] p-8 rounded-2xl border border-[var(--surface-border)] shadow-sm"
            >
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">Location Pinpoint</label>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Search area (e.g. Miyapur, Hyderabad)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="flex-1 bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-amber)] transition-colors"
                    />
                    <button onClick={handleSearch} disabled={isSearching} className="bg-[var(--surface-bg)] border border-[var(--surface-border)] px-4 rounded-xl hover:border-[var(--accent-amber)] transition-colors flex items-center justify-center">
                      <Search className="w-4 h-4 text-[var(--text-primary)]" />
                    </button>
                  </div>
                  <div ref={mapRef} className="w-full h-[250px] rounded-xl overflow-hidden border border-[var(--surface-border)] relative z-0" />
                  <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">Drag the pin or click on the map to set exact coordinates.</p>
                </div>

                <div className="space-y-4 pt-4 border-t border-[var(--surface-border)]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">Full Name</label>
                      <input
                        type="text"
                        value={step3.name}
                        onChange={(e) => setStep3(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-amber)] transition-colors"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">Phone</label>
                      <input
                        type="tel"
                        value={step3.phone}
                        onChange={(e) => setStep3(p => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-amber)] transition-colors"
                        placeholder="+91..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">Full Address</label>
                    <textarea
                      value={step3.address}
                      onChange={(e) => setStep3(p => ({ ...p, address: e.target.value }))}
                      className="w-full bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-amber)] transition-colors resize-none h-20"
                      placeholder="Flat No, Building, Street..."
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex items-center justify-center px-6 py-4 rounded-xl border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!step3.name || !step3.phone || !step3.address}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--surface-bg)] font-semibold rounded-xl px-6 py-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Schedule Pickup
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="bg-[var(--surface-elevated)] p-8 rounded-2xl border border-[var(--surface-border)] shadow-sm"
            >
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-2">Date</label>
                  <input
                    type="date"
                    value={step4.date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setStep4((p) => ({ ...p, date: e.target.value }))}
                    className="w-full bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent-amber)] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block mb-3">Time Slot</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setStep4((p) => ({ ...p, time: t }))}
                        className={`text-xs py-2.5 rounded-xl border transition-all ${
                          step4.time === t
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] font-medium"
                            : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)]/30"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[var(--surface-bg)] rounded-xl p-5 space-y-2 border border-[var(--surface-border)]">
                  <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-4">Protocol Summary</p>
                  {[
                    ["Device", step1.device],
                    ["Issue", step2.issue],
                    ["Address", step3.address],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 mb-2">
                      <span className="text-xs text-[var(--text-muted)] shrink-0">{k}</span>
                      <span className="text-xs text-[var(--text-primary)] font-medium text-right truncate">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex items-center justify-center px-6 py-4 rounded-xl border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={submit}
                    disabled={!step4.date || !step4.time || submitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black font-semibold rounded-xl px-6 py-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Initiating...
                      </span>
                    ) : (
                      <>
                        Confirm Protocol
                        <CheckCircle className="w-4 h-4" />
                      </>
                    )}
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
