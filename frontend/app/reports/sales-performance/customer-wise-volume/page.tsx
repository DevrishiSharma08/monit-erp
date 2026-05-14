"use client";

import { useMemo } from "react";
import { mockSalesOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Users, Package, TrendingUp, Star } from "lucide-react";

interface CustomerRow {
  customer: string;
  company: string;
  salesman: string;
  totalOrders: number;
  totalQty: number;
  totalValue: number;
  lastOrderDate: string;
}

export default function CustomerWiseVolumePage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const map: Record<string, CustomerRow> = {};
    mockSalesOrders.forEach((so) => {
      if (!map[so.customer]) {
        map[so.customer] = {
          customer: so.contactPerson,
          company: so.customer,
          salesman: so.salesman,
          totalOrders: 0,
          totalQty: 0,
          totalValue: 0,
          lastOrderDate: so.orderDate,
        };
      }
      const r = map[so.customer];
      r.totalOrders += 1;
      r.totalQty += so.lines.reduce((s, l) => s + l.orderedQty, 0);
      r.totalValue += so.totalValue;
      if (so.orderDate > r.lastOrderDate) r.lastOrderDate = so.orderDate;
    });

    const rows = Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
    const topCustomer = rows[0];
    const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);

    const kpis = [
      { label: "Total Customers", value: String(rows.length), icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Top Customer", value: topCustomer?.company.split(" ")[0] ?? "—", sub: topCustomer ? `₹${(topCustomer.totalValue / 1000).toFixed(0)}K` : "", icon: Star, iconBg: "bg-yellow-50", iconColor: "text-yellow-500" },
      { label: "Total Volume", value: `${(rows.reduce((s, r) => s + r.totalQty, 0) / 1000).toFixed(0)}K sht`, icon: Package, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Total Revenue", value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: TrendingUp, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    ];

    const chartData = rows.slice(0, 8).map((r) => ({
      label: r.company.length > 18 ? r.company.slice(0, 18) + "…" : r.company,
      value: r.totalValue,
      color: "#3b82f6",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Sales & Performance"
      categoryHref="/reports/sales-performance"
      reportName="Customer Wise Volume"
      reportDescription="Total quantity and value ordered per customer with ranking."
      kpis={kpis}
      chartTitle="Top Customers by Revenue"
      chartData={chartData}
      chartType="horizontal-bar"
      chartColor="#3b82f6"
      chartFormatValue={(v) => `₹${(v / 1000).toFixed(0)}K`}
      tableColumns={["Rank", "Company", "Salesman", "Orders", "Total Qty (sht)", "Total Value", "Last Order"]}
      exportFilename="customer-wise-volume"
      exportData={[
        ["Rank", "Company", "Salesman", "Orders", "Total Qty (sht)", "Total Value (₹)", "Last Order"],
        ...rows.map((r, idx) => [idx + 1, r.company, r.salesman, r.totalOrders, r.totalQty, r.totalValue, r.lastOrderDate]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Rank</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Company</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Salesman</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Orders</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Qty (sht)</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Value</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => (
                <tr key={r.company} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      idx === 0 ? "bg-yellow-100 text-yellow-700" :
                      idx === 1 ? "bg-gray-100 text-gray-600" :
                      idx === 2 ? "bg-orange-100 text-orange-600" : "text-gray-400"
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.company}</td>
                  <td className="px-4 py-3 text-gray-600">{r.salesman}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalOrders}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totalQty.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">₹{r.totalValue.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-gray-500">{r.lastOrderDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
