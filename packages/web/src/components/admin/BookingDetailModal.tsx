import { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  MapPin,
  Phone,
  Mail,
  History,
  Shield,
} from "lucide-react";
import { BookingRecord, AuditTrailItem } from "./types";
import { getBookingTrail, updateBookingStatus, STORES } from "./api";
import { BookingStatus, BOOKING_STATUSES } from "@flashfix/shared";

interface BookingDetailModalProps {
  booking: BookingRecord | null;
  onClose: () => void;
  onBookingUpdated: () => void;
  onOpenAssignModal: (booking: BookingRecord) => void;
}

const NINE_STEPS = [
  { step: 1, title: "Booking Placed", key: "PENDING" },
  { step: 2, title: "Confirmed & Assigned", key: "CONFIRMED" },
  { step: 3, title: "Agent En Route", key: "PICKUP_EN_ROUTE" },
  { step: 4, title: "Pickup Handover (OTP Verified)", key: "IN_TRANSIT" },
  { step: 5, title: "In Repair Custody", key: "CUSTODY_OTP_SENT" },
  { step: 6, title: "Diagnostic & Repair in Progress", key: "IN_REPAIR" },
  { step: 7, title: "Repair Complete & Quality Check", key: "REPAIR_COMPLETE" },
  { step: 8, title: "Return Delivery En Route", key: "RETURN_EN_ROUTE" },
  { step: 9, title: "Delivered & Verified", key: "DELIVERED" },
];

export function mapStatusToStep(status: BookingStatus): number {
  switch (status) {
    case "PENDING":
      return 1;
    case "CONFIRMED":
      return 2;
    case "PICKUP_EN_ROUTE":
    case "PICKUP_OTP_SENT":
      return 3;
    case "IN_TRANSIT":
      return 4;
    case "CUSTODY_OTP_SENT":
      return 5;
    case "IN_REPAIR":
      return 6;
    case "REPAIR_COMPLETE":
      return 7;
    case "RETURN_EN_ROUTE":
      return 8;
    case "DELIVERED":
      return 9;
    default:
      return 1;
  }
}

