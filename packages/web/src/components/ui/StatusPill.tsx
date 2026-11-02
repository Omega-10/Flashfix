import type { BookingStatus } from "@flashfix/shared";

export type StatusPillSize = "sm" | "md";

export interface StatusPillProps {
  status: BookingStatus | string;
  label?: string;
  size?: StatusPillSize;
  className?: string;
}

interface StatusConfig {
  label: string;
  dotColor: string;
  badgeStyle: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  PENDING: {
    label: "Pending assignment",
    dotColor: "bg-[var(--warning)]",
    badgeStyle: "bg-[var(--warning)]/10 text-[var(--ink)] border-[var(--warning)]/20",
  },
  CONFIRMED: {
    label: "Confirmed",
    dotColor: "bg-[var(--success)]",
    badgeStyle: "bg-[var(--success)]/10 text-[var(--ink)] border-[var(--success)]/20",
  },
  PICKUP_EN_ROUTE: {
    label: "Pickup en route",
    dotColor: "bg-[var(--warning)]",
    badgeStyle: "bg-[var(--warning)]/10 text-[var(--ink)] border-[var(--warning)]/20",
  },
  PICKUP_OTP_SENT: {
    label: "Pickup OTP sent",
    dotColor: "bg-[var(--warning)]",
    badgeStyle: "bg-[var(--warning)]/10 text-[var(--ink)] border-[var(--warning)]/20",
  },
  IN_TRANSIT: {
    label: "In transit to lab",
    dotColor: "bg-[var(--warning)]",
    badgeStyle: "bg-[var(--warning)]/10 text-[var(--ink)] border-[var(--warning)]/20",
  },
  CUSTODY_OTP_SENT: {
    label: "Custody OTP sent",
    dotColor: "bg-[var(--info)]",
    badgeStyle: "bg-[var(--info)]/10 text-[var(--ink)] border-[var(--info)]/20",
  },
  IN_REPAIR: {
    label: "In repair",
    dotColor: "bg-[var(--info)]",
    badgeStyle: "bg-[var(--info)]/10 text-[var(--ink)] border-[var(--info)]/20",
  },
  REPAIR_COMPLETE: {
    label: "Repair complete",
    dotColor: "bg-[var(--success)]",
    badgeStyle: "bg-[var(--success)]/10 text-[var(--ink)] border-[var(--success)]/20",
  },
  RETURN_EN_ROUTE: {
    label: "Return en route",
    dotColor: "bg-[var(--warning)]",
    badgeStyle: "bg-[var(--warning)]/10 text-[var(--ink)] border-[var(--warning)]/20",
  },
  DELIVERED: {
    label: "Delivered",
    dotColor: "bg-[var(--success)]",
    badgeStyle: "bg-[var(--success)]/10 text-[var(--ink)] border-[var(--success)]/20",
  },
  CANCELLED: {
    label: "Cancelled",
    dotColor: "bg-[var(--danger)]",
    badgeStyle: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20",
  },
};

const defaultConfig: StatusConfig = {
  label: "Unknown",
  dotColor: "bg-[var(--ink-muted)]",
  badgeStyle: "bg-[var(--surface-2)] text-[var(--ink-secondary)] border-[var(--hairline)]",
};

export function StatusPill({
  status,
  label: explicitLabel,
  size = "md",
  className = "",
}: StatusPillProps) {
  const normalizedKey = status.toUpperCase();
  const config = statusConfigs[normalizedKey] || defaultConfig;
  const displayText = explicitLabel || config.label;

  const sizeClasses =
    size === "sm"
      ? "text-[11px] py-0.5 px-2 gap-1.5"
      : "text-xs py-1 px-2.5 gap-2";

  return (
    <span
      className={[
        "inline-flex items-center font-medium rounded-full border select-none transition-colors",
        config.badgeStyle,
        sizeClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor}`}
        aria-hidden="true"
      />
      <span className="truncate">{displayText}</span>
    </span>
  );
}
