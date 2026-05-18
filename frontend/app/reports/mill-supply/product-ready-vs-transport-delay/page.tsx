"use client";

import { useMemo } from "react";
import { mockMillTrackers, mockTruckLoadPlans } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Truck, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface DelayRow {
  poNumber: string;
  mill: string;
  paper: string;
  gsm: number;
  size: string;
  readyDate: string;
  plannedDispatch: string;
  delayDays: number;
  status: string;
}

export default function ProductReadyVsTransportDelayPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const planMap: Record<string, string> = {};
    mockTruckLoadPlans.forEach((p) => {
      p.items.forEach((item) => {
        if (item.poNumber) planMap[item.poNumber] = p.plannedLoadDate;
      });
    });

    const rows: DelayRow[] = mockMillTrackers
      .filter((t) => t.productionStatus === "Ready" || t.productionStatus === "Dispatched")
      .map((t) => {
        const plannedDispatch = planMap[t.poNumber] ?? t.expectedDelivery;
        const readyDate = t.lastUpdate;
        const delay = Math.max(0, Math.ceil(
          (new Date(plannedDispatch).getTime() - new Date(readyDate).getTime()) / (1000 * 60 * 60 * 24)
        ));
        return {
          poNumber: t.poNumber,
          mill: t.mill,
          paper: t.paper,
          gsm: t.gsm,
          size: t.size,
          readyDate,
          plannedDispatch,
          delayDays: delay,
          status: t.productionStatus,
        };
      }).sort((a, b) => b.delayDays - a.delayDays);

    const avgDelay = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.delayDays, 0) / rows.length) : 0;
    const onTime = rows.filter((r) => r.delayDays <= 1).length;
    const delayed = rows.filter((r) => r.delayDays > 1).length;

    const kpis = [
      { label: "Total Ready", value: String(rows.length), icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "On Time (≤1 day)", value: String(onTime), icon: Truck, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Transport Delayed", value: String(delayed), icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500", valueColor: delayed > 0 ? "text-red-600" : "text-gray-900" },
      { label: "Avg Wait (days)", value: String(avgDelay), sub: "Ready → Dispatch", icon: Clock, iconBg: "bg-orange-50", iconColor: "text-orange-500", valueColor: avgDelay > 3 ? "text-orange-600" : "text-gray-900" },
    ];

    const millDelay: Record<string, number[]> = {};
    rows.forEach((r) => { (millDelay[r.mill] = millDelay[r.mill] ?? []).push(r.delayDays); });
    const chartData = Object.entries(millDelay).map(([mill, delays]) => ({
      label: mill.length > 16 ? mill.slice(0, 16) + "…" : mill,
      value: Math.round(delays.reduce((s, d) => s + d, 0) / delays.length),
      color: "#f97316",
    })).sort((a, b) => b.value - a.value);

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Mill & Supply"
      categoryHref="/reports/mill-supply"
      reportName="Product Ready vs Transport Delay"
      reportDescription="Days between mill readiness and actual truck dispatch — measures transporter lag."
      kpis={kpis}
      chartTitle="Avg Transport Delay by Mill (days)"
      chartData={chartData}
      chartType="bar"
      chartColor="#f97316"
      chartFormatValue={(v) => `${v} days`}
      tableColumns={["PO #", "Mill", "Material", "Ready Date", "Planned Dispatch", "Wait Days", "Status"]}
      exportFilename="product-ready-vs-transport-delay"
      exportData={[
        ["PO #", "Mill", "Material", "GSM", "Size", "Ready Date", "Planned Dispatch", "Wait Days", "Status"],
        ...rows.map((r) => [r.poNumber, r.mill, r.paper, r.gsm, r.size, r.readyDate, r.plannedDispatch, r.delayDays, r.status]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">PO #</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Mill</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Material</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Ready Date</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Planned Dispatch</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Wait Days</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.poNumber} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-blue-600">{r.poNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{r.mill}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.paper}</div>
                    <div className="text-xs text-gray-500">{r.gsm}g · {r.size}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.readyDate}</td>
                  <td className="px-4 py-3 text-gray-600">{r.plannedDispatch}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${r.delayDays > 3 ? "text-red-600" : r.delayDays > 1 ? "text-orange-600" : "text-green-600"}`}>
                      {r.delayDays}d
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "Dispatched" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No ready orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
