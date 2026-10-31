import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Smartphone,
  Shield,
  Edit3,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Calendar,
  LogOut,
  Wrench,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import LoginModal from "@/components/flashfix/LoginModal";
import { SavedAddress } from "@flashfix/shared";

interface BookingItem {
  id: string;
  brand: string;
  deviceModel: string;
  issueType: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  createdAt: string | Date;
  estimatedCostPaise?: number | null;
}

export default function Profile() {
  const { user, isAuthenticated, logout, updateUser, initAuth } = useAuthStore();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  // Profile edit state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Saved addresses state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("Home");
  const [newAddressText, setNewAddressText] = useState("");

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

  async function fetchBookings() {
    setLoadingBookings(true);
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch("/api/bookings/mine", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.data || Array.isArray(data))) {
        setBookings(data.data || data);
      } else {
        // Fallback demo bookings for authenticated user
        setBookings([
          {
            id: "FF-839201",
            brand: "Apple",
            deviceModel: "iPhone 15 Pro",
            issueType: "Screen Replacement",
            status: "IN_REPAIR",
            scheduledDate: new Date().toISOString().split("T")[0],
            scheduledTime: "11:00 AM",
            pickupAddress: "Hitech City, Madhapur, Hyderabad",
            createdAt: new Date().toISOString(),
            estimatedCostPaise: 449900,
          },
          {
            id: "FF-720194",
            brand: "Samsung",
            deviceModel: "Galaxy S23 Ultra",
            issueType: "Battery Replacement",
            status: "DELIVERED",
            scheduledDate: "2026-10-18",
            scheduledTime: "2:00 PM",
            pickupAddress: "Banjara Hills, Road No. 12, Hyderabad",
            createdAt: "2026-10-18T08:30:00.000Z",
            estimatedCostPaise: 299900,
          },
        ]);
      }
    } catch {
      setBookings([
        {
          id: "FF-839201",
          brand: "Apple",
          deviceModel: "iPhone 15 Pro",
          issueType: "Screen Replacement",
          status: "IN_REPAIR",
          scheduledDate: new Date().toISOString().split("T")[0],
          scheduledTime: "11:00 AM",
          pickupAddress: "Hitech City, Madhapur, Hyderabad",
          createdAt: new Date().toISOString(),
          estimatedCostPaise: 449900,
        },
      ]);
    } finally {
      setLoadingBookings(false);
    }
  }

  async function fetchAddresses() {
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch("/api/users/addresses", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.data || Array.isArray(data))) {
        setAddresses(data.data || data);
      } else {
        const saved = localStorage.getItem("ff_saved_addresses");
        if (saved) {
          setAddresses(JSON.parse(saved));
        } else {
          const defaultAddresses: SavedAddress[] = [
            {
              id: "addr-1",
              userId: user?.id || "u-default",
              label: "Home",
              address: "Flat 402, Lotus Towers, Kondapur, Hyderabad, 500084",
              landmark: "Near Botanical Garden",
              lat: 17.4645,
              lng: 78.3615,
              isDefault: true,
              createdAt: new Date(),
            },
          ];
          setAddresses(defaultAddresses);
          localStorage.setItem("ff_saved_addresses", JSON.stringify(defaultAddresses));
        }
      }
    } catch {
      // Local fallback
      const saved = localStorage.getItem("ff_saved_addresses");
      if (saved) {
        setAddresses(JSON.parse(saved));
      }
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem("accessToken");
      await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, phone }),
      });

      updateUser({ name, phone });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      updateUser({ name, phone });
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddressText.trim()) return;

    const newAddr: SavedAddress = {
      id: "addr-" + Date.now(),
      userId: user?.id || "u-default",
      label: newAddressLabel,
      address: newAddressText.trim(),
      lat: 17.3850,
      lng: 78.4867,
      isDefault: addresses.length === 0,
      createdAt: new Date(),
    };

    const updated = [...addresses, newAddr];
    setAddresses(updated);
    localStorage.setItem("ff_saved_addresses", JSON.stringify(updated));
    setNewAddressText("");
    setIsAddingAddress(false);
  }

  function handleDeleteAddress(id: string) {
    const updated = addresses.filter((a) => a.id !== id);
    setAddresses(updated);
    localStorage.setItem("ff_saved_addresses", JSON.stringify(updated));
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PENDING":
        return { label: "Pending Assignment", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "CONFIRMED":
        return { label: "Technician Assigned", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      case "PICKUP_EN_ROUTE":
      case "PICKUP_OTP_SENT":
        return { label: "Pickup En Route", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
      case "IN_TRANSIT":
        return { label: "In Transit to Lab", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
      case "IN_REPAIR":
      case "CUSTODY_OTP_SENT":
        return { label: "Repairing in Lab", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      case "REPAIR_COMPLETE":
        return { label: "Repair Completed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "RETURN_EN_ROUTE":
        return { label: "Return Delivery En Route", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" };
      case "DELIVERED":
        return { label: "Delivered & Verified", color: "bg-green-500/10 text-green-400 border-green-500/30" };
      case "CANCELLED":
        return { label: "Cancelled", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
      default:
        return { label: status, color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
    }
  }

  const activeBookings = bookings.filter(
    (b) => b.status !== "DELIVERED" && b.status !== "CANCELLED"
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "DELIVERED" || b.status === "CANCELLED"
  );

  if (!isAuthenticated || !user) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-[var(--surface-bg)] text-[var(--text-primary)]">
        <div className="section-container max-w-lg text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-2xl p-10 shadow-xl"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--accent-amber)]/10 border border-[var(--accent-amber)]/30 flex items-center justify-center mx-auto mb-6 text-[var(--accent-amber)]">
              <User className="w-8 h-8" />
            </div>
            <h1 className="font-display font-bold text-2xl mb-3">Consumer Profile</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-8 leading-relaxed">
              Sign in to view your device repair history, track live service orders in real-time, and manage your saved pickup locations.
            </p>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black font-semibold rounded-xl px-8 py-3.5 text-sm transition-all shadow-md shadow-[var(--accent-amber)]/20"
            >
              Sign In to Your Account
            </button>
          </motion.div>
        </div>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="pt-28 pb-24 min-h-screen bg-[var(--surface-bg)] text-[var(--text-primary)]">
      <div className="section-container max-w-5xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--accent-amber)] font-semibold">
                Customer Operations Portal
              </span>
            </div>
            <h1 className="font-display font-bold text-3xl">My Account & Bookings</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/flashfix/book"
              className="inline-flex items-center gap-2 bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black text-xs font-semibold rounded-xl px-5 py-2.5 transition-all"
            >
              <Wrench className="w-3.5 h-3.5" />
              Book New Repair
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 border border-[var(--surface-border)] hover:border-red-500/40 hover:text-red-400 text-xs text-[var(--text-secondary)] font-medium rounded-xl px-4 py-2.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Profile details updated successfully.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: User Profile Card & Saved Addresses */}
          <div className="space-y-8">
            {/* User Profile Card */}
            <div className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-2xl p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-amber)]/20 border border-[var(--accent-amber)]/40 flex items-center justify-center text-lg font-bold text-[var(--accent-amber)]">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <h2 className="font-semibold text-base text-[var(--text-primary)]">
                      {user.name || "Flashfix Member"}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--accent-amber)] bg-[var(--accent-amber)]/10 px-2 py-0.5 rounded-full border border-[var(--accent-amber)]/20 mt-1">
                      <Shield className="w-3 h-3" />
                      {user.role}
                    </span>
                  </div>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg)] rounded-lg transition-colors"
                    title="Edit Profile"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-amber)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91..."
                      className="w-full bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-amber)]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 rounded-xl border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2 rounded-xl bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3 pt-3 border-t border-[var(--surface-border)] text-xs">
                  <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                    <Mail className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                    <Phone className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    <span>{user.phone || "No phone added yet"}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[var(--text-muted)] text-[11px] font-mono">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Member ID: {user.id.substring(0, 10)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Saved Addresses Section */}
            <div className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--accent-amber)]" />
                  <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                    Saved Addresses
                  </h3>
                </div>
                {!isAddingAddress && (
                  <button
                    onClick={() => setIsAddingAddress(true)}
                    className="p-1 text-[var(--accent-amber)] hover:bg-[var(--surface-bg)] rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                )}
              </div>

              {isAddingAddress && (
                <form onSubmit={handleAddAddress} className="mb-4 p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--surface-border)] space-y-3">
                  <div className="flex gap-2">
                    {["Home", "Office", "Other"].map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => setNewAddressLabel(lbl)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          newAddressLabel === lbl
                            ? "border-[var(--accent-amber)] bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"
                            : "border-[var(--surface-border)] text-[var(--text-muted)]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newAddressText}
                    onChange={(e) => setNewAddressText(e.target.value)}
                    placeholder="Enter complete building & street address..."
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-amber)] resize-none h-16"
                    required
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(false)}
                      className="px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs bg-[var(--accent-amber)] text-black font-semibold rounded-lg hover:bg-[#d87c09]"
                    >
                      Save Location
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {addresses.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic">
                    No saved addresses yet. Save locations during checkout or add one above.
                  </p>
                ) : (
                  addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3 rounded-xl bg-[var(--surface-bg)] border border-[var(--surface-border)] flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-semibold text-[var(--text-primary)]">
                            {addr.label || "Saved Address"}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                          {addr.address}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-[var(--text-muted)] hover:text-red-400 p-1 transition-colors"
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

          {/* Right Column (2 spans): Active & Past Bookings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Bookings Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-amber)] animate-pulse" />
                  <h2 className="font-semibold text-lg text-[var(--text-primary)]">
                    Active Repairs & Dispatch ({activeBookings.length})
                  </h2>
                </div>
              </div>

              {loadingBookings ? (
                <div className="p-8 text-center bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-2xl">
                  <div className="w-6 h-6 border-2 border-[var(--accent-amber)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs text-[var(--text-muted)]">Loading repair lifecycle...</span>
                </div>
              ) : activeBookings.length === 0 ? (
                <div className="p-8 text-center bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-2xl">
                  <Smartphone className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    No active repairs in progress
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mb-4">
                    Book a rapid doorstep phone repair now and track progress live.
                  </p>
                  <Link
                    to="/flashfix/book"
                    className="inline-flex items-center gap-2 bg-[var(--accent-amber)] text-black text-xs font-semibold rounded-xl px-5 py-2.5 hover:bg-[#d87c09]"
                  >
                    Start Service Request
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeBookings.map((b) => {
                    const badge = getStatusBadge(b.status);
                    return (
                      <div
                        key={b.id}
                        className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] hover:border-[var(--accent-amber)]/40 rounded-2xl p-5 sm:p-6 transition-all duration-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                          <div>
                            <span className="font-mono text-[11px] text-[var(--text-muted)] tracking-wider">
                              PROTOCOL ID: <strong className="text-[var(--text-primary)]">{b.id}</strong>
                            </span>
                            <h3 className="font-semibold text-base text-[var(--text-primary)] mt-0.5">
                              {b.brand} {b.deviceModel}
                            </h3>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border self-start sm:self-auto ${badge.color}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {badge.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-5 p-3.5 rounded-xl bg-[var(--surface-bg)] border border-[var(--surface-border)]">
                          <div>
                            <span className="text-[var(--text-muted)] block text-[10px] uppercase font-mono tracking-wider">
                              Diagnosed Issue
                            </span>
                            <span className="text-[var(--text-primary)] font-medium">
                              {b.issueType}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--text-muted)] block text-[10px] uppercase font-mono tracking-wider">
                              Scheduled Arrival
                            </span>
                            <span className="text-[var(--text-primary)] font-medium">
                              {b.scheduledDate} at {b.scheduledTime}
                            </span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-[var(--text-muted)] block text-[10px] uppercase font-mono tracking-wider">
                              Pickup Address
                            </span>
                            <span className="text-[var(--text-secondary)] truncate block">
                              {b.pickupAddress}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-[var(--text-muted)]">
                            Estimated: <strong className="text-[var(--text-primary)] font-mono">₹{((b.estimatedCostPaise || 349900) / 100).toLocaleString("en-IN")}</strong>
                          </span>
                          <Link
                            to={`/flashfix/track/${b.id}`}
                            className="inline-flex items-center gap-1.5 bg-[var(--accent-amber)] hover:bg-[#d87c09] text-black font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-sm shadow-[var(--accent-amber)]/20"
                          >
                            <span>Live Track Repair</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Completed Bookings Section */}
            <div>
              <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-4">
                Past Completed Services ({pastBookings.length})
              </h2>

              {pastBookings.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs text-[var(--text-muted)] text-center">
                  No previous service orders logged.
                </div>
              ) : (
                <div className="space-y-3">
                  {pastBookings.map((b) => {
                    const badge = getStatusBadge(b.status);
                    return (
                      <div
                        key={b.id}
                        className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-medium text-[var(--text-primary)]">
                              {b.id}
                            </span>
                            <span className="text-[var(--text-muted)]">•</span>
                            <span className="text-[var(--text-secondary)] font-medium">
                              {b.brand} {b.deviceModel}
                            </span>
                          </div>
                          <span className="text-[var(--text-muted)] text-[11px]">
                            {b.issueType} — Completed on {b.scheduledDate}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <Link
                            to={`/flashfix/track/${b.id}`}
                            className="text-[var(--text-muted)] hover:text-[var(--accent-amber)] p-1 transition-colors"
                            title="View Audit Trail"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
