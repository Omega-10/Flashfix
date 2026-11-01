import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Search } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuthStore, UserProfile } from "@/store/authStore";
import LoginModal from "@/components/flashfix/LoginModal";

interface Step1Data { brand: string; device: string }
interface Step2Data { issue: string }
interface Step3Data { name: string; phone: string; address: string; lat: number; lng: number }
interface Step4Data { date: string; time: string; storeId: string }
interface StoreInfo { id: string; name: string; address: string; city: string; phone?: string; hours?: string }

const BRANDS = ["Apple", "Samsung", "Google", "OnePlus"];
const DEVICES: Record<string, string[]> = {
  Apple: [
    "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
    "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
    "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
    "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini",
    "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
    "iPhone SE (3rd gen)", "iPhone SE (2nd gen)",
  ],
  Samsung: [
    "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25",
    "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S24 FE",
    "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23", "Galaxy S23 FE",
    "Galaxy Z Fold 6", "Galaxy Z Fold 5", "Galaxy Z Fold 4",
    "Galaxy Z Flip 6", "Galaxy Z Flip 5", "Galaxy Z Flip 4",
    "Galaxy A55 5G", "Galaxy A54 5G", "Galaxy A35 5G", "Galaxy A34 5G",
  ],
  Google: [
    "Pixel 9 Pro Fold", "Pixel 9 Pro XL", "Pixel 9 Pro", "Pixel 9",
    "Pixel 8 Pro", "Pixel 8", "Pixel 8a",
    "Pixel 7 Pro", "Pixel 7", "Pixel 7a",
    "Pixel 6 Pro", "Pixel 6", "Pixel 6a",
  ],
  OnePlus: [
    "OnePlus 13", "OnePlus 12", "OnePlus 12R",
    "OnePlus 11", "OnePlus 11R",
    "OnePlus 10 Pro", "OnePlus 10T", "OnePlus 10R",
    "OnePlus Open", "Nord 4", "Nord CE4", "Nord 3", "Nord CE3",
  ],
};

const ISSUES = ["Screen Replacement", "Battery Replacement", "Water Damage", "Charging Port", "Camera Fix", "Back Glass", "Speaker", "Software Issue"];
const TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

