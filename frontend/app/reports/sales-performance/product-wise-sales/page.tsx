"use client";

import { useMemo } from "react";
import { mockSalesOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Package, Layers, TrendingUp, DollarSign } from "lucide-react";

interface ProductRow {
  paper: string;
  gsm: number;
  size: string;
  totalOrders: number;
  totalQty: number;
  totalValue: number;
  avgRate: number;
}

export default function ProductWiseSalesPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const map: Record<string, ProductRow> = {};
    mockSalesOrders.forEach((so) => {
      so.lines.forEach((line) => {
        const key = `${line.materialCode}|${line.gsm}|${line.size}`;
        if (!map[key]) {
          map[key] = { paper: line.materialCode || 'N/A', gsm: line.gsm || 0, size: line.size || '', totalOrders: 0, totalQty: 0, totalValue: 0, avgRate: 0 };
        }
        map[key].totalOrders += 1;
        map[key].totalQty += line.orderedQty;
        map[key].totalValue += line.amount;
      });
    });
    const rows = Object.values(map)
      .map((r) => ({ ...r, avgRate: r.totalQty > 0 ? Math.round(r.totalValue / r.totalQty) : 0 }))
      .sort((a, b) => b.totalQty - a.totalQty);

    const topProduct = rows[0];
    const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);
    const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);

    const kpis = [
      { label: "Unique Products", value: String(rows.length), icon: Layers, iconBg: "bg-purple-50", iconColor: "text-purple-500" },
      { label: "Top Product", value: topProduct ? `${topProduct.paper} ${topProduct.gsm}` : "—", sub: topProduct ? `${(topProduct.totalQty / 1000).toFixed(0)}K sht` : "", icon: Package, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Total Volume", value: `${(totalQty / 1000).toFixed(0)}K sht`, icon: TrendingUp, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Total Value", value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: DollarSign, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    ];

    const chartData = rows.slice(0, 8).map((r) => ({
      label: `${r.paper} ${r.gsm}G ${r.size}`,
      value: r.totalQty,
      color: "#a855f7",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Sales & Performance"
      categoryHref="/reports/sales-performance"
      reportName="Product Wise Sales"
      reportDescription="Quantity and revenue broken down by paper type, GSM, and size."
      kpis={kpis}
      chartTitle="Top Products by Volume"
      chartData={chartData}
      chartType="horizontal-bar"
      chartColor="#a855f7"
      chartFormatValue={(v) => `${v.toLocaleString("en-IN")} sht`}
      tableColumns={["Paper", "GSM", "Size", "Orders", "Total Qty", "Total Value", "Avg Rate/sht"]}
      exportFilename="product-wise-sales"
      exportData={[
        ["Paper", "GSM", "Size", "Orders", "Total Qty", "Total Value (₹)", "Avg Rate/sht (₹)"],
        ...rows.map((r) => [r.paper, r.gsm, r.size, r.totalOrders, r.totalQty, r.totalValue, r.avgRate]),
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
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Orders</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Qty</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Value</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Avg Rate/sht</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={`${r.paper}-${r.gsm}-${r.size}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.paper}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.gsm}</td>
                  <td className="px-4 py-3 text-gray-600">{r.size}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalOrders}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totalQty.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">₹{r.totalValue.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-gray-600">₹{r.avgRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
