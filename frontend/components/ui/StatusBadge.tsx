"use client";

import { cn } from "@/lib/utils";

// ─── Inquiry Status ───────────────────────────────────────────────────────────
const inquiryStatusMap: Record<string, string> = {
  "Draft":                    "bg-gray-100 text-gray-600",
  "Stock Checked":            "bg-blue-50 text-blue-600",
  "Waiting Mill Confirmation":"bg-amber-50 text-amber-600",
  "Mill Confirmed":           "bg-purple-50 text-purple-600",
  "Customer Confirmed":       "bg-indigo-50 text-indigo-600",
  "Converted":                "bg-green-50 text-green-600",
  "Lost":                     "bg-rose-50 text-rose-600",
};

// ─── Priority ────────────────────────────────────────────────────────────────
const priorityMap: Record<string, string> = {
  Urgent: "bg-rose-50 text-rose-600 border border-rose-200",
  High:   "bg-amber-50 text-amber-600 border border-amber-200",
  Medium: "bg-blue-50 text-blue-600 border border-blue-200",
  Low:    "bg-gray-50 text-gray-500 border border-gray-200",
};

// ─── Source ──────────────────────────────────────────────────────────────────
const sourceMap: Record<string, string> = {
  Visit:    "bg-purple-50 text-purple-600",
  WhatsApp: "bg-green-50 text-green-600",
  Email:    "bg-blue-50 text-blue-600",
  Phone:    "bg-gray-100 text-gray-600",
};

// ─── Sales Order Status ──────────────────────────────────────────────────────
const soStatusMap: Record<string, string> = {
  "Draft":             "bg-gray-100 text-gray-600",
  "Confirmed":         "bg-blue-50 text-blue-600",
  "Partially Dispatched": "bg-amber-50 text-amber-600",
  "Dispatched":        "bg-indigo-50 text-indigo-600",
  "Invoiced":          "bg-green-50 text-green-600",
  "Cancelled":         "bg-rose-50 text-rose-600",
};

// ─── General Active/Inactive ─────────────────────────────────────────────────
const activeMap: Record<string, string> = {
  Active:   "bg-green-50 text-green-600",
  Inactive: "bg-gray-100 text-gray-500",
  Blocked:  "bg-rose-50 text-rose-600",
};

// ─── Payment Status ──────────────────────────────────────────────────────────
const paymentMap: Record<string, string> = {
  Paid:        "bg-green-50 text-green-600",
  Partial:     "bg-amber-50 text-amber-600",
  Unpaid:      "bg-gray-100 text-gray-500",
  Overdue:     "bg-rose-50 text-rose-600",
};

type BadgeVariant = "inquiry" | "priority" | "source" | "so" | "active" | "payment" | "custom";

interface StatusBadgeProps {
  value: string;
  variant?: BadgeVariant;
  /** Custom color class — used when variant="custom" */
  className?: string;
  rounded?: "full" | "md";
}

export function StatusBadge({
  value,
  variant = "inquiry",
  className,
  rounded = "full",
}: StatusBadgeProps) {
  let colorClass = "bg-gray-100 text-gray-600";

  switch (variant) {
    case "inquiry":  colorClass = inquiryStatusMap[value] ?? colorClass; break;
    case "priority": colorClass = priorityMap[value] ?? colorClass; break;
    case "source":   colorClass = sourceMap[value] ?? colorClass; break;
    case "so":       colorClass = soStatusMap[value] ?? colorClass; break;
    case "active":   colorClass = activeMap[value] ?? colorClass; break;
    case "payment":  colorClass = paymentMap[value] ?? colorClass; break;
    case "custom":   colorClass = ""; break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-medium",
        rounded === "full" ? "rounded-full" : "rounded-md",
        colorClass,
        className
      )}
    >
      {value}
    </span>
  );
}
