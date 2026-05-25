"use client";

import { PermGuard } from "@/components/PermGuard";

import { useMemo, useState } from "react";
import {
  mockPaymentReceipts,
  mockMillPayments,
  PaymentReceipt,
  MillPayment,
} from "@/data/mockData";
import {
  CreditCard,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  TrendingDown,
  Clock,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { fmtDateIN, fmtNumIN } from "@/lib/formatters";

type Tab = "received" | "paid";

function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("received");

  // ── KPIs: Received from Customers ────────────────────────────────────────────
  const receivedKpis = useMemo(() => {
    const totalReceived = mockPaymentReceipts
      .filter((p) => p.status === "Cleared" || p.status === "Received")
      .reduce((sum, p) => sum + p.amount, 0);
    const cleared = mockPaymentReceipts.filter((p) => p.status === "Cleared").length;
    const pending = mockPaymentReceipts.filter((p) => p.status === "Pending").length;
    const bounced = mockPaymentReceipts.filter((p) => p.status === "Bounced").length;
    return { totalReceived, cleared, pending, bounced };
  }, []);

  // ── KPIs: Paid to Mills ───────────────────────────────────────────────────────
  const paidKpis = useMemo(() => {
    const totalPaid = mockMillPayments
      .filter((p) => p.status === "Paid")
      .reduce((sum, p) => sum + p.amount, 0);
    const paid = mockMillPayments.filter((p) => p.status === "Paid").length;
    const pending = mockMillPayments.filter((p) => p.status === "Pending").length;
    const overdue = mockMillPayments.filter((p) => p.status === "Overdue").length;
    return { totalPaid, paid, pending, overdue };
  }, []);

  // ── Filter Options ────────────────────────────────────────────────────────────
  const customerOptions = useMemo(() => {
    const unique = Array.from(new Set(mockPaymentReceipts.map((p) => p.customer)));
    return unique.map((c) => ({ label: c, value: c }));
  }, []);

  const millOptions = useMemo(() => {
    const unique = Array.from(new Set(mockMillPayments.map((p) => p.mill)));
    return unique.map((m) => ({ label: m, value: m }));
  }, []);

  const modeOptions = useMemo(
    () => [
      { label: "NEFT", value: "NEFT" },
      { label: "RTGS", value: "RTGS" },
      { label: "Cheque", value: "Cheque" },
      { label: "PDC", value: "PDC" },
      { label: "Cash", value: "Cash" },
      { label: "UPI", value: "UPI" },
    ],
    []
  );

  const millModeOptions = useMemo(
    () => [
      { label: "NEFT", value: "NEFT" },
      { label: "RTGS", value: "RTGS" },
      { label: "Cheque", value: "Cheque" },
      { label: "PDC", value: "PDC" },
    ],
    []
  );

  const receiptStatusOptions = useMemo(
    () => [
      { label: "Cleared", value: "Cleared" },
      { label: "Received", value: "Received" },
      { label: "Pending", value: "Pending" },
      { label: "Bounced", value: "Bounced" },
    ],
    []
  );

  const millStatusOptions = useMemo(
    () => [
      { label: "Paid", value: "Paid" },
      { label: "Pending", value: "Pending" },
      { label: "Overdue", value: "Overdue" },
    ],
    []
  );

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "RTGS": return "bg-blue-50 text-blue-700";
      case "NEFT": return "bg-indigo-50 text-indigo-700";
      case "Cheque": return "bg-purple-50 text-purple-700";
      case "PDC": return "bg-orange-50 text-orange-700";
      case "Cash": return "bg-green-50 text-green-700";
      case "UPI": return "bg-teal-50 text-teal-700";
      default: return "bg-gray-50 text-gray-600";
    }
  };

  // ── Columns: Received from Customers ─────────────────────────────────────────
  const receivedColumns: ColumnConfig<PaymentReceipt>[] = useMemo(
    () => [
      {
        id: "receiptNumber",
        accessorKey: "receiptNumber",
        header: "Receipt #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 140,
      },
      {
        id: "customer",
        accessorKey: "customer",
        header: "Customer",
        filterType: "select",
        filterOptions: customerOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 200,
      },
      {
        id: "invoiceNumber",
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 140,
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: "Amount",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => (
          <span className="font-semibold text-gray-900">
            ₹{((info.getValue() as number) / 1000).toFixed(1)}K
          </span>
        ),
        exportValue: (r) => `₹${fmtNumIN((r as any).amount)}`,
      },
      {
        id: "paymentDate",
        accessorKey: "paymentDate",
        header: "Payment Date",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => <span className="tabular-nums">{fmtDateIN(info.getValue() as string)}</span>,
        exportValue: (r) => fmtDateIN((r as any).paymentDate),
      },
      {
        id: "paymentMode",
        accessorKey: "paymentMode",
        header: "Mode",
        filterType: "select",
        filterOptions: modeOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => {
          const mode = info.getValue() as string;
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getModeColor(mode)}`}>
              {mode}
            </span>
          );
        },
      },
      {
        id: "bankName",
        accessorKey: "bankName",
        header: "Bank",
        filterType: "text",
        enableSorting: false,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "reference",
        accessorKey: "reference",
        header: "Reference",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 180,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: receiptStatusOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => {
          const status = info.getValue() as string;
          const colors: Record<string, string> = {
            Cleared: "bg-green-100 text-green-700",
            Received: "bg-blue-100 text-blue-700",
            Pending: "bg-yellow-100 text-yellow-700",
            Bounced: "bg-red-100 text-red-700",
          };
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
              {status}
            </span>
          );
        },
      },
    ],
    [customerOptions, modeOptions, receiptStatusOptions]
  );

  // ── Columns: Paid to Mills ────────────────────────────────────────────────────
  const paidColumns: ColumnConfig<MillPayment>[] = useMemo(
    () => [
      {
        id: "paymentNumber",
        accessorKey: "paymentNumber",
        header: "Payment #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 140,
      },
      {
        id: "mill",
        accessorKey: "mill",
        header: "Mill",
        filterType: "select",
        filterOptions: millOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 200,
      },
      {
        id: "grnNumber",
        accessorKey: "grnNumber",
        header: "GRN / Invoice",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 190,
        cell: (info) => {
          const p = info.row.original;
          return (
            <div>
              <p className="font-medium text-gray-900">{p.grnNumber}</p>
              <p className="text-xs text-gray-500">{p.millInvoiceNumber}</p>
            </div>
          );
        },
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: "Amount",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => (
          <span className="font-semibold text-gray-900">
            ₹{((info.getValue() as number) / 1000).toFixed(1)}K
          </span>
        ),
        exportValue: (r) => `₹${fmtNumIN((r as any).amount)}`,
      },
      {
        id: "paymentDate",
        accessorKey: "paymentDate",
        header: "Payment Date",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => <span className="tabular-nums">{fmtDateIN(info.getValue() as string)}</span>,
        exportValue: (r) => fmtDateIN((r as any).paymentDate),
      },
      {
        id: "paymentMode",
        accessorKey: "paymentMode",
        header: "Mode",
        filterType: "select",
        filterOptions: millModeOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => {
          const mode = info.getValue() as string;
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getModeColor(mode)}`}>
              {mode}
            </span>
          );
        },
      },
      {
        id: "bankName",
        accessorKey: "bankName",
        header: "Bank",
        filterType: "text",
        enableSorting: false,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "reference",
        accessorKey: "reference",
        header: "UTR / Ref",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 180,
        cell: (info) => {
          const ref = info.getValue() as string;
          return <span className="text-gray-600">{ref || "—"}</span>;
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: millStatusOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => {
          const status = info.getValue() as string;
          const colors: Record<string, string> = {
            Paid: "bg-green-100 text-green-700",
            Pending: "bg-yellow-100 text-yellow-700",
            Overdue: "bg-red-100 text-red-700",
          };
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
              {status}
            </span>
          );
        },
      },
    ],
    [millOptions, millModeOptions, millStatusOptions]
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab("received")}
          className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
            activeTab === "received"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <TrendingUp className="h-4 w-4 text-green-500" />
          Received from Customers
        </button>
        <button
          onClick={() => setActiveTab("paid")}
          className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
            activeTab === "paid"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <TrendingDown className="h-4 w-4 text-red-500" />
          Paid to Mills
        </button>
      </div>

      {/* KPI Cards */}
      {activeTab === "received" ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Received</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">
                  ₹{(receivedKpis.totalReceived / 100000).toFixed(1)}L
                </p>
                <p className="mt-0.5 text-xs text-green-600">Cleared + Received</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Cleared</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{receivedKpis.cleared}</p>
                <p className="mt-0.5 text-xs text-green-600">Bank confirmed</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{receivedKpis.pending}</p>
                <p className="mt-0.5 text-xs text-yellow-600">PDC / awaiting</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
                <CreditCard className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Bounced</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{receivedKpis.bounced}</p>
                <p className="mt-0.5 text-xs text-red-500">Needs follow-up</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Paid Out</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">
                  ₹{(paidKpis.totalPaid / 100000).toFixed(1)}L
                </p>
                <p className="mt-0.5 text-xs text-red-500">Paid to mills</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Paid</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{paidKpis.paid}</p>
                <p className="mt-0.5 text-xs text-green-600">Transferred</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{paidKpis.pending}</p>
                <p className="mt-0.5 text-xs text-yellow-600">Due soon</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Overdue</p>
                <p className="mt-1.5 text-2xl font-bold text-gray-900">{paidKpis.overdue}</p>
                <p className="mt-0.5 text-xs text-red-500">Past due date</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DataGrid */}
      {activeTab === "received" ? (
        <DataGrid
          data={mockPaymentReceipts}
          columns={receivedColumns}
          tableName="payments-received"
          enableFilters={true}
          enablePagination={true}
          enableColumnReordering={true}
          enableColumnVisibility={true}
          initialPageSize={10}
          emptyMessage="No payment receipts found"
        />
      ) : (
        <DataGrid
          data={mockMillPayments}
          columns={paidColumns}
          tableName="payments-mills"
          enableFilters={true}
          enablePagination={true}
          enableColumnReordering={true}
          enableColumnVisibility={true}
          initialPageSize={10}
          emptyMessage="No mill payments found"
        />
      )}
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="so.read"><PaymentsPage /></PermGuard>;
}
