import type { CSSProperties, HTMLAttributes } from "react";

export type SkeletonVariant = "text" | "circular" | "rectangular";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "rectangular",
  width,
  height,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: "h-4 w-full rounded-md",
    circular: "rounded-full shrink-0",
    rectangular: "rounded-lg",
  };

  const inlineStyles: CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  return (
    <div
      role="status"
      aria-hidden="true"
      className={[
        "relative overflow-hidden bg-[var(--surface-2)] select-none",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-[var(--hairline)] before:to-transparent",
        "motion-reduce:before:hidden motion-reduce:animate-pulse",
        variantStyles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={inlineStyles}
      {...props}
    />
  );
}
