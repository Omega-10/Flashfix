import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuthStore, getRedirectForRole } from "@/store/authStore";
import { isDisposableEmail } from "@flashfix/shared";
import { OtpInput } from "@/components/ui/OtpInput";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, setAuth } = useAuthStore();

  const [step, setStep] = useState<"EMAIL" | "PASSWORD" | "OTP">("EMAIL");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // If already authenticated, redirect to role-specific destination or return path
  useEffect(() => {
    if (isAuthenticated && user) {
      const returnTo = (location.state as any)?.from || getRedirectForRole(user.role);
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location.state]);

  // Display OAuth callback error if present in URL query string
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthErr = params.get("error");
    if (oauthErr) {
      setError(oauthErr);
    }
  }, [location.search]);

  // Timer countdown for OTP resend
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
      setError("Disposable email domains are not allowed. Please use your permanent email.");
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
      setError("Network error while connecting to server. Please check your connection and try again.");
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
          rememberMe,
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
      const dest = (location.state as any)?.from || getRedirectForRole(data.user.role);
      navigate(dest, { replace: true });
    } catch {
      setError("Could not reach the authentication server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e?: React.FormEvent, directCode?: string) {
    if (e) e.preventDefault();
    const code = (directCode ?? otp).trim();

    if (code.length !== 6) {
      setError("Please enter all 6 digits of your verification code.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          rememberMe,
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

      setAuth(data.user, data.token || data.accessToken || "cookie-session");
      const returnTo = (location.state as any)?.from || getRedirectForRole(data.user.role);
      navigate(returnTo, { replace: true });
    } catch {
      setError("Network error while verifying code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center bg-[var(--canvas)] text-[var(--ink)]">
      <div className="w-full max-w-[420px]">
        <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-7 sm:p-8 shadow-sm">
          {/* Header */}
          <div className="mb-7">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent)] font-semibold block mb-1.5">
              FLASHFIX ACCOUNT
            </span>
            <h1 className="text-2xl font-bold font-display tracking-tight text-[var(--ink)]">
              {step === "EMAIL"
                ? "Sign in to Flashfix"
                : step === "PASSWORD"
                ? "Enter your password"
                : "Check your email"}
            </h1>
            <p className="text-sm text-[var(--ink-2)] mt-1">
              {step === "EMAIL"
                ? "Enter your email to track repairs, manage bookings, or access staff operations."
                : step === "PASSWORD"
                ? `Signing in as ${email.trim().toLowerCase()}`
                : `We sent a 6-digit verification code to ${email.trim().toLowerCase()}`}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5 text-xs text-[var(--danger)] font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: EMAIL */}
          {step === "EMAIL" && (
            <form onSubmit={handleIdentify} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="signin-email"
                  className="block text-xs font-medium text-[var(--ink-2)] mb-1.5"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] pointer-events-none" />
                  <input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    required
                    className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-11 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Checking account...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative py-2 flex items-center justify-center">
                <div className="border-t border-[var(--hairline)] w-full" />
                <span className="bg-[var(--surface-1)] px-3 text-[11px] font-mono uppercase tracking-wider text-[var(--ink-3)]">
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

          {/* STEP 2A: STAFF PASSWORD */}
          {step === "PASSWORD" && (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="signin-password"
                    className="block text-xs font-medium text-[var(--ink-2)]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("EMAIL");
                      setPassword("");
                      setError(null);
                    }}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] pointer-events-none" />
                  <input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    autoFocus
                    required
                    className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-10 text-sm text-[var(--ink)] placeholder-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--ink-2)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[var(--hairline)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span>Keep me signed in for 30 days</span>
              </label>

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full h-11 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2B: CONSUMER OTP */}
          {step === "OTP" && (
            <form onSubmit={(e) => handleVerifyOtp(e)} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-[var(--ink-2)] mb-3 text-center">
                  6-digit verification code
                </label>
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
                className="w-full h-11 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-[var(--hairline)]">
                <button
                  type="button"
                  onClick={() => {
                    setStep("EMAIL");
                    setOtp("");
                    setError(null);
                  }}
                  className="text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                >
                  Use a different email
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
                  <span className="text-[var(--ink-3)] font-mono tabular-nums">
                    Resend in {timer}s
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-5 text-xs text-[var(--ink-3)]">
          Need assistance with a booking?{" "}
          <Link to="/flashfix/contact" className="text-[var(--accent)] hover:underline font-medium">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
