"use client";

import { PermGuard } from "@/components/PermGuard";
import { Fragment, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { MillOrderTracker, PartialDelivery, TruckLoadPlan } from "@/data/mockData";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { millTrackerApi, MillTrackerRow, MillTrackerBatchRow, BulkImportRowInput, BulkImportResultDto } from "@/lib/api-services";
import * as XLSX from "xlsx";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
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
  Search,
  Filter,
  EyeOff,
  MoreVertical,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { KpiCard } from "@/components/ui/KpiCard";

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

// ─── Note: MillTracker.OrderedQty/ReadyQty/DispatchedQty are stored in KG ────
// (backend at MillTrackerRepository.cs:189 copies PO.WeightKg into OrderedQty).
// So display values directly — do NOT apply any sheet↔kg conversion here.

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
    // Unit-wise display on every grid — the API JOINs through po.MillUnitId
    // already, so just propagate the resolved unit name.
    millUnitId:         r.millUnitId,
    millUnitName:       r.millUnitName,
    // Close-tracker (short-delivery final) — flag + audit fields.
    isClosed:           r.isClosed ?? false,
    closedAt:           r.closedAt,
    closedBy:           r.closedBy,
    closeReason:        r.closeReason,
    paper:              r.paper ?? "",
    // Brand name surfaced separately so the grid + template can show it
    // in its own column. Joined on material.QualityId backend-side.
    brandName:          r.brandName,
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
    itemRemark:         r.itemRemark,
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
function MillTrackerPage() {
  const { addTruckLoadPlan } = usePurchaseOrder();
  const { success, error: showError, warning: showWarning } = useToast();

  // ── API data ────────────────────────────────────────────────────────────────
  const [millTrackers, setMillTrackers] = useState<MillOrderTracker[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  // Excel bulk-edit flow — disables the buttons while download or upload is
  // in flight, and surfaces the per-row error summary to the user via toast.
  const [excelBusy,    setExcelBusy]    = useState(false);
  // Close filter — "active" is the default, closed trackers hide from
  // the main grid. User can toggle to "closed" or "all" to inspect the
  // finalised history.
  const [closedView, setClosedView] = useState<"active" | "closed" | "all">("active");
  // Tracker being closed via the confirm modal — null means modal hidden.
  const [closingTracker, setClosingTracker] = useState<MillOrderTracker | null>(null);
  const [closingReason,  setClosingReason]  = useState("");
  const [closingBusy,    setClosingBusy]    = useState(false);

  const refreshTrackers = useCallback(async () => {
    const res = await millTrackerApi.list({ pageSize: 500, closed: closedView });
    setMillTrackers(res.items.map(mapTrackerRow));
  }, [closedView]);

  useEffect(() => {
    refreshTrackers().finally(() => setIsLoading(false));
  }, [refreshTrackers]);

  // ── Excel bulk-edit handlers ────────────────────────────────────────────────
  const handleDownloadExcel = useCallback(async () => {
    if (excelBusy) return;
    setExcelBusy(true);
    try {
      const { blob, filename } = await millTrackerApi.exportExcel({ closed: closedView });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `mill_tracker_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success("Excel downloaded — edit Ready Qty / Status / Date, then upload back.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed.";
      showError(msg);
    } finally {
      setExcelBusy(false);
    }
  }, [excelBusy, success, showError, closedView]);

  const handleUploadExcel = useCallback(async (file: File) => {
    if (excelBusy) return;
    setExcelBusy(true);
    try {
      const result = await millTrackerApi.importExcel(file);
      await refreshTrackers();
      if (result.errors.length > 0) {
        // Hard failures (unmatched Id, bad data) — short summary toast; user can re-export to verify.
        const head = `${result.updated} updated · ${result.unchanged} unchanged · ${result.skipped} skipped`;
        const sample = result.errors.slice(0, 2).join(" · ");
        showError(`${head}. ${sample}${result.errors.length > 2 ? ` (+${result.errors.length - 2} more)` : ""}`);
      } else if (result.warnings.length > 0) {
        // Row(s) tried to set "Dispatched" from the sheet — dropped, but
        // every other edited field on those rows was still applied.
        const sample = result.warnings.slice(0, 2).join(" · ");
        showWarning(`${result.updated} updated, ${result.unchanged} unchanged. ${sample}${result.warnings.length > 2 ? ` (+${result.warnings.length - 2} more)` : ""}`);
      } else {
        success(`Bulk update done — ${result.updated} updated, ${result.unchanged} unchanged.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      showError(msg);
    } finally {
      setExcelBusy(false);
    }
  }, [excelBusy, refreshTrackers, success, showError, showWarning]);

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

  // ── Item line numbers: trackerId → 1-based index within same PO ──────────
  const poItemLineMap = useMemo<Map<string, number>>(() => {
    const groups = new Map<string, string[]>();
    for (const t of millTrackers) {
      if (!groups.has(t.poNumber)) groups.set(t.poNumber, []);
      groups.get(t.poNumber)!.push(t.id);
    }
    const result = new Map<string, number>();
    for (const [, ids] of groups) {
      if (ids.length > 1) ids.forEach((id, i) => result.set(id, i + 1));
    }
    return result;
  }, [millTrackers]);

  // ── Filtered trackers (drives all 3 views) ────────────────────────────────
  const filteredTrackers = useMemo(() => millTrackers.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      // Global search now also matches the unit name so the user can find
      // rows by typing either the mill or the picked unit.
      if (!t.poNumber.toLowerCase().includes(q) &&
          !(t.customerName?.toLowerCase().includes(q)) &&
          !t.mill.toLowerCase().includes(q) &&
          !(t.millUnitName?.toLowerCase().includes(q)) &&
          !t.paper.toLowerCase().includes(q)) return false;
    }
    if (filterStatus   && t.productionStatus !== filterStatus) return false;
    if (filterCustomer && !(t.customerName?.toLowerCase().includes(filterCustomer.toLowerCase()))) return false;
    // Mill filter: match either the unit name or the mill name so the user
    // can type "Bhadrachalam" or "ITC" and find the rows.
    if (filterMill     &&
        !t.mill.toLowerCase().includes(filterMill.toLowerCase()) &&
        !(t.millUnitName?.toLowerCase().includes(filterMill.toLowerCase()))) return false;
    if (filterPoNumber && !t.poNumber.toLowerCase().includes(filterPoNumber.toLowerCase())) return false;
    if (filterSoNumber && !(t.soNumber?.toLowerCase().includes(filterSoNumber.toLowerCase()))) return false;
    if (filterPaper    && !t.paper.toLowerCase().includes(filterPaper.toLowerCase())) return false;
    if (filterGsm      && t.gsm !== parseInt(filterGsm)) return false;
    if (filterExpFrom  && t.expectedDelivery && t.expectedDelivery < filterExpFrom) return false;
    if (filterExpTo    && t.expectedDelivery && t.expectedDelivery > filterExpTo) return false;
    return true;
  }), [millTrackers, searchQuery, filterStatus, filterCustomer, filterMill,
       filterPoNumber, filterSoNumber, filterPaper, filterGsm, filterExpFrom, filterExpTo]);

  // ── Customer groups — nested grouping uses UNIT name first (mill as
  // fallback) so the customer→mill sub-list reflects the unit-wise model.
  const customerGroups = useMemo<CustomerGroup[]>(() => {
    const map: Record<string, { customerName: string; customerId?: string; mills: Record<string, MillOrderTracker[]> }> = {};
    filteredTrackers.forEach((t) => {
      const key  = t.customerName || "__stock__";
      const name = t.customerName || "Stock POs (No Customer)";
      if (!map[key]) map[key] = { customerName: name, customerId: t.customerId, mills: {} };
      const millKey = t.millUnitName?.trim() || t.mill;
      if (!map[key].mills[millKey]) map[key].mills[millKey] = [];
      map[key].mills[millKey].push(t);
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

  // ── Mill view groups — group by UNIT name when present (mill name as
  // fallback), so each unit becomes its own group. Matches the unit-wise
  // organisation the rest of the page now follows.
  const millViewGroups = useMemo(() => {
    const map: Record<string, MillOrderTracker[]> = {};
    filteredTrackers.forEach((t) => {
      const key = t.millUnitName?.trim() || t.mill;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
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

  // ── 3-dot action menu — fixed positioning so it escapes DataGrid overflow.
  //    Flips upward when the button is near the viewport bottom so the last
  //    row's options don't fall below the fold (client UAT). Estimated menu
  //    height (MENU_H) covers 4 items + close item + dividers — a hair over
  //    fits both the closed-tracker and unclosed cases without measuring.
  function ThreeDotsMenu({ tracker }: { tracker: MillOrderTracker }) {
    const MENU_H = 210;
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });

    const toggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!open && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        const openUp = spaceBelow < MENU_H && r.top > MENU_H;   // flip if room above
        setPos(openUp
          ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right }
          : { top:    r.bottom + 4,                  right: window.innerWidth - r.right }
        );
      }
      setOpen((v) => !v);
    };

    return (
      <div className="flex items-center justify-center w-10" onClick={(e) => e.stopPropagation()}>
        <button ref={btnRef} onClick={toggle}
          className={`rounded p-1.5 transition-colors ${open ? "bg-gray-200 text-gray-800" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}>
          <MoreVertical className="h-4 w-4"/>
        </button>
        {open && createPortal(
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)}/>
            <div className="fixed z-30 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
              style={pos.bottom != null
                ? { bottom: pos.bottom, right: pos.right }
                : { top: (pos.top ?? 0) + 4, right: pos.right }}>
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
              {/* Close tracker — only for active (unclosed) rows. Short-
                  delivery finalisation; balance qty accepted as-is. */}
              {!tracker.isClosed && (
                <>
                  <div className="border-t border-gray-100"/>
                  <button onClick={() => { setClosingTracker(tracker); setOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0"/><span>Close tracker</span>
                  </button>
                </>
              )}
            </div>
          </>,
          document.body
        )}
      </div>
    );
  }

  const columns: ColumnConfig<MillOrderTracker>[] = useMemo(() => [
    { id: "actions",        accessorKey: "id",              header: "Actions",      filterType: "none",   enableSorting: false, enableHiding: false, defaultVisible: true, size: 80, sticky: "left",
      cell: (info) => <ThreeDotsMenu tracker={info.row.original}/> },
    { id: "rowNo",          accessorKey: "id",              header: "#",            filterType: "none",   enableSorting: false, enableHiding: false, defaultVisible: true, size: 45,
      cell: (info) => <span className="text-xs text-gray-400 tabular-nums">{info.row.index + 1}</span> },
    { id: "poNumber",       accessorKey: "poNumber",        header: "PO Number",    filterType: "text",   enableSorting: true, enableHiding: false, defaultVisible: true, size: 150,
      cell: (info) => {
        const po = info.getValue() as string;
        const lineNo = poItemLineMap.get(info.row.original.id);
        return (
          <div className="leading-tight">
            <span className="font-semibold text-sm text-purple-700">{po}</span>
            {lineNo && <span className="font-mono text-xs text-purple-400"> #{lineNo}</span>}
          </div>
        );
      } },
    { id: "poDate",         accessorKey: "poDate",          header: "Order Date",   filterType: "none",   enableSorting: true, defaultVisible: true, size: 115,
      cell: (info) => <span className="text-xs text-gray-600">{info.getValue() as string}</span> },
    // Single Mill column per client UAT — unit name takes primary slot
    // (since items are unit-wise), mill name shows as secondary. Filter
    // matches either unit OR mill substring so the user can type either.
    { id: "millName", accessorKey: "mill", header: "Mill",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 200,
      accessorFn: (t: MillOrderTracker) => {
        const u = t.millUnitName?.trim();
        return u ? `${u} (${t.mill})` : (t.mill ?? "");
      },
      cell: (info) => { const t = info.row.original; const unit = t.millUnitName?.trim();
        return unit
          ? (
            <div className="text-xs leading-tight">
              <div className="font-semibold text-blue-700">{unit}</div>
              <div className="text-[10px] text-gray-400">{t.mill}</div>
            </div>
          )
          : <span className="text-xs font-medium text-gray-800">{t.mill || "—"}</span>;
      } },
    // Item code split into Brand / GSM / Size — clerks filter by brand
    // directly instead of having to parse the composite item code. The
    // raw item code (e.g. "BILT/MAPLITHO/10/23x36") was useful for client
    // communication but added friction in MOT.
    { id: "brand", accessorKey: "brandName", header: "Brand",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 140,
      cell: (info) => {
        const t = info.row.original;
        const brand = (t.brandName ?? "").trim() || t.paper?.split("/")?.[1] || "—";
        return <span className="text-xs font-medium text-gray-800">{brand}</span>;
      } },
    { id: "gsm", accessorKey: "gsm", header: "GSM",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 90,
      cell: (info) => {
        const v = info.getValue() as number;
        return <span className="text-xs text-gray-700 tabular-nums">{v > 0 ? v : "—"}</span>;
      } },
    { id: "size", accessorKey: "size", header: "Size",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => {
        const v = info.getValue() as string;
        return <span className="text-xs text-gray-700">{v?.trim() || "—"}</span>;
      } },
    { id: "orderedQty",     accessorKey: "orderedQty",      header: "Ordered (kg)", filterType: "none",   enableSorting: true, defaultVisible: true, size: 95,
      cell: (info) => { const v = info.getValue() as number; return <span className="font-medium tabular-nums text-xs">{v > 0 ? v.toLocaleString() : "—"}</span>; } },
    // Renamed Mill SO No. → Order ID per client UAT (the field already
    // stored the mill's Order ID number; the old label was confusing).
    // DB column name stays as MillSONumber for backwards compat.
    { id: "millSONumber",   accessorKey: "millSONumber",    header: "Order ID",     filterType: "text",   enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => info.getValue() ? <span className="font-mono text-xs text-purple-700">{info.getValue() as string}</span> : <span className="text-gray-300 text-xs">—</span> },
    { id: "customerName",   accessorKey: "customerName",    header: "PO Customer",  filterType: "text",   enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => info.getValue() ? <span className="font-medium text-xs text-blue-700">{info.getValue() as string}</span> : <span className="text-xs text-gray-400">Stock PO</span> },
    { id: "soCustomerName", accessorKey: "soCustomerName",  header: "SO Customer",  filterType: "text",   enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => info.getValue() ? <span className="text-xs text-gray-700">{info.getValue() as string}</span> : <span className="text-gray-300 text-xs">—</span> },
    { id: "readyQty",       accessorKey: "readyQty",        header: "Ready (kg)",   filterType: "none",   enableSorting: true, defaultVisible: true, size: 90,
      cell: (info) => { const v = info.getValue() as number; return <span className={`tabular-nums text-xs font-medium ${v > 0 ? "text-green-600" : "text-gray-400"}`}>{v > 0 ? v.toLocaleString() : "—"}</span>; } },
    { id: "dispatchedQty",  accessorKey: "dispatchedQty",   header: "Dispatched (kg)", filterType: "none", enableSorting: true, defaultVisible: true, size: 105,
      cell: (info) => { const v = info.getValue() as number; return v > 0 ? <span className="font-medium text-xs text-blue-600 tabular-nums">{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span>; } },
    { id: "balanceQty",     accessorKey: "balanceQty",      header: "Balance (kg)", filterType: "none",   enableSorting: true, defaultVisible: true, size: 95,
      cell: (info) => { const v = info.getValue() as number; return <span className={`tabular-nums text-xs font-medium ${v > 0 ? "text-orange-600" : "text-green-600"}`}>{v > 0 ? v.toLocaleString() : "—"}</span>; } },
    { id: "soDeliveryDate", accessorKey: "soDeliveryDate",  header: "SO Del. Date", filterType: "none",   enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => info.getValue() ? <span className="text-xs text-gray-700">{info.getValue() as string}</span> : <span className="text-gray-300 text-xs">—</span> },
    { id: "expectedDelivery",accessorKey: "expectedDelivery",header: "PO Del. Date",filterType: "none",   enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => <span className="text-xs text-gray-700">{info.getValue() as string}</span> },
    { id: "productionStatus",accessorKey: "productionStatus",header: "Status",      filterType: "select", filterOptions: productionStatusOptions, enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => { const s = info.getValue() as string; return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s] || "bg-gray-100 text-gray-600"}`}>{s}</span>; } },
    // Latest remark per tracker — what the user typed in the Update Status
    // modal's "Remarks" field. Empty until the user types something.
    { id: "remarks", accessorKey: "remarks", header: "Remarks",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 260,
      // Disable truncate so long remarks wrap onto multiple lines instead
      // of hiding behind an ellipsis the user can't read without resizing.
      noTruncate: true, align: "left",
      cell: (info) => {
        const v = (info.getValue() as string | undefined)?.trim();
        return v
          ? <span className="text-xs text-amber-700 italic leading-snug whitespace-pre-wrap break-words">{v}</span>
          : <span className="text-xs text-gray-300">—</span>;
      } },
    // The per-line Remark typed on the PO item itself — distinct from the
    // "Remarks" column above (that's the tracker's own status note typed via
    // Update Status). Client-requested 2026-11-06: this wasn't visible
    // anywhere on the MOT grid/export before.
    { id: "itemRemark", accessorKey: "itemRemark", header: "Item Remark",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 220,
      noTruncate: true, align: "left",
      cell: (info) => {
        const v = (info.getValue() as string | undefined)?.trim();
        return v
          ? <span className="text-xs text-gray-700 leading-snug whitespace-pre-wrap break-words">{v}</span>
          : <span className="text-xs text-gray-300">—</span>;
      } },
  ], [productionStatusOptions, poItemLineMap]);

  // ── Table header for tree views ────────────────────────────────────────────
  function POTableHeader() {
    return (
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 w-10">#</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">PO Number</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">Order Date</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">Item Code</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Ordered (kg)</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">Order ID</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">PO Customer</th>
          <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">SO Customer</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Ready (kg)</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Dispatched (kg)</th>
          <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500">Balance (kg)</th>
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
        <td className="px-3 py-2">
          <span className="font-semibold text-sm text-purple-700">{tracker.poNumber}</span>
          {poItemLineMap.get(tracker.id) && <span className="font-mono text-xs text-purple-400"> #{poItemLineMap.get(tracker.id)}</span>}
        </td>
        <td className="px-3 py-2 text-xs text-gray-600">{tracker.poDate}</td>
        <td className="px-3 py-2">
          <div className="text-xs leading-tight">
            <div className="font-semibold text-gray-800">{tracker.mill}</div>
            <div className="text-gray-500">{tracker.paper} · {tracker.gsm} GSM · {tracker.size}</div>
          </div>
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium text-gray-900 tabular-nums">{tracker.orderedQty > 0 ? tracker.orderedQty.toLocaleString() : "—"}</td>
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
          <span className={tracker.readyQty > 0 ? "text-green-600" : "text-gray-400"}>{tracker.readyQty > 0 ? tracker.readyQty.toLocaleString() : "—"}</span>
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
          {tracker.dispatchedQty > 0 ? <span className="text-blue-600">{tracker.dispatchedQty.toLocaleString()}</span> : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
          <span className={tracker.balanceQty > 0 ? "text-orange-600" : "text-green-600"}>{tracker.balanceQty > 0 ? tracker.balanceQty.toLocaleString() : "—"}</span>
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
    // Page-level lock per client UAT. h-full doesn't establish a definite
    // height here (AppShell's padding wrapper has natural height, not h-full)
    // so we use an explicit viewport-relative calc instead. Offset covers
    // the AppShell header (64px) + this main-area padding (p-3 → p-6 = up
    // to 24px each side = 48px) — total ~112px on lg. KPI / toolbar above
    // sit flex-shrink-0 in the flex column; grid section gets flex-1 +
    // min-h-0 so its internal scroll (sticky header + bottom scrollbar)
    // is the ONLY scroll surface on the page.
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4 overflow-hidden">

      {/* KPI Cards — flex-shrink-0 so they keep their natural height
          inside the page's flex column and never collapse for the grid. */}
      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 flex-shrink-0">
        <KpiCard title="Total Orders"  value={kpis.total}           subtitle="All mills"       icon={Factory}     iconBg="bg-blue-50"    iconColor="text-blue-500"   />
        <KpiCard title="Pending"       value={kpis.pending}         subtitle="Not started"     icon={Clock}       iconBg="bg-gray-50"    iconColor="text-gray-500"   />
        <KpiCard title="In Production" value={kpis.inProduction}    subtitle="Active"          icon={Factory}     iconBg="bg-purple-50"  iconColor="text-purple-500" />
        <KpiCard title="Ready"         value={kpis.readyToDispatch} subtitle="To dispatch"     icon={CheckCircle} iconBg="bg-green-50"   iconColor="text-green-500"  />
        <KpiCard title="Dispatched"    value={kpis.dispatched}      subtitle="Sent from mill"  icon={Truck}       iconBg="bg-cyan-50"    iconColor="text-cyan-500"   />
        <KpiCard title="Total Value"   value={`₹${(kpis.totalValue/100000).toFixed(1)}L`} subtitle="PO value" icon={Package} iconBg="bg-emerald-50" iconColor="text-emerald-500" />
      </div>

      {/* ── Toolbar (matches DataGrid toolbar style) ─────────────────────── */}
      {/* flex-shrink-0 — toolbar keeps its natural height in the page's
          flex column so it never compresses to make room for the grid. */}
      <div className="rounded-lg border bg-white shadow-sm flex-shrink-0">
        {/* Main row — wraps on narrow screens so the search bar gets its own
            line and the action buttons sit below instead of overflowing. */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">

          {/* Search — full-width on mobile, fills remaining space from sm+ */}
          <div className="relative w-full sm:flex-1 sm:w-auto min-w-0">
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

          {/* Closed filter — active by default so short-delivery finalised
              trackers hide from the busy main grid. Toggle to inspect them
              on demand without any extra page loads elsewhere. */}
          <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 shrink-0">
            {([
              { id: "active", label: "Active"   },
              { id: "closed", label: "Closed"   },
              { id: "all",    label: "All"      },
            ] as const).map(({ id, label }) => (
              <button key={id} onClick={() => setClosedView(id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${closedView===id?"bg-white text-amber-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                {label}
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
            <span className="hidden sm:inline">Filters</span>
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
                <span className="hidden sm:inline">Columns</span>
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
                <div className="absolute right-0 top-full mt-1 z-30 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  {/* Bulk-edit Excel flow — primary for production teams. */}
                  <button onClick={() => { setShowImpExp(false); handleDownloadExcel(); }}
                    disabled={excelBusy}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <Download className="h-4 w-4 text-emerald-500 shrink-0"/>
                    <div className="text-left">
                      <p className="text-xs font-medium">Download Excel (.xlsx)</p>
                      <p className="text-[11px] text-gray-400">
                        {closedView === "active" ? "Active" : closedView === "closed" ? "Closed" : "All"} rows (current tab) — edit Ready / Status / Date
                      </p>
                    </div>
                  </button>
                  <label className={cn(
                    "flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer",
                    excelBusy && "opacity-50 pointer-events-none"
                  )}>
                    <Upload className="h-4 w-4 text-blue-500 shrink-0"/>
                    <div className="text-left">
                      <p className="text-xs font-medium">Upload edited Excel</p>
                      <p className="text-[11px] text-gray-400">Bulk-apply Ready / Status / Date changes</p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={(e) => { setShowImpExp(false); const f = e.target.files?.[0]; if (f) handleUploadExcel(f); e.target.value = ""; }}
                    />
                  </label>
                  <div className="border-t border-gray-100" />
                  {/* Legacy CSV uploader kept for backward compat */}
                  <button onClick={() => { setShowBulkUploadModal(true); setShowImpExp(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
                    <Upload className="h-4 w-4 text-gray-400 shrink-0"/>
                    <div className="text-left"><p className="text-xs font-medium">Upload CSV (legacy)</p><p className="text-[11px] text-gray-400">Old PO-number based import</p></div>
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
        <div className="flex flex-1 min-h-0 flex-col overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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
                      <span>Ord: <span className="text-gray-900">{cg.totalOrdered.toLocaleString()} kg</span></span>
                      <span>Rdy: <span className="text-green-600">{cg.totalReady.toLocaleString()} kg</span></span>
                      <span>Dsp: <span className="text-blue-600">{cg.totalDispatched.toLocaleString()} kg</span></span>
                      <span>Bal: <span className="text-orange-600">{cg.totalBalance.toLocaleString()} kg</span></span>
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
        <div className="flex flex-1 min-h-0 flex-col overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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
                      <span>Ord: <span className="text-gray-900">{mg.totalOrdered.toLocaleString()} kg</span></span>
                      <span>Rdy: <span className="text-green-600">{mg.totalReady.toLocaleString()} kg</span></span>
                      <span>Dsp: <span className="text-blue-600">{mg.totalDispatched.toLocaleString()} kg</span></span>
                      <span>Bal: <span className="text-orange-600">{mg.totalBalance.toLocaleString()} kg</span></span>
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
        // flex-1 min-h-0 wrapper: takes whatever vertical space remains
        // after KPI + tabs + filters above. The DataGrid then fills this
        // wrapper via its own h-full + flex-column behaviour (driven by
        // scrollMaxHeight="100%") so the grid's internal scroll is the
        // only scroll on the page — sticky header at the top of the
        // scroll viewport, horizontal scrollbar at the bottom of it.
        <div className="flex flex-1 min-h-0 flex-col">
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
            scrollMaxHeight="100%"
            onRowClick={(row) => openDetail(row)}
            initialPageSize={15}
            emptyMessage="No mill orders match your search."
          />
        </div>
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
              addTruckLoadPlan({
                id: `tlp_${Date.now()}`,
                planNumber: `TLP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                planDate: today,
                truckNumber: latestBatch?.truckNumber,
                origin: editingTracker.mill,
                deliveryMode: (editingTracker.deliveryMode as TruckLoadPlan["deliveryMode"]) ?? "To Godown",
                plannedLoadDate: latestBatch?.date || today,
                plannedDeliveryDate: editingTracker.expectedDelivery,
                actualLoadDate: latestBatch?.date || today,
                status: "Dispatched",
                items: [{
                  id: `item_${Date.now()}`,
                  trackerSourceId: editingTracker.id,
                  poNumber: editingTracker.poNumber,
                  soNumber: editingTracker.soNumber,
                  paper: editingTracker.paper,
                  gsm: editingTracker.gsm,
                  size: editingTracker.size,
                  quantity: dispatchQty,
                  loadOrder: 1,
                  customerName: editingTracker.customerName,
                  deliveryLocation: editingTracker.customerName || "Monit Godown, Indore",
                }],
              });
              success("Dispatched! GRN entry created for verification.");
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

      {/* Close-tracker confirmation — surfaces the numbers so the user
          sees exactly what they're accepting as final (ordered / received
          / balance being written off), plus an optional reason field. */}
      {closingTracker && (
        <Modal
          isOpen
          onClose={() => { if (!closingBusy) { setClosingTracker(null); setClosingReason(""); } }}
          title="Close mill tracker?"
          subtitle={`${closingTracker.poNumber} · ${closingTracker.paper || closingTracker.brandName || "—"}`}
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => { setClosingTracker(null); setClosingReason(""); }}
                disabled={closingBusy}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!closingTracker) return;
                  setClosingBusy(true);
                  try {
                    await millTrackerApi.close(Number(closingTracker.id), closingReason.trim() || undefined);
                    success("Tracker closed. Balance will not appear as pending anymore.");
                    setClosingTracker(null);
                    setClosingReason("");
                    await refreshTrackers();
                  } catch (e) {
                    showError(e instanceof Error ? e.message : "Failed to close tracker.");
                  } finally { setClosingBusy(false); }
                }}
                disabled={closingBusy}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >
                {closingBusy ? "Closing…" : "Close tracker"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Ordered</p>
                <p className="text-sm font-black text-gray-800 mt-0.5 tabular-nums">{closingTracker.orderedQty.toLocaleString("en-IN")} kg</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Received</p>
                <p className="text-sm font-black text-emerald-700 mt-0.5 tabular-nums">{closingTracker.dispatchedQty.toLocaleString("en-IN")} kg</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-500">Short</p>
                <p className="text-sm font-black text-orange-700 mt-0.5 tabular-nums">
                  {Math.max(0, closingTracker.orderedQty - closingTracker.dispatchedQty).toLocaleString("en-IN")} kg
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Balance will be written off as short delivery. The tracker will move out of the
              default MOT grid — you can still view it via the <strong>Closed</strong> filter above.
            </p>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={closingReason}
                onChange={(e) => setClosingReason(e.target.value)}
                placeholder="e.g. Mill confirmed no more stock available"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        </Modal>
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
                <p className="text-[10px] text-gray-400">kg</p>
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
                    {["Batch", "Date", "Qty (kg)", "Truck No", "Mill Invoice", "Remarks"].map((h) => (
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
                    <td className="px-3 py-2 font-bold text-blue-700">{batches.reduce((s, b) => s + b.qty, 0).toLocaleString()} kg</td>
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

  // Raw text the user typed in the Ready qty input — needed so trailing
  // zeros and the decimal point survive on screen (23.500 stays 23.500,
  // not 23.5). Batch qty string state + newBatch object removed with the
  // Add Batch section — DispatchReceipts are the authoritative source now.
  const [readyQtyStr, setReadyQtyStr] = useState(tracker.readyQty ? String(tracker.readyQty) : "");

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
                {/* "Dispatched" removed on purpose — it must only ever be
                    set automatically from a real dispatch entry on the
                    Dispatch page (Enter Dispatch), never a manual status
                    flip. Manually setting it here used to double-count the
                    dispatched quantity once the real dispatch entry was
                    also made for the same truck (client-reported live-data
                    bug — a real 20,069 kg dispatch showed as 40,069 kg). If
                    the tracker is already Dispatched, show it here as a
                    disabled option so the dropdown still displays correctly
                    — just not re-selectable. */}
                {["Order Placed","In Production","Partial Ready","Ready","Delayed"].map((s) => <option key={s} value={s}>{s}</option>)}
                {tracker.productionStatus === "Dispatched" && (
                  <option value="Dispatched" disabled>Dispatched (set automatically from Dispatch page)</option>
                )}
              </select>
            </div>

            <div>
              <label className={labelCls}>Ready Weight (kg) <span className="text-red-400">*</span></label>
              <input
                type="number"
                /* Bind to the raw string so trailing zeros + the decimal
                   point are preserved exactly as typed (23.500 stays
                   23.500 — not 23.5). Numeric formData.readyQty is kept
                   in sync for totals and submit. */
                value={readyQtyStr}
                step="0.01"
                onChange={(e) => {
                  setReadyQtyStr(e.target.value);
                  setFormData({ ...formData, readyQty: parseFloat(e.target.value) || 0 });
                }}
                className={inputCls}
                min="0" required
              />
              {/* Cap removed per client request — mills can deliver slightly
                  more or less than the ordered qty, and the user wants the
                  system to accept whatever weight actually arrived. The
                  ordered qty is shown for reference only. */}
              <p className="mt-1 text-[10px] text-gray-400">Ordered: {tracker.orderedQty.toLocaleString()} kg (reference only)</p>
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

        {/* Partial Delivery Batches — full "Add Batch" flow removed per
            client UAT. Authoritative dispatch data now lives on
            DispatchReceipts (via TLP → /dispatch → Enter Dispatch), so
            duplicating that entry here would create two sources of truth.
            Existing batches (from before this change) still surface on
            the read-only "Delivery Batches" strip above and in the
            History modal for audit. */}
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
    ["Delayed"],
    ["(Dispatched is set automatically from the Dispatch page — do not type it here)"],
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
            <p className="mt-2.5 text-[10px] text-gray-400">Status values: Order Placed · In Production · Partial Ready · Ready · Delayed (Dispatched is set automatically from the Dispatch page)</p>
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
                        <td className="px-3 py-2 font-mono font-semibold text-xs text-purple-600">{row.poNumber}</td>
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
              <p className="text-3xl font-bold text-gray-400">{importResult.unchanged}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-1">Unchanged</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-8 py-5 text-center">
              <p className="text-3xl font-bold text-gray-400">{importResult.skipped}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-1">Skipped</p>
            </div>
          </div>
          {importResult.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className={labelCls + " text-amber-600 mb-2"}>Warnings</p>
              <ul className="space-y-1">
                {importResult.warnings.map((w, i) => <li key={i} className="text-xs text-amber-700">• {w}</li>)}
              </ul>
            </div>
          )}
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

export default function Page() {
  return <PermGuard perm="mill.read"><MillTrackerPage /></PermGuard>;
}
