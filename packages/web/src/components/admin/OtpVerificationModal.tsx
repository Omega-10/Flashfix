import { useState, useRef, useEffect } from "react";
import { X, KeyRound, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { verifyPickupOtp, verifyCustodyOtp } from "./api";

interface OtpVerificationModalProps {
  config: {
    bookingId: string;
    purpose: "PICKUP" | "CUSTODY";
    title: string;
    description: string;
    onSuccess: () => void;
  } | null;
  onClose: () => void;
}

export default function OtpVerificationModal({
  config,
  onClose,
}: OtpVerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (config) {
      setDigits(["", "", "", "", "", ""]);
      setError(null);
      setSuccess(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [config]);

  if (!config) return null;

  const fullCode = digits.join("");

  function handleChange(idx: number, val: string) {
    if (!/^\d*$/.test(val)) return;

    const newDigits = [...digits];
    if (val.length > 1) {
      // Pasted full code
      const pasted = val.slice(0, 6).split("");
      pasted.forEach((char, i) => {
        newDigits[i] = char;
      });
      setDigits(newDigits);
      inputRefs.current[Math.min(5, pasted.length)]?.focus();
      return;
    }

    newDigits[idx] = val;
    setDigits(newDigits);

    if (val && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  async function handleVerify(codeToTest?: string) {
    const code = codeToTest || fullCode;
    const currentConfig = config;
    if (!currentConfig) return;

    if (code.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let result;
      if (currentConfig.purpose === "PICKUP") {
        result = await verifyPickupOtp(currentConfig.bookingId, code);
      } else {
        result = await verifyCustodyOtp(currentConfig.bookingId, code);
      }

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          currentConfig.onSuccess();
          onClose();
        }, 600);
      } else {
        setError(result.error || "Verification failed. Invalid code.");
      }
    } catch {
      setError("Verification failed due to a server error. Please retry.");
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
      <div className="relative z-10 w-full max-w-md bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl p-6 text-[#f5f0eb]">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#ef8f0b]/10 text-[#ef8f0b] border border-[#ef8f0b]/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#f5f0eb]">
                {config.title}
              </h3>
              <span className="font-mono text-[10px] text-[#ef8f0b]">
                {config.bookingId} • Two-Factor Handover
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#807a75] hover:text-[#f5f0eb] hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#a8a09a] mb-5 leading-relaxed">
          {config.description}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Code verified successfully! Status transitioning...</span>
          </div>
        )}

        {/* 6-Digit Pin Input */}
        <div className="flex items-center justify-between gap-2 mb-6">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="min-h-[48px] w-12 text-center text-lg font-mono font-bold bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] rounded-xl text-[#f5f0eb] outline-none focus:border-[#ef8f0b] focus:ring-2 focus:ring-[#ef8f0b]/20 transition-all"
            />
          ))}
        </div>

        {/* Verification Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 px-4 py-2 text-xs font-medium text-[#807a75] hover:text-[#f5f0eb] rounded-xl border border-[rgba(255,255,255,0.08)] hover:bg-[#1a1a1a]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || fullCode.length < 6}
            onClick={() => handleVerify()}
            className="min-h-[44px] flex-1 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#ef8f0b]/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{submitting ? "Verifying..." : "Verify Code"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
