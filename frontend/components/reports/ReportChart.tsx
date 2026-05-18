"use client";

import React from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
  Legend,
} from "recharts";

export type ChartType = "area" | "line" | "bar" | "horizontal-bar";

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string; // hex e.g. "#3b82f6"
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({
  active, payload, label, fmt,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  fmt: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-xl text-xs">
      <p className="mb-0.5 font-semibold text-gray-600">{label}</p>
      <p className="text-base font-bold text-blue-600">{fmt(payload[0].value)}</p>
    </div>
  );
}

// ─── Main Chart Component ─────────────────────────────────────────────────────

interface ReportChartProps {
  data: ChartDataPoint[];
  type?: ChartType;
  /** Primary hex colour when no per-bar color is set */
  color?: string;
  formatValue?: (v: number) => string;
  height?: number;
}

export function ReportChart({
  data,
  type = "horizontal-bar",
  color = "#3b82f6",
  formatValue,
  height = 240,
}: ReportChartProps) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value, _color: d.color ?? color }));
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-IN"));
  const gradId = `grad-${color.replace("#", "")}`;

  // ── AREA CHART ──────────────────────────────────────────────────────────────
  if (type === "area") {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#94a3b8" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#94a3b8" }}
              tickFormatter={fmt}
              width={64}
            />
            <Tooltip content={<CustomTooltip fmt={fmt} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={{ fill: color, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: color, strokeWidth: 2, stroke: "#fff" }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── LINE CHART ──────────────────────────────────────────────────────────────
  if (type === "line") {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#94a3b8" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#94a3b8" }}
              tickFormatter={fmt}
              width={64}
            />
            <Tooltip content={<CustomTooltip fmt={fmt} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={{ fill: color, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: color, strokeWidth: 2, stroke: "#fff" }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── HORIZONTAL BAR ──────────────────────────────────────────────────────────
  if (type === "horizontal-bar") {
    const dynamicHeight = Math.max(height, data.length * 40 + 24);
    return (
      <div style={{ height: dynamicHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
            barSize={18}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#94a3b8" }}
              tickFormatter={fmt}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#94a3b8" }}
              width={130}
            />
            <Tooltip content={<CustomTooltip fmt={fmt} />} cursor={{ fill: "#f8fafc" }} />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry._color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── VERTICAL BAR (default) ──────────────────────────────────────────────────
  const renderAngledTick = (props: { x: string | number; y: string | number; payload: { value: string | number } }) => {
    const { x, y, payload } = props;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={8} textAnchor="end" fill="#94a3b8" fontSize={11} transform="rotate(-30)">
          {String(payload.value)}
        </text>
      </g>
    );
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 24, left: 0, bottom: 48 }}
          barSize={28}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={renderAngledTick}
            axisLine={{ stroke: "#64748b" }}
            tickLine={{ stroke: "#94a3b8" }}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#64748b" }}
            tickLine={{ stroke: "#94a3b8" }}
            tickFormatter={fmt}
            width={64}
          />
          <Tooltip content={<CustomTooltip fmt={fmt} />} cursor={{ fill: "#f8fafc" }} />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry._color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
