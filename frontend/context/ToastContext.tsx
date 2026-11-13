"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      // Error/warning toasts carry a reason the user needs to actually read
      // and act on (e.g. "why didn't my save go through") — they stay on
      // screen until manually dismissed via the X button instead of
      // vanishing on a timer. Success/info are quick confirmations and
      // still auto-dismiss so they don't pile up. An explicit duration
      // argument always wins either way.
      const effectiveDuration = duration ?? (type === "error" || type === "warning" ? 0 : 3500);
      if (effectiveDuration > 0) {
        setTimeout(() => dismiss(id), effectiveDuration);
      }
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => toast("success", msg), [toast]);
  const error   = useCallback((msg: string) => toast("error",   msg), [toast]);
  const warning = useCallback((msg: string) => toast("warning", msg), [toast]);
  const info    = useCallback((msg: string) => toast("info",    msg), [toast]);

  // Global safety net for uncaught API errors (e.g. delete handlers that
  // forgot try/catch). Instead of Next.js dev overlay / browser console
  // spam, surface the backend's message via a toast so users always see
  // the friendly permission-denied / conflict / validation text.
  // 401 is skipped — AuthContext handles auth-expired redirects.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      if (reason instanceof ApiError && reason.status !== 401) {
        error(reason.message || "Request failed.");
        e.preventDefault();  // suppress dev-overlay + browser console noise
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, [error]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container — centered on the viewport so every message
          (success, error, permission-denied, etc.) shows in the same
          prominent spot regardless of which page fired it. */}
      {/* z-[10000] — deliberately above Modal/PortalModal's z-[9999] so a
          toast fired while an Edit modal is open (e.g. a rejected save)
          is never hidden behind it. */}
      <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

// ─── Single Toast Item ────────────────────────────────────────────────────────
const toastStyles: Record<ToastType, { wrapper: string; icon: ReactNode }> = {
  success: {
    wrapper: "bg-white border-l-4 border-green-500 shadow-lg",
    icon: <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />,
  },
  error: {
    wrapper: "bg-white border-l-4 border-rose-500 shadow-lg",
    icon: <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />,
  },
  warning: {
    wrapper: "bg-white border-l-4 border-amber-500 shadow-lg",
    icon: <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />,
  },
  info: {
    wrapper: "bg-white border-l-4 border-blue-500 shadow-lg",
    icon: <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />,
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { wrapper, icon } = toastStyles[toast.type];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 animate-fade-in",
        wrapper
      )}
    >
      {icon}
      <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="rounded p-0.5 text-gray-400 hover:text-gray-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
