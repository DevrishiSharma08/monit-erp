"use client";

import { useState, useMemo, useCallback } from "react";
import { mockTallyExports, mockSalesInvoices, mockPurchaseInvoices, TallyExport } from "@/data/mockData";
import { FileSpreadsheet, CheckCircle2, AlertTriangle, Clock, Send, RefreshCw, X, ChevronDown, Download } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";

export default function TallyExportPage() {
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchForm, setBatchForm] = useState({
    exportType: 'Sales Invoice' as TallyExport['exportType'],
    dateFrom: '',
    dateTo: '',
    fileFormat: 'XML' as 'XML' | 'Excel' | 'CSV',
    statusFilter: 'Pending' as 'Pending' | 'All',
  });

  const kpis = useMemo(() => {
    const total = mockTallyExports.length;
    const generated = mockTallyExports.filter((t) => t.status === "Generated").length;
    const sent = mockTallyExports.filter((t) => t.status === "Sent to Tally").length;
    const synced = mockTallyExports.filter((t) => t.status === "Synced").length;
    const errors = mockTallyExports.filter((t) => t.status === "Error").length;
    const totalRecords = mockTallyExports.reduce((sum, t) => sum + t.recordCount, 0);
    return { total, generated, sent, synced, errors, totalRecords };
  }, []);

  // Available records for export based on selected type
  const availableRecords = useMemo(() => {
    if (batchForm.exportType === 'Sales Invoice') {
      return mockSalesInvoices
        .filter(si => {
          if (batchForm.statusFilter === 'Pending') return !si.tallySync;
          return true;
        })
        .map(si => ({ id: si.id, number: si.invoiceNumber, date: si.invoiceDate, amount: si.totalAmount, customer: si.customerCompany }));
    }
    if (batchForm.exportType === 'Purchase Invoice') {
      return mockPurchaseInvoices
        .map(pi => ({ id: pi.id, number: pi.purchaseInvoiceNumber, date: pi.invoiceDate, amount: pi.totalAmount, customer: pi.mill }));
    }
    return [];
  }, [batchForm.exportType, batchForm.statusFilter]);

  const handleCloseModal = useCallback(() => {
    setShowBatchModal(false);
    setBatchForm({
      exportType: 'Sales Invoice',
      dateFrom: '',
      dateTo: '',
      fileFormat: 'XML',
      statusFilter: 'Pending',
    });
  }, []);

  const handleGenerateExport = useCallback(() => {
    alert(`Export batch generated: ${availableRecords.length} ${batchForm.exportType} records as ${batchForm.fileFormat}`);
    handleCloseModal();
  }, [availableRecords.length, batchForm.exportType, batchForm.fileFormat, handleCloseModal]);

  const statusOptions = useMemo(
    () => [
      { label: "Generated", value: "Generated" },
      { label: "Sent to Tally", value: "Sent to Tally" },
      { label: "Synced", value: "Synced" },
      { label: "Error", value: "Error" },
    ],
    []
  );

  const typeOptions = useMemo(
    () => [
      { label: "Sales Invoice", value: "Sales Invoice" },
      { label: "Purchase Invoice", value: "Purchase Invoice" },
      { label: "Payment Receipt", value: "Payment Receipt" },
      { label: "Payment Made", value: "Payment Made" },
    ],
    []
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Generated": return "bg-blue-100 text-blue-700";
      case "Sent to Tally": return "bg-yellow-100 text-yellow-700";
      case "Synced": return "bg-green-100 text-green-700";
      case "Error": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Sales Invoice": return "bg-blue-50 text-blue-700";
      case "Purchase Invoice": return "bg-purple-50 text-purple-700";
      case "Payment Receipt": return "bg-green-50 text-green-700";
      case "Payment Made": return "bg-orange-50 text-orange-700";
      default: return "bg-gray-50 text-gray-700";
    }
  };

  const columns: ColumnConfig<TallyExport>[] = useMemo(
    () => [
      {
        id: "exportNumber",
        accessorKey: "exportNumber",
        header: "Export #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 150,
        cell: (info) => <span className="font-medium text-gray-900">{info.getValue() as string}</span>,
      },
      {
        id: "exportDate",
        accessorKey: "exportDate",
        header: "Date",
        filterType: "date",
        enableSorting: true,
        defaultVisible: true,
        size: 110,
      },
      {
        id: "exportType",
        accessorKey: "exportType",
        header: "Type",
        filterType: "select",
        filterOptions: typeOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 160,
        cell: (info) => {
          const type = info.getValue() as string;
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getTypeColor(type)}`}>
              {type}
            </span>
          );
        },
      },
      {
        id: "invoiceNumbers",
        accessorKey: "invoiceNumbers",
        header: "Vouchers",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 260,
        cell: (info) => {
          const nums = info.getValue() as string[];
          return (
            <div className="flex flex-wrap gap-1">
              {nums.slice(0, 2).map((n) => (
                <span key={n} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 font-mono">{n}</span>
              ))}
              {nums.length > 2 && (
                <span className="text-xs text-gray-400">+{nums.length - 2} more</span>
              )}
            </div>
          );
        },
      },
      {
        id: "recordCount",
        accessorKey: "recordCount",
        header: "Records",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 90,
        cell: (info) => <span className="font-medium text-gray-700">{info.getValue() as number}</span>,
      },
      {
        id: "fileFormat",
        accessorKey: "fileFormat",
        header: "Format",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 90,
        cell: (info) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">{info.getValue() as string}</span>
        ),
      },
      {
        id: "fileName",
        accessorKey: "fileName",
        header: "File",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 220,
        cell: (info) => (
          <span className="font-mono text-xs text-gray-500">{info.getValue() as string}</span>
        ),
      },
      {
        id: "exportedBy",
        accessorKey: "exportedBy",
        header: "Exported By",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: statusOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const te = info.row.original;
          const status = info.getValue() as string;
          return (
            <div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(status)}`}>
                {status}
              </span>
              {status === "Error" && te.errorMessage && (
                <div className="text-xs text-red-500 mt-0.5 truncate max-w-[180px]" title={te.errorMessage}>
                  {te.errorMessage}
                </div>
              )}
              {status === "Synced" && te.syncedAt && (
                <div className="text-xs text-gray-400 mt-0.5">{te.syncedAt}</div>
              )}
            </div>
          );
        },
      },
    ],
    [statusOptions, typeOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Exports</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.total}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Generated</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.generated}</p>
              <p className="mt-0.5 text-xs text-blue-600">Ready to send</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Sent to Tally</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.sent}</p>
              <p className="mt-0.5 text-xs text-yellow-600">Awaiting sync</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
              <Send className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Synced</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.synced}</p>
              <p className="mt-0.5 text-xs text-green-600">In Tally</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Errors</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.errors}</p>
              <p className="mt-0.5 text-xs text-red-600">Need retry</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Records</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.totalRecords}</p>
              <p className="mt-0.5 text-xs text-gray-500">Vouchers exported</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <RefreshCw className="h-5 w-5 text-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowBatchModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <Download className="h-4 w-4" />
          Create Export Batch
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Send className="h-4 w-4" />
          Export All Pending
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-4 w-4" />
          Retry Failed
        </button>
        <p className="text-xs text-gray-500 ml-auto">
          {kpis.generated + kpis.sent} export(s) pending &middot; {kpis.errors} error(s)
        </p>
      </div>

      {/* Data Grid */}
      <DataGrid
        data={mockTallyExports}
        columns={columns}
        tableName="tally-exports"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        emptyMessage="No Tally exports found. Use 'Create Export Batch' to generate exports from invoices."
      />

      {/* Create Export Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[10vh]">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Create Export Batch</h2>
                <p className="text-sm text-gray-500">Select voucher type and date range to generate Tally export file</p>
              </div>
              <button onClick={handleCloseModal} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Export Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Type *</label>
                  <div className="relative">
                    <select
                      value={batchForm.exportType}
                      onChange={(e) => setBatchForm(prev => ({ ...prev, exportType: e.target.value as TallyExport['exportType'] }))}
                      className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Sales Invoice">Sales Invoice</option>
                      <option value="Purchase Invoice">Purchase Invoice</option>
                      <option value="Payment Receipt">Payment Receipt</option>
                      <option value="Payment Made">Payment Made</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Export Format</label>
                  <div className="relative">
                    <select
                      value={batchForm.fileFormat}
                      onChange={(e) => setBatchForm(prev => ({ ...prev, fileFormat: e.target.value as 'XML' | 'Excel' | 'CSV' }))}
                      className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="XML">XML (Tally Compatible)</option>
                      <option value="Excel">Excel (.xlsx)</option>
                      <option value="CSV">CSV</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                  <input
                    type="date"
                    value={batchForm.dateFrom}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                  <input
                    type="date"
                    value={batchForm.dateTo}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={batchForm.statusFilter === 'Pending'}
                        onChange={() => setBatchForm(prev => ({ ...prev, statusFilter: 'Pending' }))}
                        className="text-blue-500"
                      />
                      <span className="text-sm text-gray-700">Pending only (not yet exported)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={batchForm.statusFilter === 'All'}
                        onChange={() => setBatchForm(prev => ({ ...prev, statusFilter: 'All' }))}
                        className="text-blue-500"
                      />
                      <span className="text-sm text-gray-700">All records</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Preview of records to export */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Records to Export ({availableRecords.length})
                </h4>
                <div className="rounded-lg border overflow-hidden max-h-[250px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Voucher #</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Party</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableRecords.slice(0, 20).map(rec => (
                        <tr key={rec.id} className="border-t">
                          <td className="px-3 py-2 font-medium text-gray-900 font-mono text-xs">{rec.number}</td>
                          <td className="px-3 py-2 text-gray-600">{rec.date}</td>
                          <td className="px-3 py-2 text-gray-600">{rec.customer}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">₹{rec.amount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      {availableRecords.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">
                            No records found for the selected criteria
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-gray-50 p-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{availableRecords.length}</span> {batchForm.exportType} record(s) will be exported as <span className="font-mono font-medium">{batchForm.fileFormat}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total: ₹{availableRecords.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t pt-4">
                <button
                  onClick={handleCloseModal}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateExport}
                  disabled={availableRecords.length === 0}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Generate Export File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
