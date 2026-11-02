import { useState } from "react";
import { X, UserCheck, AlertCircle, Bike, Wrench } from "lucide-react";
import { BookingRecord, StaffMember } from "./types";
import { assignStaffToBooking } from "./api";

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
  const [selectedCourierId, setSelectedCourierId] = useState(
    booking?.assignedEmployeeId || "emp-001"
  );
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(
    booking?.technicianId || "emp-002"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;

  const activeStaff = staffList.filter((s) => s.status === "ACTIVE");

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
      <div className="relative z-10 w-full max-w-md bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl shadow-2xl p-6 text-[var(--ink)]">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--hairline)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#ef8f0b]/10 text-[#ef8f0b] border border-[#ef8f0b]/30">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--ink)]">
                Allocate Staff to Order
              </h3>
              <span className="font-mono text-[10px] text-[#ef8f0b]">
                {booking.id} • {booking.brand} {booking.deviceModel}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
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
            <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-muted)] block mb-1.5 flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-[#ef8f0b]" />
              <span>1. Doorstep Mobile Courier (Pickup & Handover)</span>
            </label>
            <select
              value={selectedCourierId}
              onChange={(e) => setSelectedCourierId(e.target.value)}
              className="min-h-[44px] w-full bg-[var(--surface-2)] border border-[var(--hairline)] rounded-xl px-3 py-2.5 text-xs text-[var(--ink)] outline-none focus:border-[#ef8f0b] cursor-pointer"
            >
              <option value="">-- Choose Courier Operative --</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.storeName || s.storeId}) - {s.activeJobsCount || 0} active jobs
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-muted)] block mb-1.5 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
              <span>2. Lab Hardware Technician (Diagnosis & Fix)</span>
            </label>
            <select
              value={selectedTechnicianId}
              onChange={(e) => setSelectedTechnicianId(e.target.value)}
              className="min-h-[44px] w-full bg-[var(--surface-2)] border border-[var(--hairline)] rounded-xl px-3 py-2.5 text-xs text-[var(--ink)] outline-none focus:border-[#ef8f0b] cursor-pointer"
            >
              <option value="">-- Choose Hardware Technician --</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.storeName || s.storeId}) - {s.activeJobsCount || 0} active jobs
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#ef8f0b]/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{submitting ? "Allocating..." : "Confirm Staff Allocation"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
