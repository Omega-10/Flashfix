import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js + R3F only loaded on Fortix pages
          "three-vendor": ["three", "@react-three/fiber", "@react-three/drei"],
          // Animation libs
          "animation-vendor": ["framer-motion", "gsap"],
          // Map lib
          "map-vendor": ["leaflet", "react-leaflet"],
          // React core
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // State
          "state-vendor": ["zustand"],
        },
      },
    },
    // Suppress the warning — 3D/animation demos are expected to be larger
    chunkSizeWarningLimit: 800,
  },
});

