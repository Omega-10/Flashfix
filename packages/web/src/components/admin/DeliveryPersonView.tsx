import { useState } from "react";
import {
  Bike,
  Phone,
  Navigation,
  MapPin,
  Clock,
  KeyRound,
  CheckCircle2,
  Building2,
  Send,
  Eye,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { BookingRecord } from "./types";
import {
  startPickupRoute,
  sendPickupOtp,
  sendCustodyOtp,
  completeDelivery,
} from "./api";

interface DeliveryPersonViewProps {
  bookings: BookingRecord[];
  selectedStore: string;
  onSelectBooking: (booking: BookingRecord) => void;
  onOpenOtpModal: (config: {
    bookingId: string;
    purpose: "PICKUP" | "CUSTODY";
    title: string;
    description: string;
    onSuccess: () => void;
  }) => void;
  onRefreshData: () => void;
}

export default function DeliveryPersonView({
  bookings,
  selectedStore,
  onSelectBooking,
  onOpenOtpModal,
  onRefreshData,
}: DeliveryPersonViewProps) {
  const [activeTaskTab, setActiveTaskTab] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string } | null>(null);

  // Filter tasks for mobile delivery operative
  const relevantBookings = bookings.filter((b) => {
    if (selectedStore !== "ALL" && b.storeId !== selectedStore) return false;
    return true;
  });

  const activeDeliveries = relevantBookings.filter(
    (b) =>
      b.status === "CONFIRMED" ||
      b.status === "PICKUP_EN_ROUTE" ||
      b.status === "PICKUP_OTP_SENT" ||
      b.status === "IN_TRANSIT" ||
      b.status === "CUSTODY_OTP_SENT" ||
      b.status === "RETURN_EN_ROUTE"
  );

  const completedDeliveries = relevantBookings.filter(
    (b) =>
      b.status === "IN_REPAIR" ||
      b.status === "REPAIR_COMPLETE" ||
      b.status === "DELIVERED"
  );

  async function handleStartPickup(bookingId: string) {
    setIsActionLoading(bookingId);
    try {
      await startPickupRoute(bookingId);
      onRefreshData();
    } finally {
      setIsActionLoading(null);
    }
  }

  async function handleSendPickupOtp(bookingId: string) {
    setIsActionLoading(bookingId);
    try {
      const res = await sendPickupOtp(bookingId);
      setActionMessage({ id: bookingId, text: res.message || "OTP code dispatched to customer!" });
      onRefreshData();
    } finally {
      setIsActionLoading(null);
    }
  }

  async function handleHandoverAtHub(bookingId: string) {
    setIsActionLoading(bookingId);
    try {
      const res = await sendCustodyOtp(bookingId);
      setActionMessage({ id: bookingId, text: res.message || "Custody handover code sent to lab tech." });
      onRefreshData();
    } finally {
      setIsActionLoading(null);
    }
  }

  async function handleCompleteDelivery(bookingId: string) {
    setIsActionLoading(bookingId);
    try {
      await completeDelivery(bookingId);
      onRefreshData();
    } finally {
      setIsActionLoading(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden pb-12 sm:pb-0">
      {/* ── Operative Mobile Header ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-1)] border border-[var(--hairline)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Bike className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm sm:text-base text-[var(--ink)] truncate block">
              My Deliveries
            </span>
            <p className="text-xs text-[var(--ink-muted)] truncate">
              Pickups and returns assigned to you
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <button
            onClick={onRefreshData}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--hairline-strong)] text-xs font-semibold text-[var(--ink)] transition-all"
            title="Refresh delivery tasks"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#ef8f0b]" />
            <span>Refresh</span>
          </button>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-muted)] block">
              Active Tasks
            </span>
            <span className="text-xl sm:text-2xl font-display font-bold text-[#ef8f0b]">
              {activeDeliveries.length}
            </span>
          </div>
        </div>
      </div>

      {/* ── Segmented Control: Active vs Completed ── */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[var(--surface-1)] border border-[var(--hairline)]">
        <button
          onClick={() => setActiveTaskTab("ACTIVE")}
          className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all ${
            activeTaskTab === "ACTIVE"
              ? "bg-[var(--surface-3)] text-[#ef8f0b] shadow border border-[var(--hairline)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <span>Active Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#ef8f0b]/20 text-[#ef8f0b]">
            {activeDeliveries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTaskTab("COMPLETED")}
          className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all ${
            activeTaskTab === "COMPLETED"
              ? "bg-[var(--surface-3)] text-[#ef8f0b] shadow border border-[var(--hairline)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <span>Completed Today</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400">
            {completedDeliveries.length}
          </span>
        </button>
      </div>

      {/* ── Active Tasks Stack ── */}
      {activeTaskTab === "ACTIVE" && (
        <div className="space-y-4">
          {activeDeliveries.length === 0 ? (
            <div className="py-16 text-center bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[var(--ink)]">No Pending Deliveries</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                You have fulfilled all assigned customer pickups and returns for this route.
              </p>
            </div>
          ) : (
            activeDeliveries.map((booking) => {
              const isLoading = isActionLoading === booking.id;
              const msg = actionMessage?.id === booking.id ? actionMessage.text : null;
              const mapsUrl = `https://maps.google.com/?q=${booking.pickupLat || 17.4483},${booking.pickupLng || 78.3742}`;

              return (
                <div
                  key={booking.id}
                  className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-4 sm:p-5 transition-all space-y-4"
                >
                  {/* Task Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--hairline)]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#ef8f0b]">
                        {booking.id}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-3)] text-[var(--ink-secondary)] border border-[var(--hairline)]">
                        {booking.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[var(--ink-muted)] font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#ef8f0b]" />
                      <span>{booking.scheduledTime}</span>
                    </div>
                  </div>

                  {/* Customer & Address Details */}
                  <div>
                    <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-[#ef8f0b]" />
                      <span>{booking.brand} {booking.deviceModel}</span>
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                      Issue: {booking.issueType}
                    </p>

                    <div className="mt-3 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] text-xs text-[var(--ink)]">
                      <div className="font-semibold text-xs text-[var(--ink)] flex items-center gap-1 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-[#ef8f0b] shrink-0" />
                        <span>Pickup Location:</span>
                      </div>
                      <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                        {booking.pickupAddress}
                      </p>
                      <div className="mt-1.5 text-[11px] text-[var(--ink-muted)]">
                        Contact: <strong className="text-[var(--ink)]">{booking.contactName}</strong> ({booking.contactPhone})
                      </div>
                    </div>
                  </div>

                  {/* 1-Tap Quick Action Buttons (Touch Target >= 44px) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={`tel:${booking.contactPhone}`}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[var(--surface-3)] hover:bg-[var(--surface-3)] border border-[var(--hairline)] hover:border-[#ef8f0b]/40 rounded-xl text-xs font-semibold text-[var(--ink)] active:scale-95 transition-all"
                    >
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span>Call Customer</span>
                    </a>

                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[var(--surface-3)] hover:bg-[var(--surface-3)] border border-[var(--hairline)] hover:border-[#ef8f0b]/40 rounded-xl text-xs font-semibold text-[var(--ink)] active:scale-95 transition-all"
                    >
                      <Navigation className="w-4 h-4 text-[#ef8f0b]" />
                      <span>Open GPS</span>
                    </a>
                  </div>

                  {/* Toast/Notification Message */}
                  {msg && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-mono">
                      {msg}
                    </div>
                  )}

                  {/* Step-by-Step Lifecycle Action Button (Touch Target >= 44px) */}
                  <div className="pt-2 border-t border-[var(--hairline)]">
                    {/* Status: CONFIRMED -> Start Route */}
                    {booking.status === "CONFIRMED" && (
                      <button
                        disabled={isLoading}
                        onClick={() => handleStartPickup(booking.id)}
                        className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-4 py-2.5 transition-all shadow-md shadow-[#ef8f0b]/20 active:scale-98 disabled:opacity-50"
                      >
                        <Bike className="w-4 h-4" />
                        <span>{isLoading ? "Starting Route..." : "🚀 Start Pickup Route"}</span>
                      </button>
                    )}

                    {/* Status: PICKUP_EN_ROUTE -> Send OTP to Customer */}
                    {booking.status === "PICKUP_EN_ROUTE" && (
                      <button
                        disabled={isLoading}
                        onClick={() => handleSendPickupOtp(booking.id)}
                        className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-4 py-2.5 transition-all shadow-md shadow-[#ef8f0b]/20 active:scale-98 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isLoading ? "Dispatching..." : "📍 Arrived at Doorstep — Send Customer OTP"}</span>
                      </button>
                    )}

                    {/* Status: PICKUP_OTP_SENT -> Enter Customer Doorstep OTP */}
                    {booking.status === "PICKUP_OTP_SENT" && (
                      <button
                        onClick={() =>
                          onOpenOtpModal({
                            bookingId: booking.id,
                            purpose: "PICKUP",
                            title: "Verify Doorstep Pickup OTP",
                            description: `Request the 6-digit OTP code sent to customer ${booking.contactName} (${booking.contactEmail}) to verify hardware possession.`,
                            onSuccess: onRefreshData,
                          })
                        }
                        className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#ef8f0b] to-[#f59e0b] text-black font-bold text-xs rounded-xl px-4 py-2.5 transition-all shadow-lg shadow-[#ef8f0b]/25 active:scale-98"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>🔑 Enter Customer Doorstep OTP</span>
                      </button>
                    )}

                    {/* Status: IN_TRANSIT -> Handover Custody at Hub */}
                    {booking.status === "IN_TRANSIT" && (
                      <button
                        disabled={isLoading}
                        onClick={() => handleHandoverAtHub(booking.id)}
                        className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl px-4 py-2.5 transition-all shadow-md shadow-blue-600/20 active:scale-98 disabled:opacity-50"
                      >
                        <Building2 className="w-4 h-4" />
                        <span>{isLoading ? "Initiating Handover..." : "🏢 Arrived at Lab — Send Custody OTP"}</span>
                      </button>
                    )}

                    {/* Status: CUSTODY_OTP_SENT -> Awaiting Technician Verification */}
                    {booking.status === "CUSTODY_OTP_SENT" && (
                      <div className="space-y-2">
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                            <span>Custody OTP dispatched to lab tech. Awaiting technician verification.</span>
                          </span>
                        </div>
                        <button
                          disabled={isLoading}
                          onClick={() => handleHandoverAtHub(booking.id)}
                          className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 bg-[var(--surface-3)] hover:bg-[var(--surface-3)] text-[var(--ink)] border border-[var(--hairline-strong)] font-semibold text-xs rounded-xl px-4 py-2.5 transition-all active:scale-98 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4 text-[#ef8f0b]" />
                          <span>{isLoading ? "Dispatching..." : "Resend Custody OTP to Tech"}</span>
                        </button>
                      </div>
                    )}

                    {/* Status: RETURN_EN_ROUTE -> Complete Final Delivery */}
                    {booking.status === "RETURN_EN_ROUTE" && (
                      <button
                        disabled={isLoading}
                        onClick={() => handleCompleteDelivery(booking.id)}
                        className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl px-4 py-2.5 transition-all shadow-md shadow-emerald-600/20 active:scale-98 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isLoading ? "Completing..." : "📦 Complete Delivery to Customer"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Completed Tasks ── */}
      {activeTaskTab === "COMPLETED" && (
        <div className="space-y-3">
          {completedDeliveries.map((b) => (
            <div
              key={b.id}
              onClick={() => onSelectBooking(b)}
              className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--hairline)] flex items-center justify-between gap-3 cursor-pointer hover:border-[#ef8f0b]/30 transition-all"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-[#ef8f0b]">{b.id}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    {b.status}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[var(--ink)]">
                  {b.brand} {b.deviceModel}
                </div>
                <div className="text-[11px] text-[var(--ink-muted)]">
                  Customer: {b.contactName} • {b.scheduledDate}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBooking(b);
                }}
                className="min-h-[44px] text-xs font-medium text-[var(--ink-muted)] hover:text-[#ef8f0b]"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
