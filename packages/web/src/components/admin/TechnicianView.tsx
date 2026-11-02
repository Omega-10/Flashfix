import { useState } from "react";
import {
  Wrench,
  CheckCircle2,
  Clock,
  KeyRound,
  Cpu,
  ShieldCheck,
  CheckSquare,
  Square,
  Boxes,
  Truck,
  Eye,
} from "lucide-react";
import { BookingRecord, InventoryRecord } from "./types";
import { markRepairComplete, startReturnDelivery, STORES } from "./api";

interface TechnicianViewProps {
  bookings: BookingRecord[];
  inventory: InventoryRecord[];
  selectedStore: string;
  onSelectBooking: (booking: BookingRecord) => void;
  onOpenOtpModal: (config: {
    bookingId: string;
    purpose: "CUSTODY" | "PICKUP";
    title: string;
    description: string;
    onSuccess: () => void;
  }) => void;
  onRefreshData: () => void;
}

export default function TechnicianView({
  bookings,
  inventory,
  selectedStore,
  onSelectBooking,
  onOpenOtpModal,
  onRefreshData,
}: TechnicianViewProps) {
  const [activeQueueTab, setActiveQueueTab] = useState<"ACTIVE" | "INCOMING" | "DONE">("ACTIVE");
  const [selectedChecklist, setSelectedChecklist] = useState<Record<string, Record<string, boolean>>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Filter queue for technician
  const filteredBookings = bookings.filter((b) => {
    if (selectedStore !== "ALL" && b.storeId !== selectedStore) return false;
    return true;
  });

  const incomingQueue = filteredBookings.filter(
    (b) => b.status === "CUSTODY_OTP_SENT" || b.status === "IN_TRANSIT"
  );

  const activeWorkbenchQueue = filteredBookings.filter(
    (b) => b.status === "IN_REPAIR"
  );

  const completedQueue = filteredBookings.filter(
    (b) => b.status === "REPAIR_COMPLETE" || b.status === "RETURN_EN_ROUTE" || b.status === "DELIVERED"
  );

  function toggleChecklistItem(bookingId: string, itemKey: string) {
    setSelectedChecklist((prev) => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [itemKey]: !prev[bookingId]?.[itemKey],
      },
    }));
  }

  async function handleMarkComplete(booking: BookingRecord) {
    setCompletingId(booking.id);
    try {
      await markRepairComplete(booking.id, booking.estimatedCostPaise || undefined, "Hardware diagnostic passed. OEM panel & components installed.");
      onRefreshData();
    } finally {
      setCompletingId(null);
    }
  }

  async function handleDispatchReturn(booking: BookingRecord) {
    await startReturnDelivery(booking.id);
    onRefreshData();
  }

  const DIAGNOSTIC_STEPS = [
    { key: "display", label: "Display & Touch Digitizer Calibrated" },
    { key: "battery", label: "Battery Health & Thermals Inspected" },
    { key: "biometrics", label: "Biometrics (Face ID / Fingerprint) Verified" },
    { key: "fastcharge", label: "Fast Charging Voltage & Port Tested" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-full overflow-x-hidden">
      {/* ── Technician Bench Header ── */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[var(--surface-1)] border border-[var(--hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Cpu className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold font-display text-[var(--ink)]">
              Repair Queue
            </h1>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              Devices assigned to you and custody verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-[var(--surface-3)] border border-[var(--hairline)] text-xs font-mono text-[var(--ink-secondary)]">
            Active Lab Load: <strong className="text-[#ef8f0b]">{activeWorkbenchQueue.length} devices</strong>
          </span>
          {inventory.length > 0 && (
            <span className="hidden sm:inline-block px-3 py-1.5 rounded-xl bg-[var(--surface-3)] border border-[var(--hairline)] text-xs font-mono text-emerald-400">
              OEM Stock: {inventory.reduce((acc, i) => acc + i.quantity, 0)} parts
            </span>
          )}
        </div>
      </div>

      {/* ── Segmented Workbench Tabs ── */}
      <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[var(--surface-1)] border border-[var(--hairline)]">
        <button
          onClick={() => setActiveQueueTab("ACTIVE")}
          className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            activeQueueTab === "ACTIVE"
              ? "bg-[var(--surface-3)] text-[#ef8f0b] shadow border border-[var(--hairline)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Active on Bench</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#ef8f0b]/20 text-[#ef8f0b]">
            {activeWorkbenchQueue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveQueueTab("INCOMING")}
          className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            activeQueueTab === "INCOMING"
              ? "bg-[var(--surface-3)] text-[#ef8f0b] shadow border border-[var(--hairline)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Awaiting Custody</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-400">
            {incomingQueue.length}
          </span>
        </button>

        <button
          onClick={() => setActiveQueueTab("DONE")}
          className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            activeQueueTab === "DONE"
              ? "bg-[var(--surface-3)] text-[#ef8f0b] shadow border border-[var(--hairline)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed & Ready</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400">
            {completedQueue.length}
          </span>
        </button>
      </div>

      {/* ── Incoming Custody Notification Banner ── */}
      {incomingQueue.filter((b) => b.status === "CUSTODY_OTP_SENT").length > 0 && activeQueueTab === "ACTIVE" && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>{incomingQueue.filter((b) => b.status === "CUSTODY_OTP_SENT").length} device(s)</strong> arrived at hub awaiting custody check-in.
            </span>
          </div>
          <button
            onClick={() => setActiveQueueTab("INCOMING")}
            className="text-[#ef8f0b] hover:underline font-semibold font-mono text-xs self-end sm:self-auto"
          >
            Review & Enter Custody OTP →
          </button>
        </div>
      )}

      {/* ── Tab Content ── */}

      {/* 1. ACTIVE ON WORKBENCH */}
      {activeQueueTab === "ACTIVE" && (
        <div className="space-y-4">
          {activeWorkbenchQueue.length === 0 ? (
            <div className="py-16 text-center bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[var(--ink)]">Workbench Clear</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                No active repair jobs queued on this bench. Check "Awaiting Custody" for incoming deliveries.
              </p>
            </div>
          ) : (
            activeWorkbenchQueue.map((booking) => {
              const checklist = selectedChecklist[booking.id] || {};
              const checkedCount = Object.values(checklist).filter(Boolean).length;
              const allChecked = checkedCount === DIAGNOSTIC_STEPS.length;
              const isCompleting = completingId === booking.id;

              return (
                <div
                  key={booking.id}
                  className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-4 sm:p-6 transition-all"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-[var(--hairline)]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-[#ef8f0b]">
                        {booking.id}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {booking.status}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--ink-muted)] font-mono">
                      Scheduled: <strong className="text-[var(--ink)]">{booking.scheduledDate} ({booking.scheduledTime})</strong>
                    </div>
                  </div>

                  {/* Device & Reported Problem */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)] mb-1">
                        Device Specification
                      </div>
                      <div className="text-base font-bold text-[var(--ink)]">
                        {booking.brand} {booking.deviceModel}
                      </div>
                      <div className="text-xs text-[#ef8f0b] font-medium mt-0.5">
                        {booking.issueType}
                      </div>
                      {booking.issueDescription && (
                        <p className="text-xs text-[var(--ink-secondary)] mt-2 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)]">
                          "{booking.issueDescription}"
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider text-[var(--ink-muted)] mb-1">
                        Custody & Customer Info
                      </div>
                      <div className="text-xs text-[var(--ink)] font-medium">
                        Customer: {booking.contactName} ({booking.contactPhone})
                      </div>
                      <div className="text-xs text-[var(--ink-muted)] mt-1">
                        Pickup Courier: {booking.assignedEmployeeName || "Assigned Courier"}
                      </div>
                      <div className="text-xs text-[var(--ink-muted)] mt-0.5">
                        Lab Facility: {STORES.find((s) => s.id === booking.storeId)?.name || booking.storeId}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Point Diagnostic Checklist */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] mb-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#ef8f0b]" />
                        <span>Multi-Point Lab Diagnostic Checklist</span>
                      </span>
                      <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                        {checkedCount} / {DIAGNOSTIC_STEPS.length} verified {allChecked ? "✓ QA Ready" : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DIAGNOSTIC_STEPS.map((step) => {
                        const isChecked = !!checklist[step.key];
                        return (
                          <button
                            key={step.key}
                            onClick={() => toggleChecklistItem(booking.id, step.key)}
                            className={`min-h-[44px] flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all ${
                              isChecked
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-[var(--surface-3)] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-[var(--ink-muted)] shrink-0" />
                            )}
                            <span className="leading-tight">{step.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--hairline)]">
                    <button
                      onClick={() => onSelectBooking(booking)}
                      className="min-h-[44px] text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Audit Trail & Details</span>
                    </button>

                    <button
                      disabled={isCompleting}
                      onClick={() => handleMarkComplete(booking)}
                      className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-5 py-2.5 transition-all shadow-md shadow-[#ef8f0b]/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isCompleting ? "Updating..." : "Mark Repair Complete & QA Approved"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. AWAITING CUSTODY HANDOVER */}
      {activeQueueTab === "INCOMING" && (
        <div className="space-y-4">
          {incomingQueue.length === 0 ? (
            <div className="py-16 text-center bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-6">
              <Clock className="w-10 h-10 text-blue-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[var(--ink)]">No Incoming Custody Transfers</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                All courier pickups have already been checked into the lab facility.
              </p>
            </div>
          ) : (
            incomingQueue.map((booking) => {
              const isOtpSent = booking.status === "CUSTODY_OTP_SENT";
              return (
                <div
                  key={booking.id}
                  className="bg-[var(--surface-1)] border border-blue-500/30 rounded-2xl p-4 sm:p-6 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-[var(--hairline)]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#ef8f0b]">{booking.id}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isOtpSent
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                          : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                      }`}>
                        {isOtpSent ? "CUSTODY OTP PENDING" : "EN ROUTE TO HUB"}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[var(--ink-muted)]">
                      Carrier: {booking.assignedEmployeeName || "Assigned Courier"}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-base font-bold text-[var(--ink)]">
                      {booking.brand} {booking.deviceModel}
                    </h3>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                      Service: {booking.issueType} • Customer: {booking.contactName}
                    </p>
                    <p className="text-xs text-amber-300/90 mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      {isOtpSent
                        ? "Courier has arrived at the service centre. Enter the 6-digit Custody OTP to accept custody and begin hardware diagnostic."
                        : "Courier is currently in transit to the repair hub with the customer device. Custody OTP verification will activate once courier arrives at hub."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--hairline)]">
                    <button
                      onClick={() => onSelectBooking(booking)}
                      className="min-h-[44px] text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    >
                      View Order Details
                    </button>

                    {isOtpSent ? (
                      <button
                        onClick={() =>
                          onOpenOtpModal({
                            bookingId: booking.id,
                            purpose: "CUSTODY",
                            title: "Verify Lab Custody OTP",
                            description: `Enter the 6-digit custody code displayed on operative ${booking.assignedEmployeeName || "courier"}'s screen to accept hardware into the lab.`,
                            onSuccess: onRefreshData,
                          })
                        }
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-5 py-2.5 transition-all shadow-md shadow-[#ef8f0b]/20"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Verify Custody OTP (Accept into Lab)</span>
                      </button>
                    ) : (
                      <span className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--hairline)] border border-[var(--hairline)] text-[var(--ink-muted)] text-xs font-mono">
                        <Clock className="w-4 h-4" />
                        <span>Awaiting Courier Hub Arrival</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. COMPLETED & READY FOR DISPATCH */}
      {activeQueueTab === "DONE" && (
        <div className="space-y-4">
          {completedQueue.length === 0 ? (
            <div className="py-16 text-center bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-6">
              <Boxes className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[var(--ink)]">No Finished Repairs Pending Return</h3>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Repaired hardware that passes QA testing will appear here for return delivery dispatch.
              </p>
            </div>
          ) : (
            completedQueue.map((booking) => (
              <div
                key={booking.id}
                className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[#ef8f0b]">{booking.id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      {booking.status}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[var(--ink)]">
                    {booking.brand} {booking.deviceModel}
                  </div>
                  <div className="text-xs text-[var(--ink-muted)]">
                    Customer: {booking.contactName} ({booking.pickupAddress})
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {booking.status === "REPAIR_COMPLETE" && (
                    <button
                      onClick={() => handleDispatchReturn(booking)}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs rounded-xl px-4 py-2 transition-all shadow-md shadow-[#ef8f0b]/20"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Dispatch Return Courier</span>
                    </button>
                  )}
                  <button
                    onClick={() => onSelectBooking(booking)}
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-[var(--hairline)] text-xs text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
