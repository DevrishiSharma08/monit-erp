"use client";

import { useState, useMemo, useCallback } from "react";
import { mockSalesInvoices, mockSalesOrders, SalesInvoice, Challan } from "@/data/mockData";
import { useStock } from "@/context/StockContext";
import { FileText, CheckCircle2, Clock, AlertTriangle, IndianRupee, Send, Plus, X, Search } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { fmtDateIN, fmtNumIN } from "@/lib/formatters";

export default function SalesInvoicesPage() {
  const { challans } = useStock();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<'select-source' | 'fill-details'>('select-source');
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [sourceSearch, setSourceSearch] = useState('');

  // Form state
  const [form, setForm] = useState({
    customerGST: '',
    deliveryAddress: '',
    discount: 0,
    transportCharges: 0,
    extraCharges: 0,
    extraChargesDesc: '',
    remarks: '',
    // Line-level rates (editable)
    lineRates: {} as Record<string, number>,
  });

  const kpis = useMemo(() => {
    const total = mockSalesInvoices.length;
    const draft = mockSalesInvoices.filter((si) => si.status === "Draft").length;
    const issued = mockSalesInvoices.filter((si) => si.status === "Issued").length;
    const paid = mockSalesInvoices.filter((si) => si.status === "Paid").length;
    const totalValue = mockSalesInvoices.reduce((sum, si) => sum + si.totalAmount, 0);
    const pendingCollection = mockSalesInvoices.filter((si) => si.paymentStatus !== "Paid").reduce((sum, si) => sum + si.totalAmount - (si.paidAmount || 0), 0);
    const tallySynced = mockSalesInvoices.filter((si) => si.tallySync).length;
    return { total, draft, issued, paid, totalValue, pendingCollection, tallySynced };
  }, []);

  // Dispatched challans eligible for invoicing (only Dispatched status)
  const eligibleChallans = useMemo(() => {
    const q = sourceSearch.toLowerCase();
    return challans.filter(ch => {
      if (ch.status !== 'Dispatched') return false;
      if (q && !ch.challanNumber.toLowerCase().includes(q) && !ch.soNumber.toLowerCase().includes(q) && !ch.customer.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sourceSearch]);

  // Calculate invoice totals
  const invoiceTotals = useMemo(() => {
    if (!selectedChallan) return { baseAmount: 0, gst: 0, total: 0 };
    let baseAmount = 0;
    selectedChallan.lines.forEach(line => {
      const rate = form.lineRates[line.id] || 0;
      baseAmount += line.quantity * rate;
    });
    baseAmount = baseAmount - form.discount + form.transportCharges + form.extraCharges;
    const gst = baseAmount * 0.18; // 18% GST default
    return { baseAmount, gst, total: baseAmount + gst };
  }, [selectedChallan, form.lineRates, form.discount, form.transportCharges, form.extraCharges]);

  const handleSelectChallan = useCallback((ch: Challan) => {
    setSelectedChallan(ch);
    // Find SO to get rates
    const so = mockSalesOrders.find(s => s.soNumber === ch.soNumber);
    const rates: Record<string, number> = {};
    ch.lines.forEach(line => {
      // Try to match SO line for rate
      const soLine = so?.lines.find(sl => sl.id === line.soLineId || (sl.materialCode?.includes(line.paper) && sl.gsm === line.gsm));
      rates[line.id] = soLine?.rate || 0;
    });
    setForm(prev => ({
      ...prev,
      deliveryAddress: ch.customerAddress,
      lineRates: rates,
    }));
    setCreateStep('fill-details');
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
    setCreateStep('select-source');
    setSelectedChallan(null);
    setSourceSearch('');
    setForm({
      customerGST: '',
      deliveryAddress: '',
      discount: 0,
      transportCharges: 0,
      extraCharges: 0,
      extraChargesDesc: '',
      remarks: '',
      lineRates: {},
    });
  }, []);

  const handleSave = useCallback((status: 'Draft' | 'Issued') => {
    alert(`Sales Invoice ${status === 'Draft' ? 'saved as Draft' : 'Issued'} for ${selectedChallan?.customer}`);
    handleCloseModal();
  }, [selectedChallan, handleCloseModal]);

  const statusOptions = useMemo(
    () => [
      { label: "Draft", value: "Draft" },
      { label: "Issued", value: "Issued" },
      { label: "Sent to Tally", value: "Sent to Tally" },
      { label: "Paid", value: "Paid" },
    ],
    []
  );

  const paymentOptions = useMemo(
    () => [
      { label: "Pending", value: "Pending" },
      { label: "Partially Paid", value: "Partially Paid" },
      { label: "Paid", value: "Paid" },
      { label: "Overdue", value: "Overdue" },
    ],
    []
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft": return "bg-gray-100 text-gray-700";
      case "Issued": return "bg-blue-100 text-blue-700";
      case "Sent to Tally": return "bg-purple-100 text-purple-700";
      case "Paid": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-100 text-green-700";
      case "Partially Paid": return "bg-yellow-100 text-yellow-700";
      case "Pending": return "bg-orange-100 text-orange-700";
      case "Overdue": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const columns: ColumnConfig<SalesInvoice>[] = useMemo(
    () => [
      {
        id: "invoiceNumber",
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 140,
        cell: (info) => <span className="font-medium text-gray-900">{info.getValue() as string}</span>,
      },
      {
        id: "invoiceDate",
        accessorKey: "invoiceDate",
        header: "Date",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => <span className="tabular-nums">{fmtDateIN(info.getValue() as string)}</span>,
        exportValue: (r) => fmtDateIN((r as any).invoiceDate),
      },
      {
        id: "soNumber",
        accessorKey: "soNumber",
        header: "SO Ref",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => <span className="text-blue-600 font-medium">{info.getValue() as string}</span>,
      },
      {
        id: "challanNumber",
        accessorKey: "challanNumber",
        header: "Challan",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => {
          const val = info.getValue() as string | undefined;
          return val ? <span className="text-purple-600 font-medium">{val}</span> : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: "customerCompany",
        accessorKey: "customerCompany",
        header: "Customer",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 180,
        cell: (info) => {
          const si = info.row.original;
          return (
            <div>
              <div className="font-medium text-gray-900">{si.customerCompany}</div>
              <div className="text-xs text-gray-500">{si.deliveryAddress}</div>
            </div>
          );
        },
      },
      {
        id: "lines",
        accessorKey: "lines",
        header: "Items",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 180,
        exportColumns: [
          {
            header: "Item Codes",
            value: (r) => (r as any).lines?.map((l: any, i: number) => `${i + 1}. ${l.paper} ${l.gsm}GSM ${l.size}`).join("\n") ?? "—",
          },
          {
            header: "Qty (Sht)",
            value: (r) => (r as any).lines?.map((l: any) => fmtNumIN(l.quantity)).join("\n") ?? "—",
          },
          {
            header: "Rate (₹)",
            value: (r) => (r as any).lines?.map((l: any) => `₹${fmtNumIN(l.rate, { decimals: 2 })}`).join("\n") ?? "—",
          },
          {
            header: "Amount (₹)",
            value: (r) => (r as any).lines?.map((l: any) => `₹${fmtNumIN(l.amount)}`).join("\n") ?? "—",
          },
        ],
        cell: (info) => {
          const lines = info.getValue() as SalesInvoice["lines"];
          const first = lines[0];
          return (
            <div>
              <div className="text-sm text-gray-900">{first.paper} {first.gsm}GSM</div>
              <div className="text-xs text-gray-500">
                {fmtNumIN(first.quantity)} sht @ ₹{fmtNumIN(first.rate, { decimals: 2 })}
                {lines.length > 1 && <span className="text-gray-400 ml-1">(+{lines.length - 1} more)</span>}
              </div>
            </div>
          );
        },
      },
      {
        id: "totalAmount",
        accessorKey: "totalAmount",
        header: "Total Amount",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const si = info.row.original;
          return (
            <div>
              <div className="font-medium text-gray-900">₹{fmtNumIN(si.totalAmount)}</div>
              <div className="text-xs text-gray-400">
                GST: ₹{fmtNumIN(si.cgst + si.sgst + si.igst)}
              </div>
            </div>
          );
        },
        exportValue: (r) => `₹${fmtNumIN((r as any).totalAmount)}`,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: statusOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => {
          const status = info.getValue() as string;
          return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(status)}`}>{status}</span>;
        },
      },
      {
        id: "paymentStatus",
        accessorKey: "paymentStatus",
        header: "Payment",
        filterType: "select",
        filterOptions: paymentOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const si = info.row.original;
          const status = info.getValue() as string;
          return (
            <div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentColor(status)}`}>{status}</span>
              {si.paidAmount !== undefined && si.paidAmount > 0 && status !== "Paid" && (
                <div className="text-xs text-gray-500 mt-0.5">₹{si.paidAmount.toLocaleString("en-IN")} rcvd</div>
              )}
            </div>
          );
        },
      },
      {
        id: "paymentDueDate",
        accessorKey: "paymentDueDate",
        header: "Due Date",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => {
          const date = info.getValue() as string;
          const isOverdue = date && new Date(date) < new Date() && info.row.original.paymentStatus !== "Paid";
          return <span className={`tabular-nums ${isOverdue ? "text-red-600 font-medium" : "text-gray-600"}`}>{fmtDateIN(date)}</span>;
        },
        exportValue: (r) => fmtDateIN((r as any).paymentDueDate),
      },
      {
        id: "tallySync",
        accessorKey: "tallySync",
        header: "Tally",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 90,
        cell: (info) => {
          const synced = info.getValue() as boolean;
          return synced ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Synced
            </span>
          ) : (
            <span className="text-xs text-gray-400">Pending</span>
          );
        },
      },
    ],
    [statusOptions, paymentOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Invoices</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.total}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Draft</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.draft}</p>
              <p className="mt-0.5 text-xs text-gray-500">Not yet issued</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
              <Clock className="h-5 w-5 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Issued</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.issued}</p>
              <p className="mt-0.5 text-xs text-blue-600">Sent to customer</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Send className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Paid</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.paid}</p>
              <p className="mt-0.5 text-xs text-green-600">Fully collected</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Value</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">₹{(kpis.totalValue / 100000).toFixed(1)}L</p>
              <p className="mt-0.5 text-xs text-gray-500">All invoices</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <IndianRupee className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending Collection</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">₹{(kpis.pendingCollection / 100000).toFixed(1)}L</p>
              <p className="mt-0.5 text-xs text-red-600">Outstanding</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid
        data={mockSalesInvoices}
        columns={columns}
        tableName="sales-invoices"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        emptyMessage="No sales invoices found. Click + to create a new invoice from a dispatched challan."
      />

      {/* FAB */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/40 transition-all hover:scale-105 hover:bg-blue-600 active:scale-95"
        aria-label="Create sales invoice"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* Create Sales Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[5vh]">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Create Sales Invoice</h2>
                <p className="text-sm text-gray-500">
                  {createStep === 'select-source' ? 'Step 1: Select Dispatched Challan' : 'Step 2: Invoice Details'}
                </p>
              </div>
              <button onClick={handleCloseModal} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Warning */}
            {createStep === 'select-source' && (
              <div className="mx-6 mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-700">
                  Only <strong>Dispatched</strong> challans are shown. Sales Invoice must be created from SO &rarr; Pick Plan &rarr; Challan &rarr; Sales Invoice flow to prevent inventory mismatch.
                </p>
              </div>
            )}

            {/* Step 1: Select Challan */}
            {createStep === 'select-source' && (
              <div className="p-6">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by challan, SO number, or customer..."
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {eligibleChallans.map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => handleSelectChallan(ch)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        ch.invoiceNumber
                          ? 'border-gray-100 bg-gray-50 opacity-60'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                      disabled={!!ch.invoiceNumber}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-purple-600">{ch.challanNumber}</span>
                          <span className="ml-2 text-sm text-blue-600">{ch.soNumber}</span>
                          <span className="ml-2 text-sm text-gray-500">{ch.customer}</span>
                        </div>
                        {ch.invoiceNumber ? (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                            Invoiced: {ch.invoiceNumber}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                            Ready to Invoice
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                        <span>{ch.totalQty.toLocaleString()} sheets</span>
                        <span>&middot;</span>
                        <span>{ch.lines.length} item(s)</span>
                        <span>&middot;</span>
                        <span>Dispatched: {ch.dispatchTime || ch.challanDate}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {ch.lines.map(l => `${l.paper} ${l.gsm}GSM`).join(', ')}
                      </div>
                    </button>
                  ))}
                  {eligibleChallans.length === 0 && (
                    <div className="py-10 text-center">
                      <p className="text-sm text-gray-400">No dispatched challans available for invoicing</p>
                      <p className="text-xs text-gray-300 mt-1">Challans must be in &quot;Dispatched&quot; status</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Fill Details */}
            {createStep === 'fill-details' && selectedChallan && (
              <div className="p-6 space-y-6">
                {/* Source Summary */}
                <div className="rounded-lg bg-purple-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-purple-700">Challan: {selectedChallan.challanNumber}</span>
                      <span className="ml-3 text-sm text-blue-600">SO: {selectedChallan.soNumber}</span>
                      <span className="ml-3 text-sm text-gray-600">{selectedChallan.customer}</span>
                    </div>
                    <button
                      onClick={() => { setCreateStep('select-source'); setSelectedChallan(null); }}
                      className="text-xs text-purple-600 hover:text-purple-800 underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Item Details (auto-fetched from challan, rates from SO) */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Dispatched Items</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Material</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">GSM / Size</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Dispatched Qty</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Rate (₹)</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedChallan.lines.map(line => {
                          const rate = form.lineRates[line.id] || 0;
                          return (
                            <tr key={line.id} className="border-t">
                              <td className="px-3 py-2 font-medium text-gray-900">{line.paper}</td>
                              <td className="px-3 py-2 text-gray-600">{line.gsm} GSM &middot; {line.size}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{line.quantity.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  value={rate}
                                  onChange={(e) => setForm(prev => ({
                                    ...prev,
                                    lineRates: { ...prev.lineRates, [line.id]: parseFloat(e.target.value) || 0 }
                                  }))}
                                  className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900">
                                ₹{(line.quantity * rate).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Editable Charges */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Charges / Adjustments</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Discount (₹)</label>
                      <input
                        type="number"
                        value={form.discount}
                        onChange={(e) => setForm(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Transport Charges (₹)</label>
                      <input
                        type="number"
                        value={form.transportCharges}
                        onChange={(e) => setForm(prev => ({ ...prev, transportCharges: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Extra Charges (₹)</label>
                      <input
                        type="number"
                        value={form.extraCharges}
                        onChange={(e) => setForm(prev => ({ ...prev, extraCharges: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Customer & Delivery Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer GST Number</label>
                    <input
                      type="text"
                      value={form.customerGST}
                      onChange={(e) => setForm(prev => ({ ...prev, customerGST: e.target.value }))}
                      placeholder="e.g. 23AABCR1234A1Z5"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                    <input
                      type="text"
                      value={form.deliveryAddress}
                      onChange={(e) => setForm(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <textarea
                      value={form.remarks}
                      onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                      rows={2}
                      placeholder="Optional notes..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Base Amount</span>
                    <span className="font-medium text-gray-900">₹{invoiceTotals.baseAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {form.discount > 0 && (
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="font-medium text-red-600">-₹{form.discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {form.transportCharges > 0 && (
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-gray-600">Transport</span>
                      <span className="font-medium text-gray-900">+₹{form.transportCharges.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {form.extraCharges > 0 && (
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-gray-600">Extra Charges</span>
                      <span className="font-medium text-gray-900">+₹{form.extraCharges.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">GST (18%)</span>
                    <span className="font-medium text-gray-900">₹{invoiceTotals.gst.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <span className="font-medium text-gray-900">Total Amount</span>
                    <span className="text-lg font-bold text-gray-900">₹{invoiceTotals.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 border-t pt-4">
                  <button
                    onClick={handleCloseModal}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave('Draft')}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSave('Issued')}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                  >
                    Issue Invoice
                  </button>
                  <button
                    onClick={() => handleSave('Issued')}
                    className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
                  >
                    Issue &amp; Send to Customer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
