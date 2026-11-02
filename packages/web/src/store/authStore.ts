import { create } from "zustand";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "CONSUMER" | "EMPLOYEE" | "TECHNICIAN" | "ADMIN" | "SUPER_ADMIN";
  emailVerified?: boolean;
  avatarUrl?: string | null;
  storeId?: string | null;
  storeIds?: string[];
  createdAt?: string | Date;
}

export function getRedirectForRole(role?: UserProfile["role"] | string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/superadmin";
    case "ADMIN":
      return "/admin/dashboard";
    case "TECHNICIAN":
      return "/admin/technician";
    case "EMPLOYEE":
      return "/admin/delivery";
    case "CONSUMER":
    default:
      return "/flashfix/profile";
  }
}

interface AuthStore {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: UserProfile, accessToken?: string, refreshToken?: string) => void;
  updateUser: (data: Partial<UserProfile>) => void;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
}

const STAFF_SESSION_KEY = "flashfix_staff_session";

function syncStaffLocalStorage(user: UserProfile | null, token?: string | null) {
  if (!user) {
    localStorage.removeItem(STAFF_SESSION_KEY);
    return;
  }
  if (user.role !== "CONSUMER") {
    localStorage.setItem(
      STAFF_SESSION_KEY,
      JSON.stringify({
        token: token || "cookie-session",
        user,
      })
    );
  } else {
    localStorage.removeItem(STAFF_SESSION_KEY);
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    const token = accessToken || "cookie-session";
    localStorage.setItem("accessToken", token);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    localStorage.setItem("ff_user", JSON.stringify(user));
    syncStaffLocalStorage(user, token);
    set({
      user,
      accessToken: token,
      refreshToken: refreshToken || null,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateUser: (data) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...data };
    localStorage.setItem("ff_user", JSON.stringify(updated));
    syncStaffLocalStorage(updated, get().accessToken);
    set({ user: updated });
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network error on logout
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("ff_user");
    localStorage.removeItem(STAFF_SESSION_KEY);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initAuth: async () => {
    try {
      const userRaw = localStorage.getItem("ff_user");
      const token = localStorage.getItem("accessToken");

      if (userRaw) {
        const cachedUser = JSON.parse(userRaw) as UserProfile;
        set({
          user: cachedUser,
          accessToken: token || "cookie-session",
          isAuthenticated: true,
          isLoading: false,
        });
      }

      const headers: Record<string, string> = {};
      if (token && token !== "cookie-session") {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        const freshUser = (data?.user || data?.data) as UserProfile | undefined;
        if (freshUser) {
          localStorage.setItem("ff_user", JSON.stringify(freshUser));
          syncStaffLocalStorage(freshUser, token || "cookie-session");
          set({
            user: freshUser,
            accessToken: token || "cookie-session",
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      } else if (res.status === 401) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("ff_user");
        localStorage.removeItem(STAFF_SESSION_KEY);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      set((state) => ({ ...state, isLoading: false }));
    } catch {
      set((state) => ({ ...state, isLoading: false }));
    }
  },
}));
