import { useState } from "react";
import { X, UserPlus, AlertCircle, Building2, Shield } from "lucide-react";
import { STORES, inviteTeamMember } from "./api";

interface InviteEmployeeModalProps {
  onClose: () => void;
  onInvited: () => void;
}

export default function InviteEmployeeModal({
  onClose,
  onInvited,
}: InviteEmployeeModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "TECHNICIAN" | "ADMIN">("EMPLOYEE");
  const [storeId, setStoreId] = useState(STORES[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please provide both name and corporate email.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await inviteTeamMember({
        name: name.trim(),
        email: email.trim(),
        role,
        storeId,
      });
      onInvited();
      onClose();
    } catch {
      setError("Failed to invite staff member. Please check details.");
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
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#f5f0eb]">
                Provision Staff Member
              </h3>
              <span className="text-[10px] text-[#807a75]">
                Invite operative or store admin to Flashfix hub
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

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rohith Kumar"
              className="min-h-[44px] w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rohith.kumar@flashfix.in"
              className="min-h-[44px] w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#ef8f0b]" />
              <span>Role Permissions</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "EMPLOYEE" | "TECHNICIAN" | "ADMIN")}
              className="min-h-[44px] w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none cursor-pointer focus:border-[#ef8f0b]"
            >
              <option value="EMPLOYEE">EMPLOYEE (Delivery Rider)</option>
              <option value="TECHNICIAN">TECHNICIAN (Lab Workbench)</option>
              <option value="ADMIN">ADMIN (Store Hub Operations Manager)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#ef8f0b]" />
              <span>Assigned Store Hub</span>
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="min-h-[44px] w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none cursor-pointer focus:border-[#ef8f0b]"
            >
              {STORES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-[#807a75] hover:text-[#f5f0eb]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#ef8f0b]/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{submitting ? "Sending..." : "Send Invitation"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
