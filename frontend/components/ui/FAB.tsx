"use client";

import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FABProps {
  onClick: () => void;
  label?: string;
  icon?: LucideIcon;
  className?: string;
}

export function FAB({ onClick, label = "Add new", icon: Icon = Plus, className }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-2xl",
        "bg-blue-500 text-white shadow-lg shadow-blue-500/40",
        "transition-all hover:scale-105 hover:bg-blue-600 active:scale-95",
        className
      )}
    >
      <Icon className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
