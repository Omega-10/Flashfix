import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Smartphone,
  Edit3,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  LogOut,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import LoginModal from "@/components/flashfix/LoginModal";
import { SavedAddress, BookingStatus } from "@flashfix/shared";
import { StatusPill } from "@/components/ui/StatusPill";

interface BookingItem {
  id: string;
  brand: string;
  deviceModel: string;
  issueType: string;
  status: BookingStatus;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  createdAt: string | Date;
  estimatedCostPaise?: number | null;
  finalCostPaise?: number | null;
}

export default function Profile() {
  const { user, isAuthenticated, logout, updateUser, initAuth } = useAuthStore();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Profile edit state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Saved addresses state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("Home");
  const [newAddressText, setNewAddressText] = useState("");
  const [newAddressLandmark, setNewAddressLandmark] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      fetchBookings();
      fetchAddresses();
    }
  }, [user]);

  function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("accessToken");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token && token !== "cookie-session") {
      headers.Authorization = `Bearer ${token}`;
    }
    if (user?.email) {
      headers["x-user-email"] = user.email;
    }
    return headers;
  }

  async function fetchBookings() {
    setLoadingBookings(true);
    try {
      const res = await fetch("/api/bookings/mine", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (Array.isArray(data?.data) || Array.isArray(data))) {
        setBookings(data.data || data);
      } else {
        setBookings([]);
      }
    } catch {
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }

  async function fetchAddresses() {
    setLoadingAddresses(true);
    try {
      const res = await fetch("/api/account/addresses", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (Array.isArray(data?.data) || Array.isArray(data))) {
        setAddresses(data.data || data);
      } else {
        setAddresses([]);
      }
    } catch {
      setAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setProfileError(null);

    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: user?.email,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setProfileError(data?.error?.message || "Failed to update profile.");
        return;
      }

      if (data?.token) {
        localStorage.setItem("accessToken", data.token);
      }

      updateUser({ name: name.trim(), phone: phone.trim() });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setProfileError("Network error while saving profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddressText.trim()) return;
    setAddressError(null);

    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          label: newAddressLabel,
          address: newAddressText.trim(),
          landmark: newAddressLandmark.trim() || undefined,
          isDefault: addresses.length === 0,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAddressError(data?.error?.message || "Could not save address.");
        return;
      }

      const savedAddr = data?.data || data;
      if (savedAddr) {
        setAddresses((prev) => [savedAddr, ...prev]);
      } else {
        await fetchAddresses();
      }
      setNewAddressText("");
      setNewAddressLandmark("");
      setIsAddingAddress(false);
    } catch {
      setAddressError("Network error while saving address.");
    }
  }

  async function handleDeleteAddress(id: string) {
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // ignore
    }
  }

  function formatCost(estimated?: number | null, finalCost?: number | null): string {
    const val = finalCost ?? estimated;
    if (typeof val === "number" && val > 0) {
      return `₹${(val / 100).toLocaleString("en-IN")}`;
    }
    return "Quote pending";
  }

  const activeBookings = bookings.filter(
    (b) => b.status !== "DELIVERED" && b.status !== "CANCELLED"
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "DELIVERED" || b.status === "CANCELLED"
  );

  if (!isAuthenticated || !user) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
        <div className="section-container max-w-lg text-center">
          <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-10 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[var(--accent-soft)] border border-[var(--hairline-strong)] flex items-center justify-center mx-auto mb-5 text-[var(--accent)]">
              <User className="w-7 h-7" />
            </div>
            <h1 className="font-display font-bold text-2xl mb-2">My Account</h1>
            <p className="text-sm text-[var(--ink-2)] mb-7 leading-relaxed">
              Sign in to view your repair history, track active bookings in real time, and manage your saved pickup addresses.
            </p>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold rounded-lg px-7 py-3 text-sm transition-all"
            >
              Sign In to Your Account
            </button>
          </div>
        </div>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="pt-28 pb-24 min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="section-container max-w-5xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--accent)] font-semibold block mb-1">
              CUSTOMER ACCOUNT
            </span>
            <h1 className="font-display font-bold text-3xl">My Account & Bookings</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/flashfix/book"
              className="inline-flex items-center gap-2 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] text-xs font-semibold rounded-lg px-5 py-2.5 transition-all"
            >
              <Wrench className="w-3.5 h-3.5" />
              Book a Repair
            </Link>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 border border-[var(--hairline)] hover:border-red-500/40 hover:text-[var(--danger)] text-xs text-[var(--ink-2)] font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-6 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-[var(--success)]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Profile details updated.</span>
          </div>
        )}

        {profileError && (
          <div className="mb-6 p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-[var(--danger)]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Account Details & Saved Addresses */}
          <div className="space-y-6">
            {/* Account Card */}
            <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[var(--accent-soft)] border border-[var(--hairline-strong)] flex items-center justify-center text-base font-bold text-[var(--accent)]">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <h2 className="font-semibold text-base text-[var(--ink)]">
                      {user.name || user.email.split("@")[0]}
                    </h2>
                    <span className="text-xs text-[var(--ink-3)] font-mono">
                      {user.email}
                    </span>
                  </div>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--ink-2)] block mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-10 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--ink-2)] block mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91..."
                      className="w-full h-10 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-lg px-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 rounded-lg border border-[var(--hairline)] text-xs text-[var(--ink-2)] hover:text-[var(--ink)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2.5 pt-3 border-t border-[var(--hairline)] text-xs">
                  <div className="flex items-center gap-2.5 text-[var(--ink-2)]">
                    <Mail className="w-4 h-4 text-[var(--ink-3)] shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[var(--ink-2)]">
                    <Phone className="w-4 h-4 text-[var(--ink-3)] shrink-0" />
                    <span>{user.phone || "No phone number added"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Saved Addresses Section */}
            <div className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--accent)]" />
                  <h3 className="font-semibold text-sm text-[var(--ink)]">
                    Saved Addresses
                  </h3>
                </div>
                {!isAddingAddress && (
                  <button
                    onClick={() => setIsAddingAddress(true)}
                    className="p-1 text-[var(--accent)] hover:underline flex items-center gap-1 text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                )}
              </div>

              {addressError && (
                <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-[var(--danger)]">
                  {addressError}
                </div>
              )}

              {isAddingAddress && (
                <form onSubmit={handleAddAddress} className="mb-4 p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--hairline)] space-y-3">
                  <div className="flex gap-2">
                    {["Home", "Office", "Other"].map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setNewAddressLabel(lbl)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          newAddressLabel === lbl
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
                            : "border-[var(--hairline)] text-[var(--ink-3)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newAddressText}
                    onChange={(e) => setNewAddressText(e.target.value)}
                    placeholder="Flat, building, street, city, PIN code..."
                    className="w-full bg-[var(--surface-1)] border border-[var(--hairline)] rounded-lg p-2.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)] resize-none h-16"
                    required
                  />
                  <input
                    type="text"
                    value={newAddressLandmark}
                    onChange={(e) => setNewAddressLandmark(e.target.value)}
                    placeholder="Landmark (optional)"
                    className="w-full bg-[var(--surface-1)] border border-[var(--hairline)] rounded-lg px-2.5 py-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(false)}
                      className="px-3 py-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 text-xs bg-[var(--accent)] text-[var(--accent-ink)] font-semibold rounded-lg"
                    >
                      Save Address
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {loadingAddresses ? (
                  <p className="text-xs text-[var(--ink-3)]">Loading addresses...</p>
                ) : addresses.length === 0 ? (
                  <p className="text-xs text-[var(--ink-3)]">
                    No saved addresses yet. Click &ldquo;Add&rdquo; to save a pickup address.
                  </p>
                ) : (
                  addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--hairline)] flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-semibold text-[var(--ink)]">
                            {addr.label || "Saved Address"}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] font-mono bg-[var(--surface-3)] text-[var(--ink-2)] px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--ink-2)] leading-relaxed">
                          {addr.address}
                        </p>
                        {addr.landmark && (
                          <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                            Landmark: {addr.landmark}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-[var(--ink-3)] hover:text-[var(--danger)] p-1 transition-colors"
                        title="Delete Address"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Active & Past Bookings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Bookings */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg text-[var(--ink)]">
                  Active Repairs ({activeBookings.length})
                </h2>
              </div>

              {loadingBookings ? (
                <div className="p-8 text-center bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl">
                  <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs text-[var(--ink-3)]">Loading your bookings...</span>
                </div>
              ) : activeBookings.length === 0 ? (
                <div className="p-8 text-center bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl">
                  <Smartphone className="w-9 h-9 text-[var(--ink-3)] mx-auto mb-3 opacity-60" />
                  <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
                    No active repairs
                  </h3>
                  <p className="text-xs text-[var(--ink-3)] mb-5">
                    You do not have any repairs in progress right now.
                  </p>
                  <Link
                    to="/flashfix/book"
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-semibold rounded-lg px-5 py-2.5"
                  >
                    Book a Repair
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeBookings.map((b) => (
                    <div
                      key={b.id}
                      className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-5 sm:p-6 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <span className="font-mono text-xs text-[var(--ink-3)]">
                            Booking ID: <strong className="text-[var(--ink)]">{b.id}</strong>
                          </span>
                          <h3 className="font-semibold text-base text-[var(--ink)] mt-0.5">
                            {b.brand} {b.deviceModel}
                          </h3>
                        </div>
                        <StatusPill status={b.status} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4 p-3.5 rounded-lg bg-[var(--surface-2)] border border-[var(--hairline)]">
                        <div>
                          <span className="text-[var(--ink-3)] block text-[11px] mb-0.5">
                            Service
                          </span>
                          <span className="text-[var(--ink)] font-medium">
                            {b.issueType}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--ink-3)] block text-[11px] mb-0.5">
                            Scheduled Window
                          </span>
                          <span className="text-[var(--ink)] font-medium">
                            {b.scheduledDate} · {b.scheduledTime}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[var(--ink-3)] block text-[11px] mb-0.5">
                            Pickup Address
                          </span>
                          <span className="text-[var(--ink-2)] block">
                            {b.pickupAddress}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[var(--ink-2)]">
                          Estimate:{" "}
                          <strong className="text-[var(--ink)] font-mono">
                            {formatCost(b.estimatedCostPaise, b.finalCostPaise)}
                          </strong>
                        </span>
                        <Link
                          to={`/flashfix/track/${b.id}`}
                          className="inline-flex items-center gap-1.5 bg-[var(--accent)] hover:opacity-95 text-[var(--accent-ink)] font-semibold text-xs px-4 py-2 rounded-lg transition-all"
                        >
                          <span>Track Repair</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Bookings */}
            <div>
              <h2 className="font-semibold text-lg text-[var(--ink)] mb-4">
                Past Bookings ({pastBookings.length})
              </h2>

              {pastBookings.length === 0 ? (
                <div className="p-6 rounded-xl bg-[var(--surface-1)] border border-[var(--hairline)] text-xs text-[var(--ink-3)] text-center">
                  No past bookings yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {pastBookings.map((b) => (
                    <div
                      key={b.id}
                      className="bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-medium text-[var(--ink)]">
                            {b.id}
                          </span>
                          <span className="text-[var(--ink-3)]">·</span>
                          <span className="text-[var(--ink-2)] font-medium">
                            {b.brand} {b.deviceModel}
                          </span>
                        </div>
                        <span className="text-[var(--ink-3)] text-[11px]">
                          {b.issueType} · {b.scheduledDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <StatusPill status={b.status} />
                        <Link
                          to={`/flashfix/track/${b.id}`}
                          className="text-[var(--ink-3)] hover:text-[var(--accent)] p-1 transition-colors"
                          title="View Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
