"use client";

import { useMemo } from "react";
import { mockSalesOrders, mockGRNs } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { BarChart3, CheckCircle2, AlertTriangle, Package } from "lucide-react";

interface SupplyRow {
  paper: string;
  gsm: number;
  size: string;
  totalOrdered: number;
  totalReceived: number;
  shortfall: number;
  coveragePct: number;
}

export default function ProductAgainstSupplyPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const orderedMap: Record<string, SupplyRow> = {};
    mockSalesOrders.forEach((so) => {
      so.lines.forEach((line) => {
        const key = `${line.materialCode}|${line.gsm}|${line.size}`;
        if (!orderedMap[key]) {
          orderedMap[key] = { paper: line.materialCode || 'N/A', gsm: line.gsm || 0, size: line.size || '', totalOrdered: 0, totalReceived: 0, shortfall: 0, coveragePct: 0 };
        }
        orderedMap[key].totalOrdered += line.orderedQty;
      });
    });

    mockGRNs.forEach((grn) => {
      const key = `${grn.paper}|${grn.gsm}|${grn.size}`;
      if (orderedMap[key]) {
        orderedMap[key].totalReceived += grn.receivedQty;
      }
    });

    const rows: SupplyRow[] = Object.values(orderedMap)
      .map((r) => ({
        ...r,
        shortfall: Math.max(0, r.totalOrdered - r.totalReceived),
        coveragePct: r.totalOrdered > 0 ? Math.min(100, Math.round((r.totalReceived / r.totalOrdered) * 100)) : 0,
      }))
      .sort((a, b) => a.coveragePct - b.coveragePct);

    const fullyCovered = rows.filter((r) => r.coveragePct >= 100).length;
    const uncovered = rows.filter((r) => r.coveragePct === 0).length;
    const avgCoverage = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.coveragePct, 0) / rows.length) : 0;
    const totalShortfall = rows.reduce((s, r) => s + r.shortfall, 0);

    const kpis = [
      { label: "Avg Coverage", value: `${avgCoverage}%`, icon: BarChart3, iconBg: "bg-blue-50", iconColor: "text-blue-500", valueColor: avgCoverage >= 70 ? "text-green-600" : "text-orange-600" },
      { label: "Fully Covered", value: String(fullyCovered), sub: `of ${rows.length} products`, icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Uncovered", value: String(uncovered), sub: "0% supplied", icon: AlertTriangle, iconBg: "bg-red-50", iconColor: "text-red-500", valueColor: uncovered > 0 ? "text-red-600" : "text-gray-900" },
      { label: "Total Shortfall", value: `${(totalShortfall / 1000).toFixed(0)}K sht`, icon: Package, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
    ];

    const chartData = rows.slice(0, 8).map((r) => ({
      label: `${r.paper} ${r.gsm}g`,
      value: r.coveragePct,
      color: r.coveragePct >= 100 ? "#22c55e" : r.coveragePct >= 50 ? "#eab308" : "#ef4444",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Mill & Supply"
      categoryHref="/reports/mill-supply"
      reportName="Product Against Supply"
      reportDescription="What was ordered vs what was actually supplied, with shortfall analysis."
      kpis={kpis}
      chartTitle="Coverage % by Product"
      chartData={chartData}
      chartType="bar"
      chartColor="#22c55e"
      chartFormatValue={(v) => `${v}%`}
      tableColumns={["Paper", "GSM", "Size", "Ordered", "Received", "Shortfall", "Coverage"]}
      exportFilename="product-against-supply"
      exportData={[
        ["Paper", "GSM", "Size", "Ordered", "Received", "Shortfall", "Coverage (%)"],
        ...rows.map((r) => [r.paper, r.gsm, r.size, r.totalOrdered, r.totalReceived, r.shortfall, r.coveragePct]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Paper</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">GSM</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Size</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Ordered</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Received</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Shortfall</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={`${r.paper}-${r.gsm}-${r.size}`} className={`hover:bg-gray-50 transition-colors ${r.coveragePct === 0 ? "bg-red-50/20" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.paper}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.gsm}</td>
                  <td className="px-4 py-3 text-gray-600">{r.size}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totalOrdered.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalReceived.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right">
                    {r.shortfall > 0 ? <span className="font-medium text-red-600">{r.shortfall.toLocaleString("en-IN")}</span> : <span className="text-green-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 rounded-full bg-gray-200 h-1.5">
                        <div className={`h-1.5 rounded-full ${r.coveragePct >= 100 ? "bg-green-500" : r.coveragePct >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${r.coveragePct}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${r.coveragePct >= 100 ? "text-green-600" : r.coveragePct >= 50 ? "text-yellow-600" : "text-red-600"}`}>{r.coveragePct}%</span>
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
