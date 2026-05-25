"use client";

import { useMemo } from "react";
import {
  Truck, Package, Factory, MapPinned, Clock, CheckCircle2,
  AlertTriangle, ListOrdered, ClipboardCheck, Layers,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  mockTruckLoadPlans, mockPurchaseOrders, mockSalesOrders,
  mockStockLots, mockChallans, mockGRNs, mockMills,
} from "@/data/mockData";

function KpiCard({
  title, value, sub, icon: Icon, iconBg, iconColor,
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-white/80 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${iconBg}`}>
      <p className={`text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider truncate ${iconColor}`}>{title}</p>
      <p className="mt-1.5 text-2xl sm:text-4xl font-black text-gray-900 leading-none tabular-nums animate-kpi-value">{value}</p>
      {sub && <p className="mt-1 text-[10px] sm:text-xs text-gray-500 truncate">{sub}</p>}
      <div className={`pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18] ${iconColor}`}>
        <Icon className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1} />
      </div>
    </div>
  );
}

export default function PlannerDashboard() {
  // ── Truck Load Stats ──
  const truckStats = useMemo(() => {
    const total = mockTruckLoadPlans.length;
    const planned = mockTruckLoadPlans.filter((t) => t.status === "Planned").length;
    const loading = mockTruckLoadPlans.filter((t) => t.status === "Loading").length;
    const inTransit = mockTruckLoadPlans.filter((t) => t.status === "Dispatched").length;
    const delivered = mockTruckLoadPlans.filter((t) => t.status === "Received").length;
    return { total, planned, loading, dispatched: inTransit, delivered };
  }, []);

  // ── Mill Order Stats ──
  const millStats = useMemo(() => {
    const total = mockPurchaseOrders.length;
    const pending = mockPurchaseOrders.filter((po) => po.status === "Draft" || po.status === "Sent to Mill").length;
    const confirmed = mockPurchaseOrders.filter((po) => po.status === "Acknowledged" || po.status === "In Production").length;
    const inTransit = mockPurchaseOrders.filter((po) => po.status === "Dispatched").length;
    const received = mockPurchaseOrders.filter((po) => po.status === "Part Received" || po.status === "Completed").length;
    return { total, pending, confirmed, inTransit, received };
  }, []);

  // ── Dispatch queue (orders needing dispatch) ──
  const dispatchReady = useMemo(() => {
    return mockSalesOrders.filter(
      (so) => so.status === "Fully Allocated" || so.status === "In Dispatch"
    ).length;
  }, []);

  // ── GRN Stats ──
  const grnStats = useMemo(() => {
    const total = mockGRNs.length;
    const pending = mockGRNs.filter((g) => g.status === "Draft" || g.status === "QC Pending").length;
    const verified = mockGRNs.filter((g) => g.status === "Approved" || g.status === "Stock Updated").length;
    return { total, pending, verified };
  }, []);

  // ── Stock by warehouse ──
  const warehouseStock = useMemo(() => {
    const map = new Map<string, { available: number; allocated: number; lots: number }>();
    mockStockLots.forEach((lot) => {
      const w = lot.warehouse || "Unknown";
      const existing = map.get(w) || { available: 0, allocated: 0, lots: 0 };
      existing.available += lot.availableQty;
      existing.allocated += lot.allocatedQty;
      existing.lots += 1;
      map.set(w, existing);
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      warehouse: name,
      available: data.available,
      allocated: data.allocated,
      lots: data.lots,
    }));
  }, []);

  // ── Mill readiness bar chart ──
  const millReadiness = useMemo(() => {
    return mockMills.filter((m) => m.status === "Active").map((mill) => {
      const pos = mockPurchaseOrders.filter((po) => po.mill === mill.name);
      const pendingQty = pos
        .filter((po) => po.status !== "Completed")
        .reduce((s, po) => s + po.items.reduce((is, i) => is + i.orderedQty, 0), 0);
      const deliveredQty = pos
        .filter((po) => po.status === "Completed")
        .reduce((s, po) => s + po.items.reduce((is, i) => is + i.orderedQty, 0), 0);
      return {
        mill: mill.name.length > 12 ? mill.name.substring(0, 12) + "..." : mill.name,
        pending: Math.round(pendingQty / 1000),
        delivered: Math.round(deliveredQty / 1000),
      };
    });
  }, []);

  // ── Recent truck loads ──
  const recentTrucks = useMemo(() => {
    return [...mockTruckLoadPlans]
      .sort((a, b) => b.planDate.localeCompare(a.planDate))
      .slice(0, 6);
  }, []);

  const truckStatusColor: Record<string, string> = {
    Planned: "bg-blue-100 text-blue-700",
    Loading: "bg-yellow-100 text-yellow-700",
    Dispatched: "bg-purple-100 text-purple-700",
    Received: "bg-green-100 text-green-700",
    Cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="kpi-grid grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Truck Loads" value={String(truckStats.total)}
          sub={`${truckStats.planned} planned`}
          icon={Truck} iconBg="bg-blue-50" iconColor="text-blue-500" />
        <KpiCard title="Loading Now" value={String(truckStats.loading)}
          sub="Active loading"
          icon={Package} iconBg="bg-yellow-50" iconColor="text-yellow-500" />
        <KpiCard title="Dispatched" value={String(truckStats.dispatched)}
          sub="On the road"
          icon={MapPinned} iconBg="bg-purple-50" iconColor="text-purple-500" />
        <KpiCard title="Dispatch Ready" value={String(dispatchReady)}
          sub="Orders to dispatch"
          icon={ListOrdered} iconBg="bg-green-50" iconColor="text-green-500" />
        <KpiCard title="Mill Orders Pending" value={String(millStats.pending)}
          sub={`${millStats.confirmed} confirmed`}
          icon={Factory} iconBg="bg-orange-50" iconColor="text-orange-500" />
        <KpiCard title="GRN Pending" value={String(grnStats.pending)}
          sub={`${grnStats.verified} verified`}
          icon={ClipboardCheck} iconBg="bg-indigo-50" iconColor="text-indigo-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Mill Readiness Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Mill Order Status</h2>
          <p className="text-xs text-gray-400 mb-4">Pending vs delivered quantities (in thousands)</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={millReadiness} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="mill" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={32} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pending" name="Pending (K)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" name="Received (K)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Truck Load Pipeline */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Truck Load Pipeline</h2>
          <div className="space-y-3">
            {[
              { status: "Planned", count: truckStats.planned, color: "bg-blue-500", icon: Clock },
              { status: "Loading", count: truckStats.loading, color: "bg-yellow-500", icon: Package },
              { status: "Dispatched", count: truckStats.dispatched, color: "bg-purple-500", icon: Truck },
              { status: "Received", count: truckStats.delivered, color: "bg-green-500", icon: CheckCircle2 },
            ].map((item) => (
              <div key={item.status} className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${item.color} bg-opacity-15`}>
                  <item.icon className={`h-4 w-4 ${item.color.replace("bg-", "text-")}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.status}</span>
                    <span className="font-bold text-gray-900">{item.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${truckStats.total > 0 ? (item.count / truckStats.total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mill Order Status Summary */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Mill Order Summary</h3>
            <div className="space-y-1.5">
              {[
                { label: "Pending / Sent", count: millStats.pending, dot: "bg-orange-500" },
                { label: "Confirmed", count: millStats.confirmed, dot: "bg-blue-500" },
                { label: "Dispatched", count: millStats.inTransit, dot: "bg-purple-500" },
                { label: "Received", count: millStats.received, dot: "bg-green-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                    <span className="text-gray-600">{item.label}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Stock + Recent Trucks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Warehouse Stock */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Warehouse Stock</h2>
          </div>
          {warehouseStock.length > 0 ? (
            <div className="space-y-3">
              {warehouseStock.map((w) => (
                <div key={w.warehouse} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{w.warehouse}</span>
                    <span className="text-xs text-gray-500">{w.lots} lots</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-green-50 p-2 text-center">
                      <p className="text-lg font-bold text-green-700">{w.available.toLocaleString()}</p>
                      <p className="text-[10px] text-green-600">Available</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2 text-center">
                      <p className="text-lg font-bold text-blue-700">{w.allocated.toLocaleString()}</p>
                      <p className="text-[10px] text-blue-600">Allocated</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No stock lots found.</p>
          )}
        </div>

        {/* Recent Truck Loads */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Truck Loads</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {["TLP #", "Transporter", "Route", "Status", "Date"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-gray-700 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrucks.map((truck) => (
                  <tr key={truck.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-blue-600 text-xs">{truck.planNumber}</td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">{truck.transporterName || "—"}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{truck.origin} → {truck.items[0]?.deliveryLocation ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${truckStatusColor[truck.status] || "bg-gray-100 text-gray-600"}`}>
                        {truck.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{truck.planDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
