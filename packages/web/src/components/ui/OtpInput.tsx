import { useEffect, useRef } from "react";
import type { ChangeEvent, KeyboardEvent, ClipboardEvent } from "react";

export interface OtpInputProps {
  length?: number;
  value?: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function OtpInput({
  length = 6,
  value = "",
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  autoFocus = true,
  className = "",
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Array of single-char digits padded up to length
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    // Extract only digits
    const cleanDigits = rawVal.replace(/\D/g, "");

    if (cleanDigits.length === 0) {
      // Cleared
      const newDigits = [...digits];
      newDigits[index] = "";
      const newCode = newDigits.join("");
      onChange(newCode);
      return;
    }

    if (cleanDigits.length > 1) {
      // Pasted multiple digits into single input
      handlePastedCode(cleanDigits);
      return;
    }

    // Single digit input
    const char = cleanDigits[cleanDigits.length - 1];
    const newDigits = [...digits];
    newDigits[index] = char;
    const newCode = newDigits.join("");
    onChange(newCode);

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.length === length && !newDigits.includes("")) {
      onComplete?.(newCode);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Current empty, clear previous and focus it
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        const newCode = newDigits.join("");
        onChange(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePastedCode = (pasted: string) => {
    const clean = pasted.replace(/\D/g, "").slice(0, length);
    if (!clean) return;

    onChange(clean);

    const nextIndex = Math.min(clean.length, length - 1);
    inputRefs.current[nextIndex]?.focus();

    if (clean.length === length) {
      onComplete?.(clean);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    handlePastedCode(pastedData);
  };

  return (
    <div
      role="group"
      aria-label="Verification code input"
      className={`flex items-center justify-center gap-2 sm:gap-3 ${className}`}
    >
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digits[index]}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={hasError ? "true" : undefined}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            "w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-semibold rounded-lg select-all",
            "bg-[var(--surface-2)] text-[var(--ink)] tabular-nums transition-colors",
            "border border-[var(--hairline)]",
            "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
            hasError ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]" : "",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-text",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}
