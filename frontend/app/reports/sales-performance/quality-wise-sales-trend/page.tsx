"use client";

import { useMemo } from "react";
import { mockSalesOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { BarChart3, Package, TrendingUp, DollarSign } from "lucide-react";

interface QualityRow {
  paper: string;
  gsm: number;
  totalOrders: number;
  totalQty: number;
  totalValue: number;
  avgRate: number;
}

export default function QualityWiseSalesTrendPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const map: Record<string, QualityRow> = {};
    mockSalesOrders.forEach((so) => {
      so.lines.forEach((line) => {
        const key = `${line.materialCode}|${line.gsm}`;
        if (!map[key]) {
          map[key] = { paper: line.materialCode || 'N/A', gsm: line.gsm || 0, totalOrders: 0, totalQty: 0, totalValue: 0, avgRate: 0 };
        }
        map[key].totalOrders += 1;
        map[key].totalQty += line.orderedQty;
        map[key].totalValue += line.amount;
      });
    });

    const rows = Object.values(map)
      .map((r) => ({ ...r, avgRate: r.totalQty > 0 ? Math.round(r.totalValue / r.totalQty) : 0 }))
      .sort((a, b) => b.totalQty - a.totalQty);

    const topGsm = rows[0];
    const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);
    const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);

    const kpis = [
      { label: "GSM Grades", value: String(rows.length), icon: BarChart3, iconBg: "bg-cyan-50", iconColor: "text-cyan-500" },
      { label: "Top GSM", value: topGsm ? `${topGsm.gsm} GSM` : "—", sub: topGsm?.paper ?? "", icon: Package, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Total Volume", value: `${(totalQty / 1000).toFixed(0)}K sht`, icon: TrendingUp, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Total Value", value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: DollarSign, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    ];

    const monthlyData: Record<string, number> = {};
    mockSalesOrders.forEach((so) => {
      const month = so.orderDate.substring(0, 7);
      so.lines.forEach((line) => {
        monthlyData[month] = (monthlyData[month] ?? 0) + line.orderedQty;
      });
    });
    const chartData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        label: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        value,
      }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Sales & Performance"
      categoryHref="/reports/sales-performance"
      reportName="Quality Wise Sales Trend"
      reportDescription="Sales volume and revenue segmented by paper quality grade and GSM."
      kpis={kpis}
      chartTitle="Monthly Total Quantity"
      chartData={chartData}
      chartType="area"
      chartColor="#6366f1"
      chartFormatValue={(v) => `${(v / 1000).toFixed(0)}K sht`}
      tableColumns={["Paper", "GSM", "Orders", "Total Qty", "Total Value", "Avg Rate/sht", "Share"]}
      exportFilename="quality-wise-sales-trend"
      exportData={[
        ["Paper", "GSM", "Orders", "Total Qty", "Total Value (₹)", "Avg Rate/sht (₹)", "Share (%)"],
        ...rows.map((r) => {
          const total = rows.reduce((s, x) => s + x.totalQty, 0);
          return [r.paper, r.gsm, r.totalOrders, r.totalQty, r.totalValue, r.avgRate, total > 0 ? Math.round((r.totalQty / total) * 100) : 0];
        }),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Paper</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">GSM</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Orders</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Qty</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Value</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Avg Rate/sht</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const totalQty = rows.reduce((s, x) => s + x.totalQty, 0);
                const pct = totalQty > 0 ? Math.round((r.totalQty / totalQty) * 100) : 0;
                return (
                  <tr key={`${r.paper}-${r.gsm}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.paper}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">{r.gsm}g</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.totalOrders}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totalQty.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">₹{r.totalValue.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-gray-600">₹{r.avgRate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 rounded-full bg-gray-200 h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
