"use client";

import { useMemo } from "react";
import {
  Receipt, FileInput, IndianRupee, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  mockPurchaseInvoices, mockSalesInvoices, mockSalesOrders,
  mockPurchaseOrders,
} from "@/data/mockData";

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, sub, icon: Icon, iconBg, iconColor,
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-white/80 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${iconBg}`}>
      <p className={`text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider truncate ${iconColor}`}>{title}</p>
      <p className="mt-1.5 text-2xl sm:text-4xl font-black text-gray-900 leading-none tabular-nums animate-kpi-value">{value}</p>
      {sub && <p className="mt-1 text-[10px] sm:text-xs text-gray-500 truncate">{sub}</p>}
      <div className={`pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18] ${iconColor}`}>
        <Icon className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1} />
      </div>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function AmtTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mt-1">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500 text-xs">{p.name}:</span>
          <span className="font-semibold text-gray-900">
            {"\u20B9"}{(p.value / 100000).toFixed(2)}L
          </span>
        </div>
      ))}
    </div>
  );
}

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

export default function AccountsDashboard() {
  // ── Purchase Invoice KPIs ──
  const purchaseStats = useMemo(() => {
    const total = mockPurchaseInvoices.length;
    const totalAmt = mockPurchaseInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const paid = mockPurchaseInvoices.filter((i) => i.paymentStatus === "Paid");
    const paidAmt = paid.reduce((s, i) => s + i.totalAmount, 0);
    const partial = mockPurchaseInvoices.filter((i) => i.paymentStatus === "Partially Paid");
    const pending = mockPurchaseInvoices.filter((i) => i.paymentStatus === "Pending");
    return { total, totalAmt, paid: paid.length, paidAmt, partial: partial.length, pending: pending.length, overdue: 0 };
  }, []);

  const salesStats = useMemo(() => {
    const total = mockSalesInvoices.length;
    const totalAmt = mockSalesInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const collected = mockSalesInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const outstanding = totalAmt - collected;
    const overdue = mockSalesInvoices.filter((i) => i.paymentStatus === "Overdue").length;
    const partiallyPaid = mockSalesInvoices.filter((i) => i.paymentStatus === "Partially Paid").length;
    return { total, totalAmt, collected, outstanding, overdue, partiallyPaid };
  }, []);

  // ── Payment status pie data ──
  const paymentPieData = useMemo(() => [
    { name: "Paid", value: purchaseStats.paid + mockSalesInvoices.filter((i) => i.paymentStatus === "Paid").length },
    { name: "Partial", value: purchaseStats.partial + salesStats.partiallyPaid },
    { name: "Pending", value: purchaseStats.pending + mockSalesInvoices.filter((i) => i.paymentStatus === "Pending").length },
    { name: "Overdue", value: purchaseStats.overdue + salesStats.overdue },
  ], [purchaseStats, salesStats]);

  // ── Monthly invoice bar chart ──
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, idx) => {
      const mStr = String(idx + 1).padStart(2, "0");
      const purchaseAmt = mockPurchaseInvoices
        .filter((i) => i.invoiceDate.includes(`-${mStr}-`))
        .reduce((s, i) => s + i.totalAmount, 0);
      const salesAmt = mockSalesInvoices
        .filter((i) => i.invoiceDate.includes(`-${mStr}-`))
        .reduce((s, i) => s + i.totalAmount, 0);
      return { month: m, purchase: purchaseAmt, sales: salesAmt };
    }).filter((d) => d.purchase > 0 || d.sales > 0);
  }, []);

  // ── Recent invoices ──
  const recentInvoices = useMemo(() => {
    const all = [
      ...mockSalesInvoices.map((i) => ({
        id: i.id,
        number: i.invoiceNumber,
        type: "Sales" as const,
        party: i.customerCompany || i.customer,
        amount: i.totalAmount,
        status: i.paymentStatus,
        date: i.invoiceDate,
      })),
      ...mockPurchaseInvoices.map((i) => ({
        id: i.id,
        number: i.purchaseInvoiceNumber,
        type: "Purchase" as const,
        party: i.mill,
        amount: i.totalAmount,
        status: i.paymentStatus,
        date: i.invoiceDate,
      })),
    ];
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, []);

  const statusColor: Record<string, string> = {
    Paid: "bg-green-100 text-green-700",
    "Partially Paid": "bg-yellow-100 text-yellow-700",
    Pending: "bg-blue-100 text-blue-700",
    Overdue: "bg-red-100 text-red-700",
    Issued: "bg-gray-100 text-gray-700",
    Cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="kpi-grid grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Sales Invoices" value={String(salesStats.total)}
          sub={`\u20B9${(salesStats.totalAmt / 100000).toFixed(1)}L total`}
          icon={Receipt} iconBg="bg-blue-50" iconColor="text-blue-500" />
        <KpiCard title="Purchase Invoices" value={String(purchaseStats.total)}
          sub={`\u20B9${(purchaseStats.totalAmt / 100000).toFixed(1)}L total`}
          icon={FileInput} iconBg="bg-purple-50" iconColor="text-purple-500" />
        <KpiCard title="Collections" value={`\u20B9${(salesStats.collected / 100000).toFixed(1)}L`}
          sub="Received from customers"
          icon={ArrowDownRight} iconBg="bg-green-50" iconColor="text-green-500" />
        <KpiCard title="Outstanding" value={`\u20B9${(salesStats.outstanding / 100000).toFixed(1)}L`}
          sub="Pending receivables"
          icon={Clock} iconBg="bg-yellow-50" iconColor="text-yellow-500" />
        <KpiCard title="Overdue" value={String(purchaseStats.overdue + salesStats.overdue)}
          sub="Past payment date"
          icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-500" />
        <KpiCard title="Payments Made" value={`\u20B9${(purchaseStats.paidAmt / 100000).toFixed(1)}L`}
          sub="To mills / suppliers"
          icon={ArrowUpRight} iconBg="bg-indigo-50" iconColor="text-indigo-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly Invoice Amounts */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Monthly Invoice Volume</h2>
          <p className="text-xs text-gray-400 mb-4">Purchase vs Sales invoice amounts</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tickFormatter={(v) => `\u20B9${(v / 100000).toFixed(0)}L`}
                tick={{ fontSize: 11, fill: "#9ca3af" }} width={48} />
              <Tooltip content={<AmtTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="purchase" name="Purchase" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Status Pie */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Payment Status</h2>
          <p className="text-xs text-gray-400 mb-4">All invoices combined</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false} fontSize={11}>
                {paymentPieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {paymentPieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Receivables Aging */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales Receivable Breakdown */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Sales Receivables</h2>
          <div className="space-y-3">
            {[
              { label: "Current (0-30 days)", amount: salesStats.outstanding * 0.4, color: "bg-green-500" },
              { label: "Due (30-60 days)", amount: salesStats.outstanding * 0.3, color: "bg-blue-500" },
              { label: "Overdue (60-90 days)", amount: salesStats.outstanding * 0.2, color: "bg-yellow-500" },
              { label: "Critical (90+ days)", amount: salesStats.outstanding * 0.1, color: "bg-red-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-semibold text-gray-900">
                    {"\u20B9"}{(item.amount / 100000).toFixed(2)}L
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${salesStats.outstanding > 0 ? (item.amount / salesStats.outstanding) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase Payables Breakdown */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Purchase Payables</h2>
          <div className="space-y-3">
            {[
              { label: "Paid", count: purchaseStats.paid, color: "text-green-600", dot: "bg-green-500" },
              { label: "Partially Paid", count: purchaseStats.partial, color: "text-yellow-600", dot: "bg-yellow-500" },
              { label: "Pending", count: purchaseStats.pending, color: "text-blue-600", dot: "bg-blue-500" },
              { label: "Overdue", count: purchaseStats.overdue, color: "text-red-600", dot: "bg-red-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </div>
                <span className={`text-sm font-bold ${item.color}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Invoices</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Invoice #", "Type", "Party", "Amount", "Status", "Date"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium text-gray-700 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={`${inv.type}-${inv.id}`} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-blue-600">{inv.number}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.type === "Sales" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                    }`}>
                      {inv.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{inv.party}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {"\u20B9"}{inv.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[inv.status] || "bg-gray-100 text-gray-600"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inv.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
