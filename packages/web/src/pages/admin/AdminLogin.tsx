import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, ArrowRight, Eye, EyeOff, Building2, Wrench, Bike, Globe } from "lucide-react";
import { adminLogin } from "@/components/admin/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await adminLogin(email, password);
      // Route user according to verified role
      switch (session.user.role) {
        case "SUPER_ADMIN":
          navigate("/admin/superadmin");
          break;
        case "ADMIN":
          navigate("/admin/dashboard");
          break;
        case "TECHNICIAN":
          navigate("/admin/technician");
          break;
        case "COURIER":
        case "EMPLOYEE":
          navigate("/admin/delivery");
          break;
        default:
          navigate("/admin/dashboard");
          break;
      }
    } catch (err: any) {
      setError(err?.message || "Invalid staff credentials. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFill(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-[#070707] text-[#f5f0eb] flex flex-col justify-center items-center px-4 py-12 selection:bg-[#ef8f0b]/30 selection:text-[#ef8f0b]">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_20%,#ef8f0b_0%,transparent_60%)]" />

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ef8f0b] to-[#d87c09] text-black font-bold text-2xl shadow-xl shadow-[#ef8f0b]/20 mb-4">
            ⚡
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="font-extrabold text-xl tracking-wider text-white">FLASHFIX</span>
            <span className="font-mono text-xs uppercase tracking-widest bg-[#ef8f0b]/15 text-[#ef8f0b] px-2 py-0.5 rounded border border-[#ef8f0b]/30 font-bold">
              OPS CONSOLE
            </span>
          </div>
          <p className="text-xs text-[#807a75] font-mono">
            Staff, Technician & Executive Operations
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-lg font-bold text-[#f5f0eb] mb-1 font-display">Staff Authentication</h2>
          <p className="text-xs text-[#807a75] mb-6">
            Enter your credentials to access operations dashboard & dispatch management.
          </p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5 text-base">⚠️</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#807a75] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@flashfix.in"
                  required
                  className="w-full bg-[#181818] border border-[rgba(255,255,255,0.08)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#f5f0eb] placeholder-[#555] outline-none focus:border-[#ef8f0b] focus:ring-1 focus:ring-[#ef8f0b] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#807a75] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#807a75] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#181818] border border-[rgba(255,255,255,0.08)] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#f5f0eb] placeholder-[#555] outline-none focus:border-[#ef8f0b] focus:ring-1 focus:ring-[#ef8f0b] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#807a75] hover:text-[#f5f0eb] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] mt-2 bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-sm rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#ef8f0b]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Ops Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Credential Presets for instant testing */}
          <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.06)]">
            <p className="text-[11px] font-mono text-[#807a75] uppercase tracking-wider mb-2.5">
              Quick Role Login (Pre-configured Staff):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill("superadmin@flashfix.in", "Admin@123")}
                className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#202020] border border-[rgba(255,255,255,0.06)] hover:border-[#ef8f0b]/40 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 font-bold text-[#f5f0eb]">
                  <Globe className="w-3.5 h-3.5 text-[#ef8f0b]" />
                  <span>Super Admin</span>
                </div>
                <div className="text-[10px] text-[#807a75] truncate mt-0.5">All Stores Platform</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("admin@flashfix.in", "Admin@123")}
                className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#202020] border border-[rgba(255,255,255,0.06)] hover:border-[#ef8f0b]/40 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 font-bold text-[#f5f0eb]">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Store Admin</span>
                </div>
                <div className="text-[10px] text-[#807a75] truncate mt-0.5">Multi-Store Manager</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("tech@flashfix.in", "Tech@123")}
                className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#202020] border border-[rgba(255,255,255,0.06)] hover:border-[#ef8f0b]/40 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 font-bold text-[#f5f0eb]">
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Technician</span>
                </div>
                <div className="text-[10px] text-[#807a75] truncate mt-0.5">Lab Diagnostics</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill("rider@flashfix.in", "Rider@123")}
                className="p-2.5 rounded-xl bg-[#181818] hover:bg-[#202020] border border-[rgba(255,255,255,0.06)] hover:border-[#ef8f0b]/40 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 font-bold text-[#f5f0eb]">
                  <Bike className="w-3.5 h-3.5 text-amber-400" />
                  <span>Delivery Rider</span>
                </div>
                <div className="text-[10px] text-[#807a75] truncate mt-0.5">Doorstep Partner</div>
              </button>
            </div>
          </div>
        </div>

        {/* Back to consumer website */}
        <div className="text-center mt-6">
          <Link
            to="/flashfix"
            className="text-xs text-[#807a75] hover:text-[#ef8f0b] font-mono transition-colors inline-flex items-center gap-1.5"
          >
            <span>← Return to Flashfix Customer Website</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
