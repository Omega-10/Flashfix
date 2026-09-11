/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ─── Core palette — shared by both platforms ───────────────────────
        brand: {
          black:   "#0D0D0D",
          charcoal:"#1A1A1A",
          stone:   "#E8E0D5",
          offwhite:"#F5F0EB",
          muted:   "#6B6460",
          amber:   "#f3910c",
          ember:   "#f3910c",
          // amber gradient stops
          "amber-light": "#FBBF24",
          "amber-dark":  "#D97706",
        },
      },
      fontFamily: {
        // Flashfix display — industrial, compressed
        condensed: ["Space Grotesk", "sans-serif"],
        // Fortix display — rounded, product-forward  
        display: ["Space Grotesk", "sans-serif"],
        // Body — both platforms
        sans: ["Space Grotesk", "sans-serif"],
        // Specs, pricing, code
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "10xl": ["10rem", { lineHeight: "0.9" }],
        "9xl":  ["8rem",  { lineHeight: "0.9" }],
      },
      animation: {
        "flash-pulse":   "flashPulse 2s ease-in-out infinite",
        "ember-glow":    "emberGlow 3s ease-in-out infinite",
        "float":         "float 6s ease-in-out infinite",
        "scan-line":     "scanLine 3s linear infinite",
      },
      keyframes: {
        flashPulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":       { opacity: "0.75", transform: "scale(1.05)" },
        },
        emberGlow: {
          "0%, 100%": { boxShadow: "0 0 20px 4px rgba(245,158,11,0.3)" },
          "50%":      { boxShadow: "0 0 40px 8px rgba(234,88,12,0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-20px)" },
        },
        scanLine: {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      backgroundImage: {
        "amber-gradient":  "linear-gradient(135deg, #f3910c 0%, #f3910c 100%)",
        "dark-surface":    "linear-gradient(180deg, #0D0D0D 0%, #1A1A1A 100%)",
        "light-surface":   "linear-gradient(180deg, #F5F0EB 0%, #E8E0D5 100%)",
        "mesh-dark":       "radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(234,88,12,0.06) 0%, transparent 50%)",
        "mesh-light":      "radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(234,88,12,0.08) 0%, transparent 50%)",
      },
      boxShadow: {
        "amber-sm":  "0 2px 8px rgba(245,158,11,0.25)",
        "amber-md":  "0 4px 20px rgba(245,158,11,0.35)",
        "amber-lg":  "0 8px 40px rgba(245,158,11,0.4)",
        "ember-md":  "0 4px 20px rgba(234,88,12,0.35)",
        "card-dark": "0 1px 0 rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.6)",
        "card-light":"0 1px 0 rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08)",
      },
      transitionTimingFunction: {
        "expo-out":   "cubic-bezier(0.16, 1, 0.3, 1)",
        "bounce-out": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
