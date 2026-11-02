import { createContext, forwardRef, useContext, useId } from "react";
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldContextValue {
  id: string;
  error?: string;
  helper?: string;
  hasError: boolean;
  required?: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function useFieldContext() {
  return useContext(FieldContext);
}

export interface FieldProps {
  id?: string;
  label?: ReactNode;
  helper?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  id: explicitId,
  label,
  helper,
  error,
  required,
  className = "",
  children,
}: FieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const hasError = Boolean(error);

  return (
    <FieldContext.Provider
      value={{
        id,
        error,
        helper: typeof helper === "string" ? helper : undefined,
        hasError,
        required,
      }}
    >
      <div className={`flex flex-col w-full ${className}`}>
        {label && <FieldLabel>{label}</FieldLabel>}
        {children}
        {error ? (
          <FieldError>{error}</FieldError>
        ) : helper ? (
          <FieldHelper>{helper}</FieldHelper>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function FieldLabel({ children, className = "", ...props }: FieldLabelProps) {
  const ctx = useFieldContext();
  return (
    <label
      htmlFor={ctx?.id}
      className={`block text-xs font-medium text-[var(--ink-secondary)] mb-1.5 select-none ${className}`}
      {...props}
    >
      {children}
      {ctx?.required && <span className="text-[var(--danger)] ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error: explicitError, id: explicitId, ...props }, ref) => {
    const ctx = useFieldContext();
    const id = explicitId || ctx?.id;
    const isError = explicitError ?? ctx?.hasError;

    const describedBy = [
      ctx?.helper ? `${id}-helper` : null,
      ctx?.error ? `${id}-error` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <input
        ref={ref}
        id={id}
        aria-invalid={isError ? "true" : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          "w-full h-10 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px]",
          "bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-muted)]",
          "border border-[var(--hairline)]",
          "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
          isError ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]" : "",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error: explicitError, id: explicitId, rows = 3, ...props }, ref) => {
    const ctx = useFieldContext();
    const id = explicitId || ctx?.id;
    const isError = explicitError ?? ctx?.hasError;

    const describedBy = [
      ctx?.helper ? `${id}-helper` : null,
      ctx?.error ? `${id}-error` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={isError ? "true" : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          "w-full px-3 py-2 text-sm rounded-lg transition-colors",
          "bg-[var(--surface-2)] text-[var(--ink)] placeholder:text-[var(--ink-muted)]",
          "border border-[var(--hairline)]",
          "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
          isError ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]" : "",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error: explicitError, id: explicitId, children, ...props }, ref) => {
    const ctx = useFieldContext();
    const id = explicitId || ctx?.id;
    const isError = explicitError ?? ctx?.hasError;

    const describedBy = [
      ctx?.helper ? `${id}-helper` : null,
      ctx?.error ? `${id}-error` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          id={id}
          aria-invalid={isError ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          className={[
            "w-full h-10 px-3 py-2 pr-9 text-sm rounded-lg transition-colors appearance-none min-h-[44px]",
            "bg-[var(--surface-2)] text-[var(--ink)]",
            "border border-[var(--hairline)]",
            "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
            isError ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]" : "",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          ]
            .filter(Boolean)
          .join(" ")}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--ink-secondary)]">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";

export function FieldHelper({ children, className = "", id: explicitId }: { children: ReactNode; className?: string; id?: string }) {
  const ctx = useFieldContext();
  const id = explicitId || (ctx?.id ? `${ctx.id}-helper` : undefined);
  return (
    <p id={id} className={`text-xs text-[var(--ink-muted)] mt-1.5 ${className}`}>
      {children}
    </p>
  );
}

export function FieldError({ children, className = "", id: explicitId }: { children: ReactNode; className?: string; id?: string }) {
  const ctx = useFieldContext();
  const id = explicitId || (ctx?.id ? `${ctx.id}-error` : undefined);
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={`text-xs text-[var(--danger)] font-medium mt-1.5 flex items-center gap-1 ${className}`}
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

Field.Label = FieldLabel;
Field.Input = Input;
Field.Textarea = Textarea;
Field.Select = Select;
Field.Helper = FieldHelper;
Field.Error = FieldError;
