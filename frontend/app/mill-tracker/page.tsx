"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { MillOrderTracker, PartialDelivery } from "@/types/paper-domain";
import { millTrackerApi, MillTrackerRow, MillTrackerBatchRow, BulkImportRowInput, BulkImportResultDto, truckLoadPlanApi } from "@/lib/api-services";
import * as XLSX from "xlsx";
import { useToast } from "@/context/ToastContext";
import {
  Factory,
  Clock,
  Truck,
  CheckCircle,
  Upload,
  Download,
  Edit,
  Eye,
  History,
  ChevronDown,
  ChevronRight,
  Users,
  List,
  Package,
  Plus,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  EyeOff,
  MoreVertical,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";

// ─── Timestamp formatter (UTC → IST) ─────────────────────────────────────────
function fmtDateTime(raw?: string | null): string {
  if (!raw) return "—";
  const utc = raw.endsWith("Z") ? raw : raw + "Z";
  const d = new Date(utc);
  if (isNaN(d.getTime())) return raw;
  const datePart = d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric", month: "short", year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  return `${datePart}, ${timePart.toUpperCase()}`;
}

// ─── Shared form styles ───────────────────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

// ─── Status color helper ─────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  "Order Placed":  "bg-gray-100 text-gray-600",
  "In Production": "bg-blue-100 text-blue-700",
  "Partial Ready": "bg-amber-100 text-amber-700",
  "Ready":         "bg-green-100 text-green-700",
  "Dispatched":    "bg-cyan-100 text-cyan-700",
  "Delayed":       "bg-red-100 text-red-700",
  "Cancelled":     "bg-rose-100 text-rose-700",
};

// ─── Group types ──────────────────────────────────────────────────────────────
interface MillGroup { millName: string; trackers: MillOrderTracker[] }
interface CustomerGroup {
  key: string;
  customerName: string;
  customerId?: string;
  mills: MillGroup[];
  totalOrdered: number;
  totalReady: number;
  totalDispatched: number;
  totalBalance: number;
  poCount: number;
}

