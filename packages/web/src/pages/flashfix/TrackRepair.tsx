import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Smartphone,
  MapPin,
  Calendar,
  AlertCircle,
  Wrench,
  Truck,
  UserCheck,
  Check,
  Sparkles,
  KeyRound,
  Copy,
  Search,
  XCircle,
} from "lucide-react";
import { BookingStatus, BookingTrail } from "@flashfix/shared";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface BookingDetail {
  id: string;
  trackingCode?: string;
  brand: string;
  deviceModel: string;
  issueType: string;
  issueDescription?: string | null;
  status: BookingStatus;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  storeId?: string;
  storeName?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  estimatedCostPaise?: number | null;
  finalCostPaise?: number | null;
  assignedEmployeeName?: string | null;
  technicianName?: string | null;
  pickupOtp?: string | null;
  custodyOtp?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface StepDefinition {
  step: number;
  key: string;
  title: string;
  desc: string;
  icon: React.ElementType;
}

const NINE_STEPS: StepDefinition[] = [
  {
    step: 1,
    key: "BOOKING_PLACED",
    title: "Booking Placed",
    desc: "Service request received and scheduled",
    icon: Calendar,
  },
  {
    step: 2,
    key: "CONFIRMED",
    title: "Confirmed & Assigned",
    desc: "Pickup courier and repair technician assigned",
    icon: UserCheck,
  },
  {
    step: 3,
    key: "PICKUP_EN_ROUTE",
    title: "Courier En Route",
    desc: "Courier is heading to your pickup address",
    icon: Truck,
  },
  {
    step: 4,
    key: "IN_TRANSIT",
    title: "Device Picked Up (OTP Verified)",
    desc: "Device collected after 6-digit pickup code verification",
    icon: ShieldCheck,
  },
  {
    step: 5,
    key: "CUSTODY_VERIFIED",
    title: "Checked In at Service Hub",
    desc: "Device received at service hub and verified by technician",
    icon: MapPin,
  },
  {
    step: 6,
    key: "IN_REPAIR",
    title: "Repair in Progress",
    desc: "Hardware diagnostic and repair underway",
    icon: Wrench,
  },
  {
    step: 7,
    key: "REPAIR_COMPLETE",
    title: "Repair Complete & Quality Checked",
    desc: "Post-repair quality inspection completed",
    icon: Sparkles,
  },
  {
    step: 8,
    key: "RETURN_EN_ROUTE",
    title: "Out for Return Delivery",
    desc: "Courier is returning your repaired device",
    icon: Truck,
  },
  {
    step: 9,
    key: "DELIVERED",
    title: "Delivered",
    desc: "Repaired device delivered back to you",
    icon: CheckCircle2,
  },
];

function mapStatusToStepIndex(status: BookingStatus): number {
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
    case "CANCELLED":
      return 0;
    default:
      return 1;
  }
}

