import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] max-w-lg mx-auto ${className}`}
    >
      {icon && (
        <div className="mb-4 text-[var(--ink-muted)] flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-semibold text-[var(--ink)] tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-xs sm:text-sm text-[var(--ink-secondary)] leading-relaxed max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex items-center justify-center">{action}</div>}
    </div>
  );
}
