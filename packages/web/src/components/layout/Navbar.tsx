import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";

const flashfixLinks = [
  { to: "/flashfix", label: "Home" },
  { to: "/flashfix/services", label: "Services" },
  { to: "/flashfix/book", label: "Book Repair" },
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
              <Link to="/story" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm">
                ← Story
              </Link>
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
                      ? "bg-amber-gradient text-[#0D0D0D]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  ⚡ Flashfix
                </Link>
                <Link
                  to="/fortix"
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
                    platform === "fortix"
                      ? "bg-amber-gradient text-[#0D0D0D]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Fortix
                </Link>
              </div>
            )}
          </div>

          {/* ── Center: Nav links ── */}
          <nav className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/flashfix" || link.to === "/fortix"}
                className={({ isActive }) =>
                  `nav-link text-sm ${isActive ? "active text-[var(--text-primary)]" : ""}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {platform === "hub" && (
              <>
                <Link to="/flashfix" className="nav-link text-sm">Flashfix</Link>
                <Link to="/fortix" className="nav-link text-sm">Fortix</Link>
              </>
            )}
          </nav>

          {/* ── Right: CTA + Theme Toggle ── */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
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
                      isActive ? "text-[var(--accent-amber)]" : "text-[var(--text-secondary)]"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {platform === "flashfix" && (
                <Link to="/flashfix/book" className="btn-primary text-sm mt-2">
                  Book Repair
                </Link>
              )}
              {platform === "fortix" && (
                <Link to="/fortix/products" className="btn-primary text-sm mt-2">
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
