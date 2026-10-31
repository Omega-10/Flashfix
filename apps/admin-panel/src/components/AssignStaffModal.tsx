import { useState } from "react";
import { X, UserCheck, AlertCircle } from "lucide-react";
import { BookingRecord, StaffMember } from "../types";
import { assignStaffToBooking } from "../api";

interface AssignStaffModalProps {
  booking: BookingRecord | null;
  staffList: StaffMember[];
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignStaffModal({
  booking,
  staffList,
  onClose,
  onAssigned,
}: AssignStaffModalProps) {
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;

  // Filter staff belonging to the booking's store or all
  const availableCouriers = staffList.filter((s) => s.status === "ACTIVE");
  const availableTechnicians = staffList.filter((s) => s.status === "ACTIVE");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;

    if (!selectedCourierId) {
      setError("Please select a mobile courier / operative for doorstep pickup.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await assignStaffToBooking(
        booking.id,
        selectedCourierId,
        selectedTechnicianId || selectedCourierId
      );
      onAssigned();
      onClose();
    } catch {
      setError("Failed to assign staff. Please try again.");
    } finally {
      setSubmitting(false);
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
      <div className="relative z-10 w-full max-w-md bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl p-6 text-[#f5f0eb]">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#ef8f0b]/10 text-[#ef8f0b] border border-[#ef8f0b]/30">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#f5f0eb]">
                Allocate Staff to Order
              </h3>
              <span className="font-mono text-[10px] text-[#ef8f0b]">
                {booking.id} • {booking.brand} {booking.deviceModel}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#807a75] hover:text-[#f5f0eb] hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
              1. Doorstep Mobile Courier (Pickup & Handover)
            </label>
            <select
              value={selectedCourierId}
              onChange={(e) => setSelectedCourierId(e.target.value)}
              required
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b] cursor-pointer"
            >
              <option value="">Select mobile operative...</option>
              {availableCouriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role}) • {c.storeName || "All Hubs"}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#807a75] mt-1">
              Will receive customer pickup notification and perform 6-digit OTP verification.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
              2. Lab Hardware Technician (Diagnosis & Custody)
            </label>
            <select
              value={selectedTechnicianId}
              onChange={(e) => setSelectedTechnicianId(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b] cursor-pointer"
            >
              <option value="">Same as mobile courier (or select dedicated tech)...</option>
              {availableTechnicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.role}) • {t.storeName || "All Hubs"}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] text-[11px] text-[#807a75]">
            Confirming allocation will transition status to <strong className="text-[#ef8f0b] font-mono">CONFIRMED</strong> and trigger internal employee dispatch.
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] text-xs text-[#807a75] hover:text-[#f5f0eb] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedCourierId}
              className="flex-1 py-2.5 rounded-xl bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#ef8f0b]/20 disabled:opacity-40"
            >
              {submitting ? "Allocating..." : "Confirm Staff Allocation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
