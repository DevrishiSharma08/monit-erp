"use client";

import { PermGuard } from "@/components/PermGuard";

import { useState, useMemo, useCallback } from "react";
import { Challan, InTransitTracking } from "@/data/mockData";
import { useStock } from "@/context/StockContext";
import { useSalesOrder } from "@/context/SalesOrderContext";
import { useToast } from "@/context/ToastContext";
import {
  FileText,
  Clock,
  PackageCheck,
  Truck,
  CheckCircle2,
  Play,
  Square,
  Send,
  Receipt,
  X,
  MapPin,
  User,
  Phone,
  Calendar,
  Package,
  Weight,
  Hash,
  FileSpreadsheet,
  AlertTriangle,
  Printer,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { fmtDateIN, fmtNumIN } from "@/lib/formatters";

function ChallanPage() {
  const { stockLots, dispatchLot, challans, updateChallan, addInTransitTracking } = useStock();
  const { salesOrders, updateSalesOrder } = useSalesOrder();
  const { success } = useToast();
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Form state for loading control
  const [loadingForm, setLoadingForm] = useState({
    numberOfBundles: 0,
    weightKg: 0,
    lrNumber: "",
    eWayBillNumber: "",
    remarks: "",
  });

  // Form state for dispatch
  const [dispatchForm, setDispatchForm] = useState({
    lrNumber: "",
    eWayBillNumber: "",
    gateOutTime: "",
    transportCost: 0,
    remarks: "",
  });

  // KPIs
  const kpis = useMemo(() => {
    const total = challans.length;
    const ready = challans.filter((c) => c.status === "Ready").length;
    const loading = challans.filter((c) => c.status === "Loading").length;
    const loaded = challans.filter((c) => c.status === "Loaded").length;
    const dispatched = challans.filter((c) => c.status === "Dispatched").length;
    const withInvoice = challans.filter((c) => c.invoiceNumber).length;
    const totalQty = challans.reduce((sum, c) => sum + c.totalQty, 0);

    return { total, ready, loading, loaded, dispatched, withInvoice, totalQty };
  }, [challans]);

  const statusOptions = useMemo(
    () => [
      { label: "Ready", value: "Ready" },
      { label: "Loading", value: "Loading" },
      { label: "Loaded", value: "Loaded" },
      { label: "Dispatched", value: "Dispatched" },
    ],
    []
  );

  // Status transition handlers
  const handleStartLoading = useCallback(() => {
    if (!selectedChallan) return;
    const now = new Date();
    const timeStr = now.toISOString().slice(0, 16).replace("T", " ");
    updateChallan(selectedChallan.id, { status: "Loading", loadingStartTime: timeStr });
    setSelectedChallan((prev) =>
      prev ? { ...prev, status: "Loading" as const, loadingStartTime: timeStr } : null
    );
  }, [selectedChallan, updateChallan]);

  const handleCompleteLoading = useCallback(() => {
    if (!selectedChallan) return;
    const now = new Date();
    const timeStr = now.toISOString().slice(0, 16).replace("T", " ");
    const loadPatch = {
      status: "Loaded" as const,
      loadingEndTime: timeStr,
      loadedBy: "Current User",
      numberOfBundles: loadingForm.numberOfBundles || selectedChallan.numberOfBundles,
      weightKg: loadingForm.weightKg || selectedChallan.weightKg,
      remarks: loadingForm.remarks || selectedChallan.remarks,
    };
    updateChallan(selectedChallan.id, loadPatch);
    setSelectedChallan((prev) => prev ? { ...prev, ...loadPatch } : null);
  }, [selectedChallan, loadingForm, updateChallan]);

  const handleDispatch = useCallback(() => {
    if (!selectedChallan) return;
    const now = new Date();
    const timeStr = now.toISOString().slice(0, 16).replace("T", " ");
    const trackingId = `TRK-${now.getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    // ── Permanently deduct stock for each challan line ─────────────────────
    selectedChallan.lines.forEach((line) => {
      const lot = stockLots.find((l) => l.lotNumber === line.lotNumber);
      if (lot) dispatchLot(lot.id, line.quantity);
    });

    // ── Mark matching SO lines as Dispatched ───────────────────────────────
    const so = salesOrders.find((s) => s.soNumber === selectedChallan.soNumber);
    if (so) {
      const dispatchedLineIds = new Set(selectedChallan.lines.map((l) => l.soLineId));
      const updatedLines = so.lines.map((l) =>
        dispatchedLineIds.has(l.id) ? { ...l, status: "Dispatched" as const } : l
      );
      const allDispatched = updatedLines.every((l) => l.status === "Dispatched" || l.status === "Delivered");
      updateSalesOrder(so.id, {
        lines: updatedLines,
        ...(allDispatched ? { status: "Completed" as const } : {}),
      });
    }

    // ── Update challan status ──────────────────────────────────────────────
    const dispatchPatch = {
      status: "Dispatched" as const,
      dispatchTime: timeStr,
      gateOutTime: dispatchForm.gateOutTime || timeStr,
      lrNumber: dispatchForm.lrNumber || selectedChallan.lrNumber,
      eWayBillNumber: dispatchForm.eWayBillNumber || selectedChallan.eWayBillNumber,
      transportCost: dispatchForm.transportCost || selectedChallan.transportCost,
      inTransitTrackingId: trackingId,
      invoiceEligible: true,
    };
    updateChallan(selectedChallan.id, dispatchPatch);
    setSelectedChallan((prev) => prev ? { ...prev, ...dispatchPatch } : null);

    // ── Create In-Transit tracking entry ───────────────────────────────────
    const today = now.toISOString().slice(0, 10);
    const eta = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const newTracking: InTransitTracking = {
      id: `trk_${Date.now()}`,
      trackingNumber: trackingId,
      loadPlanId: selectedChallan.truckLoadPlanNumber,
      soNumber: selectedChallan.soNumber,
      challanNumber: selectedChallan.challanNumber,
      truckNumber: selectedChallan.truckNumber || "TBD",
      driverName: selectedChallan.driverName || "TBD",
      driverPhone: selectedChallan.driverPhone || "",
      origin: selectedChallan.warehouse,
      destination: selectedChallan.customerAddress || selectedChallan.customer,
      deliveryMode: selectedChallan.deliveryMode,
      dispatchedDate: today,
      expectedArrival: eta,
      status: "Dispatched",
      locationUpdates: [{ timestamp: timeStr, location: selectedChallan.warehouse, remarks: "Dispatched from warehouse" }],
    };
    addInTransitTracking(newTracking);

    success(`Challan ${selectedChallan.challanNumber} dispatched. Stock deducted.`);
    setShowDispatchConfirm(false);
    setDispatchForm({ lrNumber: "", eWayBillNumber: "", gateOutTime: "", transportCost: 0, remarks: "" });
  }, [selectedChallan, dispatchForm, stockLots, dispatchLot, salesOrders, updateSalesOrder, updateChallan, addInTransitTracking, success]);

  const handleGenerateInvoice = useCallback(() => {
    if (!selectedChallan) return;
    const invoiceNum = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
    updateChallan(selectedChallan.id, { invoiceNumber: invoiceNum });
    setSelectedChallan((prev) => prev ? { ...prev, invoiceNumber: invoiceNum } : null);
    setShowInvoiceModal(false);
  }, [selectedChallan, updateChallan]);

  const openDetail = useCallback((challan: Challan) => {
    setSelectedChallan(challan);
    setLoadingForm({
      numberOfBundles: challan.numberOfBundles || 0,
      weightKg: challan.weightKg || 0,
      lrNumber: challan.lrNumber || "",
      eWayBillNumber: challan.eWayBillNumber || "",
      remarks: challan.remarks || "",
    });
    setShowDetailModal(true);
  }, []);

  // Status badge colors
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Ready: "bg-purple-100 text-purple-700 border-purple-200",
      Loading: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Loaded: "bg-blue-100 text-blue-700 border-blue-200",
      Dispatched: "bg-green-100 text-green-700 border-green-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  // Columns
  const columns: ColumnConfig<Challan>[] = useMemo(
    () => [
      {
        id: "challanNumber",
        accessorKey: "challanNumber",
        header: "Challan #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 130,
        cell: (info) => (
          <span className="font-semibold text-blue-700 cursor-pointer hover:underline">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        id: "challanDate",
        accessorKey: "challanDate",
        header: "Date",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 100,
        cell: (info) => <span className="tabular-nums">{fmtDateIN(info.getValue() as string)}</span>,
        exportValue: (r) => fmtDateIN((r as any).challanDate),
      },
      {
        id: "soNumber",
        accessorKey: "soNumber",
        header: "SO #",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => (
          <span className="text-blue-600 font-medium">{info.getValue() as string}</span>
        ),
      },
      {
        id: "customer",
        accessorKey: "customer",
        header: "Customer",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 170,
      },
      {
        id: "deliveryMode",
        accessorKey: "deliveryMode",
        header: "Delivery Mode",
        filterType: "select",
        filterOptions: [
          { label: "Direct To Customer", value: "Direct To Customer" },
          { label: "To Godown", value: "To Godown" },
        ],
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const mode = info.getValue() as string;
          const isDirectCustomer = mode === "Direct To Customer";
          return (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                isDirectCustomer
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-orange-50 text-orange-700"
              }`}
            >
              {isDirectCustomer ? "Direct" : "To Godown"}
            </span>
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
        size: 220,
        exportColumns: [
          {
            header: "Items",
            value: (r) => (r as any).lines?.map((l: any, i: number) => `${i + 1}. ${l.paper} ${l.gsm}GSM ${l.size}`).join("\n") ?? "—",
          },
          {
            header: "Qty (Sht)",
            value: (r) => (r as any).lines?.map((l: any) => fmtNumIN(l.quantity)).join("\n") ?? "—",
          },
        ],
        cell: (info) => {
          const challan = info.row.original;
          const totalLines = challan.lines.length;
          const firstLine = challan.lines[0];
          return (
            <div className="text-sm space-y-0.5">
              <p className="font-medium text-gray-900">
                {firstLine.paper} {firstLine.gsm}GSM
                {totalLines > 1 && (
                  <span className="text-gray-500"> +{totalLines - 1} more</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {fmtNumIN(challan.totalQty)} sheets
              </p>
            </div>
          );
        },
      },
      {
        id: "truckNumber",
        accessorKey: "truckNumber",
        header: "Truck #",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-gray-900">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        id: "driverName",
        accessorKey: "driverName",
        header: "Driver",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "lrNumber",
        accessorKey: "lrNumber",
        header: "LR #",
        filterType: "text",
        enableSorting: false,
        defaultVisible: true,
        size: 120,
        cell: (info) => {
          const lr = info.getValue() as string | undefined;
          return lr ? (
            <span className="font-mono text-xs text-gray-700">{lr}</span>
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          );
        },
      },
      {
        id: "eWayBillNumber",
        accessorKey: "eWayBillNumber",
        header: "E-Way Bill",
        filterType: "text",
        enableSorting: false,
        defaultVisible: false,
        size: 150,
        cell: (info) => {
          const ewb = info.getValue() as string | undefined;
          return ewb ? (
            <span className="font-mono text-xs text-gray-700">{ewb}</span>
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          );
        },
      },
      {
        id: "dispatchTime",
        accessorKey: "dispatchTime",
        header: "Dispatch Time",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const dt = info.getValue() as string | undefined;
          return dt ? (
            <span className="text-sm text-gray-700">{dt}</span>
          ) : (
            <span className="text-gray-400 text-xs">Not dispatched</span>
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
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(status)}`}
            >
              {status}
            </span>
          );
        },
      },
      {
        id: "invoiceNumber",
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        filterType: "text",
        enableSorting: false,
        defaultVisible: true,
        size: 130,
        cell: (info) => {
          const invoice = info.getValue() as string | undefined;
          return invoice ? (
            <span className="text-green-600 font-medium">{invoice}</span>
          ) : (
            <span className="text-gray-400 text-xs">Pending</span>
          );
        },
      },
    ],
    [statusOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Ready for Loading
              </p>
              <p className="mt-1.5 text-2xl font-bold text-purple-700">{kpis.ready}</p>
              <p className="mt-0.5 text-xs text-purple-600">Awaiting start</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
              <CheckCircle2 className="h-5 w-5 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Loading
              </p>
              <p className="mt-1.5 text-2xl font-bold text-yellow-700">{kpis.loading}</p>
              <p className="mt-0.5 text-xs text-yellow-600">In progress</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Loaded
              </p>
              <p className="mt-1.5 text-2xl font-bold text-blue-700">{kpis.loaded}</p>
              <p className="mt-0.5 text-xs text-blue-600">Ready to dispatch</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <PackageCheck className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Dispatched
              </p>
              <p className="mt-1.5 text-2xl font-bold text-green-700">{kpis.dispatched}</p>
              <p className="mt-0.5 text-xs text-green-600">On the way</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <Truck className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Invoiced
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.withInvoice}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {kpis.total > 0
                  ? ((kpis.withInvoice / kpis.total) * 100).toFixed(0)
                  : 0}
                % done
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
              <Receipt className="h-5 w-5 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Total Qty
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">
                {(kpis.totalQty / 1000).toFixed(0)}K
              </p>
              <p className="mt-0.5 text-xs text-gray-500">sheets across all</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
              <Package className="h-5 w-5 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              Challan & Loading - Control Gate: Warehouse → Truck → Customer
            </p>
            <p className="mt-1 text-amber-700">
              Only Pick Plans with status &quot;Completed&quot; and assigned Truck Load Plan appear
              here. Click any row to open the Challan Detail page with loading
              controls, dispatch actions, and invoice generation.
            </p>
          </div>
        </div>
      </div>

      {/* Status Flow Indicator */}
      <div className="rounded-lg border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-center gap-2 text-xs font-medium">
          <span className="flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-purple-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-yellow-700">
            <Play className="h-3.5 w-3.5" /> Start Loading
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">
            <Square className="h-3.5 w-3.5" /> Complete Loading
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-green-700">
            <Send className="h-3.5 w-3.5" /> Dispatch
          </span>
          <span className="text-gray-300">→</span>
          <span className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-700">
            <Receipt className="h-3.5 w-3.5" /> Invoice
          </span>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid
        data={challans}
        columns={columns}
        tableName="challans"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        onRowClick={(challan) => openDetail(challan)}
        emptyMessage="No challans found. Challans are created when Pick Plans are completed and Truck Load Plans assigned."
      />

      {/* ======================== CHALLAN DETAIL MODAL ======================== */}
      {showDetailModal && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedChallan.challanNumber}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedChallan.soNumber} | {selectedChallan.customer}
                  </p>
                </div>
                <span
                  className={`ml-4 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${getStatusColor(selectedChallan.status)}`}
                >
                  {selectedChallan.status}
                </span>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 space-y-6">
              {/* ===== Section A: Order Info ===== */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Section A — Order Info
                </h3>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> SO Number
                    </p>
                    <p className="mt-1 font-semibold text-blue-700">
                      {selectedChallan.soNumber}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> Customer
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedChallan.customer}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Delivery Mode
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedChallan.deliveryMode}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Warehouse
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedChallan.warehouse}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 col-span-2">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Delivery Address
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedChallan.customerAddress}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Expected Delivery
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {selectedChallan.expectedDeliveryDate}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Pick Plan
                    </p>
                    <p className="mt-1 font-semibold text-indigo-700">
                      {selectedChallan.pickPlanNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* ===== Section B: Item Details ===== */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Section B — Item Details (Auto-filled from Pick Plan)
                </h3>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">
                          Item
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">
                          GSM
                        </th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">
                          Size
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          Ordered
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          Picked
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">
                          Balance
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">
                          Bin
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">
                          Lot #
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedChallan.lines.map((line, idx) => (
                        <tr
                          key={line.id}
                          className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {line.paper}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {line.gsm}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {line.size}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {line.orderedQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">
                            {line.pickedQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-medium ${
                                line.orderedQty - line.pickedQty > 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {(line.orderedQty - line.pickedQty).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {line.binLocation}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {line.lotNumber}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <td className="px-4 py-3 text-gray-900" colSpan={3}>
                          Total
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {selectedChallan.lines
                            .reduce((s, l) => s + l.orderedQty, 0)
                            .toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-green-700">
                          {selectedChallan.lines
                            .reduce((s, l) => s + l.pickedQty, 0)
                            .toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {selectedChallan.lines
                            .reduce((s, l) => s + (l.orderedQty - l.pickedQty), 0)
                            .toLocaleString()}
                        </td>
                        <td className="px-4 py-3" colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* ===== Section C: Loading Control ===== */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Section C — Loading Control
                </h3>

                {/* Truck Info (read-only from TLP) */}
                <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-2">
                    Truck Details (Auto from Truck Load Plan:{" "}
                    {selectedChallan.truckLoadPlanNumber})
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Truck Number</p>
                      <p className="font-mono font-bold text-gray-900">
                        {selectedChallan.truckNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Driver</p>
                      <p className="font-medium text-gray-900 flex items-center gap-1">
                        <User className="h-3 w-3 text-gray-400" />
                        {selectedChallan.driverName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Mobile</p>
                      <p className="font-medium text-gray-900 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        {selectedChallan.driverPhone}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Transporter</p>
                      <p className="font-medium text-gray-900">
                        {selectedChallan.transporterName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Loading Times */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">Loading Start</p>
                    <p className="mt-1 font-medium text-gray-900">
                      {selectedChallan.loadingStartTime || (
                        <span className="text-gray-400">Not started</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">Loading End</p>
                    <p className="mt-1 font-medium text-gray-900">
                      {selectedChallan.loadingEndTime || (
                        <span className="text-gray-400">Not complete</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">Gate Out Time</p>
                    <p className="mt-1 font-medium text-gray-900">
                      {selectedChallan.gateOutTime || (
                        <span className="text-gray-400">Not dispatched</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">Loaded By</p>
                    <p className="mt-1 font-medium text-gray-900">
                      {selectedChallan.loadedBy || (
                        <span className="text-gray-400">-</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Editable Loading Fields (only when Loading or Ready) */}
                {(selectedChallan.status === "Ready" ||
                  selectedChallan.status === "Loading") && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600 mb-3">
                      Loading Details (Fill during loading)
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Number of Bundles
                        </label>
                        <input
                          type="number"
                          value={loadingForm.numberOfBundles || ""}
                          onChange={(e) =>
                            setLoadingForm((f) => ({
                              ...f,
                              numberOfBundles: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g. 24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Weight (KG)
                        </label>
                        <input
                          type="number"
                          value={loadingForm.weightKg || ""}
                          onChange={(e) =>
                            setLoadingForm((f) => ({
                              ...f,
                              weightKg: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g. 6500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Remarks
                        </label>
                        <input
                          type="text"
                          value={loadingForm.remarks}
                          onChange={(e) =>
                            setLoadingForm((f) => ({ ...f, remarks: e.target.value }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Any loading remarks..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dispatch-specific fields (only when Loaded) */}
                {selectedChallan.status === "Loaded" && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-3">
                      Dispatch Details (Fill before dispatch)
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          LR Number *
                        </label>
                        <input
                          type="text"
                          value={dispatchForm.lrNumber}
                          onChange={(e) =>
                            setDispatchForm((f) => ({
                              ...f,
                              lrNumber: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g. LR-2024-0051"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          E-Way Bill Number *
                        </label>
                        <input
                          type="text"
                          value={dispatchForm.eWayBillNumber}
                          onChange={(e) =>
                            setDispatchForm((f) => ({
                              ...f,
                              eWayBillNumber: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g. EWB-331200045678"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Gate Out Time
                        </label>
                        <input
                          type="datetime-local"
                          value={dispatchForm.gateOutTime}
                          onChange={(e) =>
                            setDispatchForm((f) => ({
                              ...f,
                              gateOutTime: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Transport Cost (INR)
                        </label>
                        <input
                          type="number"
                          value={dispatchForm.transportCost || ""}
                          onChange={(e) =>
                            setDispatchForm((f) => ({
                              ...f,
                              transportCost: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g. 4500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Logistics Info (read-only for dispatched) */}
                {selectedChallan.status === "Dispatched" && (
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-3">
                      Dispatch & Logistics Info
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">LR Number</p>
                        <p className="font-mono font-medium text-gray-900">
                          {selectedChallan.lrNumber || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">E-Way Bill</p>
                        <p className="font-mono font-medium text-gray-900">
                          {selectedChallan.eWayBillNumber || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gate Out Time</p>
                        <p className="font-medium text-gray-900">
                          {selectedChallan.gateOutTime || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Transport Cost</p>
                        <p className="font-medium text-gray-900">
                          {selectedChallan.transportCost
                            ? `INR ${selectedChallan.transportCost.toLocaleString()}`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Dispatch Time</p>
                        <p className="font-medium text-gray-900">
                          {selectedChallan.dispatchTime || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Bundles</p>
                        <p className="font-medium text-gray-900">
                          {selectedChallan.numberOfBundles || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Weight</p>
                        <p className="font-medium text-gray-900">
                          {selectedChallan.weightKg
                            ? `${selectedChallan.weightKg.toLocaleString()} KG`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tracking ID</p>
                        <p className="font-mono font-medium text-blue-700">
                          {selectedChallan.inTransitTrackingId || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Section D: Linked Records ===== */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Section D — Linked Records
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">SO</p>
                    <p className="font-semibold text-blue-700 text-sm">
                      {selectedChallan.soNumber}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">Pick Plan</p>
                    <p className="font-semibold text-indigo-700 text-sm">
                      {selectedChallan.pickPlanNumber}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">Truck Load Plan</p>
                    <p className="font-semibold text-orange-700 text-sm">
                      {selectedChallan.truckLoadPlanNumber}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">Challan</p>
                    <p className="font-semibold text-gray-900 text-sm">
                      {selectedChallan.challanNumber}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">Invoice</p>
                    <p
                      className={`font-semibold text-sm ${
                        selectedChallan.invoiceNumber
                          ? "text-green-700"
                          : "text-gray-400"
                      }`}
                    >
                      {selectedChallan.invoiceNumber || "Not Generated"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== Action Footer ===== */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6 rounded-b-2xl">
              <div className="flex items-center gap-2">
                {selectedChallan.status === "Dispatched" && (
                  <button
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      // Print challan
                    }}
                  >
                    <Printer className="h-4 w-4" />
                    Print Challan
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Ready → Start Loading */}
                {selectedChallan.status === "Ready" && (
                  <button
                    onClick={handleStartLoading}
                    className="flex items-center gap-2 rounded-lg bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-yellow-600 transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    Start Loading
                  </button>
                )}

                {/* Loading → Complete Loading */}
                {selectedChallan.status === "Loading" && (
                  <button
                    onClick={handleCompleteLoading}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    <Square className="h-4 w-4" />
                    Complete Loading
                  </button>
                )}

                {/* Loaded → Dispatch */}
                {selectedChallan.status === "Loaded" && (
                  <button
                    onClick={() => setShowDispatchConfirm(true)}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    Dispatch
                  </button>
                )}

                {/* Dispatched → Generate Invoice */}
                {selectedChallan.status === "Dispatched" &&
                  !selectedChallan.invoiceNumber && (
                    <button
                      onClick={() => setShowInvoiceModal(true)}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                      <Receipt className="h-4 w-4" />
                      Generate Sales Invoice
                    </button>
                  )}

                {/* Invoice already generated */}
                {selectedChallan.invoiceNumber && (
                  <button className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-6 py-2.5 text-sm font-semibold text-green-700">
                    <FileSpreadsheet className="h-4 w-4" />
                    {selectedChallan.invoiceNumber} - Export to Tally
                  </button>
                )}

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================== DISPATCH CONFIRMATION MODAL ======================== */}
      {showDispatchConfirm && selectedChallan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Send className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Dispatch</h3>
                <p className="text-sm text-gray-500">
                  {selectedChallan.challanNumber}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4">
              <p className="text-sm font-medium text-amber-800">
                On dispatch, the system will:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-700">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> Create In-Transit
                  tracking entry
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> Lock Pick Plan
                  (no further edits)
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> Permanently reduce
                  warehouse stock
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> Enable Sales
                  Invoice generation
                </li>
              </ul>
            </div>

            {!dispatchForm.lrNumber && !selectedChallan.lrNumber && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
                <p className="text-xs font-medium text-red-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  LR Number and E-Way Bill are recommended before dispatch.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowDispatchConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatch}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== INVOICE GENERATION MODAL ======================== */}
      {showInvoiceModal && selectedChallan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Receipt className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Generate Sales Invoice
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedChallan.challanNumber} → {selectedChallan.soNumber}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-semibold text-gray-900">
                  {selectedChallan.customer}
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                        Item
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Rate (est.)
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedChallan.lines.map((line) => {
                      const estimatedRate = line.gsm * 0.5;
                      const amount = line.quantity * estimatedRate;
                      return (
                        <tr key={line.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-900">
                            {line.paper} {line.gsm}GSM {line.size}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {line.quantity.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            INR {estimatedRate.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            INR {amount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td className="px-3 py-2" colSpan={3}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right text-green-700">
                        INR{" "}
                        {selectedChallan.lines
                          .reduce(
                            (sum, l) => sum + l.quantity * l.gsm * 0.5,
                            0
                          )
                          .toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  Rates will be pulled from SO. Invoice will be pushed to Tally
                  Export Queue after generation.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateInvoice}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Generate Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="logistics.read"><ChallanPage /></PermGuard>;
}
