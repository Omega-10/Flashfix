import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { User, LogIn } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Magnetic from "@/components/ui/Magnetic";
import { useAuthStore } from "@/store/authStore";

const flashfixLinks = [
  { to: "/flashfix", label: "Home" },
  { to: "/flashfix/services", label: "Services" },
  { to: "/flashfix/book", label: "Book Repair" },
  { to: "/flashfix/profile", label: "Profile" },
  { to: "/flashfix/about", label: "About" },
  { to: "/flashfix/contact", label: "Contact" },
];

const fortixLinks = [
  { to: "/fortix", label: "Home" },
  { to: "/fortix/products", label: "Products" },
  { to: "/fortix/about", label: "About" },
  { to: "/fortix/contact", label: "Contact" },
];

export default function Navbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  // Determine active platform from URL
  const platform = location.pathname.startsWith("/flashfix")
    ? "flashfix"
    : location.pathname.startsWith("/fortix")
    ? "fortix"
    : "hub";

  const links = platform === "flashfix" ? flashfixLinks : platform === "fortix" ? fortixLinks : [];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-[0_1px_0_rgba(255,255,255,0.04)]" : "bg-transparent"
      }`}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16">

          {/* ── Left: Logo + Platform Switcher ── */}
          <div className="flex items-center gap-6">
            {/* Story Link */}
            {platform !== "hub" && (
              <Magnetic strength={0.3}>
                <Link
                  to="/story"
                  className="hidden md:flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs font-mono uppercase tracking-widest"
                >
                  <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
                    <path d="M12.5 7H4.9l3.1-3.1L7 2.9 2.4 7.5 7 12.1l1-1-3.1-3.1h7.6v-1z" />
                  </svg>
                  Story
                </Link>
              </Magnetic>
            )}

            {/* Platform logos */}
            <Link to={platform === "fortix" ? "/fortix" : "/flashfix"} className="flex items-center gap-2">
              {platform === "flashfix" || platform === "hub" ? (
                <FlashfixLogo />
              ) : (
                <FortixLogo />
              )}
            </Link>

            {/* Platform switcher pill */}
            {platform !== "hub" && (
              <div className="hidden md:flex items-center gap-1 bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-full p-1">
                <Link
                  to="/flashfix"
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                    platform === "flashfix"
                      ? "bg-[var(--accent-amber)] text-[#0D0D0D]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  ⚡ Flashfix
                </Link>
                <Link
                  to="/fortix"
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                    platform === "fortix"
                      ? "bg-[var(--accent-amber)] text-[#0D0D0D]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Fortix
                </Link>
              </div>
            )}
          </div>

          {/* ── Center: Nav links ── */}
          <nav className="hidden lg:flex items-center gap-7">
            {links.map((link) => (
              <Magnetic strength={0.2} key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "active text-[var(--accent-amber)] font-semibold" : ""}`
                  }
                  end={link.to === "/flashfix" || link.to === "/fortix"}
                >
                  {link.label}
                </NavLink>
              </Magnetic>
            ))}
            {platform === "hub" && (
              <>
                <Link to="/flashfix" className="nav-link text-sm">Flashfix</Link>
                <Link to="/fortix" className="nav-link text-sm">Fortix</Link>
              </>
            )}
          </nav>

          {/* ── Right: Auth + CTA + Theme Toggle ── */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* User Account / Sign In */}
            {isAuthenticated ? (
              <Link
                to={user && user.role !== "CONSUMER" ? "/admin" : "/flashfix/profile"}
                className="flex items-center gap-2 bg-[var(--surface-elevated)] hover:border-[var(--accent-amber)] border border-[var(--surface-border)] px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-primary)] transition-all"
                title={user && user.role !== "CONSUMER" ? "Open Operations Console" : "View Profile & Bookings"}
              >
                <div className="w-6 h-6 rounded-full bg-[var(--accent-amber)] text-black flex items-center justify-center font-bold text-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
                <span className="hidden sm:inline-block max-w-[100px] truncate">{user?.name || "Profile"}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-[var(--surface-border)] hover:border-[var(--accent-amber)] text-[var(--text-primary)] hover:text-[var(--accent-amber)] transition-all bg-[var(--surface-elevated)]/60"
              >
                <LogIn className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
                <span>Sign In</span>
              </Link>
            )}

            {platform === "flashfix" && (
              <Link to="/flashfix/book" className="btn-primary text-sm px-5 py-2.5 hidden md:inline-flex">
                Book Repair
              </Link>
            )}
            {platform === "fortix" && (
              <Link to="/fortix/products" className="btn-primary text-sm px-5 py-2.5 hidden md:inline-flex">
                Shop Now
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Toggle menu"
            >
              <div className="w-5 flex flex-col gap-1">
                <motion.span
                  className="block h-px bg-current"
                  animate={{ rotate: menuOpen ? 45 : 0, translateY: menuOpen ? "4px" : 0 }}
                />
                <motion.span
                  className="block h-px bg-current"
                  animate={{ opacity: menuOpen ? 0 : 1 }}
                />
                <motion.span
                  className="block h-px bg-current"
                  animate={{ rotate: menuOpen ? -45 : 0, translateY: menuOpen ? "-4px" : 0 }}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden glass border-t border-[var(--surface-border)] md:hidden"
          >
            <nav className="section-container py-4 flex flex-col gap-3">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/flashfix" || link.to === "/fortix"}
                  className={({ isActive }) =>
                    `text-sm font-medium py-2 border-b border-[var(--surface-border)] ${
                      isActive ? "text-[var(--accent-amber)] font-semibold" : "text-[var(--text-secondary)]"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}

              {/* Mobile Auth button */}
              {isAuthenticated ? (
                <Link
                  to={user && user.role !== "CONSUMER" ? "/admin" : "/flashfix/profile"}
                  className="flex items-center gap-2 py-2 text-sm text-[var(--text-primary)] border-b border-[var(--surface-border)]"
                >
                  <User className="w-4 h-4 text-[var(--accent-amber)]" />
                  <span>{user && user.role !== "CONSUMER" ? "Operations Console" : `My Profile (${user?.name || user?.email})`}</span>
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-2 py-2 text-sm text-[var(--accent-amber)] font-medium border-b border-[var(--surface-border)]"
                >
                  <LogIn className="w-4 h-4 text-[var(--accent-amber)]" />
                  <span>Sign In</span>
                </Link>
              )}

              {platform === "flashfix" && (
                <Link to="/flashfix/book" className="btn-primary text-sm mt-2 text-center">
                  Book Repair
                </Link>
              )}
              {platform === "fortix" && (
                <Link to="/fortix/products" className="btn-primary text-sm mt-2 text-center">
                  Shop Now
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function FlashfixLogo() {
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="heading-flashfix text-2xl tracking-[0.12em] text-[var(--text-primary)] group-hover:text-[var(--accent-amber)] transition-colors uppercase">
        FLASHFIX
      </span>
    </div>
  );
}

function FortixLogo() {
  return (
    <div className="flex items-center group">
      <span className="heading-fortix text-[22px] tracking-[0.08em] text-[var(--text-primary)] transition-colors group-hover:text-[var(--text-primary)] uppercase">
        FORTI
      </span>
      <span 
        className="heading-fortix text-[26px] text-[var(--accent-amber)] -ml-0.5 leading-none transition-all group-hover:scale-110" 
        style={{ textShadow: "0 0 12px rgba(245,158,11,0.3)" }}
      >
        ×
      </span>
    </div>
  );
}
