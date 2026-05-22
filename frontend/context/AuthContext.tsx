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
  companyId:    number;
  companyName:  string;
}

interface LoginApiResponse {
  accessToken: string;
  tokenType:   string;
  expiresAt:   string;
  permissions: string[];
  user: {
    id:           number;
    username:     string;
    name:         string;
    role:         string;
    customerName: string | null;
    companyId:    number;
  };
}

interface AuthContextValue {
  user:           AuthUser | null;
  isLoading:      boolean;
  login:          (username: string, password: string, companyId?: number) => Promise<{ success: boolean; message?: string }>;
  logout:         () => Promise<void>;
  isAdmin:        boolean;
  isSalesman:     boolean;
  isCustomer:     boolean;
  isPlanner:      boolean;
  isAccountant:   boolean;
  hasRole:        (roles: string[]) => boolean;
  hasPermission:  (perm: string) => boolean;
  canViewCosts:   boolean;
  canViewContacts: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPANY_NAMES: Record<number, string> = {
  1: "Monit Paper Agency",
  2: "Monit Paper Associates",
};

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

function decodeCompanyIdFromToken(token: string): number {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));
    return parseInt(payload["company_id"] ?? "1", 10) || 1;
  } catch {
    return 1;
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
    if (!u.companyId)   u.companyId   = 1;
    if (!u.companyName) u.companyName = COMPANY_NAMES[u.companyId] ?? "Monit Paper Agency";
    return u;
  } catch {
    return null;
  }
}

function clearUser(): void {
  try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}

// Admin and Manager always have full data access regardless of permission flags
const FULL_ACCESS_ROLES = ["Admin", "Manager"];

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function tryRestore() {
      const newToken = await refreshOnce();
      if (cancelled) return;
      if (newToken) {
        const cached = loadUser();
        if (cached) {
          const companyId   = decodeCompanyIdFromToken(newToken);
          setUser({
            ...cached,
            permissions: decodePermsFromToken(newToken),
            companyId,
            companyName: COMPANY_NAMES[companyId] ?? "Monit Paper Agency",
          });
        } else {
          setAccessToken(null);
        }
      } else {
        clearUser();
      }
      notifyAuthSettled();
      setIsLoading(false);
    }

    tryRestore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!user && !isPublic) router.replace("/login");
  }, [user, isLoading, pathname, router]);

  const login = useCallback(
    async (username: string, password: string, companyId: number = 1): Promise<{ success: boolean; message?: string }> => {
      try {
        const data = await apiFetch<LoginApiResponse>("/api/v1/auth/login", {
          method: "POST",
          body:   JSON.stringify({ username, password, companyId }),
        });

        const cid = data.user.companyId ?? companyId;
        const authUser: AuthUser = {
          id:           data.user.id,
          username:     data.user.username,
          name:         data.user.name,
          role:         data.user.role,
          customerName: data.user.customerName,
          permissions:  decodePermsFromToken(data.accessToken),
          companyId:    cid,
          companyName:  COMPANY_NAMES[cid] ?? "Monit Paper Agency",
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

  const hasPermission = useCallback(
    (perm: string): boolean => {
      if (!user) return false;
      if (FULL_ACCESS_ROLES.includes(user.role)) return true;
      return user.permissions.includes("*") || user.permissions.includes(perm);
    },
    [user]
  );

  const canViewCosts    = hasPermission("finance.view_costs");
  const canViewContacts = hasPermission("clients.view_contacts");

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    logout,
    isAdmin:        user?.role === "Admin",
    isSalesman:     user?.role === "Salesman",
    isCustomer:     user?.role === "Customer",
    isPlanner:      user?.role === "Planner",
    isAccountant:   user?.role === "Accountant",
    hasRole,
    hasPermission,
    canViewCosts,
    canViewContacts,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
