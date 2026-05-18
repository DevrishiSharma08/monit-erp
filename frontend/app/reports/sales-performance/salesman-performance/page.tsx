"use client";

import { useMemo } from "react";
import { mockSalesOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { UserCheck, Users, TrendingUp, Star } from "lucide-react";

interface SalesmanRow {
  salesman: string;
  totalOrders: number;
  totalCustomers: number;
  totalQty: number;
  totalValue: number;
  avgOrderValue: number;
}

export default function SalesmanPerformancePage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const map: Record<string, SalesmanRow & { customers: Set<string> }> = {};
    mockSalesOrders.forEach((so) => {
      if (!map[so.salesman]) {
        map[so.salesman] = {
          salesman: so.salesman,
          totalOrders: 0,
          totalCustomers: 0,
          customers: new Set(),
          totalQty: 0,
          totalValue: 0,
          avgOrderValue: 0,
        };
      }
      const r = map[so.salesman];
      r.totalOrders += 1;
      r.customers.add(so.customer);
      r.totalQty += so.lines.reduce((s, l) => s + l.orderedQty, 0);
      r.totalValue += so.totalValue;
    });

    const rows: SalesmanRow[] = Object.values(map)
      .map((r) => ({
        salesman: r.salesman,
        totalOrders: r.totalOrders,
        totalCustomers: r.customers.size,
        totalQty: r.totalQty,
        totalValue: r.totalValue,
        avgOrderValue: r.totalOrders > 0 ? Math.round(r.totalValue / r.totalOrders) : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    const top = rows[0];
    const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);

    const kpis = [
      { label: "Active Salesmen", value: String(rows.length), icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Best Performer", value: top?.salesman.split(" ")[0] ?? "—", sub: top ? `₹${(top.totalValue / 1000).toFixed(0)}K` : "", icon: Star, iconBg: "bg-yellow-50", iconColor: "text-yellow-500" },
      { label: "Total Revenue", value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: TrendingUp, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Avg per Salesman", value: `₹${rows.length > 0 ? (totalValue / rows.length / 1000).toFixed(0) : 0}K`, icon: UserCheck, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    ];

    const chartData = rows.map((r) => ({
      label: r.salesman.length > 15 ? r.salesman.slice(0, 15) + "…" : r.salesman,
      value: r.totalValue,
      color: "#22c55e",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Sales & Performance"
      categoryHref="/reports/sales-performance"
      reportName="Salesman Performance"
      reportDescription="Orders, revenue, and customer count per salesman with ranking."
      kpis={kpis}
      chartTitle="Revenue by Salesman"
      chartData={chartData}
      chartType="bar"
      chartColor="#22c55e"
      chartFormatValue={(v) => `₹${(v / 1000).toFixed(0)}K`}
      tableColumns={["Rank", "Salesman", "Orders", "Customers", "Total Qty", "Total Value", "Avg Order Value"]}
      exportFilename="salesman-performance"
      exportData={[
        ["Rank", "Salesman", "Orders", "Customers", "Total Qty", "Total Value (₹)", "Avg Order Value (₹)"],
        ...rows.map((r, idx) => [idx + 1, r.salesman, r.totalOrders, r.totalCustomers, r.totalQty, r.totalValue, r.avgOrderValue]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Rank</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Salesman</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Orders</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Customers</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Qty</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Value</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Avg Order Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => (
                <tr key={r.salesman} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      idx === 0 ? "bg-yellow-100 text-yellow-700" :
                      idx === 1 ? "bg-gray-100 text-gray-600" :
                      idx === 2 ? "bg-orange-100 text-orange-600" : "text-gray-400"
                    }`}>{idx + 1}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.salesman}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalOrders}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalCustomers}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totalQty.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">₹{r.totalValue.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-gray-600">₹{r.avgOrderValue.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
