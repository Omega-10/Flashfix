import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";

/** Syncs Zustand theme to DOM class — call once in App root */
export function useThemeSync() {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [theme]);
}
