"use client";

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  footer?: ReactNode;
  subtitle?: string;
}

const sizeMap: Record<string, string> = {
  sm:    "max-w-md",
  md:    "max-w-xl",
  lg:    "max-w-2xl",
  xl:    "max-w-4xl",
  "2xl": "max-w-5xl",
};

export function Modal({ isOpen, onClose, title, children, size = "md", footer, subtitle }: ModalProps) {
  // Guard against SSR — createPortal needs document.body
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  /*
   * createPortal renders directly into <body> — this bypasses the
   * `transform: translateY(0)` applied by .animate-fade-in on the page wrapper,
   * which would otherwise make `position:fixed` children position relative to
   * that element instead of the real viewport (causing the header to be hidden
   * behind the app header and the backdrop to not cover the full screen).
   */
  return createPortal(
    <div
      className="animate-backdrop-in fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal card — auto-sizes to content, never exceeds viewport */}
      <div
        className={cn(
          "animate-modal-in relative z-10 flex w-full flex-col rounded-2xl bg-white shadow-2xl",
          "max-h-[calc(100vh-2rem)]",
          sizeMap[size]
        )}
      >
        {/* Fixed header — always visible even when content scrolls */}
        <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl border-b border-gray-100 bg-white px-6 py-4">
          <div>
            <h2 className="truncate pr-4 text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white transition-all hover:bg-gray-700 active:scale-95"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable body — gray background fills any space after form content */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-100 px-6 py-5">
          {children}
        </div>

        {/* Optional sticky footer */}
        {footer && (
          <div className="flex flex-shrink-0 items-center justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-white px-6 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