export default function BookingDetailModal({
  booking,
  onClose,
  onBookingUpdated,
  onOpenAssignModal,
}: BookingDetailModalProps) {
  const [trail, setTrail] = useState<AuditTrailItem[]>([]);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [newStatus, setNewStatus] = useState<BookingStatus>("PENDING");
  const [overrideNote, setOverrideNote] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  useEffect(() => {
    if (booking) {
      setNewStatus(booking.status);
      setLoadingTrail(true);
      getBookingTrail(booking.id)
        .then((items) => setTrail(items))
        .finally(() => setLoadingTrail(false));
    }
  }, [booking]);

  if (!booking) return null;

  const currentStep = mapStatusToStep(booking.status);
  const store = STORES.find((s) => s.id === booking.storeId);

  async function handleStatusOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;

    setSubmittingOverride(true);
    try {
      await updateBookingStatus(booking.id, newStatus, overrideNote);
      setIsOverriding(false);
      onBookingUpdated();
      const updatedTrail = await getBookingTrail(booking.id);
      setTrail(updatedTrail);
    } finally {
      setSubmittingOverride(false);
    }
  }

  function formatPrice(paise?: number | null) {
    if (!paise) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(paise / 100);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-2xl bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl shadow-2xl p-5 sm:p-7 text-[var(--ink)] my-auto max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--hairline)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#ef8f0b]/10 text-[#ef8f0b] border border-[#ef8f0b]/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[var(--ink)]">
                  Order history
                </h3>
                <span className="font-mono text-xs text-[#ef8f0b] font-bold">
                  {booking.id}
                </span>
              </div>
              <span className="text-xs text-[var(--ink-muted)]">
                {booking.brand} {booking.deviceModel} • {booking.issueType}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 9-Step Repair Lifecycle Stepper */}
        <div className="mb-6 p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)]">
              9-Step Repair Lifecycle Progress
            </span>
            <span className="text-xs font-mono text-[#ef8f0b] font-bold">
              Step {currentStep} of 9
            </span>
          </div>

          <div className="relative flex items-center justify-between">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-[var(--surface-3)] z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#ef8f0b] z-0 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 8) * 100}%` }}
            />

            {NINE_STEPS.map((step) => {
              const isPast = step.step <= currentStep;
              const isCurrent = step.step === currentStep;
              return (
                <div
                  key={step.step}
                  className="relative z-10 flex flex-col items-center group cursor-help"
                  title={`${step.step}. ${step.title}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-all ${
                      isCurrent
                        ? "bg-[#ef8f0b] text-black ring-4 ring-[#ef8f0b]/20"
                        : isPast
                        ? "bg-[#ef8f0b] text-black"
                        : "bg-[var(--surface-3)] text-[var(--ink-muted)] border border-[var(--hairline)]"
                    }`}
                  >
                    {step.step}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-center text-xs font-semibold text-[var(--ink)]">
            Current State: <span className="text-[#ef8f0b]">{NINE_STEPS[currentStep - 1]?.title}</span>
          </div>
        </div>

        {/* Customer & Staff Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] space-y-2 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-muted)] block">
              Customer Contact & Address
            </span>
            <div className="font-semibold text-sm text-[var(--ink)]">{booking.contactName}</div>
            <div className="flex items-center gap-1.5 text-[var(--ink-secondary)]">
              <Phone className="w-3.5 h-3.5 text-[#ef8f0b]" />
              <span>{booking.contactPhone}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--ink-secondary)]">
              <Mail className="w-3.5 h-3.5 text-[#ef8f0b]" />
              <span className="truncate">{booking.contactEmail}</span>
            </div>
            <div className="flex items-start gap-1.5 text-[var(--ink-muted)] pt-1">
              <MapPin className="w-3.5 h-3.5 text-[#ef8f0b] shrink-0 mt-0.5" />
              <span className="leading-snug">{booking.pickupAddress}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
                Staff & Logistics Hub
              </span>
              <button
                onClick={() => onOpenAssignModal(booking)}
                className="text-[11px] font-semibold text-[#ef8f0b] hover:underline"
              >
                Reassign →
              </button>
            </div>
            <div className="text-xs">
              <span className="text-[var(--ink-muted)]">Service Centre: </span>
              <span className="font-semibold text-[var(--ink)]">{store?.name || booking.storeId}</span>
            </div>
            <div className="text-xs">
              <span className="text-[var(--ink-muted)]">Assigned Courier: </span>
              <span className="font-semibold text-[var(--ink)]">
                {booking.assignedEmployeeName || "Unassigned"}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-[var(--ink-muted)]">Assigned Tech: </span>
              <span className="font-semibold text-[var(--ink)]">
                {booking.technicianName || "Unassigned"}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-[var(--ink-muted)]">Estimated Cost: </span>
              <span className="font-mono font-bold text-[#ef8f0b]">
                {formatPrice(booking.estimatedCostPaise)}
              </span>
            </div>
          </div>
        </div>

        {/* Administrative Override Bar */}
        <div className="mb-6 p-4 rounded-xl bg-[var(--surface-2)] border border-[#ef8f0b]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ef8f0b]" />
              <span className="text-xs font-bold text-[var(--ink)]">
                Administrative Status Override
              </span>
            </div>
            <button
              onClick={() => setIsOverriding(!isOverriding)}
              className="text-xs text-[#ef8f0b] hover:underline font-semibold"
            >
              {isOverriding ? "Cancel" : "Override Status"}
            </button>
          </div>

          {isOverriding && (
            <form onSubmit={handleStatusOverride} className="mt-3 space-y-3 pt-3 border-t border-[var(--hairline)]">
              <div>
                <label className="text-[10px] font-mono text-[var(--ink-muted)] uppercase block mb-1">
                  Target Status Transition
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as BookingStatus)}
                  className="min-h-[44px] w-full bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl px-3 py-2 text-xs text-[var(--ink)] outline-none"
                >
                  {BOOKING_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[var(--ink-muted)] uppercase block mb-1">
                  Audit Override Note (Recorded to Ledger)
                </label>
                <input
                  type="text"
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  placeholder="e.g. Expedited by Ops Director due to expedited VIP ticket"
                  className="min-h-[44px] w-full bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl px-3 py-2 text-xs text-[var(--ink)] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingOverride}
                className="min-h-[44px] bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-[#ef8f0b]/20"
              >
                {submittingOverride ? "Updating..." : "Apply Status Override"}
              </button>
            </form>
          )}
        </div>

        {/* Immutable Audit Trail */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-[#ef8f0b]" />
            <h4 className="text-xs font-bold text-[var(--ink)]">
              Immutable Physical Custody Audit Trail
            </h4>
          </div>

          <div className="space-y-2.5">
            {loadingTrail ? (
              <div className="py-4 text-center text-xs text-[var(--ink-muted)]">
                Loading audit trail entries...
              </div>
            ) : trail.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--ink-muted)]">
                No trail records recorded yet.
              </div>
            ) : (
              trail.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] text-xs flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[#ef8f0b]">
                        {item.toStatus}
                      </span>
                      <span className="text-[var(--ink-secondary)] text-[11px]">
                        by <strong className="text-[var(--ink)]">{item.triggeredByName || "System"}</strong>
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-[var(--ink-muted)] text-[11px] mt-1 leading-snug">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-[var(--ink-muted)] shrink-0">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
