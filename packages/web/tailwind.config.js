/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ─── Semantic tokens (WCAG AA/AAA compliant) ──────────────────────
        canvas: "var(--canvas)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        hairline: "var(--hairline)",
        ink: {
          DEFAULT: "var(--ink)",
          secondary: "var(--ink-secondary)",
          muted: "var(--ink-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          text: "var(--accent-text)",
          ink: "var(--accent-ink)",
        },
        state: {
          success: "var(--success)",
          warning: "var(--warning)",
          danger: "var(--danger)",
          info: "var(--info)",
        },

        // ─── Core palette — shared by both platforms (backward compat) ───
        brand: {
          black:    "#0A0A0A",
          charcoal: "#111111",
          stone:    "#E8E0D5",
          offwhite: "#F5F0EB",
          muted:    "#85807B",
          amber:    "#ef8f0b",
          ember:    "#ef8f0b",
          "amber-light": "#FBBF24",
          "amber-dark":  "#9a5200",
        },
      },
      fontFamily: {
        // UI Body & Controls — Primary
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        // Tracking codes, OTP, financial figures, specs
        mono: ["JetBrains Mono", "monospace"],
        // Wordmark and hero marketing display strictly
        condensed: ["Lexend Exa", "sans-serif"],
        display: ["Lexend Exa", "sans-serif"],
      },
      fontSize: {
        "10xl": ["10rem", { lineHeight: "0.9" }],
        "9xl":  ["8rem",  { lineHeight: "0.9" }],
      },
      animation: {
        "flash-pulse": "flashPulse 2s ease-in-out infinite",
        "float":       "float 6s ease-in-out infinite",
        "shimmer":     "shimmer 2s ease-in-out infinite",
      },
      keyframes: {
        flashPulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":       { opacity: "0.85", transform: "scale(1.02)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      backgroundImage: {
        "amber-gradient": "linear-gradient(135deg, #ef8f0b 0%, #ef8f0b 100%)",
        "dark-surface":   "linear-gradient(180deg, #0a0a0a 0%, #111111 100%)",
        "light-surface":  "linear-gradient(180deg, #f5f0eb 0%, #fffdfa 100%)",
      },
      boxShadow: {
        // Restrained structural shadows — glows purged
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
        "card-dark":  "0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4)",
        "card-light": "0 1px 0 rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.04)",
      },
      transitionTimingFunction: {
        "expo-out":   "cubic-bezier(0.16, 1, 0.3, 1)",
        "bounce-out": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
