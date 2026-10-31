import { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Edit,
} from "lucide-react";
import { BookingRecord, AuditTrailItem } from "../types";
import { getBookingTrail, updateBookingStatus, STORES } from "../api";
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

function mapStatusToStep(status: BookingStatus): number {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-4xl bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl max-h-[90vh] flex flex-col text-[#f5f0eb]">
        {/* Modal Header */}
        <div className="p-6 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ef8f0b]/10 border border-[#ef8f0b]/30 flex items-center justify-center text-[#ef8f0b] font-bold">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono font-bold text-lg text-[#ef8f0b]">
                  {booking.id}
                </h2>
                <span className="text-[10px] font-mono text-[#807a75] bg-[#1a1a1a] px-2 py-0.5 rounded border border-[rgba(255,255,255,0.08)]">
                  {booking.trackingCode || `TRK-${booking.id}`}
                </span>
              </div>
              <p className="text-xs text-[#a8a09a]">
                Hardware Repair & Audit Protocol Details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAssignModal(booking)}
              className="bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-3.5 py-2 rounded-xl transition-all"
            >
              {booking.assignedEmployeeName ? "Reassign Staff" : "Assign Staff"}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#807a75] hover:text-[#f5f0eb] hover:bg-[#1a1a1a] rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Contact */}
            <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] text-xs space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#807a75] block">
                Customer Information
              </span>
              <div className="font-semibold text-[#f5f0eb] text-sm">
                {booking.contactName}
              </div>
              <div className="flex items-center gap-2 text-[#a8a09a]">
                <Phone className="w-3.5 h-3.5 text-[#ef8f0b]" />
                <span>{booking.contactPhone}</span>
              </div>
              <div className="flex items-center gap-2 text-[#a8a09a] truncate">
                <Mail className="w-3.5 h-3.5 text-[#807a75]" />
                <span className="truncate">{booking.contactEmail}</span>
              </div>
            </div>

            {/* Device & Problem */}
            <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] text-xs space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#807a75] block">
                Hardware & Diagnosis
              </span>
              <div className="font-semibold text-[#f5f0eb] text-sm flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#ef8f0b]" />
                <span>{booking.brand} {booking.deviceModel}</span>
              </div>
              <div className="text-[#a8a09a]">
                Problem: <strong className="text-[#f5f0eb]">{booking.issueType}</strong>
              </div>
              {booking.issueDescription && (
                <p className="text-[11px] text-[#807a75] italic">
                  "{booking.issueDescription}"
                </p>
              )}
            </div>

            {/* Staff & Store */}
            <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] text-xs space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#807a75] block">
                Store Hub & Operatives
              </span>
              <div className="font-semibold text-[#f5f0eb]">
                {store?.name || booking.storeId}
              </div>
              <div className="text-[#a8a09a]">
                Courier: <strong className="text-[#f5f0eb]">{booking.assignedEmployeeName || "Unassigned"}</strong>
              </div>
              <div className="text-[#a8a09a]">
                Technician: <strong className="text-[#f5f0eb]">{booking.technicianName || "Unassigned"}</strong>
              </div>
            </div>
          </div>

          {/* Pickup Address & Schedule */}
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#ef8f0b] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-mono uppercase text-[#807a75] block">
                  Pickup Doorstep Coordinates
                </span>
                <span className="text-[#f5f0eb]">{booking.pickupAddress}</span>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="text-[10px] font-mono uppercase text-[#807a75] block">
                Scheduled Slot
              </span>
              <span className="font-mono text-[#ef8f0b] font-semibold">
                {booking.scheduledDate} • {booking.scheduledTime}
              </span>
            </div>
          </div>

          {/* 9-Step Timeline Stepper */}
          <div className="p-5 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-sm text-[#f5f0eb]">
                  9-Step Lifecycle Audit Stepper
                </h3>
                <p className="text-[11px] text-[#807a75]">
                  Chain-of-custody tracking from booking intake to customer delivery
                </p>
              </div>
              <span className="font-mono text-xs text-[#ef8f0b] bg-[#ef8f0b]/10 px-2.5 py-0.5 rounded-full border border-[#ef8f0b]/30">
                Step {currentStep} of 9 ({booking.status})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {NINE_STEPS.map((step) => {
                const isPassed = currentStep > step.step;
                const isCurrent = currentStep === step.step;
                return (
                  <div
                    key={step.step}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isPassed
                        ? "bg-[#141414] border-emerald-500/30 text-[#f5f0eb]"
                        : isCurrent
                        ? "bg-[#ef8f0b]/10 border-[#ef8f0b] text-[#ef8f0b] font-semibold shadow-sm"
                        : "bg-[#141414]/40 border-[rgba(255,255,255,0.04)] text-[#6b6460]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold">
                        STEP 0{step.step}
                      </span>
                      {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-[#ef8f0b] animate-ping" />
                      )}
                    </div>
                    <div className="text-[11px] leading-tight font-medium">
                      {step.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Override Toolbar for Store Admins */}
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#f5f0eb]">
                Admin Status Override & Audit Notes
              </span>
              {!isOverriding && (
                <button
                  onClick={() => setIsOverriding(true)}
                  className="text-xs text-[#ef8f0b] hover:underline flex items-center gap-1 font-medium"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Override Status
                </button>
              )}
            </div>

            {isOverriding ? (
              <form onSubmit={handleStatusOverride} className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-[#807a75] uppercase block mb-1">
                      New Status State
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as BookingStatus)}
                      className="w-full bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                    >
                      {BOOKING_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#807a75] uppercase block mb-1">
                      Audit Note (Mandatory)
                    </label>
                    <input
                      type="text"
                      value={overrideNote}
                      onChange={(e) => setOverrideNote(e.target.value)}
                      placeholder="e.g. Technician completed screen swap; verified with QC meter"
                      required
                      className="w-full bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOverriding(false)}
                    className="px-3 py-1.5 text-xs text-[#807a75] hover:text-[#f5f0eb]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOverride || !overrideNote.trim()}
                    className="bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-4 py-1.5 rounded-xl transition-all disabled:opacity-40"
                  >
                    {submittingOverride ? "Updating..." : "Commit Status Change"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-[#807a75]">
                Current status is locked to <strong className="text-[#f5f0eb] font-mono">{booking.status}</strong>. Store managers can manually update status with an immutable audit entry.
              </p>
            )}
          </div>

          {/* Immutable Audit Trail List */}
          <div>
            <h3 className="font-bold text-sm text-[#f5f0eb] mb-3">
              Cryptographic Audit Log
            </h3>
            {loadingTrail ? (
              <div className="p-4 text-center text-xs text-[#807a75]">
                Loading trail events...
              </div>
            ) : trail.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#807a75] bg-[#1a1a1a] rounded-xl">
                No prior transitions logged.
              </div>
            ) : (
              <div className="space-y-2">
                {trail.map((t, i) => (
                  <div
                    key={t.id || i}
                    className="p-3 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ef8f0b]" />
                      <span className="font-mono font-semibold text-[#ef8f0b]">
                        {t.toStatus}
                      </span>
                      <span className="text-[#a8a09a]">— {t.notes || "Status logged"}</span>
                    </div>
                    <div className="text-[10px] font-mono text-[#807a75] sm:text-right">
                      <span>By {t.triggeredByName || "System"}</span> •{" "}
                      <span>{new Date(t.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