export default function TrackRepair() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [lookupInput, setLookupInput] = useState("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [trail, setTrail] = useState<BookingTrail[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Cancellation state
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const getHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("accessToken");
    const headers: Record<string, string> = {};
    if (token && token !== "cookie-session") {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const fetchBookingData = useCallback(
    async (isManual = false) => {
      if (!id) {
        setLoading(false);
        return;
      }
      if (isManual) setRefreshing(true);

      try {
        const [bookingRes, trailRes] = await Promise.all([
          fetch(`/api/bookings/${encodeURIComponent(id)}`, {
            credentials: "include",
            headers: getHeaders(),
          }),
          fetch(`/api/bookings/${encodeURIComponent(id)}/trail`, {
            credentials: "include",
            headers: getHeaders(),
          }),
        ]);

        if (bookingRes.status === 404) {
          setBooking(null);
          setNotFound(true);
          setError(null);
          return;
        }

        if (!bookingRes.ok) {
          const errData = await bookingRes.json().catch(() => null);
          setError(errData?.error?.message || "Unable to load booking details.");
          return;
        }

        const bData = await bookingRes.json();
        const resolvedBooking = bData.data || bData.booking || bData;
        setBooking(resolvedBooking);
        setNotFound(false);
        setError(null);

        if (trailRes.ok) {
          const tData = await trailRes.json();
          const rawTrail = Array.isArray(tData) ? tData : tData.data || tData.trail || [];
          const sorted = [...rawTrail].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setTrail(sorted);
        } else {
          setTrail([]);
        }

        setLastRefreshed(new Date());
      } catch {
        setError("Network error while loading repair status.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchBookingData();
    } else {
      setBooking(null);
      setLoading(false);
    }
  }, [id, fetchBookingData]);

  // 15-second polling paused when tab is hidden
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchBookingData();
    }, 15000);

    return () => clearInterval(interval);
  }, [id, fetchBookingData]);

  async function handleCancelBooking() {
    if (!booking) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getHeaders(),
        },
        body: JSON.stringify({ reason: "Cancelled by customer" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Could not cancel this booking.");
      } else {
        setIsCancelDialogOpen(false);
        await fetchBookingData(true);
      }
    } catch {
      setError("Network error while cancelling booking.");
    } finally {
      setCancelling(false);
    }
  }

  function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = lookupInput.trim();
    if (!cleaned) return;
    navigate(`/flashfix/track/${encodeURIComponent(cleaned)}`);
  }

  // Standalone Lookup Screen when visiting /flashfix/track without an ID
  if (!id) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
        <div className="section-container max-w-md">
          <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-7 sm:p-8 shadow-sm">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-semibold block mb-1">
              REPAIR TRACKING
            </span>
            <h1 className="font-display font-bold text-2xl mb-2">Track Your Repair</h1>
            <p className="text-xs text-[var(--ink-2)] mb-6 leading-relaxed">
              Enter your booking ID to view real-time repair progress and status updates.
            </p>
            <form onSubmit={handleLookupSubmit} className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
                <input
                  type="text"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="Enter booking ID"
                  autoFocus
                  required
                  className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-4 text-sm font-mono text-[var(--ink)] placeholder-[var(--ink-3)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                type="submit"
                disabled={!lookupInput.trim()}
                className="w-full h-11 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold text-sm rounded-lg transition-all disabled:opacity-50"
              >
                Track Repair
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-[var(--canvas)] text-[var(--ink)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[var(--ink-3)]">Loading repair status...</p>
        </div>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
        <div className="section-container max-w-md text-center">
          <div className="p-8 rounded-xl bg-[var(--surface-1)] border border-[var(--hairline)]">
            <AlertCircle className="w-10 h-10 text-[var(--danger)] mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Booking Not Found</h2>
            <p className="text-xs text-[var(--ink-2)] mb-6">
              {error || (
                <>
                  No repair booking was found with ID{" "}
                  <span className="font-mono font-semibold text-[var(--ink)]">{id}</span>. Please check your booking ID or sign in to view your account bookings.
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <Link
                to="/flashfix/track"
                className="inline-flex items-center justify-center border border-[var(--hairline)] text-xs font-medium px-4 py-2.5 rounded-lg hover:bg-[var(--surface-2)]"
              >
                Search Another ID
              </Link>
              <Link
                to="/flashfix/profile"
                className="inline-flex items-center justify-center bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-xs px-5 py-2.5 rounded-lg"
              >
                Go to My Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentStep = mapStatusToStepIndex(booking.status);
  const canCancel = ["PENDING", "CONFIRMED", "PICKUP_EN_ROUTE"].includes(booking.status);
  const costDisplay =
    typeof (booking.finalCostPaise ?? booking.estimatedCostPaise) === "number" &&
    (booking.finalCostPaise ?? booking.estimatedCostPaise)! > 0
      ? `₹${(((booking.finalCostPaise ?? booking.estimatedCostPaise) as number) / 100).toLocaleString("en-IN")}`
      : "Quote pending";

  return (
    <div className="pt-28 pb-24 min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="section-container max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/flashfix/profile"
              className="p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--hairline)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Back to My Account"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                  Booking #{booking.id}
                </span>
                <StatusPill status={booking.status} />
              </div>
              <h1 className="font-display font-bold text-2xl">
                {booking.brand} {booking.deviceModel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <span className="text-[11px] font-mono text-[var(--ink-3)] hidden sm:inline">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
            <button
              onClick={() => fetchBookingData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--hairline)] hover:border-[var(--accent)] text-xs font-medium text-[var(--ink-2)] hover:text-[var(--ink)] transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[var(--accent)]" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
            {canCancel && (
              <button
                onClick={() => setIsCancelDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-xs font-medium text-[var(--danger)] hover:bg-red-500/20 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Booking</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-[var(--danger)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cancelled Banner */}
        {booking.status === "CANCELLED" && (
          <div className="mb-6 p-5 rounded-xl bg-[var(--surface-1)] border border-red-500/30 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-sm text-[var(--ink)]">This booking has been cancelled</h2>
              <p className="text-xs text-[var(--ink-2)] mt-0.5">
                If you still need a repair, you can book a new pickup slot anytime.
              </p>
            </div>
          </div>
        )}

        {/* Doorstep Pickup OTP Code Banner (Shown only when server returns pickupOtp for owner during PICKUP_OTP_SENT) */}
        {booking.status === "PICKUP_OTP_SENT" && booking.pickupOtp && (
          <div className="mb-8 p-6 rounded-xl bg-[var(--surface-1)] border-2 border-[var(--accent)] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-mono text-[11px] font-bold tracking-wider text-[var(--accent)] uppercase block">
                    Pickup Handover Code
                  </span>
                  <h2 className="text-lg font-bold font-display text-[var(--ink)]">
                    Share this code with your courier at pickup
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--ink-2)] mb-4 leading-relaxed">
              Share this 6-digit code in person with{" "}
              <strong className="text-[var(--ink)]">
                {booking.assignedEmployeeName || "your assigned Flashfix courier"}
              </strong>{" "}
              when handing over your device.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--hairline)]">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                {booking.pickupOtp.split("").map((digit, idx) => (
                  <div
                    key={idx}
                    className="w-10 h-12 sm:w-12 sm:h-14 rounded-lg bg-[var(--surface-1)] border border-[var(--accent)] flex items-center justify-center text-xl sm:text-2xl font-mono font-bold text-[var(--accent)] tabular-nums"
                  >
                    {digit}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  onClick={() => {
                    if (booking.pickupOtp && navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(booking.pickupOtp).catch(() => {});
                    }
                    setCopiedOtp(true);
                    setTimeout(() => setCopiedOtp(false), 2000);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-3)] border border-[var(--hairline)] text-xs font-semibold text-[var(--ink)] flex items-center gap-2 transition-all"
                >
                  {copiedOtp ? (
                    <>
                      <Check className="w-4 h-4 text-[var(--success)]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[var(--accent)]" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <Smartphone className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--ink-3)]">Device & Issue</span>
            </div>
            <h3 className="font-semibold text-sm text-[var(--ink)]">
              {booking.brand} {booking.deviceModel}
            </h3>
            <p className="text-xs text-[var(--ink-2)] mt-1">{booking.issueType}</p>
          </div>

          <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--ink-3)]">Pickup Schedule</span>
            </div>
            <h3 className="font-semibold text-sm text-[var(--ink)]">
              {booking.scheduledDate} · {booking.scheduledTime}
            </h3>
            <p className="text-xs text-[var(--ink-2)] mt-1 truncate">{booking.pickupAddress}</p>
          </div>

          <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-2">
              <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--ink-3)]">Assignment & Estimate</span>
            </div>
            <h3 className="font-semibold text-sm text-[var(--ink)]">
              {booking.assignedEmployeeName ? `Courier: ${booking.assignedEmployeeName}` : "Awaiting courier assignment"}
            </h3>
            <div className="text-xs text-[var(--ink-2)] mt-1 flex justify-between">
              <span>{booking.technicianName ? `Tech: ${booking.technicianName}` : "Lab technician pending"}</span>
              <span className="font-mono font-semibold text-[var(--ink)]">{costDisplay}</span>
            </div>
          </div>
        </div>

        {/* 9-Step Timeline */}
        {booking.status !== "CANCELLED" && (
          <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-6 sm:p-8 mb-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--hairline)]">
              <div>
                <h2 className="font-bold text-base text-[var(--ink)]">Repair Progress</h2>
                <p className="text-xs text-[var(--ink-3)]">
                  Step-by-step status from doorstep pickup to return delivery
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--accent)] font-semibold">
                Step {Math.max(1, currentStep)} of 9
              </span>
            </div>

            <div className="relative pl-6 sm:pl-8 space-y-6">
              <div className="absolute top-4 bottom-4 left-9 sm:left-11 w-px bg-[var(--hairline)]" />

              {NINE_STEPS.map((item) => {
                const isPassed = currentStep > item.step;
                const isCurrent = currentStep === item.step;
                const StepIcon = item.icon;

                return (
                  <div key={item.step} className="relative flex items-start gap-4 sm:gap-5">
                    <div
                      className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-xs font-mono ${
                        isPassed
                          ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]"
                          : isCurrent
                          ? "bg-[var(--surface-1)] border-[var(--accent)] text-[var(--accent)] font-bold"
                          : "bg-[var(--surface-2)] border-[var(--hairline)] text-[var(--ink-3)]"
                      }`}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : item.step}
                    </div>

                    <div
                      className={`flex-1 p-3.5 rounded-lg border ${
                        isCurrent
                          ? "bg-[var(--surface-2)] border-[var(--accent)]"
                          : isPassed
                          ? "bg-[var(--surface-2)]/50 border-[var(--hairline)]"
                          : "border-transparent opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2">
                          <StepIcon className="w-4 h-4 text-[var(--accent)]" />
                          <h4 className="font-semibold text-sm text-[var(--ink)]">{item.title}</h4>
                        </div>
                        <span className="text-[11px] font-mono text-[var(--ink-3)]">
                          {isPassed ? "Done" : isCurrent ? "Active" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--ink-2)]">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity History */}
        <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="font-semibold text-base text-[var(--ink)]">
              Status History ({trail.length})
            </h3>
          </div>

          {trail.length === 0 ? (
            <p className="text-xs text-[var(--ink-3)]">No status transitions recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {trail.map((t, idx) => (
                <div
                  key={t.id || idx}
                  className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <StatusPill status={t.toStatus} />
                    <span className="text-[var(--ink-2)]">{t.notes || "Status updated"}</span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--ink-3)] shrink-0 tabular-nums">
                    {new Date(t.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={handleCancelBooking}
        title="Cancel this repair booking?"
        description="Your scheduled pickup will be cancelled. You can place a new booking anytime."
        confirmText="Cancel Booking"
        isDestructive
        isLoading={cancelling}
      />
    </div>
  );
}
