"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart, ShoppingBag, ClipboardCheck, Package,
  ArrowRight, CheckCircle2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";
import { dashboardApi, type DashboardSummaryDto } from "@/lib/api-services";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtL = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

const STATUS_CLS: Record<string, string> = {
  Draft:                  "bg-gray-100 text-gray-500",
  "Pending Allocation":   "bg-amber-100 text-amber-700",
  "Partially Allocated":  "bg-blue-100 text-blue-700",
  "Fully Allocated":      "bg-green-100 text-green-700",
  "In Dispatch":          "bg-purple-100 text-purple-700",
  Confirmed:              "bg-green-100 text-green-700",
  Ready:                  "bg-emerald-100 text-emerald-700",
  Dispatched:             "bg-indigo-100 text-indigo-700",
  Received:               "bg-green-100 text-green-700",
  "Sent to Mill":         "bg-blue-100 text-blue-700",
  "Partial Ready":        "bg-amber-100 text-amber-700",
  Acknowledged:           "bg-gray-100 text-gray-500",
  Completed:              "bg-gray-100 text-gray-500",
  "Order Placed":         "bg-gray-100 text-gray-500",
  "In Production":        "bg-blue-100 text-blue-700",
};

const SO_COLORS: Record<string, string> = {
  "Pending Allocation":   "#f59e0b",
  "Partially Allocated":  "#3b82f6",
  "Fully Allocated":      "#10b981",
  "In Dispatch":          "#8b5cf6",
  Completed:              "#9ca3af",
  Draft:                  "#d1d5db",
};

const PO_COLORS: Record<string, string> = {
  "Sent to Mill":  "#6366f1",
  Acknowledged:    "#9ca3af",
  "Partial Ready": "#f59e0b",
  Ready:           "#10b981",
  Received:        "#8b5cf6",
};

function Badge({ s }: { s: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[s] ?? "bg-gray-100 text-gray-500"}`}>
      {s}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, iconBg, iconColor, href, urgent,
}: {
  title: string; value: string; sub?: string; urgent?: boolean;
  icon: React.ElementType; iconBg: string; iconColor: string; href: string;
}) {
  return (
    <Link href={href}
      className={`group relative overflow-hidden rounded-2xl border border-white/80 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] ${iconBg}`}>
      <p className={`text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider truncate ${iconColor}`}>{title}</p>
      <p className="mt-1.5 text-2xl sm:text-4xl font-black text-gray-900 leading-none tabular-nums animate-kpi-value">{value}</p>
      {sub && (
        <p className={`mt-1 text-[10px] sm:text-xs truncate ${urgent ? "text-rose-500 font-semibold" : "text-gray-500"}`}>{sub}</p>
      )}
      <div className={`pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18] ${iconColor}`}>
        <Icon className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1} />
      </div>
    </Link>
  );
}

// ─── Pipeline Bar ─────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { label: "Open SOs",    color: "text-blue-600",    bg: "bg-blue-50",    href: "/orders" },
  { label: "Open POs",    color: "text-violet-600",  bg: "bg-violet-50",  href: "/purchase-orders" },
  { label: "Mill Track",  color: "text-amber-600",   bg: "bg-amber-50",   href: "/mill-tracker" },
  { label: "Pending GRN", color: "text-rose-500",    bg: "bg-rose-50",    href: "/grn" },
  { label: "In Stock",    color: "text-emerald-600", bg: "bg-emerald-50", href: "/stock-lots" },
] as const;

function PipelineBar({ counts }: { counts: number[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      <div className="flex items-stretch min-w-[360px]">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-stretch flex-1">
            <Link href={step.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 sm:py-4 px-2 ${step.bg} hover:brightness-95 transition-all text-center`}>
              <span className={`text-xl sm:text-2xl font-black tabular-nums ${step.color}`}>{counts[i]}</span>
              <span className="text-[9px] sm:text-[10px] font-semibold text-gray-500 leading-tight">{step.label}</span>
            </Link>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className="flex items-center justify-center w-5 sm:w-6 bg-white flex-shrink-0">
                <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-300" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section Card header ──────────────────────────────────────────────────────

function CardHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-gray-50">
      <p className="text-sm font-bold text-gray-800">{title}</p>
      <Link href={href} className="flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-700 transition-colors">
        View all <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Mill tracker row ─────────────────────────────────────────────────────────

