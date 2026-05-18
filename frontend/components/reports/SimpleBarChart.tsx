"use client";

export interface BarItem {
  label: string;
  value: number;
  color?: string; // tailwind bg class e.g. "bg-blue-500"
}

interface SimpleBarChartProps {
  data: BarItem[];
  title: string;
  valueSuffix?: string;
  formatValue?: (v: number) => string;
}

export function SimpleBarChart({ data, title, valueSuffix = "", formatValue }: SimpleBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-IN") + valueSuffix);

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div className="w-36 flex-shrink-0 truncate text-right text-xs text-gray-600" title={item.label}>
              {item.label}
            </div>
            <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-5 rounded-full transition-all ${item.color ?? "bg-blue-500"}`}
                style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
              />
            </div>
            <div className="w-24 flex-shrink-0 text-right text-xs font-medium text-gray-700">
              {fmt(item.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
