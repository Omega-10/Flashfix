import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";
type Platform = "hub" | "flashfix" | "fortix";

interface AppStore {
  theme: Theme;
  activePlatform: Platform;
  // Location state
  userLocation: { lat: number; lng: number } | null;
  locationPermission: "prompt" | "granted" | "denied";
  // Actions
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setActivePlatform: (p: Platform) => void;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  setLocationPermission: (status: "prompt" | "granted" | "denied") => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      theme: "dark",
      activePlatform: "hub",
      userLocation: null,
      locationPermission: "prompt",

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      setTheme: (theme) => set({ theme }),

      setActivePlatform: (activePlatform) => set({ activePlatform }),

      setUserLocation: (userLocation) => set({ userLocation }),

      setLocationPermission: (locationPermission) => set({ locationPermission }),
    }),
    {
      name: "flashfix-app",
      partialize: (s) => ({ theme: s.theme, locationPermission: s.locationPermission }),
    }
  )
);
