"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    (type: ToastType, message: string, duration = 3500) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => toast("success", msg), [toast]);
  const error   = useCallback((msg: string) => toast("error",   msg), [toast]);
  const warning = useCallback((msg: string) => toast("warning", msg), [toast]);
  const info    = useCallback((msg: string) => toast("info",    msg), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 min-w-[320px] max-w-sm w-full px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
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