function MillRow({ t }: { t: DashboardSummaryDto["millTrackers"][0] }) {
  const pct = t.productionProgress ?? 0;
  const bar = pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : pct > 0 ? "bg-amber-400" : "bg-gray-200";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-800 truncate">{t.material}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{t.mill} · {t.orderedQty.toLocaleString()} kg</p>
      </div>
      <div className="w-24 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-gray-500">{pct}%</span>
          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_CLS[t.productionStatus] ?? "bg-gray-100 text-gray-500"}`}>
            {t.productionStatus}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div className={`h-1.5 rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Mini chart tooltip ───────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-1.5 shadow-md text-xs">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-gray-500">{payload[0].value} orders</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcurementDashboard() {
  const [data, setData] = useState<DashboardSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.summary()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-20" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Failed to load dashboard. Please refresh.
      </div>
    );
  }

  const soTotalCount = data.soStatusBreakdown.reduce((s, x) => s + x.value, 0);
  const poTotalCount = data.poStatusBreakdown.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-4 pb-8">

      {/* KPI Row */}
      <div className="kpi-grid grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          title="Open Sales Orders" value={String(data.openSoCount)} sub={fmtL(data.openSoValue)}
          icon={ShoppingCart} iconBg="bg-blue-50" iconColor="text-blue-600"
          href="/orders" />
        <KpiCard
          title="Open Purchase Orders" value={String(data.openPoCount)} sub={fmtL(data.openPoValue)}
          icon={ShoppingBag} iconBg="bg-violet-50" iconColor="text-violet-600"
          href="/purchase-orders" />
        <KpiCard
          title="Pending GRNs" value={String(data.pendingGrnCount)}
          sub={data.pendingGrnCount ? "Awaiting QC / approval" : "All clear"} urgent={data.pendingGrnCount > 0}
          icon={ClipboardCheck} iconBg={data.pendingGrnCount ? "bg-amber-50" : "bg-emerald-50"}
          iconColor={data.pendingGrnCount ? "text-amber-600" : "text-emerald-600"}
          href="/grn" />
        <KpiCard
          title="Stock Available" value={`${data.availableStockQty.toLocaleString()} kg`}
          sub={`${data.availableStockLots} lots`}
          icon={Package} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          href="/stock-lots" />
      </div>

      {/* Pipeline */}
      <PipelineBar counts={[
        data.openSoCount,
        data.openPoCount,
        data.millTrackerTotal,
        data.pendingGrnCount,
        data.availableStockLots,
      ]} />

      {/* Recent activity — 3 columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Recent SOs */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <CardHeader title="Recent Sales Orders" href="/orders" />
          <div className="px-4 py-0.5 divide-y divide-gray-50">
            {data.recentSalesOrders.map((so) => (
              <div key={so.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{so.number}</p>
                  <p className="text-[11px] text-gray-400 truncate">{so.party}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <Badge s={so.status} />
                  <span className="text-[11px] font-bold text-gray-600">{fmtL(so.totalValue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent POs */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <CardHeader title="Recent Purchase Orders" href="/purchase-orders" />
          <div className="px-4 py-0.5 divide-y divide-gray-50">
            {data.recentPurchaseOrders.map((po) => (
              <div key={po.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{po.number}</p>
                  <p className="text-[11px] text-gray-400 truncate">{po.party}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <Badge s={po.status} />
                  <span className="text-[11px] font-bold text-gray-600">{fmtL(po.totalValue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mill Tracker */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <CardHeader title="Mill Order Tracker" href="/mill-tracker" />
          <div className="px-4 pt-2.5 pb-1">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 mb-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <span className="text-xs text-gray-500">
                <span className="font-bold text-emerald-600">{data.millTrackerReady}</span> ready &middot;&nbsp;
                <span className="font-bold text-amber-600">{data.millTrackerTotal - data.millTrackerReady}</span> in progress
              </span>
            </div>
            {data.millTrackers.map((t) => <MillRow key={t.id} t={t} />)}
          </div>
        </div>
      </div>

      {/* Status distribution charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* SO status horizontal bar */}
        <div className="rounded-xl border border-gray-100 bg-white px-4 pt-3.5 pb-3 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-1">Sales Order — Status Breakdown</p>
          <p className="text-[11px] text-gray-400 mb-3">{soTotalCount} orders total</p>
          <ResponsiveContainer width="100%" height={data.soStatusBreakdown.length * 28 + 16}>
            <BarChart data={data.soStatusBreakdown} layout="vertical" barSize={13} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                {data.soStatusBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={SO_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* PO status horizontal bar */}
        <div className="rounded-xl border border-gray-100 bg-white px-4 pt-3.5 pb-3 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-1">Purchase Order — Status Breakdown</p>
          <p className="text-[11px] text-gray-400 mb-3">{poTotalCount} orders total</p>
          <ResponsiveContainer width="100%" height={data.poStatusBreakdown.length * 28 + 16}>
            <BarChart data={data.poStatusBreakdown} layout="vertical" barSize={13} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                {data.poStatusBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={PO_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
