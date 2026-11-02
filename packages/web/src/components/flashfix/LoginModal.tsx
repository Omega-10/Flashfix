import React, { useState, useEffect } from "react";
import { X, Mail, ShieldCheck, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { useAuthStore, UserProfile } from "@/store/authStore";
import { isDisposableEmail } from "@flashfix/shared";
import { OtpInput } from "@/components/ui/OtpInput";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: UserProfile) => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (step === "OTP" && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            setCanResend(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timer]);

  useEffect(() => {
    if (isOpen) {
      setStep("EMAIL");
      setOtp("");
      setError(null);
      setLoading(false);
      setTimer(60);
      setCanResend(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function extractErrorMessage(res: Response, resText: string, data: any): string {
    if (data?.error?.code === "DISPOSABLE_EMAIL_NOT_ALLOWED" || data?.error?.message?.includes("disposable")) {
      return "Disposable email domains are not allowed. Please enter your personal or work email.";
    }
    if (data?.error?.message) return data.error.message;
    if (data?.message) return data.message;
    if (typeof data?.error === "string") return data.error;

    const trimmed = (resText || "").trim();
    if (trimmed && !trimmed.startsWith("<")) {
      return `Request failed (${res.status}): ${trimmed.slice(0, 140)}`;
    }
    return `Unable to complete sign-in (${res.status}). Please try again.`;
  }

  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (isDisposableEmail(cleanEmail)) {
      setError("Disposable email domains are not allowed. Please use a permanent email.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: cleanEmail }),
      });

      const resText = await res.text();
      let data: any = null;
      try {
        data = resText ? JSON.parse(resText) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        setError(extractErrorMessage(res, resText, data));
        return;
      }

      setStep("OTP");
      setOtp("");
      setTimer(60);
      setCanResend(false);
    } catch {
      setError("Network error while connecting to server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e?: React.FormEvent, directCode?: string) {
    if (e) e.preventDefault();
    const code = (directCode ?? otp).trim();

    if (code.length !== 6) {
      setError("Please enter all 6 digits of the verification code.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, rememberMe: true }),
      });

      const resText = await res.text();
      let data: any = null;
      try {
        data = resText ? JSON.parse(resText) : null;
      } catch {
        data = null;
      }

      if (!res.ok || !data?.user) {
        setError(extractErrorMessage(res, resText, data));
        return;
      }

      const token = data.token || data.accessToken || "cookie-session";
      const user: UserProfile = data.user;

      setAuth(user, token);
      if (onSuccess) onSuccess(user);
      onClose();
    } catch {
      setError("Network error while verifying code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-md bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl shadow-2xl p-6 sm:p-8 text-[var(--ink)]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent)] font-semibold block mb-1">
            FLASHFIX ACCOUNT
          </span>
          <h3 className="font-display font-bold text-xl text-[var(--ink)]">
            {step === "EMAIL" ? "Sign in to continue" : "Enter verification code"}
          </h3>
          <p className="text-xs text-[var(--ink-secondary)] mt-1">
            {step === "EMAIL"
              ? "Sign in with your email to link your booking and track repair status."
              : `Code sent to ${email.trim().toLowerCase()}`}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-[var(--danger)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "EMAIL" && (
          <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-secondary)] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  autoFocus
                  required
                  className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-4 text-sm text-[var(--ink)] placeholder-[var(--ink-muted)] outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold rounded-lg px-5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Send One-Time Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="relative py-1.5 flex items-center justify-center">
              <div className="border-t border-[var(--hairline)] w-full" />
              <span className="bg-[var(--surface-1)] px-3 text-[11px] font-mono uppercase tracking-wider text-[var(--ink-muted)]">
                or
              </span>
              <div className="border-t border-[var(--hairline)] w-full" />
            </div>

            <a
              href="/api/auth/google"
              className="w-full h-11 bg-[var(--surface-2)] hover:bg-[var(--surface-1)] border border-[var(--hairline)] text-[var(--ink)] font-medium text-sm rounded-lg flex items-center justify-center gap-2.5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>
          </form>
        )}

        {step === "OTP" && (
          <form onSubmit={(e) => handleVerifyOtp(e)} className="space-y-5">
            <div>
              <OtpInput
                value={otp}
                onChange={setOtp}
                onComplete={(code) => handleVerifyOtp(undefined, code)}
                disabled={loading}
                hasError={!!error}
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold rounded-lg px-5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Continue</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] pt-2 border-t border-[var(--hairline)]">
              <button
                type="button"
                onClick={() => {
                  setStep("EMAIL");
                  setOtp("");
                  setError(null);
                }}
                className="text-[var(--ink-secondary)] hover:text-[var(--ink)]"
              >
                Change email
              </button>
              {canResend ? (
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  className="text-[var(--accent)] hover:underline font-medium"
                >
                  Resend code
                </button>
              ) : (
                <span className="font-mono tabular-nums">Resend in {timer}s</span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
