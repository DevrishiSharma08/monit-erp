"use client";

import Link from "next/link";
import {
  ShoppingCart, ShoppingBag, ClipboardCheck, Package,
  ArrowRight, CheckCircle2,
} from "lucide-react";
import {
  mockSalesOrders, mockPurchaseOrders, mockGRNs,
  mockStockLots, mockMillTrackers,
} from "@/data/mockData";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";

// ─── Data ─────────────────────────────────────────────────────────────────────

function getDashboardData() {
  const openSOs = mockSalesOrders.filter(
    (s) => !["Completed", "Closed", "Cancelled"].includes(s.status)
  );
  const openSOValue = openSOs.reduce((s, o) => s + o.totalValue, 0);

  const openPOs = mockPurchaseOrders.filter(
    (p) => !["Received", "Cancelled"].includes(p.status)
  );
  const openPOValue = openPOs.reduce((s, p) => s + p.totalValue, 0);

  const pendingGRNs = mockGRNs.filter(
    (g) => g.status === "Draft" || g.status === "QC Pending"
  );

  const availableStock = mockStockLots.filter((l) => l.status === "Available");
  const stockQty = availableStock.reduce((s, l) => s + l.currentQty, 0);

  const trackers = mockMillTrackers;
  const readyTrackers = trackers.filter(
    (t) => t.productionStatus === "Ready" || t.productionStatus === "Dispatched"
  );

  const soStatusMap = new Map<string, number>();
  mockSalesOrders.forEach((s) => soStatusMap.set(s.status, (soStatusMap.get(s.status) || 0) + 1));
  const soChart = Array.from(soStatusMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const poStatusMap = new Map<string, number>();
  mockPurchaseOrders.forEach((p) => poStatusMap.set(p.status, (poStatusMap.get(p.status) || 0) + 1));
  const poChart = Array.from(poStatusMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    openSOs, openSOValue, openPOs, openPOValue,
    pendingGRNs, availableStock, stockQty,
    trackers, readyTrackers, soChart, poChart,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtL = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

const STATUS_CLS: Record<string, string> = {
  Draft:                  "bg-gray-100 text-gray-500",
  "Pending Allocation":     "bg-amber-100 text-amber-700",
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
  "Pending Allocation":     "#f59e0b",
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
  title, value, sub, icon: Icon, iconBg, iconColor, accent, href, urgent,
}: {
  title: string; value: string; sub?: string; urgent?: boolean;
  icon: React.ElementType; iconBg: string; iconColor: string; accent: string; href: string;
}) {
  return (
    <Link href={href}
      className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className={`absolute inset-y-0 left-0 w-[3px] rounded-l-xl ${accent}`} />
      <div className="pl-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
          <p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-tight text-gray-900">{value}</p>
          {sub && (
            <p className={`text-[11px] font-medium ${urgent ? "text-rose-500" : "text-gray-400"}`}>{sub}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-[18px] w-[18px] ${iconColor}`} strokeWidth={2} />
        </div>
      </div>
      <div className="mt-2 pl-3 flex items-center gap-1 text-[11px] font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="h-3 w-3" />
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
    <div className="flex items-stretch rounded-xl overflow-hidden border border-gray-100 shadow-sm">
      {PIPELINE_STEPS.map((step, i) => (
        <div key={step.label} className="flex items-stretch flex-1 min-w-0">
          <Link href={step.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-4 px-2 ${step.bg} hover:brightness-95 transition-all text-center`}>
            <span className={`text-2xl font-black tabular-nums ${step.color}`}>{counts[i]}</span>
            <span className="text-[10px] font-semibold text-gray-500 leading-tight">{step.label}</span>
          </Link>
          {i < PIPELINE_STEPS.length - 1 && (
            <div className="flex items-center justify-center w-6 bg-white flex-shrink-0">
              <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Section Card wrapper ─────────────────────────────────────────────────────

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

function MillRow({ t }: { t: typeof mockMillTrackers[0] }) {
  const pct = t.productionProgress ?? 0;
  const bar = pct >= 100 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : pct > 0 ? "bg-amber-400" : "bg-gray-200";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-800 truncate">
          {t.paper.split("/").slice(1).join(" · ")}
        </p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcurementDashboard() {
  const {
    openSOs, openSOValue, openPOs, openPOValue,
    pendingGRNs, availableStock, stockQty,
    trackers, readyTrackers, soChart, poChart,
  } = getDashboardData();

  const recentSOs = [...mockSalesOrders]
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
    .slice(0, 6);

  const recentPOs = [...mockPurchaseOrders]
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
    .slice(0, 6);

  return (
    <div className="space-y-4 pb-8">

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Open Sales Orders" value={String(openSOs.length)} sub={fmtL(openSOValue)}
          icon={ShoppingCart} iconBg="bg-blue-50" iconColor="text-blue-600"
          accent="bg-blue-500" href="/orders" />
        <KpiCard
          title="Open Purchase Orders" value={String(openPOs.length)} sub={fmtL(openPOValue)}
          icon={ShoppingBag} iconBg="bg-violet-50" iconColor="text-violet-600"
          accent="bg-violet-500" href="/purchase-orders" />
        <KpiCard
          title="Pending GRNs" value={String(pendingGRNs.length)}
          sub={pendingGRNs.length ? "Awaiting QC / approval" : "All clear"} urgent={pendingGRNs.length > 0}
          icon={ClipboardCheck} iconBg={pendingGRNs.length ? "bg-amber-50" : "bg-emerald-50"}
          iconColor={pendingGRNs.length ? "text-amber-600" : "text-emerald-600"}
          accent={pendingGRNs.length ? "bg-amber-400" : "bg-emerald-400"} href="/grn" />
        <KpiCard
          title="Stock Available" value={`${stockQty.toLocaleString()} kg`}
          sub={`${availableStock.length} lots`}
          icon={Package} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          accent="bg-emerald-500" href="/stock-lots" />
      </div>

      {/* Pipeline */}
      <PipelineBar counts={[openSOs.length, openPOs.length, trackers.length, pendingGRNs.length, availableStock.length]} />

      {/* Recent activity — 3 columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Recent SOs */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <CardHeader title="Recent Sales Orders" href="/orders" />
          <div className="px-4 py-0.5 divide-y divide-gray-50">
            {recentSOs.map((so) => (
              <div key={so.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{so.soNumber}</p>
                  <p className="text-[11px] text-gray-400 truncate">{so.customer}</p>
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
            {recentPOs.map((po) => (
              <div key={po.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{po.poNumber}</p>
                  <p className="text-[11px] text-gray-400 truncate">{po.mill}</p>
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
                <span className="font-bold text-emerald-600">{readyTrackers.length}</span> ready &middot;&nbsp;
                <span className="font-bold text-amber-600">{trackers.length - readyTrackers.length}</span> in progress
              </span>
            </div>
            {trackers.slice(0, 6).map((t) => <MillRow key={t.id} t={t} />)}
          </div>
        </div>
      </div>

      {/* Status distribution charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* SO status horizontal bar */}
        <div className="rounded-xl border border-gray-100 bg-white px-4 pt-3.5 pb-3 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-1">Sales Order — Status Breakdown</p>
          <p className="text-[11px] text-gray-400 mb-3">{mockSalesOrders.length} orders total</p>
          <ResponsiveContainer width="100%" height={soChart.length * 28 + 16}>
            <BarChart data={soChart} layout="vertical" barSize={13} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                {soChart.map((entry) => (
                  <Cell key={entry.name} fill={SO_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* PO status horizontal bar */}
        <div className="rounded-xl border border-gray-100 bg-white px-4 pt-3.5 pb-3 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-1">Purchase Order — Status Breakdown</p>
          <p className="text-[11px] text-gray-400 mb-3">{mockPurchaseOrders.length} orders total</p>
          <ResponsiveContainer width="100%" height={poChart.length * 28 + 16}>
            <BarChart data={poChart} layout="vertical" barSize={13} margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                {poChart.map((entry) => (
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
