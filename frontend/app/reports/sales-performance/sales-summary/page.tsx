"use client";

import { useMemo } from "react";
import { mockSalesOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ShoppingCart, TrendingUp, DollarSign, Calendar } from "lucide-react";

export default function SalesSummaryPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const total = mockSalesOrders.length;
    const totalValue = mockSalesOrders.reduce((s, o) => s + o.totalValue, 0);
    const avgValue = total > 0 ? totalValue / total : 0;
    const completed = mockSalesOrders.filter((o) => o.status === "Completed").length;

    const monthlyData: Record<string, number> = {};
    mockSalesOrders.forEach((so) => {
      const month = so.orderDate.substring(0, 7);
      monthlyData[month] = (monthlyData[month] ?? 0) + so.totalValue;
    });
    const chartData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        label: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        value,
      }));

    const kpis = [
      { label: "Total Orders", value: String(total), icon: ShoppingCart, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Total Value", value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: DollarSign, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Avg Order Value", value: `₹${(avgValue / 1000).toFixed(0)}K`, icon: TrendingUp, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
      { label: "Completed", value: String(completed), sub: `${Math.round((completed / total) * 100)}% completion`, icon: Calendar, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
    ];

    const rows = [...mockSalesOrders].sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Sales & Performance"
      categoryHref="/reports/sales-performance"
      reportName="Sales Summary"
      reportDescription="Complete sales order summary with value, volume, and status breakdown."
      kpis={kpis}
      chartTitle="Monthly Order Value"
      chartData={chartData}
      chartType="area"
      chartColor="#14b8a6"
      chartFormatValue={(v) => `₹${(v / 1000).toFixed(0)}K`}
      tableColumns={["SO #", "Customer", "Salesman", "Order Date", "Expected Delivery", "Lines", "Value", "Status"]}
      exportFilename="sales-summary"
      exportData={[
        ["SO #", "Customer", "Salesman", "Order Date", "Expected Delivery", "Lines", "Value (₹)", "Status"],
        ...rows.map((so) => [so.soNumber, so.customer, so.salesman, so.orderDate, so.lines[0]?.requiredDeliveryDate ?? "N/A", so.lines.length, so.totalValue, so.status]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">SO #</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Salesman</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Order Date</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Expected Delivery</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Lines</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Value</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((so) => (
                <tr key={so.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-blue-600">{so.soNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{so.customer}</td>
                  <td className="px-4 py-3 text-gray-600">{so.salesman}</td>
                  <td className="px-4 py-3 text-gray-600">{so.orderDate}</td>
                  <td className="px-4 py-3 text-gray-600">{so.lines[0]?.requiredDeliveryDate || 'N/A'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{so.lines.length}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    ₹{so.totalValue.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      so.status === "Completed" || so.status === "Closed" ? "bg-green-50 text-green-600" :
                      so.status === "In Dispatch" ? "bg-blue-50 text-blue-600" :
                      so.status === "Cancelled" ? "bg-rose-50 text-rose-600" :
                      "bg-amber-50 text-amber-600"
                    }`}>
                      {so.status}
                    </span>
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
