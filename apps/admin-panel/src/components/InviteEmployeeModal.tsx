import { useState } from "react";
import { X, UserPlus, Mail, AlertCircle } from "lucide-react";
import { inviteTeamMember, STORES } from "../api";
import { StaffMember } from "../types";

interface InviteEmployeeModalProps {
  onClose: () => void;
  onInvited: (staff: StaffMember) => void;
}

export default function InviteEmployeeModal({
  onClose,
  onInvited,
}: InviteEmployeeModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [storeId, setStoreId] = useState(STORES[0]?.id || "store-001");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const invited = await inviteTeamMember({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        storeId,
      });
      onInvited(invited);
      onClose();
    } catch {
      setError("Failed to dispatch employee invitation. Please retry.");
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
                Invite Team Operative
              </h3>
              <p className="text-[10px] text-[#807a75]">
                Dispatches Brevo email onboarding invitation
              </p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
              Full Legal Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              required
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3.5 py-2.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
              Company / Official Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#807a75]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@flashfix.in"
                required
                className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
                Access Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "EMPLOYEE" | "ADMIN")}
                className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b] cursor-pointer"
              >
                <option value="EMPLOYEE">EMPLOYEE (Field/Tech)</option>
                <option value="ADMIN">ADMIN (Store Lead)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#807a75] block mb-1.5">
                Assigned Store Hub
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[#f5f0eb] outline-none focus:border-[#ef8f0b] cursor-pointer"
              >
                {STORES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[10px] text-[#807a75] leading-relaxed pt-1">
            An automated credentials invitation will be sent to the employee. They can sign in using one-time verification.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] text-xs text-[#807a75] hover:text-[#f5f0eb] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-[#ef8f0b] hover:bg-[#d87c09] text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#ef8f0b]/20 disabled:opacity-40"
            >
              {submitting ? "Sending Invite..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
