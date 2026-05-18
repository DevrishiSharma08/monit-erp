"use client";

import { useMemo } from "react";
import {
  UserCheck, Target, TrendingUp, ShoppingCart, Users,
  AlertTriangle, CheckCircle2, Package,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import {
  mockSalesmen, mockSalesOrders, mockCustomers, mockCategories,
} from "@/data/mockData";

function KpiCard({
  title, value, sub, icon: Icon, iconBg, iconColor, trend,
}: {
  title: string; value: string; sub?: string; trend?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
          {trend && (
            <p className="mt-0.5 text-xs text-green-600 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {trend}
            </p>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function SalesmanDashboard() {
  // ── Salesman performance data ──
  const salesmenPerformance = useMemo(() => {
    return mockSalesmen.filter((s) => s.status === "Active").map((sm) => {
      const orders = mockSalesOrders.filter((so) => so.salesman === sm.name);
      const totalQty = orders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.orderedQty, 0), 0);
      const totalValue = orders.reduce((s, o) => s + o.totalValue, 0);
      const delivered = orders.filter((o) => o.status === "Completed").length;
      const pending = orders.filter((o) => o.status !== "Completed" && o.status !== "Cancelled" && o.status !== "Closed").length;
      const uniqueCustomers = new Set(orders.map((o) => o.customer)).size;

      // Simulated target achievement (target is monthly in value, but we show qty-based)
      const targetQty = sm.monthlyTarget / 100; // rough approximation
      const achievement = targetQty > 0 ? Math.min(100, Math.round((totalQty / targetQty) * 100)) : 0;

      return {
        id: sm.id,
        name: sm.name,
        territory: sm.territory,
        totalOrders: orders.length,
        totalQty,
        totalValue,
        delivered,
        pending,
        uniqueCustomers,
        target: targetQty,
        achievement,
      };
    });
  }, []);

  // ── Aggregate KPIs ──
  const kpis = useMemo(() => {
    const totalOrders = salesmenPerformance.reduce((s, p) => s + p.totalOrders, 0);
    const totalQty = salesmenPerformance.reduce((s, p) => s + p.totalQty, 0);
    const totalCustomers = salesmenPerformance.reduce((s, p) => s + p.uniqueCustomers, 0);
    const avgAchievement = salesmenPerformance.length > 0
      ? Math.round(salesmenPerformance.reduce((s, p) => s + p.achievement, 0) / salesmenPerformance.length)
      : 0;
    return { totalOrders, totalQty, totalCustomers, avgAchievement, activeSalesmen: salesmenPerformance.length };
  }, [salesmenPerformance]);

  // ── Bar chart data ──
  const barData = useMemo(() => {
    return salesmenPerformance.map((p) => ({
      name: p.name.split(" ")[0], // first name only for chart
      orders: p.totalOrders,
      qty: Math.round(p.totalQty / 1000), // in thousands
      customers: p.uniqueCustomers,
    }));
  }, [salesmenPerformance]);

  // ── Radar chart data (performance dimensions) ──
  const radarData = useMemo(() => {
    if (salesmenPerformance.length === 0) return [];
    const maxOrders = Math.max(...salesmenPerformance.map((p) => p.totalOrders), 1);
    const maxQty = Math.max(...salesmenPerformance.map((p) => p.totalQty), 1);
    const maxCustomers = Math.max(...salesmenPerformance.map((p) => p.uniqueCustomers), 1);
    const maxDelivered = Math.max(...salesmenPerformance.map((p) => p.delivered), 1);

    return [
      { metric: "Orders", ...Object.fromEntries(salesmenPerformance.map((p) => [p.name.split(" ")[0], Math.round((p.totalOrders / maxOrders) * 100)])) },
      { metric: "Quantity", ...Object.fromEntries(salesmenPerformance.map((p) => [p.name.split(" ")[0], Math.round((p.totalQty / maxQty) * 100)])) },
      { metric: "Customers", ...Object.fromEntries(salesmenPerformance.map((p) => [p.name.split(" ")[0], Math.round((p.uniqueCustomers / maxCustomers) * 100)])) },
      { metric: "Delivery", ...Object.fromEntries(salesmenPerformance.map((p) => [p.name.split(" ")[0], Math.round((p.delivered / maxDelivered) * 100)])) },
      { metric: "Target %", ...Object.fromEntries(salesmenPerformance.map((p) => [p.name.split(" ")[0], p.achievement])) },
    ];
  }, [salesmenPerformance]);

  const radarColors = ["#3b82f6", "#10b981", "#f59e0b"];

  const getAchievementColor = (pct: number) => {
    if (pct >= 80) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getAchievementBg = (pct: number) => {
    if (pct >= 80) return "bg-green-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard title="Active Salesmen" value={String(kpis.activeSalesmen)}
          icon={UserCheck} iconBg="bg-blue-50" iconColor="text-blue-500" />
        <KpiCard title="Total Orders" value={String(kpis.totalOrders)}
          sub="Across all salesmen"
          icon={ShoppingCart} iconBg="bg-green-50" iconColor="text-green-500" />
        <KpiCard title="Total Qty Sold" value={`${(kpis.totalQty / 1000).toFixed(1)}K`}
          sub="Sheets / KG combined"
          icon={Package} iconBg="bg-purple-50" iconColor="text-purple-500" />
        <KpiCard title="Customers Served" value={String(kpis.totalCustomers)}
          icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-500" />
        <KpiCard title="Avg Achievement" value={`${kpis.avgAchievement}%`}
          sub="Target vs actual"
          icon={Target} iconBg="bg-orange-50" iconColor="text-orange-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Salesman Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Performance Comparison</h2>
          <p className="text-xs text-gray-400 mb-4">Orders, quantity (in K), and customer count</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={32} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qty" name="Qty (K)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="customers" name="Customers" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Skill Radar</h2>
          <p className="text-xs text-gray-400 mb-4">Relative performance across dimensions</p>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
              {salesmenPerformance.map((p, i) => (
                <Radar
                  key={p.id}
                  name={p.name.split(" ")[0]}
                  dataKey={p.name.split(" ")[0]}
                  stroke={radarColors[i % radarColors.length]}
                  fill={radarColors[i % radarColors.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Salesman Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {salesmenPerformance.map((sm) => (
          <div key={sm.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{sm.name}</h3>
                <p className="text-xs text-gray-500">{sm.territory}</p>
              </div>
              <div className={`flex items-center gap-1 text-sm font-bold ${getAchievementColor(sm.achievement)}`}>
                <Target className="h-4 w-4" />
                {sm.achievement}%
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="h-2 rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${getAchievementBg(sm.achievement)} transition-all`}
                  style={{ width: `${Math.min(100, sm.achievement)}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>{sm.totalQty.toLocaleString()} sold</span>
                <span>Target: {sm.target.toLocaleString()}</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Orders", value: sm.totalOrders, color: "text-blue-600" },
                { label: "Delivered", value: sm.delivered, color: "text-green-600" },
                { label: "Pending", value: sm.pending, color: "text-orange-600" },
                { label: "Customers", value: sm.uniqueCustomers, color: "text-indigo-600" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-gray-50 py-2">
                  <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
