import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Local YYYY-MM-DD (avoids UTC shift from toISOString) */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** How many days ahead (from today) can be booked. */
  maxDaysAhead?: number;
}

export default function DatePicker({ value, onChange, maxDaysAhead = 60 }: DatePickerProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxDaysAhead);
    return d;
  }, [today, maxDaysAhead]);

  const selected = parseLocalISODate(value);
  const [view, setView] = useState(() => {
    const base = selected && selected >= today ? selected : today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const canPrev = view > new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = new Date(view.getFullYear(), view.getMonth() + 1, 1) <= maxDate;

  // Monday-first grid
  const firstWeekday = (view.getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];

  const monthLabel = view.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-bg)] p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => canPrev && setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          disabled={!canPrev}
          aria-label="Previous month"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{monthLabel}</span>
        <button
          type="button"
          onClick={() => canNext && setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          disabled={!canNext}
          aria-label="Next month"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[10px] font-mono uppercase text-center text-[var(--text-muted)] py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = toLocalISODate(d);
          const disabled = d < today || d > maxDate;
          const isSelected = value === iso;
          const isToday = d.getTime() === today.getTime();
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              aria-pressed={isSelected}
              aria-label={d.toDateString()}
              className={`h-9 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-[var(--accent)] text-[var(--accent-ink)] font-semibold"
                  : disabled
                  ? "text-[var(--text-muted)] opacity-35 cursor-not-allowed line-through decoration-transparent"
                  : `text-[var(--text-primary)] hover:bg-[var(--accent-amber-soft)] hover:text-[var(--accent)] ${
                      isToday ? "ring-1 ring-inset ring-[var(--accent)]" : ""
                    }`
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