// ─── API → frontend model mapper ──────────────────────────────────────────────
function mapTrackerRow(r: MillTrackerRow): MillOrderTracker {
  return {
    id:                 String(r.id),
    poNumber:           r.poNumber,
    poItemId:           r.poItemId != null ? String(r.poItemId) : undefined,
    poDate:             r.poDate ?? "",
    mill:               r.mill ?? "",
    paper:              r.paper ?? "",
    gsm:                r.gsm ?? 0,
    size:               r.size ?? "",
    orderedQty:         r.orderedQty,
    readyQty:           r.readyQty,
    dispatchedQty:      r.dispatchedQty,
    balanceQty:         r.balanceQty,
    rate:               r.rate,
    totalAmount:        r.totalAmount,
    productionStatus:   r.productionStatus as MillOrderTracker["productionStatus"],
    productionProgress: r.productionProgress,
    expectedDelivery:   r.expectedDelivery ?? "",
    actualDispatchDate: r.actualDispatchDate,
    lastUpdate:         r.lastUpdate ?? "",
    lastUpdatedBy:      r.lastUpdatedBy,
    delayDays:          r.delayDays,
    soNumber:           r.soNumber,
    deliveryMode:       r.deliveryMode as MillOrderTracker["deliveryMode"],
    millInvoiceNo:      r.millInvoiceNo,
    remarks:            r.remarks,
    customerName:       r.customerName,
    soCustomerName:     r.soCustomerName,
    customerId:         r.customerId != null ? String(r.customerId) : undefined,
    millSONumber:       r.millSONumber,
    soDeliveryDate:     r.soDeliveryDate,
    partialDeliveries:  r.batches.map((b) => ({
      id:            String(b.id),
      batchNo:       b.batchNo,
      date:          b.deliveryDate ?? "",
      qty:           b.quantity,
      truckNumber:   b.truckNumber,
      millInvoiceNo: b.millInvoiceNo,
      remarks:       b.remarks,
    })),
    history: r.history.map((h) => ({
      id:        String(h.id),
      date:      h.updatedAt,
      user:      h.updatedBy,
      action:    h.action ?? "Update",
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      oldQty:    h.oldQty,
      newQty:    h.newQty,
      remarks:   h.remarks,
    })),
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MillTrackerPage() {
  const { success } = useToast();

  // ── API data ────────────────────────────────────────────────────────────────
  const [millTrackers, setMillTrackers] = useState<MillOrderTracker[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);

  const refreshTrackers = useCallback(async () => {
    const res = await millTrackerApi.list({ pageSize: 500 });
    setMillTrackers(res.items.map(mapTrackerRow));
  }, []);

  useEffect(() => {
    refreshTrackers().finally(() => setIsLoading(false));
  }, [refreshTrackers]);

  // View state
  const [activeTab, setActiveTab]                 = useState<"customer" | "mill" | "po">("po");
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedMills, setExpandedMills]         = useState<Set<string>>(new Set());

  // Toolbar state
  const [searchQuery, setSearchQuery]         = useState("");
  const [filterStatus, setFilterStatus]       = useState("");
  const [filterCustomer, setFilterCustomer]   = useState("");
  const [filterMill, setFilterMill]           = useState("");
  const [filterPoNumber, setFilterPoNumber]   = useState("");
  const [filterSoNumber, setFilterSoNumber]   = useState("");
  const [filterPaper, setFilterPaper]         = useState("");
  const [filterGsm, setFilterGsm]             = useState("");
  const [filterExpFrom, setFilterExpFrom]     = useState("");
  const [filterExpTo, setFilterExpTo]         = useState("");
  const [showFilters, setShowFilters]         = useState(false);
  const [showImpExp, setShowImpExp]           = useState(false);

  // Modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingTracker, setEditingTracker]   = useState<MillOrderTracker | undefined>();

  // PO-view column visibility (external control passed to DataGrid)
  const [poColumnVis, setPoColumnVis]         = useState<Record<string, boolean>>({});
  const [showColumnPanel, setShowColumnPanel] = useState(false);

  // ── KPIs (always from full millTrackers) ─────────────────────────────────────
  const kpis = useMemo(() => {
    const total           = millTrackers.length;
    const pending         = millTrackers.filter((m) => m.productionStatus === "Order Placed").length;
    const inProduction    = millTrackers.filter((m) => m.productionStatus === "In Production" || m.productionStatus === "Partial Ready").length;
    const readyToDispatch = millTrackers.filter((m) => m.productionStatus === "Ready").length;
    const dispatched      = millTrackers.filter((m) => m.productionStatus === "Dispatched").length;
    const delayed         = millTrackers.filter((m) => (m.delayDays ?? 0) > 0).length;
    const totalValue      = millTrackers.reduce((s, m) => s + m.totalAmount, 0);
    return { total, pending, inProduction, readyToDispatch, dispatched, delayed, totalValue };
  }, [millTrackers]);

  // ── Filtered trackers (drives all 3 views) ────────────────────────────────
  const filteredTrackers = useMemo(() => millTrackers.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.poNumber.toLowerCase().includes(q) &&
          !(t.customerName?.toLowerCase().includes(q)) &&
          !t.mill.toLowerCase().includes(q) &&
          !t.paper.toLowerCase().includes(q)) return false;
    }
    if (filterStatus   && t.productionStatus !== filterStatus) return false;
    if (filterCustomer && !(t.customerName?.toLowerCase().includes(filterCustomer.toLowerCase()))) return false;
    if (filterMill     && !t.mill.toLowerCase().includes(filterMill.toLowerCase())) return false;
    if (filterPoNumber && !t.poNumber.toLowerCase().includes(filterPoNumber.toLowerCase())) return false;
    if (filterSoNumber && !(t.soNumber?.toLowerCase().includes(filterSoNumber.toLowerCase()))) return false;
    if (filterPaper    && !t.paper.toLowerCase().includes(filterPaper.toLowerCase())) return false;
    if (filterGsm      && t.gsm !== parseInt(filterGsm)) return false;
    if (filterExpFrom  && t.expectedDelivery && t.expectedDelivery < filterExpFrom) return false;
    if (filterExpTo    && t.expectedDelivery && t.expectedDelivery > filterExpTo) return false;
    return true;
  }), [millTrackers, searchQuery, filterStatus, filterCustomer, filterMill,
       filterPoNumber, filterSoNumber, filterPaper, filterGsm, filterExpFrom, filterExpTo]);

  // ── Customer groups ────────────────────────────────────────────────────────
  const customerGroups = useMemo<CustomerGroup[]>(() => {
    const map: Record<string, { customerName: string; customerId?: string; mills: Record<string, MillOrderTracker[]> }> = {};
    filteredTrackers.forEach((t) => {
      const key  = t.customerName || "__stock__";
      const name = t.customerName || "Stock POs (No Customer)";
      if (!map[key]) map[key] = { customerName: name, customerId: t.customerId, mills: {} };
      if (!map[key].mills[t.mill]) map[key].mills[t.mill] = [];
      map[key].mills[t.mill].push(t);
    });
    return Object.entries(map).map(([key, g]) => {
      const all = Object.values(g.mills).flat();
      return {
        key,
        customerName: g.customerName,
        customerId:   g.customerId,
        mills:        Object.entries(g.mills).map(([millName, trackers]) => ({ millName, trackers })),
        totalOrdered:    all.reduce((s, t) => s + t.orderedQty, 0),
        totalReady:      all.reduce((s, t) => s + t.readyQty, 0),
        totalDispatched: all.reduce((s, t) => s + t.dispatchedQty, 0),
        totalBalance:    all.reduce((s, t) => s + t.balanceQty, 0),
        poCount:         all.length,
      };
    });
  }, [filteredTrackers]);

  // ── Mill view groups ───────────────────────────────────────────────────────
  const millViewGroups = useMemo(() => {
    const map: Record<string, MillOrderTracker[]> = {};
    filteredTrackers.forEach((t) => { if (!map[t.mill]) map[t.mill] = []; map[t.mill].push(t); });
    return Object.entries(map).map(([millName, trackers]) => ({
      millName,
      trackers,
      totalOrdered:    trackers.reduce((s, t) => s + t.orderedQty, 0),
      totalReady:      trackers.reduce((s, t) => s + t.readyQty, 0),
      totalDispatched: trackers.reduce((s, t) => s + t.dispatchedQty, 0),
      totalBalance:    trackers.reduce((s, t) => s + t.balanceQty, 0),
      poCount:         trackers.length,
    }));
  }, [filteredTrackers]);

  const toggleCustomer = (key: string) => setExpandedCustomers((prev) => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const toggleMill = (name: string) => setExpandedMills((prev) => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
  });

  const openUpdate  = (t: MillOrderTracker) => { setEditingTracker(t); setShowUpdateModal(true); };
  const openDetail  = (t: MillOrderTracker) => { setEditingTracker(t); setShowDetailModal(true); };
  const openHistory = (t: MillOrderTracker) => { setEditingTracker(t); setShowHistoryModal(true); };

  // ── PO DataGrid columns ────────────────────────────────────────────────────
  const productionStatusOptions = useMemo(() => [
    { label: "Order Placed",  value: "Order Placed"  },
    { label: "In Production", value: "In Production" },
    { label: "Partial Ready", value: "Partial Ready" },
    { label: "Ready",         value: "Ready"         },
    { label: "Dispatched",    value: "Dispatched"    },
    { label: "Delayed",       value: "Delayed"       },
    { label: "Cancelled",     value: "Cancelled"     },
  ], []);

  // ── 3-dot action menu — fixed positioning so it escapes DataGrid overflow ────
  function ThreeDotsMenu({ tracker }: { tracker: MillOrderTracker }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState({ top: 0, right: 0 });

    const toggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!open && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
      }
      setOpen((v) => !v);
    };

    return (
      <div className="flex items-center justify-center w-10" onClick={(e) => e.stopPropagation()}>
        <button ref={btnRef} onClick={toggle}
          className={`rounded p-1.5 transition-colors ${open ? "bg-gray-200 text-gray-800" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>
          <MoreVertical className="h-4 w-4"/>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)}/>
            <div className="fixed z-30 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
              style={{ top: pos.top + 4, right: pos.right }}>
              <button onClick={() => { openUpdate(tracker); setOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                <Edit className="h-3.5 w-3.5 shrink-0"/><span>Update Status</span>
              </button>
              <div className="border-t border-gray-100"/>
              <button onClick={() => { openDetail(tracker); setOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors">
                <Eye className="h-3.5 w-3.5 shrink-0"/><span>View Details</span>
              </button>
              <div className="border-t border-gray-100"/>
              <button onClick={() => { openHistory(tracker); setOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <History className="h-3.5 w-3.5 shrink-0"/><span>History</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const columns: ColumnConfig<MillOrderTracker>[] = useMemo(() => [
    { id: "rowNo",          accessorKey: "id",              header: "#",            filterType: "none",   enableSorting: false, enableHiding: false, defaultVisible: true, size: 45,
      cell: (info) => <span className="text-xs text-gray-400 tabular-nums">{info.row.index + 1}</span> },
    { id: "poNumber",       accessorKey: "poNumber",        header: "PO Number",    filterType: "text",   enableSorting: true, enableHiding: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-mono font-semibold text-xs text-gray-900">{info.getValue() as string}</span> },
    { id: "poDate",         accessorKey: "poDate",          header: "Order Date",   filterType: "none",   enableSorting: true, defaultVisible: true, size: 95,
      cell: (info) => <span className="text-xs text-gray-600">{info.getValue() as string}</span> },
    { id: "itemCode",       accessorKey: "mill",            header: "Item Code",    filterType: "text",   enableSorting: false, defaultVisible: true, size: 200,
      cell: (info) => { const t = info.row.original; return (
        <div className="text-xs leading-tight">
          <div className="font-semibold text-gray-800">{t.mill}</div>
          <div className="text-gray-500">{t.paper} · {t.gsm} GSM · {t.size}</div>
        </div>
      ); } },
    { id: "orderedQty",     accessorKey: "orderedQty",      header: "Ordered",      filterType: "none",   enableSorting: true, defaultVisible: true, size: 80,
      cell: (info) => <span className="font-medium tabular-nums text-xs">{(info.getValue() as number).toLocaleString()}</span> },
    { id: "millSONumber",   accessorKey: "millSONumber",    header: "Mill SO No.",  filterType: "text",   enableSorting: true, defaultVisible: true, size: 110,
      cell: (info) => info.getValue() ? <span className="font-mono text-xs text-purple-700">{info.getValue() as string}</span> : <span className="text-gray-300 text-xs">—</span> },
    { id: "customerName",   accessorKey: "customerName",    header: "PO Customer",  filterType: "text",   enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => info.getValue() ? <span className="font-medium text-xs text-blue-700">{info.getValue() as string}</span> : <span className="text-xs text-gray-400">Stock PO</span> },
    { id: "soCustomerName", accessorKey: "soCustomerName",  header: "SO Customer",  filterType: "text",   enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => info.getValue() ? <span className="text-xs text-gray-700">{info.getValue() as string}</span> : <span className="text-gray-300 text-xs">—</span> },
    { id: "readyQty",       accessorKey: "readyQty",        header: "Ready",        filterType: "none",   enableSorting: true, defaultVisible: true, size: 75,
      cell: (info) => { const v = info.getValue() as number; return <span className={`tabular-nums text-xs font-medium ${v > 0 ? "text-green-600" : "text-gray-400"}`}>{v.toLocaleString()}</span>; } },
    { id: "dispatchedQty",  accessorKey: "dispatchedQty",   header: "Dispatched",   filterType: "none",   enableSorting: true, defaultVisible: true, size: 85,
      cell: (info) => { const v = info.getValue() as number; return v > 0 ? <span className="font-medium text-xs text-blue-600 tabular-nums">{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span>; } },
    { id: "balanceQty",     accessorKey: "balanceQty",      header: "Balance",      filterType: "none",   enableSorting: true, defaultVisible: true, size: 75,
      cell: (info) => { const v = info.getValue() as number; return <span className={`tabular-nums text-xs font-medium ${v > 0 ? "text-orange-600" : "text-green-600"}`}>{v.toLocaleString()}</span>; } },
    { id: "soDeliveryDate", accessorKey: "soDeliveryDate",  header: "SO Del. Date", filterType: "none",   enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => info.getValue() ? <span className="text-xs text-gray-700">{info.getValue() as string}</span> : <span className="text-gray-300 text-xs">—</span> },
    { id: "expectedDelivery",accessorKey: "expectedDelivery",header: "PO Del. Date",filterType: "none",   enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => <span className="text-xs text-gray-700">{info.getValue() as string}</span> },
    { id: "productionStatus",accessorKey: "productionStatus",header: "Status",      filterType: "select", filterOptions: productionStatusOptions, enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => { const s = info.getValue() as string; return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s] || "bg-gray-100 text-gray-600"}`}>{s}</span>; } },
    { id: "actions",        accessorKey: "id",              header: "Actions",      filterType: "none",   enableSorting: false, enableHiding: false, defaultVisible: true, size: 52, sticky: "right",
      cell: (info) => <ThreeDotsMenu tracker={info.row.original}/> },
  ], [productionStatusOptions]);

  // ── Table header for tree views ────────────────────────────────────────────
  function POTableHeader() {
    return (
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 w-10">#</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">PO Number</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">Order Date</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">Item Code</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Ordered</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">Mill SO No.</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">PO Customer</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">SO Customer</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Ready</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Dispatched</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Balance</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">SO Del.</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">PO Del.</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">Status</th>
          <th className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500">·</th>
        </tr>
      </thead>
    );
  }

  // ── Table row for tree views ───────────────────────────────────────────────
  function POTableRow({ tracker, rowIndex }: { tracker: MillOrderTracker; rowIndex: number }) {
    return (
      <tr className="border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
        onClick={() => openDetail(tracker)}>
        <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">{rowIndex + 1}</td>
        <td className="px-3 py-2 font-mono font-semibold text-xs text-gray-900">{tracker.poNumber}</td>
        <td className="px-3 py-2 text-xs text-gray-600">{tracker.poDate}</td>
        <td className="px-3 py-2">
          <div className="text-xs leading-tight">
            <div className="font-semibold text-gray-800">{tracker.mill}</div>
            <div className="text-gray-500">{tracker.paper} · {tracker.gsm} GSM · {tracker.size}</div>
          </div>
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium text-gray-900 tabular-nums">{tracker.orderedQty.toLocaleString()}</td>
        <td className="px-3 py-2 text-xs">
          {tracker.millSONumber ? <span className="font-mono text-purple-700">{tracker.millSONumber}</span> : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs">
          {tracker.customerName ? <span className="font-medium text-blue-700">{tracker.customerName}</span> : <span className="text-gray-400">Stock PO</span>}
        </td>
        <td className="px-3 py-2 text-xs">
          {tracker.soCustomerName ? <span className="text-gray-700">{tracker.soCustomerName}</span> : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
          <span className={tracker.readyQty > 0 ? "text-green-600" : "text-gray-400"}>{tracker.readyQty.toLocaleString()}</span>
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
          {tracker.dispatchedQty > 0 ? <span className="text-blue-600">{tracker.dispatchedQty.toLocaleString()}</span> : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
          <span className={tracker.balanceQty > 0 ? "text-orange-600" : "text-green-600"}>{tracker.balanceQty.toLocaleString()}</span>
        </td>
        <td className="px-3 py-2 text-xs text-gray-600">
          {tracker.soDeliveryDate || <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs text-gray-600">{tracker.expectedDelivery}</td>
        <td className="px-3 py-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[tracker.productionStatus] || "bg-gray-100 text-gray-600"}`}>
            {tracker.productionStatus}
          </span>
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <ThreeDotsMenu tracker={tracker}/>
        </td>
      </tr>
    );
  }

  const activeFilterCount = [filterStatus, searchQuery, filterCustomer, filterMill,
    filterPoNumber, filterSoNumber, filterPaper, filterGsm, filterExpFrom, filterExpTo
  ].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex h-64 items-center justify-center text-sm text-gray-400">Loading mill orders…</div>
  );

  return (
    <div className="space-y-4 pb-24">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {([
          { label: "Total Orders",  value: kpis.total,           sub: "All mills",    icon: Factory,     color: "blue"    },
          { label: "Pending",       value: kpis.pending,         sub: "Not started",  icon: Clock,       color: "gray"    },
          { label: "In Production", value: kpis.inProduction,    sub: "Active",       icon: Factory,     color: "purple"  },
          { label: "Ready",         value: kpis.readyToDispatch, sub: "To dispatch",  icon: CheckCircle, color: "green"   },
          { label: "Dispatched",    value: kpis.dispatched,      sub: "Sent from mill",icon: Truck,      color: "cyan"    },
          { label: "Total Value",   value: `₹${(kpis.totalValue/100000).toFixed(1)}L`, sub: "PO value", icon: Package,   color: "emerald" },
        ] as const).map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
                <p className={`mt-0.5 text-xs text-${color}-600`}>{sub}</p>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-${color}-50`}>
                <Icon className={`h-4 w-4 text-${color}-500`}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar (matches DataGrid toolbar style) ─────────────────────── */}
      <div className="rounded-lg border bg-white shadow-sm">
        {/* Main row */}
        <div className="flex items-center gap-2 px-3 py-2.5">

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO, customer, mill, paper…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-150"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5"/>
              </button>
            )}
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 shrink-0">
            {([
              { id: "po",       Icon: List,    label: "PO"     },
              { id: "customer", Icon: Users,   label: "Client" },
              { id: "mill",     Icon: Factory, label: "Mill"   },
            ] as const).map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${activeTab===id?"bg-white text-blue-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                <Icon className="h-3.5 w-3.5"/><span>{label}</span>
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-gray-200 shrink-0"/>

          {/* Filter button */}
          <button onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors flex-shrink-0 ${
              showFilters || activeFilterCount > 0
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            <Filter className="h-4 w-4"/>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{activeFilterCount}</span>
            )}
          </button>

          {/* Column selector — PO view only */}
          {activeTab === "po" && (
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowColumnPanel((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  showColumnPanel
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                <Eye className="h-4 w-4"/>
                <span>Columns</span>
                {Object.values(poColumnVis).filter((v) => v === false).length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-400 text-[10px] font-bold text-white">
                    {Object.values(poColumnVis).filter((v) => v === false).length}
                  </span>
                )}
              </button>
              {showColumnPanel && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowColumnPanel(false)}/>
                  <div className="absolute right-0 top-full mt-2 z-30 w-60 rounded-lg border bg-white shadow-lg">
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between border-b pb-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Toggle Columns</span>
                        <button onClick={() => setShowColumnPanel(false)} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5"/></button>
                      </div>
                      <div className="max-h-72 overflow-y-auto space-y-0.5">
                        {columns.filter((c) => c.enableHiding !== false).map((col) => (
                          <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={poColumnVis[col.id] !== false}
                              onChange={(e) => setPoColumnVis((prev) => ({ ...prev, [col.id]: e.target.checked }))}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                            />
                            <span className="flex-1 text-gray-700">{col.header}</span>
                            {poColumnVis[col.id] === false ? <EyeOff className="h-3.5 w-3.5 text-gray-300"/> : <Eye className="h-3.5 w-3.5 text-blue-400"/>}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 border-t pt-2">
                        <button onClick={() => setPoColumnVis({})} className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">Show All</button>
                        <button onClick={() => {
                          const hidden = Object.fromEntries(columns.filter(c => c.enableHiding !== false).map(c => [c.id, false]));
                          setPoColumnVis(hidden);
                        }} className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">Hide All</button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Import/Export */}
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowImpExp((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <FileSpreadsheet className="h-4 w-4"/>
              <ChevronDown className="h-3 w-3 text-gray-400"/>
            </button>
            {showImpExp && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowImpExp(false)}/>
                <div className="absolute right-0 top-full mt-1 z-30 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <button onClick={() => { setShowBulkUploadModal(true); setShowImpExp(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                    <Upload className="h-4 w-4 text-gray-400 shrink-0"/>
                    <div className="text-left"><p className="text-xs font-medium">Upload File</p><p className="text-[11px] text-gray-400">Import mill readiness data</p></div>
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Filter panel — inside toolbar, attached via border-t */}
        {showFilters && (
          <div className="border-t px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={filterPoNumber} onChange={(e) => setFilterPoNumber(e.target.value)} placeholder="PO Number…"
                className="min-w-[130px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <input value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} placeholder="Customer…"
                className="min-w-[130px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <input value={filterMill} onChange={(e) => setFilterMill(e.target.value)} placeholder="Mill…"
                className="min-w-[120px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <input value={filterSoNumber} onChange={(e) => setFilterSoNumber(e.target.value)} placeholder="SO Number…"
                className="min-w-[120px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <input value={filterPaper} onChange={(e) => setFilterPaper(e.target.value)} placeholder="Paper type…"
                className="min-w-[120px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="min-w-[150px] rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                <option value="">All Statuses</option>
                {["Order Placed","In Production","Partial Ready","Ready","Dispatched","Delayed","Cancelled"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input type="number" value={filterGsm} onChange={(e) => setFilterGsm(e.target.value)} placeholder="GSM…"
                className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-gray-500 whitespace-nowrap">Exp. date:</span>
                <input type="date" value={filterExpFrom} onChange={(e) => setFilterExpFrom(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
                <span className="text-xs text-gray-400">–</span>
                <input type="date" value={filterExpTo} onChange={(e) => setFilterExpTo(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              {activeFilterCount > 0 && (
                <button onClick={() => {
                  setFilterStatus(""); setFilterCustomer(""); setFilterMill(""); setSearchQuery("");
                  setFilterPoNumber(""); setFilterSoNumber(""); setFilterPaper(""); setFilterGsm("");
                  setFilterExpFrom(""); setFilterExpTo("");
                }} className="flex items-center gap-1 flex-shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100">
                  <X className="h-3.5 w-3.5"/> Clear all
                </button>
              )}
            </div>
            {filteredTrackers.length !== millTrackers.length && (
              <p className="mt-2 text-xs text-blue-600">{filteredTrackers.length} of {millTrackers.length} orders</p>
            )}
          </div>
        )}
      </div>

      {/* ── CLIENT VIEW ─────────────────────────────────────────────────── */}
      {activeTab === "customer" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {customerGroups.length === 0
            ? <div className="py-10 text-center text-sm text-gray-400">No orders match your search</div>
            : customerGroups.map((cg) => {
              const isOpen = expandedCustomers.has(cg.key);
              const dispPct = cg.totalOrdered > 0 ? Math.round((cg.totalDispatched / cg.totalOrdered) * 100) : 0;
              return (
                <div key={cg.key} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => toggleCustomer(cg.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isOpen ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-blue-500 shrink-0"/> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0"/>}
                      <span className={`text-sm font-semibold ${isOpen ? "text-blue-800" : "text-gray-900"}`}>
                        {cg.key === "__stock__" ? "Stock POs" : cg.customerName}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{cg.poCount} PO{cg.poCount !== 1 ? "s" : ""}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{cg.mills.length} Mill{cg.mills.length !== 1 ? "s" : ""}</span>
                      {dispPct > 0 && <span className="text-xs font-medium text-green-600">{dispPct}% dispatched</span>}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs font-medium tabular-nums text-gray-500 mr-2">
                      <span>Ord: <span className="text-gray-900">{cg.totalOrdered.toLocaleString()}</span></span>
                      <span>Rdy: <span className="text-green-600">{cg.totalReady.toLocaleString()}</span></span>
                      <span>Dsp: <span className="text-blue-600">{cg.totalDispatched.toLocaleString()}</span></span>
                      <span>Bal: <span className="text-orange-600">{cg.totalBalance.toLocaleString()}</span></span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto border-t border-gray-100">
                      <table className="w-full text-sm min-w-[1400px]">
                        <POTableHeader/>
                        <tbody>
                          {cg.mills.map((mg, mi) => (
                            <Fragment key={mg.millName}>
                              <tr className="bg-gray-100/70">
                                <td colSpan={15} className="px-4 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <Factory className="h-3.5 w-3.5 text-gray-500 shrink-0"/>
                                    <span className="text-xs font-semibold text-gray-700">{mg.millName}</span>
                                    <span className="text-xs text-gray-500">· {mg.trackers.length} PO{mg.trackers.length !== 1 ? "s" : ""}</span>
                                  </div>
                                </td>
                              </tr>
                              {mg.trackers.map((t, i) => (
                                <POTableRow key={t.id} tracker={t} rowIndex={mi * 1000 + i}/>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── MILL VIEW ───────────────────────────────────────────────────── */}
      {activeTab === "mill" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {millViewGroups.length === 0
            ? <div className="py-10 text-center text-sm text-gray-400">No orders match your search</div>
            : millViewGroups.map((mg) => {
              const isOpen   = expandedMills.has(mg.millName);
              const readyPct = mg.totalOrdered > 0 ? Math.round((mg.totalReady      / mg.totalOrdered) * 100) : 0;
              const dispPct  = mg.totalOrdered > 0 ? Math.round((mg.totalDispatched / mg.totalOrdered) * 100) : 0;
              return (
                <div key={mg.millName} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => toggleMill(mg.millName)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isOpen ? "bg-indigo-50 hover:bg-indigo-100" : "hover:bg-gray-50"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-indigo-500 shrink-0"/> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0"/>}
                      <Factory className="h-4 w-4 text-indigo-500 shrink-0"/>
                      <span className={`text-sm font-semibold ${isOpen ? "text-indigo-800" : "text-gray-900"}`}>{mg.millName}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{mg.poCount} PO{mg.poCount !== 1 ? "s" : ""}</span>
                      {readyPct > 0 && <span className="text-xs font-medium text-green-600">{readyPct}% ready</span>}
                      {dispPct  > 0 && <span className="text-xs font-medium text-cyan-600">{dispPct}% dispatched</span>}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs font-medium tabular-nums text-gray-500 mr-2">
                      <span>Ord: <span className="text-gray-900">{mg.totalOrdered.toLocaleString()}</span></span>
                      <span>Rdy: <span className="text-green-600">{mg.totalReady.toLocaleString()}</span></span>
                      <span>Dsp: <span className="text-blue-600">{mg.totalDispatched.toLocaleString()}</span></span>
                      <span>Bal: <span className="text-orange-600">{mg.totalBalance.toLocaleString()}</span></span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto border-t border-gray-100">
                      <table className="w-full text-sm min-w-[1400px]">
                        <POTableHeader/>
                        <tbody>
                          {mg.trackers.map((t, i) => <POTableRow key={t.id} tracker={t} rowIndex={i}/>)}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── PO VIEW (DataGrid) ──────────────────────────────────────────── */}
      {activeTab === "po" && (
        <DataGrid
          data={filteredTrackers}
          columns={columns}
          tableName="mill-trackers"
          enableFilters={false}
          enablePagination={true}
          enableColumnReordering={true}
          enableColumnVisibility={true}
          hideToolbar={true}
          externalColumnVisibility={poColumnVis}
          onExternalColumnVisibilityChange={setPoColumnVis}
          onRowClick={(row) => openDetail(row)}
          initialPageSize={15}
          emptyMessage="No mill orders match your search."
        />
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {showUpdateModal && editingTracker && (
        <UpdateStatusModal
          tracker={editingTracker}
          trackerId={Number(editingTracker.id)}
          onClose={() => { setShowUpdateModal(false); setEditingTracker(undefined); refreshTrackers(); }}
          onSave={(data) => {
            // Call API (fire-and-forget; list refreshes when done)
            millTrackerApi.updateStatus(Number(editingTracker.id), {
              status:           data.productionStatus!,
              progress:         data.productionProgress,
              readyQty:         data.readyQty,
              note:             data.remarks,
              expectedDelivery: data.expectedDelivery || undefined,
            }).then(() => refreshTrackers()).catch(console.error);

            if (data.productionStatus === "Dispatched") {
              const batches     = data.partialDeliveries ?? editingTracker.partialDeliveries ?? [];
              const latestBatch = batches.slice(-1)[0];
              const dispatchQty = batches.reduce((s, b) => s + b.qty, 0) || (data.readyQty ?? editingTracker.readyQty);
              const today       = new Date().toISOString().split("T")[0];
              truckLoadPlanApi.create({
                truckNumber:         latestBatch?.truckNumber,
                origin:              editingTracker.mill,
                deliveryMode:        editingTracker.deliveryMode ?? "To Godown",
                plannedLoadDate:     latestBatch?.date || today,
                plannedDeliveryDate: editingTracker.expectedDelivery,
                millInvoiceNo:       latestBatch?.millInvoiceNo,
                items: [{
                  trackerId:        editingTracker.id ? Number(editingTracker.id) : undefined,
                  poNumber:         editingTracker.poNumber,
                  soNumber:         editingTracker.soNumber,
                  paper:            editingTracker.paper,
                  gsm:              editingTracker.gsm,
                  size:             editingTracker.size,
                  quantity:         dispatchQty,
                  loadOrder:        1,
                  customerName:     editingTracker.customerName,
                  deliveryLocation: editingTracker.customerName || "Monit Godown, Indore",
                }],
              }).catch(console.error);
              success("Dispatched! Truck load plan created.");
            } else {
              success("Mill tracker updated.");
            }
            setShowUpdateModal(false);
            setEditingTracker(undefined);
          }}
        />
      )}

      {showDetailModal && editingTracker && (
        <DetailModal
          tracker={editingTracker}
          onClose={() => { setShowDetailModal(false); setEditingTracker(undefined); }}
          onAddBatch={() => { setShowDetailModal(false); setShowUpdateModal(true); }}
        />
      )}

      {showHistoryModal && editingTracker && (
        <HistoryModal
          tracker={editingTracker}
          onClose={() => { setShowHistoryModal(false); setEditingTracker(undefined); }}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadModal
          existingPONumbers={millTrackers.map((t) => t.poNumber)}
          onClose={() => setShowBulkUploadModal(false)}
          onImportComplete={() => { refreshTrackers(); setShowBulkUploadModal(false); }}
        />
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({
  tracker: initialTracker,
  onClose,
  onAddBatch,
}: {
  tracker: MillOrderTracker;
  onClose: () => void;
  onAddBatch: () => void;
}) {
  const [tracker, setTracker] = useState(initialTracker);
  const [batchesLoading, setBatchesLoading] = useState(true);

  useEffect(() => {
    millTrackerApi.getById(Number(initialTracker.id))
      .then((row) => setTracker(mapTrackerRow(row)))
      .catch(() => {/* keep initial */ })
      .finally(() => setBatchesLoading(false));
  }, [initialTracker.id]);

  const batches = tracker.partialDeliveries || [];
  const readyPct      = tracker.orderedQty > 0 ? Math.round((tracker.readyQty      / tracker.orderedQty) * 100) : 0;
  const dispatchedPct = tracker.orderedQty > 0 ? Math.round((tracker.dispatchedQty / tracker.orderedQty) * 100) : 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={tracker.poNumber}
      subtitle={[tracker.customerName, tracker.mill].filter(Boolean).join(" · ")}
      size="lg"
      footer={
        <button onClick={onClose} className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">Close</button>
      }
    >
      <div className="space-y-4">
        {/* Status + identity chips */}
        <div className="flex flex-wrap items-center gap-2">
          {tracker.customerName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <Users className="h-3 w-3" /> {tracker.customerName}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <Factory className="h-3 w-3" /> {tracker.mill}
          </span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[tracker.productionStatus]}`}>{tracker.productionStatus}</span>
        </div>

        {/* Material & Quantities */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
          <p className={labelCls}>Material & Quantities</p>
          <div className="text-sm font-semibold text-gray-800">{tracker.paper} · {tracker.gsm} GSM · {tracker.size}</div>

          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden flex">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${dispatchedPct}%` }} title={`Dispatched: ${dispatchedPct}%`} />
            <div className="h-full bg-green-400 transition-all" style={{ width: `${Math.max(0, readyPct - dispatchedPct)}%` }} title={`Ready: ${readyPct - dispatchedPct}%`} />
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" />Dispatched {dispatchedPct}%</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-400" />Ready {readyPct}%</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-gray-200" />Pending {100 - readyPct}%</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Ordered",    value: tracker.orderedQty,    color: "text-gray-900" },
              { label: "Ready",      value: tracker.readyQty,      color: "text-green-600" },
              { label: "Dispatched", value: tracker.dispatchedQty, color: "text-blue-600" },
              { label: "Balance",    value: tracker.balanceQty,    color: "text-orange-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                <p className={`text-base font-bold ${color}`}>{value.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">sheets</p>
              </div>
            ))}
          </div>
        </div>

        {/* Order Info */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className={labelCls + " mb-3"}>Order Info</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Expected Delivery</p>
              <p className="mt-0.5 font-medium text-gray-800">{tracker.expectedDelivery || "—"}</p>
            </div>
            {tracker.actualDispatchDate && (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Actual Dispatch</p>
                <p className="mt-0.5 font-medium text-gray-800">{tracker.actualDispatchDate}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Last Updated</p>
              <p className="mt-0.5 font-medium text-gray-800">{fmtDateTime(tracker.lastUpdate)}{tracker.lastUpdatedBy ? ` by ${tracker.lastUpdatedBy}` : ""}</p>
            </div>
            {tracker.deliveryMode && (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Delivery Mode</p>
                <p className="mt-0.5 font-medium text-gray-800">{tracker.deliveryMode}</p>
              </div>
            )}
            {tracker.millInvoiceNo && (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Mill Invoice</p>
                <p className="mt-0.5 font-medium text-gray-800">{tracker.millInvoiceNo}</p>
              </div>
            )}
            {tracker.remarks && (
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Remarks</p>
                <p className="mt-0.5 text-gray-800">{tracker.remarks}</p>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Batches */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className={labelCls}>Delivery Batches</p>
            {tracker.readyQty > tracker.dispatchedQty && (
              <button onClick={onAddBatch} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Batch
              </button>
            )}
          </div>

          {batchesLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />
              Loading batches…
            </div>
          ) : batches.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
              No delivery batches recorded yet
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Batch", "Date", "Qty (sheets)", "Truck No", "Mill Invoice", "Remarks"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.map((b) => (
                    <tr key={b.id} className="bg-white hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-amber-700">#{b.batchNo}</td>
                      <td className="px-3 py-2 text-gray-700">{b.date}</td>
                      <td className="px-3 py-2 font-semibold text-blue-700">{b.qty.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{b.truckNumber || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{b.millInvoiceNo || "—"}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{b.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-100">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500">Total Dispatched</td>
                    <td className="px-3 py-2 font-bold text-blue-700">{batches.reduce((s, b) => s + b.qty, 0).toLocaleString()}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Update Status Modal (with Partial Delivery section) ──────────────────────
function UpdateStatusModal({
  tracker,
  trackerId,
  onClose,
  onSave,
}: {
  tracker: MillOrderTracker;
  trackerId: number;
  onClose: () => void;
  onSave: (data: Partial<MillOrderTracker>) => void;
}) {
  const [formData, setFormData] = useState({
    productionStatus:   tracker.productionStatus,
    readyQty:           tracker.readyQty,
    dispatchedQty:      tracker.dispatchedQty,
    balanceQty:         tracker.balanceQty,
    expectedDelivery:   tracker.expectedDelivery,
    actualDispatchDate: tracker.actualDispatchDate || "",
    partialDeliveries:  tracker.partialDeliveries ?? [],
    remarks:            "",
    lastUpdatedBy:      "Mill Team",
  });

  const existingBatches   = formData.partialDeliveries;
  const alreadyDispatched = existingBatches.reduce((s, b) => s + b.qty, 0);
  const maxBatchQty       = formData.readyQty - alreadyDispatched;

  const [showBatchForm, setShowBatchForm] = useState(false);
  const [newBatch, setNewBatch] = useState({
    date: new Date().toISOString().split("T")[0],
    qty: 0,
    truckNumber: "",
    millInvoiceNo: "",
    remarks: "",
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Update Production Status"
      subtitle={`${tracker.poNumber} · ${tracker.mill} · ${tracker.gsm} GSM ${tracker.size}`}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" form="update-status-form" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Save Update</button>
        </>
      }
    >
      <form id="update-status-form" onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
        {/* Status fields */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className={labelCls + " mb-3"}>Production Update</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Production Status <span className="text-red-400">*</span></label>
              <select
                value={formData.productionStatus}
                onChange={(e) => setFormData({ ...formData, productionStatus: e.target.value as MillOrderTracker["productionStatus"] })}
                className={inputCls}
                required
              >
                {["Order Placed","In Production","Partial Ready","Ready","Dispatched","Delayed"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Ready Quantity <span className="text-red-400">*</span></label>
              <input
                type="number"
                value={formData.readyQty || ""}
                onChange={(e) => setFormData({ ...formData, readyQty: parseInt(e.target.value) || 0 })}
                className={inputCls}
                min="0" max={tracker.orderedQty} required
              />
              <p className="mt-1 text-[10px] text-gray-400">Max: {tracker.orderedQty.toLocaleString()} sheets</p>
            </div>

            <div>
              <label className={labelCls}>Expected Dispatch Date</label>
              <input type="date" value={formData.expectedDelivery} onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Last Updated By</label>
              <input type="text" value={formData.lastUpdatedBy} onChange={(e) => setFormData({ ...formData, lastUpdatedBy: e.target.value })} className={inputCls} placeholder="Name of person updating" />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Remarks</label>
              <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className={inputCls + " resize-none"} rows={2} placeholder="Production updates, quality notes, delay reasons..." />
            </div>
          </div>
        </div>

        {/* Partial Delivery Batches */}
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Partial Delivery Batches</p>
            </div>
            {maxBatchQty > 0 && (
              <button type="button" onClick={() => setShowBatchForm(!showBatchForm)} className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 transition-colors">
                <Plus className="h-3.5 w-3.5" /> {showBatchForm ? "Cancel" : "Add Batch"}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {existingBatches.length === 0 && !showBatchForm && (
              <p className="text-xs text-orange-600/70 py-1">{maxBatchQty > 0 ? "Click 'Add Batch' to record a partial delivery." : "No ready qty available for dispatch."}</p>
            )}
            {existingBatches.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg bg-white border border-orange-100 px-3 py-2 text-xs">
                <span className="font-semibold text-orange-700">Batch {b.batchNo}</span>
                <span className="text-blue-700 font-medium">{b.qty.toLocaleString()} sht</span>
                <span className="text-gray-500">{b.date}</span>
                {b.truckNumber && <span className="font-mono text-gray-600">{b.truckNumber}</span>}
                {b.millInvoiceNo && <span className="text-gray-500">{b.millInvoiceNo}</span>}
              </div>
            ))}

            {showBatchForm && (
              <div className="rounded-lg border border-orange-200 bg-white p-3 space-y-3">
                <p className="text-xs font-semibold text-orange-700">New Delivery Batch (max {maxBatchQty.toLocaleString()} sht)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Dispatch Date <span className="text-red-400">*</span></label>
                    <input type="date" value={newBatch.date} onChange={(e) => setNewBatch({ ...newBatch, date: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Quantity (sheets) <span className="text-red-400">*</span></label>
                    <input type="number" value={newBatch.qty || ""} onChange={(e) => setNewBatch({ ...newBatch, qty: Math.min(parseInt(e.target.value) || 0, maxBatchQty) })} className={inputCls} min="1" max={maxBatchQty} placeholder={`Max ${maxBatchQty}`} />
                  </div>
                  <div>
                    <label className={labelCls}>Truck Number</label>
                    <input type="text" value={newBatch.truckNumber} onChange={(e) => setNewBatch({ ...newBatch, truckNumber: e.target.value.toUpperCase() })} className={inputCls + " font-mono"} placeholder="MH04AB1234" />
                  </div>
                  <div>
                    <label className={labelCls}>Mill Invoice No</label>
                    <input type="text" value={newBatch.millInvoiceNo} onChange={(e) => setNewBatch({ ...newBatch, millInvoiceNo: e.target.value })} className={inputCls} placeholder="MI-2024-003" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Remarks</label>
                    <input type="text" value={newBatch.remarks} onChange={(e) => setNewBatch({ ...newBatch, remarks: e.target.value })} className={inputCls} placeholder="Notes about this delivery..." />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowBatchForm(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button
                    type="button"
                    disabled={newBatch.qty <= 0}
                    onClick={async () => {
                      try {
                        const created: MillTrackerBatchRow = await millTrackerApi.addBatch(trackerId, {
                          deliveryDate:  newBatch.date,
                          quantity:      newBatch.qty,
                          truckNumber:   newBatch.truckNumber   || undefined,
                          millInvoiceNo: newBatch.millInvoiceNo || undefined,
                          remarks:       newBatch.remarks       || undefined,
                        });
                        const batch: PartialDelivery = {
                          id:            String(created.id),
                          batchNo:       created.batchNo,
                          date:          created.deliveryDate ?? newBatch.date,
                          qty:           created.quantity,
                          truckNumber:   created.truckNumber,
                          millInvoiceNo: created.millInvoiceNo,
                          remarks:       created.remarks,
                        };
                        const updatedBatches  = [...formData.partialDeliveries, batch];
                        const totalDispatched = updatedBatches.reduce((s, b) => s + b.qty, 0);
                        setFormData((prev) => ({
                          ...prev,
                          partialDeliveries: updatedBatches,
                          dispatchedQty:     totalDispatched,
                          balanceQty:        Math.max(0, tracker.orderedQty - totalDispatched),
                          productionStatus:  totalDispatched >= prev.readyQty ? "Dispatched" : prev.productionStatus,
                        }));
                        setNewBatch({ date: new Date().toISOString().split("T")[0], qty: 0, truckNumber: "", millInvoiceNo: "", remarks: "" });
                        setShowBatchForm(false);
                      } catch (err) {
                        console.error("Failed to save batch:", err);
                      }
                    }}
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    Save Batch
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({ tracker: initialTracker, onClose }: { tracker: MillOrderTracker; onClose: () => void }) {
  const [history, setHistory] = useState(initialTracker.history || []);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    millTrackerApi.getById(Number(initialTracker.id))
      .then((row) => setHistory(row.history.map((h) => ({
        id:        String(h.id),
        date:      h.updatedAt,
        user:      h.updatedBy,
        action:    h.action ?? "Update",
        oldStatus: h.oldStatus,
        newStatus: h.newStatus,
        oldQty:    h.oldQty,
        newQty:    h.newQty,
        remarks:   h.remarks,
      }))))
      .catch(() => {/* keep initial */ })
      .finally(() => setRefreshing(false));
  }, [initialTracker.id]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Production History"
      subtitle={`${initialTracker.poNumber} · ${initialTracker.mill}`}
      size="md"
      footer={
        <button onClick={onClose} className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">Close</button>
      }
    >
      {history.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <History className="mx-auto h-10 w-10 text-gray-300 mb-2" />
          <p className="text-sm">{refreshing ? "Loading history…" : "No history yet — history is created when you save a status update"}</p>
        </div>
      ) : (
        <div className="relative space-y-3 pl-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
          {history.map((log) => (
            <div key={log.id} className="relative pl-5">
              <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-white" />
              <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{log.action}</p>
                    {log.oldStatus && log.newStatus && (
                      <p className="mt-1 text-xs text-gray-500">Status: <span className="font-medium text-gray-700">{log.oldStatus}</span> → <span className="font-medium text-blue-600">{log.newStatus}</span></p>
                    )}
                    {log.oldQty !== undefined && log.newQty !== undefined && (
                      <p className="mt-1 text-xs text-gray-500">Qty: <span className="font-medium text-gray-700">{log.oldQty.toLocaleString()}</span> → <span className="font-medium text-green-600">{log.newQty.toLocaleString()}</span></p>
                    )}
                    {log.remarks && <p className="mt-1 text-xs text-gray-400 italic">{log.remarks}</p>}
                  </div>
                  <div className="text-right text-xs text-gray-500 shrink-0">
                    <p>{fmtDateTime(log.date)}</p>
                    <p className="mt-0.5 font-semibold text-gray-700">{log.user}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Excel / CSV parser (client-side via xlsx) ────────────────────────────────
async function parseFileRows(file: File): Promise<BulkImportRowInput[]> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array", cellDates: true });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  // sheet_to_json with header:1 gives raw arrays per row
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  if (rows.length < 2) return [];

  // Find header row — first row whose first non-empty cell contains "po" (case-insensitive)
  // Columns: A=PO Number, B=Ready Qty, C=Status, D=Expected Date, E=Remarks
  const mapped: (BulkImportRowInput | null)[] = (rows.slice(1) as unknown[][]).map(r => {
    const cell = (i: number) => String(r[i] ?? "").trim();
    const poNumber = cell(0);
    if (!poNumber) return null;

    // Dates may come as JS Date objects from xlsx (cellDates:true)
    let expectedDelivery = cell(3);
    if (r[3] instanceof Date) {
      expectedDelivery = (r[3] as Date).toISOString().split("T")[0];
    }

    return {
      poNumber,
      readyQty:         parseFloat(cell(1)) || undefined,
      status:           cell(2) || undefined,
      expectedDelivery: expectedDelivery || undefined,
      remarks:          cell(4) || undefined,
    };
  });
  return mapped.filter((r): r is BulkImportRowInput => r !== null);
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const colWidths = [{ wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 30 }];

  // Sheet 1: blank upload sheet (headers only)
  const uploadSheet = XLSX.utils.aoa_to_sheet([
    ["PO Number", "Ready Qty", "Status", "Expected Date", "Remarks"],
  ]);
  uploadSheet["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, uploadSheet, "Upload Data");

  // Sheet 2: examples for reference (do not upload this sheet)
  const examplesSheet = XLSX.utils.aoa_to_sheet([
    ["NOTE: This sheet is for reference only. Fill data in the 'Upload Data' sheet."],
    [],
    ["PO Number", "Ready Qty", "Status", "Expected Date", "Remarks"],
    ["PO-2024-001", 9000, "In Production", "2024-02-15", "Mill team confirmed production started"],
    ["PO-2024-002", 20000, "Ready", "2024-02-20", "Full batch ready for dispatch"],
    ["PO-2024-003", 0, "Delayed", "", "Machine breakdown, delay of 1 week"],
    [],
    ["Valid Status values:"],
    ["Order Placed"],
    ["In Production"],
    ["Partial Ready"],
    ["Ready"],
    ["Dispatched"],
    ["Delayed"],
  ]);
  examplesSheet["!cols"] = [{ wch: 55 }, ...colWidths.slice(1)];
  XLSX.utils.book_append_sheet(wb, examplesSheet, "Examples (Reference)");

  XLSX.writeFile(wb, "mill_tracker_template.xlsx");
}

// ─── Bulk Upload Modal ─────────────────────────────────────────────────────────
function BulkUploadModal({
  existingPONumbers,
  onClose,
  onImportComplete,
}: {
  existingPONumbers: string[];
  onClose: () => void;
  onImportComplete: () => void;
}) {
  const [stage, setStage]           = useState<"upload" | "detecting" | "preview" | "result">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkImportRowInput[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResultDto | null>(null);
  const [isImporting, setIsImporting]   = useState(false);
  const [dragActive, setDragActive]     = useState(false);

  const existingPOs = useMemo(() => new Set(existingPONumbers), [existingPONumbers]);

  const getMatch = (po: string) => {
    if (existingPOs.has(po)) return "matched";
    if ([...existingPOs].some(p => p.startsWith(po.slice(0, 8)))) return "fuzzy";
    return "unmatched";
  };

  const matchedCount   = parsedRows.filter(r => getMatch(r.poNumber) === "matched").length;
  const unmatchedCount = parsedRows.filter(r => getMatch(r.poNumber) === "unmatched").length;

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setStage("detecting");
    try {
      const rows = await parseFileRows(file);
      setParsedRows(rows);
      setStage(rows.length > 0 ? "preview" : "upload");
    } catch {
      setStage("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleConfirm = async () => {
    const toImport = parsedRows.filter(r => getMatch(r.poNumber) !== "unmatched");
    if (!toImport.length) return;
    setIsImporting(true);
    try {
      const result = await millTrackerApi.bulkImport(toImport);
      setImportResult(result);
      setStage("result");
    } catch (err) { console.error("Import failed:", err); }
    finally { setIsImporting(false); }
  };

  const footer = (
    <>
      {stage === "preview" && (
        <>
          <button type="button" onClick={() => { setStage("upload"); setSelectedFile(null); setParsedRows([]); }}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors mr-auto">
            ← Back
          </button>
          <button type="button" onClick={handleConfirm} disabled={matchedCount === 0 || isImporting}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {isImporting ? "Importing…" : `Import ${matchedCount} rows`}
          </button>
        </>
      )}
      {stage === "result" && (
        <button type="button" onClick={onImportComplete}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
          Done — Refresh View
        </button>
      )}
      {(stage === "upload" || stage === "detecting") && (
        <button type="button" onClick={onClose}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      )}
    </>
  );

  return (
    <Modal isOpen onClose={onClose} title="Upload Mill Readiness"
      subtitle={stage === "upload" ? "Import readiness updates from CSV" : stage === "detecting" ? "Parsing file…" : stage === "preview" ? selectedFile?.name : "Import complete"}
      size="lg" footer={footer}>

      {/* Upload stage */}
      {stage === "upload" && (
        <div className="space-y-4">
          <div onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragActive ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"}`}>
            <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-700">Drag & drop Excel / CSV file here</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">or</p>
            <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Browse File
              <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
            </label>
            <p className="mt-3 text-xs text-gray-400">Supported: .xlsx · .xls · .csv</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className={labelCls}>CSV Column Format</p>
              <button onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="h-3.5 w-3.5" /> Download Template
              </button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {["A: PO Number", "B: Ready Qty", "C: Status", "D: Expected Date", "E: Remarks"].map(col => (
                <div key={col} className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-center text-[10px] font-semibold text-gray-600">{col}</div>
              ))}
            </div>
            <p className="mt-2.5 text-[10px] text-gray-400">Status values: Order Placed · In Production · Partial Ready · Ready · Dispatched · Delayed</p>
          </div>
        </div>
      )}

      {/* Detecting stage */}
      {stage === "detecting" && (
        <div className="py-16 text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4" />
          <p className="text-sm font-medium text-gray-700">Parsing {selectedFile?.name}…</p>
        </div>
      )}

      {/* Preview stage */}
      {stage === "preview" && (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${matchedCount > 0 ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
            <CheckCircle2 className={`h-5 w-5 shrink-0 ${matchedCount > 0 ? "text-green-600" : "text-amber-500"}`} />
            <span className="flex-1 text-sm font-medium text-gray-800">{parsedRows.length} rows parsed</span>
            <div className="flex gap-4 text-xs shrink-0">
              <span className="flex items-center gap-1 font-semibold text-green-700"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />{matchedCount} matched</span>
              {unmatchedCount > 0 && <span className="flex items-center gap-1 font-semibold text-red-500"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />{unmatchedCount} unmatched (skip)</span>}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <tr>
                    {["", "PO Number", "Ready Qty", "Status", "Expected Date", "Remarks", "Match"].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRows.map((row, i) => {
                    const match = getMatch(row.poNumber);
                    return (
                      <tr key={i} className={match === "matched" ? "bg-green-50/50" : match === "fuzzy" ? "bg-amber-50/50" : "bg-red-50/50"}>
                        <td className="px-3 py-2"><div className={`h-2 w-2 rounded-full ${match === "matched" ? "bg-green-500" : match === "fuzzy" ? "bg-amber-500" : "bg-red-400"}`} /></td>
                        <td className="px-3 py-2 font-mono font-semibold text-xs text-gray-900">{row.poNumber}</td>
                        <td className="px-3 py-2 text-xs text-right tabular-nums text-gray-700">{row.readyQty?.toLocaleString() ?? "—"}</td>
                        <td className="px-3 py-2">
                          {row.status ? <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[row.status] ?? "bg-gray-100 text-gray-600"}`}>{row.status}</span> : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.expectedDelivery || "—"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">{row.remarks || "—"}</td>
                        <td className="px-3 py-2 text-xs font-semibold">
                          {match === "matched"   && <span className="text-green-700">✓ Matched</span>}
                          {match === "fuzzy"     && <span className="text-amber-600">~ Fuzzy</span>}
                          {match === "unmatched" && <span className="text-red-500">✗ Skipped</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Result stage */}
      {stage === "result" && importResult && (
        <div className="py-6 space-y-4">
          <div className="flex items-center justify-center gap-6">
            <div className="rounded-xl border border-green-100 bg-green-50 px-8 py-5 text-center">
              <p className="text-3xl font-bold text-green-700">{importResult.updated}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600 mt-1">Updated</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-8 py-5 text-center">
              <p className="text-3xl font-bold text-gray-400">{importResult.skipped}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-1">Skipped</p>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className={labelCls + " text-red-600 mb-2"}>Errors</p>
              <ul className="space-y-1">
                {importResult.errors.map((e, i) => <li key={i} className="text-xs text-red-700">• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
