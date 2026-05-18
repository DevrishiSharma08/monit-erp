"use client";

import { useMemo } from "react";
import { mockSalesInvoices } from "@/data/mockData";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { Wallet, AlertTriangle, Clock, CheckCircle2, DollarSign } from "lucide-react";

interface AgingRow {
  customer: string;
  company: string;
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90plus: number;
  totalOutstanding: number;
  oldestInvoiceDate: string;
}

export default function CustomerAgingPage() {
  const { kpis, chartData, rows } = useMemo(() => {
    const today = new Date();
    const map: Record<string, AgingRow> = {};

    mockSalesInvoices
      .filter((inv) => inv.paymentStatus !== "Paid")
      .forEach((inv) => {
        if (!map[inv.customerCompany]) {
          map[inv.customerCompany] = {
            customer: inv.customer,
            company: inv.customerCompany,
            bucket0_30: 0,
            bucket31_60: 0,
            bucket61_90: 0,
            bucket90plus: 0,
            totalOutstanding: 0,
            oldestInvoiceDate: inv.invoiceDate,
          };
        }
        const r = map[inv.customerCompany];
        const outstanding = inv.totalAmount - (inv.paidAmount ?? 0);
        const invoiceDate = new Date(inv.invoiceDate);
        const ageDays = Math.ceil((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));

        if (ageDays <= 30) r.bucket0_30 += outstanding;
        else if (ageDays <= 60) r.bucket31_60 += outstanding;
        else if (ageDays <= 90) r.bucket61_90 += outstanding;
        else r.bucket90plus += outstanding;

        r.totalOutstanding += outstanding;
        if (inv.invoiceDate < r.oldestInvoiceDate) r.oldestInvoiceDate = inv.invoiceDate;
      });

    const rows = Object.values(map).sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const totalOutstanding = rows.reduce((s, r) => s + r.totalOutstanding, 0);
    const overdue90 = rows.reduce((s, r) => s + r.bucket90plus, 0);
    const customersCount = rows.length;
    const highRisk = rows.filter((r) => r.bucket90plus > 0).length;

    const kpis = [
      { label: "Total Outstanding", value: `₹${(totalOutstanding / 100000).toFixed(1)}L`, icon: DollarSign, iconBg: "bg-red-50", iconColor: "text-red-500", valueColor: "text-red-600" },
      { label: "Customers With Dues", value: String(customersCount), icon: Wallet, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { label: "90+ Days (High Risk)", value: `₹${(overdue90 / 1000).toFixed(0)}K`, sub: `${highRisk} customers`, icon: AlertTriangle, iconBg: "bg-orange-50", iconColor: "text-orange-500", valueColor: overdue90 > 0 ? "text-red-600" : "text-gray-900" },
      { label: "0-30 Days (Current)", value: `₹${(rows.reduce((s, r) => s + r.bucket0_30, 0) / 1000).toFixed(0)}K`, icon: CheckCircle2, iconBg: "bg-green-50", iconColor: "text-green-500" },
    ];

    const chartData = rows.slice(0, 8).map((r) => ({
      label: r.company.length > 16 ? r.company.slice(0, 16) + "…" : r.company,
      value: r.totalOutstanding,
      color: r.bucket90plus > 0 ? "#ef4444" : r.bucket61_90 > 0 ? "#f97316" : "#eab308",
    }));

    return { kpis, chartData, rows };
  }, []);

  return (
    <ReportPageLayout
      categoryName="Finance & Inventory"
      categoryHref="/reports/finance-inventory"
      reportName="Customer Aging"
      reportDescription="Outstanding receivables bucketed by age (0-30, 31-60, 61-90, 90+ days) per customer."
      kpis={kpis}
      chartTitle="Outstanding by Customer"
      chartData={chartData}
      chartType="bar"
      chartColor="#ef4444"
      chartFormatValue={(v) => `₹${(v / 1000).toFixed(0)}K`}
      tableColumns={["Customer", "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total Due", "Oldest Invoice"]}
      exportFilename="customer-aging"
      exportData={[
        ["Company", "Customer", "0-30 Days (₹)", "31-60 Days (₹)", "61-90 Days (₹)", "90+ Days (₹)", "Total Due (₹)", "Oldest Invoice"],
        ...rows.map((r) => [r.company, r.customer, Math.round(r.bucket0_30), Math.round(r.bucket31_60), Math.round(r.bucket61_90), Math.round(r.bucket90plus), Math.round(r.totalOutstanding), r.oldestInvoiceDate]),
      ]}
    >
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">0-30 Days</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">31-60 Days</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">61-90 Days</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">90+ Days</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Total Due</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Oldest Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.company} className={`hover:bg-gray-50 transition-colors ${r.bucket90plus > 0 ? "bg-red-50/20" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.company}</div>
                    <div className="text-xs text-gray-400">{r.customer}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {r.bucket0_30 > 0 ? `₹${Math.round(r.bucket0_30).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-yellow-600">
                    {r.bucket31_60 > 0 ? `₹${Math.round(r.bucket31_60).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">
                    {r.bucket61_90 > 0 ? `₹${Math.round(r.bucket61_90).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">
                    {r.bucket90plus > 0 ? `₹${Math.round(r.bucket90plus).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">₹{Math.round(r.totalOutstanding).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.oldestInvoiceDate}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No outstanding receivables found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageLayout>
  );
}
