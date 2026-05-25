"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  IndianRupee, TrendingUp, ShoppingCart, Users, Factory,
  Truck, Package, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, Target, Shield,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  mockDashboardStats, mockSalesChartData, mockWeeklySalesData,
  mockMillStockData, mockSalesOrders, mockPurchaseOrders,
  mockSalesmen, mockCustomers, mockStockLots, mockTruckLoadPlans,
  mockSalesInvoices, mockPurchaseInvoices,
} from "@/data/mockData";

// ─── Types ────────────────────────────────────────────────────────────────────
type TimePeriod = "this_month" | "last_month" | "3_months" | "6_months" | "1_year";

const PERIOD_OPTIONS: { label: string; value: TimePeriod }[] = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "3_months" },
  { label: "Last 6 Months", value: "6_months" },
  { label: "This Year", value: "1_year" },
];

// ─── Shared components ────────────────────────────────────────────────────────
function KpiCard({
  title, value, sub, icon: Icon, iconBg, iconColor, trend,
}: {
  title: string; value: string; sub?: string; trend?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-white/80 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${iconBg}`}>
      <p className={`text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider truncate ${iconColor}`}>{title}</p>
      <p className="mt-1.5 text-2xl sm:text-4xl font-black text-gray-900 leading-none tabular-nums animate-kpi-value">{value}</p>
      {sub && <p className="mt-1 text-[10px] sm:text-xs text-gray-500 truncate">{sub}</p>}
      {trend && (
        <p className="mt-0.5 text-[10px] sm:text-xs text-green-600 font-medium flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> {trend}
        </p>
      )}
      <div className={`pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18] ${iconColor}`}>
        <Icon className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1} />
      </div>
    </div>
  );
}

function SalesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-800 mb-2 border-b pb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500 text-xs">{p.name}</span>
          </div>
          <span className="font-semibold text-gray-900">
            {"\u20B9"}{(p.value / 100000).toFixed(2)}L
          </span>
        </div>
      ))}
    </div>
  );
}

function PeriodDropdown({ period, onChange }: { period: TimePeriod; onChange: (v: TimePeriod) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const current = PERIOD_OPTIONS.find((o) => o.value === period);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-all">
        <span>{current?.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-4 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
                period === opt.value ? "font-semibold text-blue-600 bg-blue-50" : "text-gray-700"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];

export default function OwnerDashboard() {
  const stats = mockDashboardStats;
  const [period, setPeriod] = useState<TimePeriod>("6_months");

  // ── Chart data ──
  const chartData = useMemo(() => {
    if (period === "this_month") return mockWeeklySalesData.this_month.map((d) => ({ month: d.label, sales: d.sales, collections: d.collections }));
    if (period === "last_month") return mockWeeklySalesData.last_month.map((d) => ({ month: d.label, sales: d.sales, collections: d.collections }));
    if (period === "3_months") return mockSalesChartData.slice(-3);
    if (period === "6_months") return mockSalesChartData.slice(-6);
    return mockSalesChartData.slice(-12);
  }, [period]);

  // ── Business health KPIs ──
  const businessHealth = useMemo(() => {
    const totalRevenue = mockSalesInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPurchase = mockPurchaseInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const grossMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalPurchase) / totalRevenue) * 100) : 0;
    const activeCustomers = mockCustomers.filter((c) => c.status === "Active").length;
    const activeSalesmen = mockSalesmen.filter((s) => s.status === "Active").length;
    const openOrders = mockSalesOrders.filter((so) => so.status !== "Completed" && so.status !== "Closed" && so.status !== "Cancelled").length;
    const pendingPOs = mockPurchaseOrders.filter((po) => po.status !== "Completed").length;
    const stockValue = mockStockLots.reduce((s, l) => s + l.availableQty * 50, 0); // rough value
    const trucksInTransit = mockTruckLoadPlans.filter((t) => t.status === "Dispatched").length;
    const overdueInvoices = mockSalesInvoices.filter((i) => i.paymentStatus === "Overdue").length;

    return {
      totalRevenue, totalPurchase, grossMargin, activeCustomers, activeSalesmen,
      openOrders, pendingPOs, stockValue, trucksInTransit, overdueInvoices,
    };
  }, []);

  // ── Order status pie ──
  const orderStatusPie = useMemo(() => {
    const statusCounts = new Map<string, number>();
    mockSalesOrders.forEach((so) => {
      statusCounts.set(so.status, (statusCounts.get(so.status) || 0) + 1);
    });
    return Array.from(statusCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, []);

  // ── Salesman leaderboard ──
  const leaderboard = useMemo(() => {
    return mockSalesmen.filter((s) => s.status === "Active").map((sm) => {
      const orders = mockSalesOrders.filter((so) => so.salesman === sm.name);
      const totalValue = orders.reduce((s, o) => s + o.totalValue, 0);
      const totalQty = orders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.orderedQty, 0), 0);
      return { name: sm.name, territory: sm.territory, orders: orders.length, totalValue, totalQty };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }, []);

  // ── Top customers ──
  const topCustomers = useMemo(() => {
    const map = new Map<string, { orders: number; value: number }>();
    mockSalesOrders.forEach((so) => {
      const existing = map.get(so.customer) || { orders: 0, value: 0 };
      existing.orders += 1;
      existing.value += so.totalValue;
      map.set(so.customer, existing);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, []);

  const xAxisLabel = period === "this_month" || period === "last_month" ? "Week" : "Month";

  return (
    <div className="space-y-6 pb-24">
      {/* Primary KPIs */}
      <div className="kpi-grid grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard title="Today's Sales" value={`\u20B9${(stats.todaySales / 1000).toFixed(0)}K`}
          trend="+12% from yesterday"
          icon={IndianRupee} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <KpiCard title="Month Revenue" value={`\u20B9${(stats.monthSales / 100000).toFixed(1)}L`}
          trend="+8% from last month"
          icon={TrendingUp} iconBg="bg-green-50" iconColor="text-green-600" />
        <KpiCard title="Open Orders" value={String(businessHealth.openOrders)}
          sub={`${stats.pendingApprovals} pending approval`}
          icon={ShoppingCart} iconBg="bg-orange-50" iconColor="text-orange-600" />
        <KpiCard title="Active Customers" value={String(businessHealth.activeCustomers)}
          sub={`${businessHealth.activeSalesmen} salesmen`}
          icon={Users} iconBg="bg-purple-50" iconColor="text-purple-600" />
        <KpiCard title="Overdue Payments" value={String(stats.overduePayments + businessHealth.overdueInvoices)}
          sub="Needs follow-up"
          icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" />
      </div>

      {/* Secondary KPIs */}
      <div className="kpi-grid grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <KpiCard title="Pending POs" value={String(businessHealth.pendingPOs)}
          icon={Factory} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard title="Low Stock" value={String(stats.lowStock)}
          icon={Package} iconBg="bg-rose-50" iconColor="text-rose-600" />
        <KpiCard title="Dispatched" value={String(businessHealth.trucksInTransit)}
          icon={Truck} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <KpiCard title="Gross Margin" value={`${businessHealth.grossMargin}%`}
          sub="Revenue - purchase"
          icon={Target} iconBg="bg-teal-50" iconColor="text-teal-600" />
        <KpiCard title="Coverage Health" value={`${Math.round((businessHealth.openOrders > 0 ? (businessHealth.openOrders - stats.lowStock) / businessHealth.openOrders : 1) * 100)}%`}
          icon={Shield} iconBg="bg-cyan-50" iconColor="text-cyan-600" />
      </div>

      {/* Sales Trend + Order Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Area Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Sales Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Revenue &amp; Collections — by {xAxisLabel}</p>
            </div>
            <PeriodDropdown period={period} onChange={setPeriod} />
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ownerSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ownerCollectGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tickFormatter={(v) => `\u20B9${(v / 100000).toFixed(0)}L`}
                tick={{ fontSize: 11, fill: "#9ca3af" }} width={44} />
              <Tooltip content={<SalesTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#ownerSalesGrad)" dot={{ r: 3.5, fill: "#3b82f6", strokeWidth: 0 }} />
              <Area type="monotone" dataKey="collections" name="Collections" stroke="#06b6d4" strokeWidth={2.5}
                fill="url(#ownerCollectGrad)" dot={{ r: 3.5, fill: "#06b6d4", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie + Payment Status */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col gap-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Order Pipeline</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={orderStatusPie} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                  label={(props: any) => `${((props.percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10}>
                  {orderStatusPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1">
              {orderStatusPie.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-gray-600 truncate">{d.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Payment Status</h3>
            <div className="space-y-1.5">
              {[
                { label: "Collected", amount: stats.monthSales * 0.6, dot: "bg-green-500", color: "text-green-600" },
                { label: "Due (0-30d)", amount: stats.monthSales * 0.25, dot: "bg-blue-500", color: "text-blue-600" },
                { label: "Overdue (30+)", amount: stats.monthSales * 0.1, dot: "bg-orange-500", color: "text-orange-600" },
                { label: "Overdue (60+)", amount: stats.monthSales * 0.05, dot: "bg-red-500", color: "text-red-600" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                  <span className={`text-xs font-semibold ${item.color}`}>
                    {"\u20B9"}{(item.amount / 100000).toFixed(1)}L
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stock by Mill + Leaderboard + Top Customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Stock by Mill */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Stock by Mill</h2>
          <p className="text-xs text-gray-400 mb-4">Current inventory value &amp; sheets by supplier</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mockMillStockData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="mill" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 11, fill: "#9ca3af" }} width={36} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" name="Value (\u20B9)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sheets" name="Sheets" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leaderboard + Top Customers */}
        <div className="space-y-5">
          {/* Salesman Leaderboard */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Salesman Leaderboard</h2>
            <div className="space-y-2">
              {leaderboard.map((sm, i) => (
                <div key={sm.name} className="flex items-center gap-3 py-1.5">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? "bg-yellow-100 text-yellow-700" :
                    i === 1 ? "bg-gray-100 text-gray-600" :
                    "bg-orange-50 text-orange-600"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{sm.name}</p>
                    <p className="text-[10px] text-gray-500">{sm.territory}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {"\u20B9"}{(sm.totalValue / 100000).toFixed(1)}L
                    </p>
                    <p className="text-[10px] text-gray-400">{sm.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Customers */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Top Customers</h2>
            <div className="space-y-2">
              {topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 truncate">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 ml-2 whitespace-nowrap">
                    {"\u20B9"}{(c.value / 100000).toFixed(1)}L
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
