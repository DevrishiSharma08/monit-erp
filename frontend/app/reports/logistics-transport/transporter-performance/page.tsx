"use client";

import { useMemo } from "react";
import { mockTransporters, mockTruckLoadPlans } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Truck, Star, CheckCircle2, AlertTriangle } from "lucide-react";

interface TransporterRow {
  name: string;
  areaCovered: string;
  totalLoads: number;
  delivered: number;
  inTransit: number;
  onTimePct: number;
  serviceRating: number;
  ratePerMT: number;
}

export default function TransporterPerformancePage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const loadMap: Record<string, { total: number; delivered: number; inTransit: number }> = {};
    mockTruckLoadPlans.forEach((p) => {
      const name = p.transporterName ?? "Unknown";
      if (!loadMap[name]) loadMap[name] = { total: 0, delivered: 0, inTransit: 0 };
      loadMap[name].total += 1;
      if (p.status === "Delivered") loadMap[name].delivered += 1;
      if (p.status === "In Transit") loadMap[name].inTransit += 1;
    });

    const rows: TransporterRow[] = mockTransporters.map((t) => {
      const loads = loadMap[t.name] ?? { total: 0, delivered: 0, inTransit: 0 };
      const onTimePct = loads.total > 0 ? Math.round((loads.delivered / loads.total) * 100) : 0;
      return {
        name: t.name,
        areaCovered: t.areaCovered,
        totalLoads: loads.total,
        delivered: loads.delivered,
        inTransit: loads.inTransit,
        onTimePct,
        serviceRating: t.serviceRating,
        ratePerMT: t.ratePerMT,
      };
    }).sort((a, b) => b.serviceRating - a.serviceRating);

    const avgRating = rows.length > 0 ? (rows.reduce((s, r) => s + r.serviceRating, 0) / rows.length).toFixed(1) : "0.0";
    const activeCount = mockTransporters.filter((t) => t.status === "Active").length;
    const topRated = rows[0];

    const kpis = [
      { label: "Total Transporters", value: String(rows.length), icon: Truck, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Active", value: String(activeCount), icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Avg Rating", value: `${avgRating} / 5`, icon: Star, iconBg: "bg-yellow-50", iconColor: "text-yellow-500" },
      { label: "Top Rated", value: topRated?.name.split(" ")[0] ?? "—", sub: topRated ? `${topRated.serviceRating}/5 ★` : "", icon: AlertTriangle, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    ];

    const chartData = rows.map((r) => ({
      label: r.name.length > 16 ? r.name.slice(0, 16) + "…" : r.name,
      value: r.serviceRating,
      color: r.serviceRating >= 4 ? "#22c55e" : r.serviceRating >= 3 ? "#eab308" : "#ef4444",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Logistics & Transport"
      categoryHref="/reports/logistics-transport"
      reportName="Transporter Performance"
      reportDescription="On-time delivery %, service rating, and cost efficiency per transporter and area."
      kpis={kpis}
      chartTitle="Service Rating by Transporter"
      chartData={chartData}
      chartType="bar"
      chartColor="#22c55e"
      chartFormatValue={(v) => `${v} / 5`}
      tableColumns={["Transporter", "Area Covered", "Total Loads", "Delivered", "In Transit", "Rate/MT", "Rating"]}
      exportFilename="transporter-performance"
      exportData={[
        ["Transporter", "Area Covered", "Total Loads", "Delivered", "In Transit", "Rate/MT (₹)", "Rating (/5)"],
        ...rows.map((r) => [r.name, r.areaCovered, r.totalLoads, r.delivered, r.inTransit, r.ratePerMT, r.serviceRating]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Transporter</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Area Covered</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Loads</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Delivered</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">In Transit</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Rate/MT</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.areaCovered}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalLoads}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{r.delivered}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{r.inTransit}</td>
                  <td className="px-4 py-3 text-right text-gray-900">₹{r.ratePerMT.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map((s) => (
                        <span key={s} className={`text-xs ${s <= r.serviceRating ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                      ))}
                      <span className="ml-1 text-xs text-gray-500">({r.serviceRating})</span>
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
