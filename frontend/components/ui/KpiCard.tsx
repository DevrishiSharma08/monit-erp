import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  subtitleColor?: "default" | "green" | "red" | "amber" | "blue";
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  className?: string;
  onClick?: () => void;
}

const subtitleColors = {
  default: "text-gray-500",
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
  onClick,
}: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/80 p-2.5 sm:p-3.5 shadow-sm",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        onClick && "cursor-pointer active:scale-[0.98]",
        iconBg,
        className
      )}
    >
      <p className={cn("text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider truncate", iconColor)}>
        {title}
      </p>
      <p className="mt-1 text-xl sm:text-3xl font-black text-gray-900 leading-none tabular-nums animate-kpi-value">
        {value}
      </p>
      {subtitle && (
        <p className={cn("mt-0.5 text-[9px] sm:text-[11px] truncate", subtitleColors[subtitleColor])}>
          {subtitle}
        </p>
      )}

      {/* Ghost watermark icon — scales slightly on card hover */}
      <div className={cn(
        "pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12]",
        "transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18]",
        iconColor
      )}>
        <Icon className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={1} />
      </div>
    </div>
  );
}
