import type { NearbyStore } from "@/hooks/useGeolocation";

interface StoreBadgeProps {
  store: NearbyStore;
  size?: "sm" | "md" | "lg";
}

const TIER_CONFIG = {
  flash: {
    label: "⚡ Flash",
    className: "badge-flash",
    title: "Same-day pickup & delivery",
  },
  "next-day": {
    label: "📦 Next-Day",
    className: "badge-next-day",
    title: "Next-day delivery available",
  },
  "out-of-range": {
    label: "🔜 Coming Soon",
    className: "badge-out-of-range",
    title: "Outside delivery range — walk-in only",
  },
};

export default function StoreBadge({ store, size = "md" }: StoreBadgeProps) {
  const config = TIER_CONFIG[store.tier];

  const sizeClass =
    size === "sm" ? "text-[10px] px-2 py-0.5" :
    size === "lg" ? "text-sm px-4 py-1.5" :
    "text-xs px-3 py-1";

  return (
    <span
      className={`${config.className} ${sizeClass} shrink-0`}
      title={config.title}
    >
      {/* Flash hero — within 3km, show extra emphasis */}
      {store.isFlashHero ? "⚡⚡ Flash — Same Day" : config.label}
    </span>
  );
}
