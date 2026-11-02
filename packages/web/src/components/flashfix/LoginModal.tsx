import React, { useState, useEffect } from "react";
import { X, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
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
  const [step, setStep] = useState<"EMAIL" | "PASSWORD" | "OTP">("EMAIL");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setPassword("");
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
      return "Disposable email domains are not allowed. Please enter your work or personal email.";
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

  async function handleIdentify(e?: React.FormEvent) {
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
      const res = await fetch("/api/auth/identify", {
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

      if (data?.next === "password") {
        setStep("PASSWORD");
      } else {
        setStep("OTP");
        setOtp("");
        setTimer(60);
        setCanResend(false);
      }
    } catch {
      setError("Network error while connecting to server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          rememberMe: true,
        }),
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

      setAuth(data.user, data.token || "cookie-session");
      if (onSuccess) onSuccess(data.user);
      onClose();
    } catch {
      setError("Network error while signing in. Please try again.");
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
          className="absolute top-5 right-5 p-1.5 rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent)] font-semibold block mb-1">
            FLASHFIX ACCOUNT
          </span>
          <h3 className="font-display font-bold text-xl text-[var(--ink)]">
            {step === "EMAIL"
              ? "Sign in to continue"
              : step === "PASSWORD"
              ? "Enter your password"
              : "Enter verification code"}
          </h3>
          <p className="text-xs text-[var(--ink-2)] mt-1">
            {step === "EMAIL"
              ? "Sign in with your email to link your booking and track repair status."
              : step === "PASSWORD"
              ? `Signing in as ${email.trim().toLowerCase()}`
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
          <form onSubmit={handleIdentify} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-2)] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-3)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  autoFocus
                  required
                  className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-4 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] outline-none focus:border-[var(--accent)] transition-colors"
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
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {step === "PASSWORD" && (
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-[var(--ink-2)]">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("EMAIL");
                    setPassword("");
                    setError(null);
                  }}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Change email
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                  required
                  className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-10 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold rounded-lg px-5 text-sm transition-all disabled:opacity-40"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Sign In</span>}
            </button>
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

            <div className="flex items-center justify-between text-xs text-[var(--ink-3)] pt-2 border-t border-[var(--hairline)]">
              <button
                type="button"
                onClick={() => {
                  setStep("EMAIL");
                  setOtp("");
                  setError(null);
                }}
                className="text-[var(--ink-2)] hover:text-[var(--ink)]"
              >
                Change email
              </button>
              {canResend ? (
                <button
                  type="button"
                  onClick={() => handleIdentify()}
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
