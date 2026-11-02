import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useState, useEffect } from "react";
import { User, LogIn } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Magnetic from "@/components/ui/Magnetic";
import { useAuthStore } from "@/store/authStore";

const flashfixLinks = [
  { to: "/flashfix", label: "Home" },
  { to: "/flashfix/services", label: "Services" },
  { to: "/flashfix/book", label: "Book Repair" },
  { to: "/flashfix/track", label: "Track Repair" },
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

/* 3D Flip Link Variants — Inspired by ATL Navbar */
const flipLinkFrontVariants: Variants = {
  initial: {
    transform: "translateY(0%) rotateX(0deg)",
    opacity: 1,
  },
  hover: {
    transform: "translateY(-50%) rotateX(-90deg)",
    opacity: 0,
  },
};

const flipLinkBackVariants: Variants = {
  initial: {
    transform: "translateY(50%) rotateX(90deg)",
    opacity: 0,
  },
  hover: {
    transform: "translateY(0%) rotateX(0deg)",
    opacity: 1,
  },
};

function NavFlipLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="outline-none block">
      {({ isActive }) => (
        <motion.div
          whileHover="hover"
          initial="initial"
          transition={{ duration: 0.3 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative font-medium text-sm py-1.5 px-3 rounded-lg select-none"
        >
          {/* Sizing anchor */}
          <span className="invisible block px-0.5">{label}</span>

          {/* Front Face */}
          <motion.div
            className={`absolute inset-0 flex items-center justify-center rounded-lg transition-colors ${
              isActive
                ? "text-[var(--accent)] font-semibold"
                : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
            }`}
            style={{ backfaceVisibility: "hidden" }}
            variants={flipLinkFrontVariants}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <span>{label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] bg-[var(--accent)] rounded-full" />
            )}
          </motion.div>

          {/* Back Face (flips into view on hover) */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center rounded-lg font-semibold text-[var(--accent)] bg-[var(--accent-amber-soft)]"
            style={{ backfaceVisibility: "hidden" }}
            variants={flipLinkBackVariants}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <span>{label}</span>
          </motion.div>
        </motion.div>
      )}
    </NavLink>
  );
}

