import { create } from "zustand";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "CONSUMER" | "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";
  emailVerified?: boolean;
  avatarUrl?: string | null;
  storeId?: string | null;
  createdAt?: string | Date;
}

interface AuthStore {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken?: string) => void;
  updateUser: (data: Partial<UserProfile>) => void;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem("accessToken", accessToken);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    localStorage.setItem("ff_user", JSON.stringify(user));
    set({
      user,
      accessToken,
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
    set({ user: updated });
  },

  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("ff_user");
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initAuth: () => {
    try {
      const token = localStorage.getItem("accessToken");
      const userRaw = localStorage.getItem("ff_user");
      const refreshToken = localStorage.getItem("refreshToken");

      if (token && userRaw) {
        const user = JSON.parse(userRaw) as UserProfile;
        set({
          user,
          accessToken: token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });

        // Background sync with /api/auth/me if available
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.data || data?.user) {
              const freshUser = data.data || data.user;
              localStorage.setItem("ff_user", JSON.stringify(freshUser));
              set({ user: freshUser });
            }
          })
          .catch(() => {
            // Keep existing cached user on network failure
          });
      } else {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
