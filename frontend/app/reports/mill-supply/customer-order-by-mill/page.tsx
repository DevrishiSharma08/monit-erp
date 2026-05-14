"use client";

import { useMemo } from "react";
import { mockPurchaseOrders, mockSalesOrders } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { FileText, Factory, Users, Package } from "lucide-react";

interface MillCustomerRow {
  mill: string;
  customer: string;
  paper: string;
  totalPOs: number;
  totalQty: number;
  totalValue: number;
}

export default function CustomerOrderByMillPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    // Build SO customer mapping via soNumber
    const soCustomerMap: Record<string, string> = {};
    mockSalesOrders.forEach((so) => {
      soCustomerMap[so.soNumber] = so.customer;
    });

    const mapKey = (mill: string, customer: string, paper: string) => `${mill}||${customer}||${paper}`;
    const map: Record<string, MillCustomerRow> = {};

    mockPurchaseOrders.forEach((po) => {
      const customer = po.directCustomer ?? (po.deliveryMode === "Direct To Customer" ? "Direct" : "Via Godown");
      po.items.forEach((item) => {
        const paper = item.materialCode || `${item.categoryName} ${item.gsm} GSM`;
        const key = mapKey(po.mill, customer, paper);
        if (!map[key]) {
          map[key] = { mill: po.mill, customer, paper, totalPOs: 0, totalQty: 0, totalValue: 0 };
        }
        map[key].totalPOs += 1;
        map[key].totalQty += item.orderedQty;
        map[key].totalValue += item.amount;
      });
    });

    const rows = Object.values(map).sort((a, b) => b.totalValue - a.totalValue);

    const mills = new Set(rows.map((r) => r.mill));
    const customers = new Set(rows.map((r) => r.customer));
    const topMill = [...mills].reduce((best, m) => {
      const val = rows.filter((r) => r.mill === m).reduce((s, r) => s + r.totalValue, 0);
      const bestVal = rows.filter((r) => r.mill === best).reduce((s, r) => s + r.totalValue, 0);
      return val > bestVal ? m : best;
    }, [...mills][0] ?? "");

    const kpis = [
      { label: "Mill-Customer Pairs", value: String(rows.length), icon: FileText, iconBg: "bg-purple-50", iconColor: "text-purple-500" },
      { label: "Mills Used", value: String(mills.size), icon: Factory, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "Customers Served", value: String(customers.size), icon: Users, iconBg: "bg-green-50", iconColor: "text-green-500" },
      { label: "Top Mill", value: topMill.length > 12 ? topMill.slice(0, 12) + "…" : topMill, sub: "by PO value", icon: Package, iconBg: "bg-indigo-50", iconColor: "text-indigo-500" },
    ];

    const millTotals: Record<string, number> = {};
    rows.forEach((r) => { millTotals[r.mill] = (millTotals[r.mill] ?? 0) + r.totalQty; });
    const chartData = Object.entries(millTotals).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
      label: label.length > 16 ? label.slice(0, 16) + "…" : label,
      value,
      color: "#6366f1",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Mill & Supply"
      categoryHref="/reports/mill-supply"
      reportName="Customer Order by Mill"
      reportDescription="Which mill supplies which customer — useful for sourcing optimisation."
      kpis={kpis}
      chartTitle="Total Qty by Mill"
      chartData={chartData}
      chartType="horizontal-bar"
      chartColor="#6366f1"
      chartFormatValue={(v) => `${v.toLocaleString("en-IN")} sht`}
      tableColumns={["Mill", "Customer", "Paper", "POs", "Total Qty", "Total Value"]}
      exportFilename="customer-order-by-mill"
      exportData={[
        ["Mill", "Customer", "Paper", "POs", "Total Qty", "Total Value (₹)"],
        ...rows.map((r) => [r.mill, r.customer, r.paper, r.totalPOs, r.totalQty, r.totalValue]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Mill</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Paper</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">POs</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Qty</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.mill}</td>
                  <td className="px-4 py-3 text-gray-900">{r.customer}</td>
                  <td className="px-4 py-3 text-gray-600">{r.paper}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.totalPOs}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{r.totalQty.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">₹{r.totalValue.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
