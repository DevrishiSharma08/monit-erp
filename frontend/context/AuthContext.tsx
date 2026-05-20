"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, setAccessToken, ApiError, refreshOnce, notifyAuthSettled } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:           number;
  username:     string;
  name:         string;
  role:         string;
  customerName: string | null;
  permissions:  string[];
}

interface LoginApiResponse {
  accessToken: string;
  tokenType:   string;
  expiresAt:   string;
  user: {
    id:           number;
    username:     string;
    name:         string;
    role:         string;
    customerName: string | null;
  };
}


interface AuthContextValue {
  user:         AuthUser | null;
  isLoading:    boolean;
  login:        (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout:       () => Promise<void>;
  isAdmin:      boolean;
  isSalesman:   boolean;
  isCustomer:   boolean;
  isPlanner:    boolean;
  isAccountant: boolean;
  hasRole:      (roles: string[]) => boolean;
  hasPerm:      (perm: string) => boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodePermsFromToken(token: string): string[] {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    const p = payload["perm"];
    return Array.isArray(p) ? p : p ? [p] : [];
  } catch {
    return [];
  }
}

const USER_KEY = "monit_user";

const PUBLIC_PATHS = ["/login"];

const roleHome: Record<string, string> = {
  Admin:             "/",
  Manager:           "/",
  Salesman:          "/orders",
  Accountant:        "/dashboard/accounts",
  Planner:           "/dashboard/planner",
  "Warehouse Manager": "/stock-lots",
  Customer:          "/inquiry",
};

function saveUser(user: AuthUser): void {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* private mode */ }
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as AuthUser;
    if (!u.permissions) u.permissions = [];
    return u;
  } catch {
    return null;
  }
}

function clearUser(): void {
  try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

  // On mount: restore session via HttpOnly refresh-token cookie
  useEffect(() => {
    let cancelled = false;

    async function tryRestore() {
      // Share the same deduped refresh promise as any concurrent API 401-retries,
      // preventing double-rotation of the refresh token on a fresh page load.
      const newToken = await refreshOnce();
      if (cancelled) return;
      if (newToken) {
        const cached = loadUser();
        if (cached) {
          // Always decode fresh permissions from new token — role may have changed
          setUser({ ...cached, permissions: decodePermsFromToken(newToken) });
        } else {
          // Cookie valid but no cached user — force re-login for clean state
          setAccessToken(null);
        }
      } else {
        clearUser(); // setAccessToken(null) already done inside refreshOnce
      }
      notifyAuthSettled();
      setIsLoading(false);
    }

    tryRestore();
    return () => { cancelled = true; };
  }, []);

  // Route guard
  useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!user && !isPublic) router.replace("/login");
  }, [user, isLoading, pathname, router]);

  const login = useCallback(
    async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
      try {
        const data = await apiFetch<LoginApiResponse>("/api/v1/auth/login", {
          method: "POST",
          body:   JSON.stringify({ username, password }),
        });

        const authUser: AuthUser = {
          id:           data.user.id,
          username:     data.user.username,
          name:         data.user.name,
          role:         data.user.role,
          customerName: data.user.customerName,
          permissions:  decodePermsFromToken(data.accessToken),
        };

        setAccessToken(data.accessToken);
        setUser(authUser);
        saveUser(authUser);
        router.push(roleHome[authUser.role] ?? "/");
        return { success: true };
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Login failed. Please check your connection and try again.";
        return { success: false, message: msg };
      }
    },
    [router]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch { /* always clear locally even if server call fails */ }
    setAccessToken(null);
    setUser(null);
    clearUser();
    router.push("/login");
  }, [router]);

  const hasRole = useCallback(
    (roles: string[]) => !!user && roles.includes(user.role),
    [user]
  );

  const hasPerm = useCallback(
    (perm: string): boolean => {
      if (!user) return false;
      // Admin role always has full access
      if (user.role === "Admin") return true;
      const perms = user.permissions ?? [];
      // If no permissions stored (old token / no restrictions), show everything
      if (perms.length === 0) return true;
      return perms.includes(perm);
    },
    [user]
  );

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    logout,
    isAdmin:      user?.role === "Admin",
    isSalesman:   user?.role === "Salesman",
    isCustomer:   user?.role === "Customer",
    isPlanner:    user?.role === "Planner",
    isAccountant: user?.role === "Accountant",
    hasRole,
    hasPerm,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