export default function Navbar() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [navClass, setNavClass] = useState<"slide-down" | "slide-up">("slide-down");
  const { user, isAuthenticated } = useAuthStore();

  // Determine active platform from URL
  const platform = location.pathname.startsWith("/flashfix")
    ? "flashfix"
    : location.pathname.startsWith("/fortix")
    ? "fortix"
    : "hub";

  const links = platform === "flashfix" ? flashfixLinks : platform === "fortix" ? fortixLinks : [];

  // Scroll Show / Hide Listener — Inspired by ATL Navbar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 20);

      if (currentScrollY > lastScrollY && currentScrollY > 70 && !menuOpen) {
        setNavClass("slide-up");
      } else if (currentScrollY < lastScrollY) {
        setNavClass("slide-down");
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, menuOpen]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-sm" : "bg-transparent"
      }`}
      initial={{ y: 0 }}
      animate={{
        y: navClass === "slide-up" ? "-100%" : "0%",
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-16">

          {/* ── Left: Logo + Platform Switcher ── */}
          <div className="flex items-center gap-5 sm:gap-6">
            {/* Story Link */}
            {platform !== "hub" && (
              <Magnetic strength={0.3}>
                <Link
                  to="/story"
                  className="hidden md:flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs font-mono uppercase tracking-widest"
                >
                  <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
                    <path d="M12.5 7H4.9l3.1-3.1L7 2.9 2.4 7.5 7 12.1l1-1-3.1-3.1h7.6v-1z" />
                  </svg>
                  Story
                </Link>
              </Magnetic>
            )}

            {/* Platform logos with hover lift */}
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Link to={platform === "fortix" ? "/fortix" : "/flashfix"} className="flex items-center gap-2">
                {platform === "flashfix" || platform === "hub" ? (
                  <FlashfixLogo />
                ) : (
                  <FortixLogo />
                )}
              </Link>
            </motion.div>

            {/* Platform switcher pill */}
            {platform !== "hub" && (
              <div className="hidden md:flex items-center gap-1 bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-full p-1 shadow-xs">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/flashfix"
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 block ${
                      platform === "flashfix"
                        ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Flashfix
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/fortix"
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 block ${
                      platform === "fortix"
                        ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Fortix
                  </Link>
                </motion.div>
              </div>
            )}
          </div>

          {/* ── Center: 3D Flip Nav links (Perspective Container) ── */}
          <nav
            className="hidden lg:flex items-center gap-1.5"
            style={{ perspective: "1000px" }}
          >
            {links.map((link) => (
              <NavFlipLink
                key={link.to}
                to={link.to}
                label={link.label}
                end={link.to === "/flashfix" || link.to === "/fortix"}
              />
            ))}
            {platform === "hub" && (
              <>
                <NavFlipLink to="/flashfix" label="Flashfix" />
                <NavFlipLink to="/fortix" label="Fortix" />
              </>
            )}
          </nav>

          {/* ── Right: Auth + CTA + Theme Toggle ── */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* User Account / Sign In */}
            {isAuthenticated ? (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/flashfix/profile"
                  className="flex items-center gap-2 bg-[var(--surface-elevated)] hover:border-[var(--accent)] border border-[var(--surface-border)] px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-primary)] transition-all shadow-xs"
                  title="View Profile & Bookings"
                >
                  <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] flex items-center justify-center font-bold text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                  </div>
                  <span className="hidden sm:inline-block max-w-[100px] truncate">{user?.name || "Profile"}</span>
                </Link>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-[var(--surface-border)] hover:border-[var(--accent)] text-[var(--text-primary)] hover:text-[var(--accent)] transition-all bg-[var(--surface-elevated)]"
                >
                  <LogIn className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Sign In</span>
                </Link>
              </motion.div>
            )}

            {/* Desktop Primary CTA Button with Scale Hover Animation */}
            {platform === "flashfix" && (
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="hidden md:inline-flex"
              >
                <Link
                  to="/flashfix/book"
                  className="px-5 py-2 rounded-full text-sm font-semibold bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs hover:brightness-105 transition-all"
                >
                  Book Repair
                </Link>
              </motion.div>
            )}
            {platform === "fortix" && (
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="hidden md:inline-flex"
              >
                <Link
                  to="/fortix/products"
                  className="px-5 py-2 rounded-full text-sm font-semibold bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs hover:brightness-105 transition-all"
                >
                  Shop Now
                </Link>
              </motion.div>
            )}

            {/* Mobile menu toggle — Animated Hamburger to X */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--surface-elevated)]"
              aria-label="Toggle menu"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <motion.span
                  className="block h-[2px] bg-current rounded-full origin-left"
                  animate={{ rotate: menuOpen ? 45 : 0, translateY: menuOpen ? 0 : 0 }}
                  transition={{ duration: 0.25 }}
                />
                <motion.span
                  className="block h-[2px] bg-current rounded-full"
                  animate={{ opacity: menuOpen ? 0 : 1, scaleX: menuOpen ? 0 : 1 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className="block h-[2px] bg-current rounded-full origin-left"
                  animate={{ rotate: menuOpen ? -45 : 0, translateY: menuOpen ? 0 : 0 }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Animated Staggered Menu Drawer — Inspired by ATL */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden glass border-t border-[var(--surface-border)] lg:hidden"
          >
            <nav className="section-container py-5 flex flex-col gap-2">
              {links.map((link, idx) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  whileHover={{ x: 6 }}
                >
                  <NavLink
                    to={link.to}
                    end={link.to === "/flashfix" || link.to === "/fortix"}
                    className={({ isActive }) =>
                      `text-base font-medium py-2.5 px-2 flex items-center justify-between border-b border-[var(--surface-border)]/50 transition-colors ${
                        isActive
                          ? "text-[var(--accent)] font-semibold"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`
                    }
                  >
                    <span>{link.label}</span>
                    <span className="text-xs text-[var(--accent)] font-mono">→</span>
                  </NavLink>
                </motion.div>
              ))}

              {/* Mobile Auth button */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: links.length * 0.04 }}
                className="pt-2"
              >
                {isAuthenticated ? (
                  <Link
                    to="/flashfix/profile"
                    className="flex items-center gap-2 py-2 px-2 text-sm text-[var(--text-primary)] border-b border-[var(--surface-border)]/50"
                  >
                    <User className="w-4 h-4 text-[var(--accent)]" />
                    <span>{`Profile (${user?.name || user?.email})`}</span>
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-2 py-2 px-2 text-sm text-[var(--accent)] font-medium border-b border-[var(--surface-border)]/50"
                  >
                    <LogIn className="w-4 h-4 text-[var(--accent)]" />
                    <span>Sign In</span>
                  </Link>
                )}
              </motion.div>

              {platform === "flashfix" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: (links.length + 1) * 0.04 }}
                  className="pt-2"
                >
                  <Link
                    to="/flashfix/book"
                    className="block w-full text-center py-3 rounded-xl font-semibold bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                  >
                    Book Repair
                  </Link>
                </motion.div>
              )}
              {platform === "fortix" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: (links.length + 1) * 0.04 }}
                  className="pt-2"
                >
                  <Link
                    to="/fortix/products"
                    className="block w-full text-center py-3 rounded-xl font-semibold bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                  >
                    Shop Now
                  </Link>
                </motion.div>
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
      <span className="heading-flashfix text-2xl tracking-[0.12em] text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors uppercase">
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
        className="heading-fortix text-[26px] text-[var(--accent)] -ml-0.5 leading-none transition-all group-hover:scale-110" 
        style={{ textShadow: "0 0 12px rgba(239,143,11,0.3)" }}
      >
        ×
      </span>
    </div>
  );
}
