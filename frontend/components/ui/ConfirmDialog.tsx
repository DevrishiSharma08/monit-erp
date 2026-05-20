"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

const variantMap = {
  danger: {
    icon: Trash2,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
    btnClass: "bg-rose-500 hover:bg-rose-600 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    btnClass: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  default: {
    icon: AlertTriangle,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    btnClass: "bg-blue-500 hover:bg-blue-600 text-white",
  },
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const { icon: Icon, iconBg, iconColor, btnClass } = variantMap[variant];

  return createPortal(
    <div className="animate-backdrop-in fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-white/10">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="animate-modal-in relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-xl", iconBg)}>
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && (
            <p className="mt-1.5 text-sm text-gray-500">{description}</p>
          )}
        </div>

        <div className="flex gap-2 rounded-b-2xl border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50",
              btnClass
            )}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
