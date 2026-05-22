"use client";

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalModalProps {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  className?: string;
}

/**
 * Consistent portal shell for inline modal components.
 * Provides: z-[9999], backdrop-blur, animate-backdrop-in/modal-in,
 * Escape key, body scroll lock. Children own the header/body/footer.
 */
export function PortalModal({
  onClose,
  children,
  maxWidth = "max-w-4xl",
  className,
}: PortalModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="animate-backdrop-in fixed inset-0 z-[9999] overflow-y-auto bg-black/20 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            "animate-modal-in relative z-10 w-full rounded-2xl bg-white shadow-2xl",
            maxWidth,
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Standardised dark close button matching Modal.tsx */
export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white transition-all hover:bg-gray-700 active:scale-95"
    >
      <X className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}
