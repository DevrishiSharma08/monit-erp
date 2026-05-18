import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  subtitleColor?: "default" | "green" | "red" | "amber" | "blue";
  icon: LucideIcon;
  iconBg?: string;   // e.g. "bg-blue-50"
  iconColor?: string; // e.g. "text-blue-500"
  className?: string;
}

const subtitleColors = {
  default: "text-gray-400",
  green:   "text-green-600",
  red:     "text-rose-500",
  amber:   "text-amber-600",
  blue:    "text-blue-600",
};

export function KpiCard({
  title,
  value,
  subtitle,
  subtitleColor = "default",
  icon: Icon,
  iconBg = "bg-blue-50",
  iconColor = "text-blue-500",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-100 bg-white p-5 shadow-sm card-hover",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 truncate">
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className={cn("mt-0.5 text-xs", subtitleColors[subtitleColor])}>
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={cn(
            "ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
            iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
    </div>
  );
}