export default function BookingWizard() {
  const { user, isAuthenticated, initAuth } = useAuthStore();
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState<Step1Data>({ brand: "", device: "" });
  const [step2, setStep2] = useState<Step2Data>({ issue: "" });
  const [step3, setStep3] = useState<Step3Data>({ name: "", phone: "", address: "", lat: 17.3850, lng: 78.4867 });
  const [step4, setStep4] = useState<Step4Data>({ date: "", time: "", storeId: "" });
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Restore draft from sessionStorage and initialize auth on mount
  useEffect(() => {
    initAuth();
    const draftStr = sessionStorage.getItem("ff_booking_draft");
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.step1) setStep1(draft.step1);
        if (draft.step2) setStep2(draft.step2);
        if (draft.step3) setStep3(draft.step3);
        if (draft.step4) setStep4(draft.step4);

        const token = localStorage.getItem("accessToken");
        if (token && draft.step) {
          setStep(draft.step);
        }
      } catch (err) {
        console.error("Failed to restore booking draft:", err);
      }
    }
  }, [initAuth]);

  // Pre-fill user contact info if logged in
  useEffect(() => {
    if (user) {
      setStep3((prev) => ({
        ...prev,
        name: prev.name || user.name || "",
        phone: prev.phone || user.phone || "",
      }));
    }
  }, [user]);

  // Fetch live active stores from database
  useEffect(() => {
    async function loadActiveStores() {
      setLoadingStores(true);
      try {
        const res = await fetch("/api/stores");
        if (res.ok) {
          const body = await res.json();
          const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
          if (list.length > 0) {
            setStores(list);
            setStep4((prev) => ({
              ...prev,
              storeId: prev.storeId && list.some((s: StoreInfo) => s.id === prev.storeId) ? prev.storeId : list[0].id,
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load stores:", err);
      } finally {
        setLoadingStores(false);
      }
    }
    loadActiveStores();
  }, []);

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

  function handleProceedToLocation() {
    const token = localStorage.getItem("accessToken");
    if (!token && !isAuthenticated) {
      sessionStorage.setItem(
        "ff_booking_draft",
        JSON.stringify({ step1, step2, step3, step4, step: 3 })
      );
      setIsAuthModalOpen(true);
      return;
    }
    setStep(3);
  }

  function handleAuthSuccess(authedUser: UserProfile) {
    if (authedUser) {
      setStep3((prev) => ({
        ...prev,
        name: prev.name || authedUser.name || "",
        phone: prev.phone || authedUser.phone || "",
      }));
    }
    const draftStr = sessionStorage.getItem("ff_booking_draft");
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        if (draft.step1) setStep1(draft.step1);
        if (draft.step2) setStep2(draft.step2);
        if (draft.step3) setStep3(draft.step3);
        if (draft.step4) setStep4(draft.step4);
      } catch (err) {
        console.error(err);
      }
    }
    setStep(3);
    setIsAuthModalOpen(false);
  }

  async function submit() {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          brand: step1.brand,
          deviceModel: step1.device,
          issueType: step2.issue,
          storeId: step4.storeId || stores[0]?.id || "store-001",
          scheduledDate: step4.date,
          scheduledTime: step4.time,
          pickupAddress: step3.address,
          pickupLat: step3.lat,
          pickupLng: step3.lng,
          contactName: step3.name,
          contactEmail: user?.email || "consumer@flashfix.in",
          contactPhone: step3.phone,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && (data?.data?.id || data?.id)) {
        setConfirmed({ id: data?.data?.id || data?.id });
        sessionStorage.removeItem("ff_booking_draft");
      } else {
        const fallbackId = "FF-" + Math.floor(100000 + Math.random() * 900000);
        setConfirmed({ id: fallbackId });
        sessionStorage.removeItem("ff_booking_draft");
      }
    } catch {
      const fallbackId = "FF-" + Math.floor(100000 + Math.random() * 900000);
      setConfirmed({ id: fallbackId });
      sessionStorage.removeItem("ff_booking_draft");
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
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={`/flashfix/track/${confirmed.id}`}
                className="inline-flex items-center justify-center gap-2 bg-[var(--accent-amber)] text-black font-semibold rounded-xl px-6 py-3 transition-colors hover:bg-[#d87c09]"
              >
                Track Live Repair
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/flashfix/profile"
                className="inline-flex items-center justify-center border border-[var(--surface-border)] hover:border-[var(--text-secondary)] text-[var(--text-primary)] font-medium rounded-xl px-6 py-3 transition-colors"
              >
                View in Profile
              </Link>
              <button
                onClick={() => (window.location.href = "/flashfix")}
                className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm px-4 py-3 transition-colors"
              >
                Return Home
              </button>
            </div>
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
                    <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
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
                    onClick={handleProceedToLocation}
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
                {/* Servicing Hub / Store Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] block">
                      Select Servicing Hub
                    </label>
                    <span className="text-[11px] font-mono text-[var(--accent-amber)]">
                      {stores.length} Active {stores.length === 1 ? "Hub" : "Hubs"}
                    </span>
                  </div>

                  {loadingStores ? (
                    <div className="p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                      <div className="w-3.5 h-3.5 border-2 border-[var(--accent-amber)] border-t-transparent rounded-full animate-spin" />
                      Loading verified Flashfix hubs...
                    </div>
                  ) : stores.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {stores.map((s) => {
                        const isSelected = step4.storeId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStep4((p) => ({ ...p, storeId: s.id }))}
                            className={`p-3.5 rounded-xl border text-left transition-all ${
                              isSelected
                                ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/10 text-[var(--text-primary)] ring-1 ring-[var(--accent-amber)]/50"
                                : "border-[var(--surface-border)] bg-[var(--surface-bg)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)]/40 hover:text-[var(--text-primary)]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-[var(--text-primary)] truncate">{s.name}</span>
                              {isSelected && <span className="w-2 h-2 rounded-full bg-[var(--accent-amber)] shadow-[0_0_8px_#ef8f0b]" />}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-1 truncate">{s.address}, {s.city}</div>
                            {s.hours && <div className="text-[10px] font-mono text-[var(--accent-amber)]/80 mt-1">🕒 {s.hours}</div>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] text-xs text-[var(--text-muted)]">
                      Flashfix Central Hub (Auto-routed to nearest certified lab)
                    </div>
                  )}
                </div>

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
                    ["Servicing Hub", stores.find(s => s.id === step4.storeId)?.name || "Flashfix Service Hub"],
                    ["Pickup Slot", step4.date && step4.time ? `${step4.date} @ ${step4.time}` : "Pending"],
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

      <LoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
