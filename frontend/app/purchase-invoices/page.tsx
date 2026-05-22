"use client";

import { useState, useMemo, useCallback } from "react";
import { mockPurchaseInvoices, mockGRNs, PurchaseInvoice, GRN, PurchaseOrder } from "@/data/mockData";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { FileText, Truck, CheckCircle2, AlertTriangle, IndianRupee, Clock, Plus, X, Search, ChevronDown } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";

export default function PurchaseInvoicesPage() {
  const { purchaseOrders } = usePurchaseOrder();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<'select-po' | 'fill-details'>('select-po');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [, setSelectedGRNs] = useState<GRN[]>([]);
  const [poSearch, setPOSearch] = useState('');

  // Form state
  const [form, setForm] = useState({
    purchaseInvoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    baseRate: 0,
    taxPercent: 18,
    deliveryMode: 'To Godown' as 'To Godown' | 'Direct To Customer',
    directCustomer: '',
    customerSO: '',
    paymentTerms: '30 Days',
    remarks: '',
  });

  const kpis = useMemo(() => {
    const total = mockPurchaseInvoices.length;
    const inTransit = mockPurchaseInvoices.filter((pi) => pi.status === "In Transit" || pi.status === "Punched").length;
    const received = mockPurchaseInvoices.filter((pi) => pi.status === "Received").length;
    const grnDone = mockPurchaseInvoices.filter((pi) => pi.status === "GRN Done").length;
    const totalValue = mockPurchaseInvoices.reduce((sum, pi) => sum + pi.totalAmount, 0);
    const pendingPayment = mockPurchaseInvoices.filter((pi) => pi.paymentStatus !== "Paid").reduce((sum, pi) => sum + pi.totalAmount - (pi.paidAmount || 0), 0);
    return { total, inTransit, received, grnDone, totalValue, pendingPayment };
  }, []);

  // Available POs for invoice creation (filter those that don't have invoices yet or are partially invoiced)
  const availablePOs = useMemo(() => {
    const q = poSearch.toLowerCase();
    return purchaseOrders.filter(po => {
      if (q && !po.poNumber.toLowerCase().includes(q) && !po.mill.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [poSearch]);

  // GRN entries for selected PO
  const grnForPO = useMemo(() => {
    if (!selectedPO) return [];
    return mockGRNs.filter(g => g.poNumber === selectedPO.poNumber || g.poNumber.includes(selectedPO.poNumber.replace('PO-', '')));
  }, [selectedPO]);

  // Calculate totals
  const invoiceTotals = useMemo(() => {
    if (!selectedPO) return { qty: 0, baseAmount: 0, tax: 0, total: 0 };
    const item = selectedPO.items[0];
    const qty = item ? item.orderedQty : 0;
    const baseAmount = form.baseRate > 0 ? qty * form.baseRate : (item ? item.amount : 0);
    const taxAmount = baseAmount * (form.taxPercent / 100);
    return { qty, baseAmount, tax: taxAmount, total: baseAmount + taxAmount };
  }, [selectedPO, form.baseRate, form.taxPercent]);

  const handleSelectPO = useCallback((po: PurchaseOrder) => {
    setSelectedPO(po);
    const relatedGRNs = mockGRNs.filter(g => g.poNumber === po.poNumber || g.poNumber.includes(po.poNumber.replace('PO-', '')));
    setSelectedGRNs(relatedGRNs);
    const item = po.items[0];
    setForm(prev => ({
      ...prev,
      baseRate: item ? item.rate : 0,
      taxPercent: po.gstPercentage || 18,
      deliveryMode: po.deliveryMode === 'Direct To Customer' ? 'Direct To Customer' : 'To Godown',
    }));
    setCreateStep('fill-details');
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
    setCreateStep('select-po');
    setSelectedPO(null);
    setSelectedGRNs([]);
    setPOSearch('');
    setForm({
      purchaseInvoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      baseRate: 0,
      taxPercent: 18,
      deliveryMode: 'To Godown',
      directCustomer: '',
      customerSO: '',
      paymentTerms: '30 Days',
      remarks: '',
    });
  }, []);

  const handleSave = useCallback((status: 'Draft' | 'Confirm') => {
    // In real app this would POST to API
    alert(`Purchase Invoice ${status === 'Draft' ? 'saved as Draft' : 'Confirmed'} for ${selectedPO?.poNumber}`);
    handleCloseModal();
  }, [selectedPO, handleCloseModal]);

  const statusOptions = useMemo(
    () => [
      { label: "Punched", value: "Punched" },
      { label: "In Transit", value: "In Transit" },
      { label: "Received", value: "Received" },
      { label: "GRN Done", value: "GRN Done" },
    ],
    []
  );

  const paymentOptions = useMemo(
    () => [
      { label: "Pending", value: "Pending" },
      { label: "Partially Paid", value: "Partially Paid" },
      { label: "Paid", value: "Paid" },
    ],
    []
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Punched": return "bg-gray-100 text-gray-700";
      case "In Transit": return "bg-blue-100 text-blue-700";
      case "Received": return "bg-orange-100 text-orange-700";
      case "GRN Done": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-100 text-green-700";
      case "Partially Paid": return "bg-yellow-100 text-yellow-700";
      case "Pending": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const columns: ColumnConfig<PurchaseInvoice>[] = useMemo(
    () => [
      {
        id: "purchaseInvoiceNumber",
        accessorKey: "purchaseInvoiceNumber",
        header: "Invoice #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 170,
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
      },
      {
        id: "mill",
        accessorKey: "mill",
        header: "Mill",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 170,
      },
      {
        id: "poNumber",
        accessorKey: "poNumber",
        header: "PO Ref",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => <span className="text-blue-600 font-medium">{info.getValue() as string}</span>,
      },
      {
        id: "paper",
        accessorKey: "paper",
        header: "Material",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 160,
        cell: (info) => {
          const pi = info.row.original;
          return (
            <div>
              <div className="font-medium text-gray-900">{pi.paper}</div>
              <div className="text-xs text-gray-500">{pi.gsm} GSM &middot; {pi.size} &middot; {pi.quantity.toLocaleString()} sht</div>
            </div>
          );
        },
      },
      {
        id: "totalAmount",
        accessorKey: "totalAmount",
        header: "Amount",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const pi = info.row.original;
          return (
            <div>
              <div className="font-medium text-gray-900">₹{pi.totalAmount.toLocaleString("en-IN")}</div>
              <div className="text-xs text-gray-400">Base: ₹{pi.baseAmount.toLocaleString("en-IN")}</div>
            </div>
          );
        },
      },
      {
        id: "deliveryMode",
        accessorKey: "deliveryMode",
        header: "Delivery",
        filterType: "select",
        filterOptions: [
          { label: "Direct To Customer", value: "Direct To Customer" },
          { label: "To Godown", value: "To Godown" },
        ],
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const pi = info.row.original;
          const isDirect = pi.deliveryMode === "Direct To Customer";
          return (
            <div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isDirect ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                {isDirect ? "Direct" : "To Godown"}
              </span>
              {isDirect && pi.directCustomer && (
                <div className="text-xs text-gray-500 mt-0.5">{pi.directCustomer}</div>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: statusOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 120,
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
        size: 130,
        cell: (info) => {
          const status = info.getValue() as string;
          return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentColor(status)}`}>{status}</span>;
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
          const isOverdue = new Date(date) < new Date() && info.row.original.paymentStatus !== "Paid";
          return <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-600"}>{date}</span>;
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
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">In Transit</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.inTransit}</p>
              <p className="mt-0.5 text-xs text-blue-600">Stock on the way</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Truck className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Received</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.received}</p>
              <p className="mt-0.5 text-xs text-orange-600">GRN pending</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">GRN Done</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.grnDone}</p>
              <p className="mt-0.5 text-xs text-green-600">Stock updated</p>
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
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending Payment</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">₹{(kpis.pendingPayment / 100000).toFixed(1)}L</p>
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
        data={mockPurchaseInvoices}
        columns={columns}
        tableName="purchase-invoices"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        emptyMessage="No purchase invoices found. Click + to punch a new mill invoice."
      />

      {/* FAB */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/40 transition-all hover:scale-105 hover:bg-blue-600 active:scale-95"
        aria-label="Create purchase invoice"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* Create Purchase Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[5vh]">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Create Purchase Invoice</h2>
                <p className="text-sm text-gray-500">
                  {createStep === 'select-po' ? 'Step 1: Select Purchase Order' : 'Step 2: Invoice Details'}
                </p>
              </div>
              <button onClick={handleCloseModal} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Step 1: Select PO */}
            {createStep === 'select-po' && (
              <div className="p-6">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by PO number or mill name..."
                    value={poSearch}
                    onChange={(e) => setPOSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {availablePOs.map(po => (
                    <button
                      key={po.id}
                      onClick={() => handleSelectPO(po)}
                      className="w-full rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-blue-600">{po.poNumber}</span>
                          <span className="ml-2 text-sm text-gray-500">{po.mill}</span>
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          po.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          po.status === 'In Transit' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {po.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                        {po.items[0] && (
                          <>
                            <span>{po.items[0].categoryName} {po.items[0].gsm}GSM {po.items[0].size}</span>
                            <span>&middot;</span>
                            <span>{po.totalQuantity.toLocaleString()} sheets</span>
                            <span>&middot;</span>
                            <span>₹{po.totalValue.toLocaleString('en-IN')}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        Ordered: {po.orderDate} &middot; Delivery: {po.deliveryMode} &middot; {po.paymentTerms}
                      </div>
                    </button>
                  ))}
                  {availablePOs.length === 0 && (
                    <div className="py-10 text-center text-sm text-gray-400">No purchase orders found</div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Fill Details */}
            {createStep === 'fill-details' && selectedPO && (
              <div className="p-6 space-y-6">
                {/* PO Summary */}
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-blue-700">PO: {selectedPO.poNumber}</span>
                      <span className="ml-3 text-sm text-blue-600">{selectedPO.mill}</span>
                    </div>
                    <button
                      onClick={() => { setCreateStep('select-po'); setSelectedPO(null); }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Change PO
                    </button>
                  </div>
                </div>

                {/* GRN Entries (auto-fetched) */}
                {grnForPO.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">GRN Entries (Auto-fetched)</h4>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">GRN #</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Received Qty</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">QC</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grnForPO.map(grn => (
                            <tr key={grn.id} className="border-t">
                              <td className="px-3 py-2 font-medium text-gray-900">{grn.grnNumber}</td>
                              <td className="px-3 py-2 text-gray-600">{grn.grnDate}</td>
                              <td className="px-3 py-2 text-gray-600">{grn.receivedQty.toLocaleString()} sht</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  grn.qcResult === 'Accepted' ? 'bg-green-100 text-green-700' :
                                  grn.qcResult === 'Rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>{grn.qcResult}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  grn.status === 'Stock Updated' ? 'bg-green-100 text-green-700' :
                                  grn.status === 'Approved' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>{grn.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Material Details (auto-fetched from PO) */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Material Details</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Material</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">GSM</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Size</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Received Qty</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Base Rate</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPO.items.map(item => (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2 font-medium text-gray-900">{item.categoryName}</td>
                            <td className="px-3 py-2 text-gray-600">{item.gsm}</td>
                            <td className="px-3 py-2 text-gray-600">{item.size}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{item.orderedQty.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                value={form.baseRate || item.rate}
                                onChange={(e) => setForm(prev => ({ ...prev, baseRate: parseFloat(e.target.value) || 0 }))}
                                className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">
                              ₹{((form.baseRate || item.rate) * item.orderedQty).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Invoice Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mill Invoice Number *</label>
                    <input
                      type="text"
                      value={form.purchaseInvoiceNumber}
                      onChange={(e) => setForm(prev => ({ ...prev, purchaseInvoiceNumber: e.target.value }))}
                      placeholder="e.g. MILL-INV-2024-007"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
                    <input
                      type="date"
                      value={form.invoiceDate}
                      onChange={(e) => setForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax %</label>
                    <div className="relative">
                      <select
                        value={form.taxPercent}
                        onChange={(e) => setForm(prev => ({ ...prev, taxPercent: parseInt(e.target.value) }))}
                        className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={5}>5% GST</option>
                        <option value={12}>12% GST</option>
                        <option value={18}>18% GST</option>
                        <option value={28}>28% GST</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <div className="relative">
                      <select
                        value={form.paymentTerms}
                        onChange={(e) => setForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                        className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Advance">Advance</option>
                        <option value="15 Days">15 Days</option>
                        <option value="30 Days">30 Days</option>
                        <option value="45 Days">45 Days</option>
                        <option value="60 Days">60 Days</option>
                        <option value="90 Days">90 Days</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Mode</label>
                    <div className="relative">
                      <select
                        value={form.deliveryMode}
                        onChange={(e) => setForm(prev => ({ ...prev, deliveryMode: e.target.value as 'To Godown' | 'Direct To Customer' }))}
                        className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="To Godown">To Godown</option>
                        <option value="Direct To Customer">Direct To Customer</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  {form.deliveryMode === 'Direct To Customer' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={form.directCustomer}
                        onChange={(e) => setForm(prev => ({ ...prev, directCustomer: e.target.value }))}
                        placeholder="Customer name"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}
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
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">GST ({form.taxPercent}%)</span>
                    <span className="font-medium text-gray-900">₹{invoiceTotals.tax.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <span className="font-medium text-gray-900">Total Amount</span>
                    <span className="text-lg font-bold text-gray-900">₹{invoiceTotals.total.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Due Date: {(() => {
                      const days = parseInt(form.paymentTerms) || 30;
                      const due = new Date(form.invoiceDate);
                      due.setDate(due.getDate() + days);
                      return due.toISOString().split('T')[0];
                    })()}
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
                    disabled={!form.purchaseInvoiceNumber}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    onClick={() => handleSave('Confirm')}
                    disabled={!form.purchaseInvoiceNumber}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    Confirm Invoice
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
