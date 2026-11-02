import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { adminLogin } from "@/components/admin/api";
import { StaffSessionUser } from "@/components/admin/types";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useThemeSync } from "@/hooks/useThemeSync";

interface AdminLoginProps {
  onSuccess?: (user: StaffSessionUser) => void;
}

export function getStaffHomeRoute(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/superadmin";
    case "ADMIN":
      return "/admin/dashboard";
    case "TECHNICIAN":
      return "/admin/technician";
    case "EMPLOYEE":
      return "/admin/delivery";
    default:
      return "/admin/dashboard";
  }
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  useThemeSync();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your staff email and password.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const session = await adminLogin(cleanEmail, password);
      if (onSuccess) {
        onSuccess(session.user);
      }
      navigate(getStaffHomeRoute(session.user.role), { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid staff credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-shell relative min-h-screen px-4 py-16 flex items-center justify-center bg-[var(--canvas)] text-[var(--ink)] transition-colors duration-300">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[400px]">
        <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-7 sm:p-8 shadow-lg">
          <div className="mb-7">
            <div className="flex items-center justify-between mb-3">
              <span className="heading-flashfix text-xl tracking-[0.12em] text-[var(--ink)]">
                FLASH<span className="text-[#ef8f0b]">FIX</span>
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#ef8f0b]/15 text-[#ef8f0b] border border-[#ef8f0b]/30">
                Staff Portal
              </span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
              Staff sign in
            </h1>
            <p className="text-xs text-[var(--ink-secondary)] mt-1">
              Your workspace opens automatically based on your role.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5 text-xs text-red-400 font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="staff-email"
                className="block text-xs font-medium text-[var(--ink-secondary)] mb-1.5"
              >
                Staff email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
                <input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@flashfix.in"
                  autoComplete="email"
                  autoFocus
                  required
                  className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-3.5 text-sm text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[#ef8f0b] focus:ring-1 focus:ring-[#ef8f0b] transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="staff-password"
                className="block text-xs font-medium text-[var(--ink-secondary)] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full h-11 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg pl-10 pr-10 text-sm text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[#ef8f0b] focus:ring-1 focus:ring-[#ef8f0b] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)] p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full h-11 bg-[#ef8f0b] hover:brightness-105 text-[var(--accent-ink)] font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
