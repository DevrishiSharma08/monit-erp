"use client";

import { useMemo } from "react";
import { mockMillTrackers, mockPurchaseOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Factory, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface MillRow {
  mill: string;
  totalOrders: number;
  dispatched: number;
  inProduction: number;
  delayed: number;
  onTimePct: number;
}

export default function MillPerformancePage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const map: Record<string, MillRow> = {};
    mockMillTrackers.forEach((t) => {
      if (!map[t.mill]) {
        map[t.mill] = { mill: t.mill, totalOrders: 0, dispatched: 0, inProduction: 0, delayed: 0, onTimePct: 0 };
      }
      map[t.mill].totalOrders += 1;
      if (t.productionStatus === "Dispatched") map[t.mill].dispatched += 1;
      if (t.productionStatus === "In Production") map[t.mill].inProduction += 1;
      const today = new Date();
      const expected = new Date(t.expectedDelivery);
      if (t.productionStatus !== "Dispatched" && expected < today) map[t.mill].delayed += 1;
    });

    const rows: MillRow[] = Object.values(map).map((r) => ({
      ...r,
      onTimePct: r.totalOrders > 0 ? Math.round(((r.totalOrders - r.delayed) / r.totalOrders) * 100) : 100,
    })).sort((a, b) => b.onTimePct - a.onTimePct);

    const totalOrders = rows.reduce((s, r) => s + r.totalOrders, 0);
    const totalDispatched = rows.reduce((s, r) => s + r.dispatched, 0);
    const totalDelayed = rows.reduce((s, r) => s + r.delayed, 0);
    const avgOnTime = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.onTimePct, 0) / rows.length) : 100;

    const kpis = [
      { label: "Mills Tracked", value: String(rows.length), icon: Factory, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Total POs", value: String(totalOrders), icon: Clock, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
      { label: "Avg On-Time %", value: `${avgOnTime}%`, sub: `${totalDispatched} dispatched`, icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500", valueColor: avgOnTime >= 80 ? "text-green-600" : "text-orange-600" },
      { label: "Delayed", value: String(totalDelayed), sub: "Past expected date", icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500", valueColor: totalDelayed > 0 ? "text-red-600" : "text-gray-900" },
    ];

    const chartData = rows.map((r) => ({
      label: r.mill.length > 16 ? r.mill.slice(0, 16) + "…" : r.mill,
      value: r.onTimePct,
      color: r.onTimePct >= 80 ? "#22c55e" : r.onTimePct >= 60 ? "#eab308" : "#ef4444",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Mill & Supply"
      categoryHref="/reports/mill-supply"
      reportName="Mill Performance"
      reportDescription="On-time delivery %, production delays, and dispatch stats per mill."
      kpis={kpis}
      chartTitle="On-Time % by Mill"
      chartData={chartData}
      chartType="bar"
      chartColor="#3b82f6"
      chartFormatValue={(v) => `${v}%`}
      tableColumns={["Mill", "Total POs", "Dispatched", "In Production", "Delayed", "On-Time %"]}
      exportFilename="mill-performance"
      exportData={[
        ["Mill", "Total POs", "Dispatched", "In Production", "Delayed", "On-Time (%)"],
        ...rows.map((r) => [r.mill, r.totalOrders, r.dispatched, r.inProduction, r.delayed, r.onTimePct]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Mill</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total POs</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Dispatched</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">In Production</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Delayed</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">On-Time %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.mill} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.mill}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalOrders}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{r.dispatched}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{r.inProduction}</td>
                  <td className="px-4 py-3 text-right">
                    {r.delayed > 0 ? <span className="font-medium text-red-600">{r.delayed}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 rounded-full bg-gray-200 h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${r.onTimePct >= 80 ? "bg-green-500" : r.onTimePct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${r.onTimePct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${r.onTimePct >= 80 ? "text-green-600" : r.onTimePct >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                        {r.onTimePct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
