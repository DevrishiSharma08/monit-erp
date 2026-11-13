"use client";

import { PermGuard } from "@/components/PermGuard";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { TruckLoadPlan, TruckLoadPlanItem, MillOrderTracker } from "@/types/paper-domain";
import {
  Truck, Clock, CheckCircle2, Plus, Package, AlertCircle,
  MoreVertical, Eye, EyeOff, Trash2, Printer, RefreshCw, X, Weight,
  GripVertical, Filter, Search, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { PortalModal, ModalCloseButton } from "@/components/PortalModal";
import { useToast } from "@/context/ToastContext";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { cn } from "@/lib/utils";
import {
  truckLoadPlanApi, TruckLoadPlanApiDto, TruckLoadPlanItemApiDto,
  millTrackerApi, MillTrackerRow,
  transporterApi, TransporterDropdown,
  type TlpLoadType,
} from "@/lib/api-services";
import type { TransporterVehicleDto } from "@/lib/api-services";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  Planned:    "bg-blue-50 text-blue-700 border border-blue-200",
  Loading:    "bg-amber-50 text-amber-700 border border-amber-200",
  Dispatched: "bg-purple-50 text-purple-700 border border-purple-200",
  Received:   "bg-green-50 text-green-700 border border-green-200",
};
const STATUS_SEQ: TruckLoadPlan["status"][] = ["Planned", "Loading", "Dispatched", "Received"];

const PENDING_COLS = [
  { id: "status",     label: "Status"           },
  { id: "readyWt",    label: "Ready (kg)"       },
  { id: "plannedWt",  label: "Planned (kg)"     },
  { id: "planWt",     label: "Dispatched (kg)"  },
  { id: "balanceWt",  label: "Balance (kg)"     },
  { id: "eta",        label: "ETA"              },
] as const;
type PendingColId = typeof PENDING_COLS[number]["id"];
const DEFAULT_HIDDEN: PendingColId[] = ["planWt"];
const PENDING_COL_ALIGN: Record<PendingColId, "left" | "right"> = {
  status: "left", readyWt: "right", plannedWt: "right", planWt: "right", balanceWt: "right", eta: "left",
};

const TRACKER_STATUS_BADGE: Record<string, string> = {
  "Ready":              "bg-green-100 text-green-700",
  "Partial Ready":      "bg-amber-100 text-amber-700",
  "Partial Dispatched": "bg-purple-100 text-purple-700",
  "Order Placed":       "bg-gray-100 text-gray-600",
  "In Production":      "bg-blue-100 text-blue-700",
  "Dispatched":         "bg-teal-100 text-teal-700",
  "Delayed":            "bg-red-100 text-red-700",
  "Cancelled":          "bg-gray-100 text-gray-400",
};

// ─── Local type extensions (load types not in shared mockData) ─────────────────

type TLPItemEx = TruckLoadPlanItem & { loadType?: TlpLoadType; planQty?: number };
type TLPLoadEx = { id: number; loadType: TlpLoadType; loadSequence: number; address?: string; items: TLPItemEx[] };
type TLPPlanEx = Omit<TruckLoadPlan, "items"> & { items: TLPItemEx[]; loads: TLPLoadEx[] };

// A tracker's `readyQty` is already a NET balance — "sitting ready at the
// mill right now, not yet dispatched" — because both dispatch paths
// (TruckLoadPlanService.SyncTrackerDispatchAsync and
// DispatchReceiptRepository) decrement it by the dispatched amount at the
// moment something actually ships. It does NOT also know about trucks
// already PLANNED (but not yet actually dispatched) against it, though —
// that's what `plannedElsewhereQty` accounts for, so a 2nd truck being
// planned for the remainder doesn't show the full ready qty again.
// `availableToPlanQty` = readyQty - plannedElsewhereQty, floored at 0 — the
// single number every "how much can I still plan" calculation in this file
// should use. Previously this ALSO subtracted dispatchedQty a second time
// (double-subtraction bug, client-reported 2026-10-05: PO MPA/26-27/319 had
// Ready=2300, Dispatched=464.2 already netted out of that 2300, but the UI
// only allowed planning 1835.8 — wrongly subtracting the 464.2 again).
// `plannedElsewhereQty` is surfaced separately so the UI can show the user
// WHY the available figure is smaller than Ready.
type TrackerEx = MillOrderTracker & { availableToPlanQty: number; plannedElsewhereQty: number };

// ─── Note: tracker/TLP qty fields are stored in KG ────────────────────────────
// MillTracker.OrderedQty/ReadyQty/DispatchedQty are kg (backend stores PO.WeightKg).
// TLP items.quantity is also kg. Display values directly — no sheets conversion.

function itemWeight(item: TruckLoadPlanItem): number {
  return item.weightKg ?? item.quantity ?? 0;
}

function planTotals(plan: TLPPlanEx) {
  const totalWeight = plan.items.reduce((s, i) => s + itemWeight(i), 0);
  const uniquePOs   = new Set(plan.items.map((i) => i.poNumber)).size;
  return { totalWeight, uniquePOs };
}

// ─── Tracker Detail Modal ─────────────────────────────────────────────────────

function TrackerDetailModal({ tracker, onClose }: { tracker: TrackerEx; onClose: () => void }) {
  const avail          = tracker.availableToPlanQty;
  const availWeight    = avail;
  const orderedWeight  = tracker.orderedQty;
  const readyWeight    = tracker.readyQty;
  const dispatchWeight = tracker.dispatchedQty;

  return (
    <PortalModal onClose={onClose}>
      {/* Header — blue tinted */}
      <div className="flex items-center justify-between border-b border-blue-100 px-5 py-3.5 bg-blue-50 rounded-t-2xl flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 font-mono">{tracker.poNumber}</h2>
            <p className="text-xs text-gray-500">{tracker.mill} · PO Date: {tracker.poDate}</p>
          </div>
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
            TRACKER_STATUS_BADGE[tracker.productionStatus] ?? "bg-gray-100 text-gray-600")}>
            {tracker.productionStatus}
          </span>
          {tracker.soNumber && <span className="text-xs text-purple-500 font-medium">→ SO: {tracker.soNumber}</span>}
          {!!tracker.delayDays && tracker.delayDays > 0 && (
            <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-semibold text-red-600">{tracker.delayDays}d delay</span>
            </div>
          )}
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5 space-y-4">
        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">PO Number</p>
            <p className="text-sm font-black text-blue-900 font-mono mt-0.5 truncate">{tracker.poNumber}</p>
          </div>
          <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">Customer</p>
            <p className="text-sm font-bold text-violet-900 mt-0.5 truncate">{tracker.customerName ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Ready / Ordered</p>
            <p className="text-sm font-black text-emerald-800 mt-0.5">{tracker.readyQty.toLocaleString()} / {tracker.orderedQty.toLocaleString()}</p>
          </div>
        </div>

        {/* Material */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Material</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Paper", val: tracker.paper },
            { label: "GSM",   val: String(tracker.gsm) },
            { label: "Size",  val: tracker.size },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
              <p className="text-[10px] text-gray-400 uppercase">{label}</p>
              <p className="font-semibold text-gray-800 text-xs mt-0.5">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quantities */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quantities</p>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Ordered",    val: tracker.orderedQty,          wt: orderedWeight,  color: "text-gray-800"   },
            { label: "Ready",      val: tracker.readyQty,            wt: readyWeight,    color: "text-green-700"  },
            { label: "Dispatched", val: tracker.dispatchedQty,       wt: dispatchWeight, color: "text-purple-700" },
            { label: "Planned",    val: tracker.plannedElsewhereQty, wt: 0,              color: "text-amber-700"  },
            { label: "Available",  val: avail,                       wt: availWeight,    color: "text-blue-700"   },
          ].map(({ label, val, wt, color }) => (
            <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase">{label}</p>
              <p className={cn("font-bold text-sm mt-0.5 tabular-nums", color)}>{val.toLocaleString()}</p>
              {wt > 0 && <p className="text-[10px] text-gray-400 tabular-nums">{wt.toLocaleString()} kg</p>}
            </div>
          ))}
        </div>
        {tracker.productionProgress > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>Production Progress</span>
              <span className="font-semibold">{tracker.productionProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(tracker.productionProgress, 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Customer & Delivery */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <p className="text-[10px] text-gray-400 uppercase mb-1">Customer</p>
          <p className="font-semibold text-gray-800 text-xs">{tracker.customerName ?? "—"}</p>
          {tracker.deliveryMode && (
            <p className="text-[11px] text-blue-500 mt-0.5">{tracker.deliveryMode}</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <p className="text-[10px] text-gray-400 uppercase mb-1">Delivery Address</p>
          <p className="text-xs text-gray-700 leading-relaxed">{tracker.directDeliveryAddress ?? "—"}</p>
        </div>
      </div>

      {/* Dates & Update */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <p className="text-[10px] text-gray-400 uppercase mb-1">Expected Delivery</p>
          <p className="font-semibold text-xs text-gray-800">{tracker.expectedDelivery || "—"}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <p className="text-[10px] text-gray-400 uppercase mb-1">Last Updated</p>
          <p className="text-xs text-gray-700">{tracker.lastUpdate || "—"}</p>
          {tracker.lastUpdatedBy && <p className="text-[11px] text-gray-400">by {tracker.lastUpdatedBy}</p>}
        </div>
      </div>

      {tracker.remarks && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
          <p className="text-[10px] text-gray-400 uppercase mb-1">Remarks</p>
          <p className="text-xs text-amber-800">{tracker.remarks}</p>
        </div>
      )}

      </div>
    </PortalModal>
  );
}

// ─── Sortable pending column header (DnD reordering) ──────────────────────────

function SortablePendingTh({ id, align, children }: { id: PendingColId; align: "left" | "right"; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <th ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={cn("px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 select-none whitespace-nowrap",
        align === "right" ? "text-right" : "text-left")}>
      <div className={cn("inline-flex items-center gap-1", align === "right" ? "flex-row-reverse" : "")}>
        <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
          className="cursor-grab touch-none text-gray-300 hover:text-gray-400 active:cursor-grabbing">
          <GripVertical className="h-3 w-3" />
        </button>
        {children}
      </div>
    </th>
  );
}

// ─── Pending POs Section ───────────────────────────────────────────────────────

interface PendingFilters { search: string; customer: string; mill: string; status: string; }

function PendingPOsSection({
  trackers, selectedIds, onToggle, onPlanSelected, onViewTracker,
}: {
  trackers: TrackerEx[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onPlanSelected: () => void;
  onViewTracker: (t: TrackerEx) => void;
}) {
  const [filters,      setFilters]     = useState<PendingFilters>({ search: "", customer: "", mill: "", status: "" });
  const [hiddenCols,   setHiddenCols]  = useState<Set<PendingColId>>(new Set(DEFAULT_HIDDEN));
  const [colMenuOpen,  setColMenuOpen] = useState(false);
  const [showFilters,  setShowFilters] = useState(false);
  const [colOrder,     setColOrder]    = useState<PendingColId[]>(PENDING_COLS.map((c) => c.id));
  const [pageIndex,    setPageIndex]   = useState(0);
  const pageSize = 15;

  const sensors = useSensors(useSensor(PointerSensor));

  const handleColDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as PendingColId);
        const newIdx = prev.indexOf(over.id as PendingColId);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const visibleCols = colOrder.filter((id) => !hiddenCols.has(id));
  const toggleCol = (col: PendingColId) => setHiddenCols((prev) => {
    const next = new Set(prev); next.has(col) ? next.delete(col) : next.add(col); return next;
  });

  const customers = useMemo(() => [...new Set(trackers.map((t) => t.customerName).filter(Boolean))] as string[], [trackers]);
  // Filter dropdown lists unit names where available, mill name otherwise —
  // matches the unit-wise mental model the user has on this page.
  const mills     = useMemo(() => [...new Set(trackers.map((t) => t.millUnitName?.trim() || t.mill))], [trackers]);
  const statuses  = useMemo(() => [...new Set(trackers.map((t) => t.productionStatus))], [trackers]);

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase();
    return trackers.filter((t) => {
      // Global search now also matches mill + unit so the user can type
      // either "Bhadrachalam" or "ITC" and find rows on this page.
      if (q
          && !t.poNumber.toLowerCase().includes(q)
          && !t.paper.toLowerCase().includes(q)
          && !(t.customerName ?? "").toLowerCase().includes(q)
          && !(t.mill ?? "").toLowerCase().includes(q)
          && !(t.millUnitName ?? "").toLowerCase().includes(q)) return false;
      if (filters.customer && t.customerName !== filters.customer) return false;
      // Mill filter matches the per-row unit name when present, mill name
      // otherwise — same key the dropdown was built from.
      if (filters.mill && (t.millUnitName?.trim() || t.mill) !== filters.mill) return false;
      if (filters.status && t.productionStatus !== filters.status) return false;
      return true;
    });
  }, [trackers, filters]);

  // Reset to page 1 whenever the filtered set changes shape, so a filter
  // edit never strands the user on a now-out-of-range page.
  useEffect(() => { setPageIndex(0); }, [filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const paged = filtered.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);

  const allSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));
  const toggleAll = () => {
    if (allSelected) filtered.forEach((t) => onToggle(t.id));
    else filtered.filter((t) => !selectedIds.has(t.id)).forEach((t) => onToggle(t.id));
  };

  const setF = (k: keyof PendingFilters, v: string) => setFilters((p) => ({ ...p, [k]: v }));

  const selectedWeight = useMemo(() =>
    trackers.filter((t) => selectedIds.has(t.id))
      .reduce((s, t) => s + t.availableToPlanQty, 0),
    [trackers, selectedIds],
  );

  // Per-column cell renderer — returns the <td> element
  const renderCell = (col: PendingColId, t: TrackerEx, balanceWt: number) => {
    switch (col) {
      case "status":
        return (
          <td key={col} className="px-3 py-3 whitespace-nowrap">
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
              TRACKER_STATUS_BADGE[t.productionStatus] ?? "bg-gray-100 text-gray-600")}>
              {t.productionStatus}
            </span>
          </td>
        );
      case "readyWt": {
        return (
          <td key={col} className="px-3 py-3 text-right text-xs font-medium text-gray-700 tabular-nums whitespace-nowrap">
            {t.readyQty > 0 ? `${t.readyQty.toLocaleString()} kg` : "—"}
            {/* Tells the user WHY this row's Balance is smaller than Ready
                — otherwise planning a 2nd truck for the same PO item looks
                like the full Ready qty is still up for grabs. */}
            {t.plannedElsewhereQty > 0 && (
              <p className="text-[10px] font-normal text-amber-600">{t.plannedElsewhereQty.toLocaleString()} planned</p>
            )}
          </td>
        );
      }
      case "plannedWt": {
        return (
          <td key={col} className="px-3 py-3 text-right text-xs font-medium text-amber-600 tabular-nums whitespace-nowrap">
            {t.plannedElsewhereQty > 0 ? `${t.plannedElsewhereQty.toLocaleString()} kg` : "—"}
          </td>
        );
      }
      case "planWt": {
        return (
          <td key={col} className="px-3 py-3 text-right text-xs font-medium text-purple-600 tabular-nums whitespace-nowrap">
            {t.dispatchedQty > 0 ? `${t.dispatchedQty.toLocaleString()} kg` : "—"}
          </td>
        );
      }
      case "balanceWt":
        return (
          <td key={col} className="px-3 py-3 text-right text-sm font-bold text-blue-700 tabular-nums whitespace-nowrap">
            {balanceWt > 0 ? `${balanceWt.toLocaleString()} kg` : "—"}
          </td>
        );
      case "eta":
        return <td key={col} className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{t.expectedDelivery || "—"}</td>;
    }
  };

  // PO line numbers (#1, #2…) — only when same PO has multiple tracker items
  const poItemLineMap = useMemo<Map<string, number>>(() => {
    const groups = new Map<string, string[]>();
    for (const t of trackers) {
      if (!groups.has(t.poNumber)) groups.set(t.poNumber, []);
      groups.get(t.poNumber)!.push(t.id);
    }
    const result = new Map<string, number>();
    for (const [, ids] of groups) {
      if (ids.length > 1) ids.forEach((id, i) => result.set(id, i + 1));
    }
    return result;
  }, [trackers]);

  const selCls     = "min-w-[140px] rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
  const activeFilterCount = [filters.customer, filters.mill, filters.status].filter(Boolean).length;

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500">
            <Package className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-900">Pending Dispatch</p>
            <p className="text-xs text-orange-600">{trackers.length} item{trackers.length !== 1 ? "s" : ""} ready at mills</p>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <button onClick={onPlanSelected}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-sm">
            <Truck className="h-3.5 w-3.5" />
            Plan {selectedIds.size} Selected
            {selectedWeight > 0 && <span className="ml-1 opacity-80 font-normal">· {selectedWeight.toLocaleString()} kg</span>}
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-gray-100">
        {/* Row 1: Search + Filters btn + Columns btn */}
        <div className="flex items-center gap-2 bg-gray-50/60 px-4 py-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search PO, material, customer…"
              value={filters.search}
              onChange={(e) => setF("search", e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {filters.search && (
              <button onClick={() => setF("search", "")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors flex-shrink-0",
              (showFilters || activeFilterCount > 0)
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Column visibility */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setColMenuOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                colMenuOpen
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <Eye className="h-4 w-4" />
              <span>Columns</span>
              {hiddenCols.size > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-400 text-[10px] font-bold text-white">
                  {hiddenCols.size}
                </span>
              )}
            </button>
            {colMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setColMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 w-60 rounded-lg border border-gray-100 bg-white shadow-lg">
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between border-b pb-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Toggle Columns</span>
                      <button onClick={() => setColMenuOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {PENDING_COLS.map((col) => (
                        <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                          <input type="checkbox" checked={!hiddenCols.has(col.id)} onChange={() => toggleCol(col.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400" />
                          <span className="text-gray-700 flex-1">{col.label}</span>
                          {!hiddenCols.has(col.id)
                            ? <Eye className="h-3.5 w-3.5 text-blue-400" />
                            : <EyeOff className="h-3.5 w-3.5 text-gray-300" />}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 border-t pt-2">
                      <button onClick={() => setHiddenCols(new Set())}
                        className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
                        Show All
                      </button>
                      <button onClick={() => setHiddenCols(new Set(PENDING_COLS.map((c) => c.id)))}
                        className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
                        Hide All
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Collapsible filter panel */}
        {showFilters && (
          <div className="border-t px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  list="pending-customers-list"
                  value={filters.customer}
                  onChange={(e) => setF("customer", e.target.value)}
                  placeholder="Search customer…"
                  className={selCls}
                />
                <datalist id="pending-customers-list">
                  {customers.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="relative">
                <input
                  type="text"
                  list="pending-mills-list"
                  value={filters.mill}
                  onChange={(e) => setF("mill", e.target.value)}
                  placeholder="Search mill…"
                  className={selCls}
                />
                <datalist id="pending-mills-list">
                  {mills.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <select value={filters.status} onChange={(e) => setF("status", e.target.value)} className={selCls}>
                <option value="">All Statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters((p) => ({ ...p, customer: "", mill: "", status: "" }))}
                  className="flex items-center gap-1 flex-shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
        <DndContext id="pending-cols-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColDragEnd}>
          <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
            <thead className="sticky top-0 z-20 border-b-2 border-gray-200 bg-gradient-to-b from-slate-50 to-gray-50">
              <tr>
                {/* Fixed: checkbox */}
                <th className="w-10 px-4 py-2.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-500" />
                </th>
                {/* Fixed: PO Number */}
                <th className="min-w-[120px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  PO #
                </th>
                {/* Fixed: Item Code (paper/gsm/size) */}
                <th className="min-w-[180px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  Item Code
                </th>
                {/* Fixed: Mill */}
                <th className="min-w-[110px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  Mill
                </th>
                {/* Fixed: Customer */}
                <th className="min-w-[130px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  Customer
                </th>
                {/* Fixed: Address */}
                <th className="min-w-[180px] max-w-[240px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Address
                </th>
                {/* Drag-to-reorder visible columns */}
                <SortableContext items={visibleCols} strategy={horizontalListSortingStrategy}>
                  {visibleCols.map((col) => {
                    const def = PENDING_COLS.find((c) => c.id === col)!;
                    return (
                      <SortablePendingTh key={col} id={col} align={PENDING_COL_ALIGN[col]}>
                        {def.label}
                      </SortablePendingTh>
                    );
                  })}
                </SortableContext>
                {/* Fixed: View */}
                <th className="w-14 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0
                ? <tr><td colSpan={99} className="py-8 text-center text-sm text-gray-400">No pending items match filters</td></tr>
                : paged.map((t) => {
                    const balanceWt = t.availableToPlanQty;
                    const checked   = selectedIds.has(t.id);
                    const lineNo   = poItemLineMap.get(t.id);
                    return (
                      <tr key={t.id} onClick={() => onToggle(t.id)}
                        className={cn("cursor-pointer transition-colors", checked ? "bg-blue-50/70" : "hover:bg-gray-50/60")}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={checked} onChange={() => onToggle(t.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-500" />
                        </td>
                        <td className="px-3 py-3 min-w-[120px] whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-gray-800">{t.poNumber}</span>
                          {lineNo && <span className="font-mono text-xs text-blue-500"> #{lineNo}</span>}
                        </td>
                        <td className="px-3 py-3 min-w-[180px]">
                          <p className="font-medium text-gray-700 text-xs leading-tight">{t.paper}</p>
                          <p className="text-[11px] text-gray-400">{t.gsm} GSM · {t.size}</p>
                        </td>
                        {/* Mill column — unit name primary, mill name as
                            secondary line (per client UAT: items are
                            unit-wise so unit is the meaningful identifier). */}
                        <td className="px-3 py-3 text-xs whitespace-nowrap min-w-[140px] leading-tight">
                          {t.millUnitName
                            ? (<>
                                <div className="font-semibold text-blue-700">{t.millUnitName}</div>
                                <div className="text-[10px] text-gray-400">{t.mill}</div>
                              </>)
                            : <span className="text-gray-700">{t.mill || "—"}</span>}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-gray-700 whitespace-nowrap min-w-[130px]">{t.customerName ?? "—"}</td>
                        <td className="px-3 py-3 text-xs text-gray-500 min-w-[180px] max-w-[240px]">
                          {t.directDeliveryAddress
                            ? <span className="line-clamp-2 leading-relaxed">{t.directDeliveryAddress}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        {visibleCols.map((col) => renderCell(col, t, balanceWt))}
                        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => onViewTracker(t)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </DndContext>
      </div>

      {/* Pagination — matches DataGridPagination's compact style so this
          hand-rolled table reads as "just another grid" to the user. */}
      {filtered.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between border-t px-4 py-2">
          <p className="text-xs text-gray-600">
            Showing {safePageIndex * pageSize + 1} to {Math.min((safePageIndex + 1) * pageSize, filtered.length)} of {filtered.length} items
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={safePageIndex === 0}
              className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                safePageIndex === 0 ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-gray-300 text-gray-700 hover:bg-gray-50")}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-xs text-gray-500">{safePageIndex + 1} / {pageCount}</span>
            <button
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePageIndex >= pageCount - 1}
              className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                safePageIndex >= pageCount - 1 ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-gray-300 text-gray-700 hover:bg-gray-50")}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Plan Creation Modal ───────────────────────────────────────────────────────

const TLP_LOAD_TYPES: TlpLoadType[] = ["Load 1", "Load 2", "Load 3", "Last Load"];

interface PlanItem {
  rowKey: string;
  trackerId: string; poNumber: string; soNumber: string;
  paper: string; gsm: number; size: string;
  customerName: string; mill: string; deliveryAddress: string;
  maxQty: number; quantity: number; quantityStr: string; loadOrder: number;
  loadType: TlpLoadType;
}

interface PlanForm {
  items: PlanItem[];
  loadAddresses: Partial<Record<TlpLoadType, string>>;
  truckNumber: string; truckType: string; truckCapacityKg: number;
  transporterName: string; driverName: string; driverPhone: string;
  freightAmount: number; millInvoiceNo: string; deliveryBillNo: string;
  // Planned Delivery Date dropped per client UAT — load date is the only
  // schedule the user actually plans against; delivery ETA was redundant
  // and never trusted by ops since freight realities vary day-to-day.
  origin: string; plannedLoadDate: string;
}

function PlanCreationModal({ trackers, transporters, onSubmit, onCancel }: {
  trackers: TrackerEx[];
  transporters: TransporterDropdown[];
  onSubmit: (form: PlanForm) => Promise<void>;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [step, setStep] = useState<1 | 2>(1);
  // Guards against a double-click (or an impatient second click while the
  // first request is still in flight) firing two create requests — without
  // this, both could reach the server and each silently create its own
  // Truck Load Plan for the same items (client-reported 2026-09-11: a
  // single, unhurried save somehow produced a duplicate-key crash server
  // side, traced to two near-simultaneous requests from one click sequence).
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialItems: PlanItem[] = trackers.map((t, i) => {
    const avail = t.availableToPlanQty;
    return {
      rowKey: t.id,
      trackerId: t.id, poNumber: t.poNumber, soNumber: t.soNumber ?? "",
      paper: t.paper, gsm: t.gsm, size: t.size,
      // Persist the unit name as the "mill" on the load item when the PO has
      // a unit picked, so saved plans / dispatch / GRN all show the unit
      // downstream. Falls back to plain mill name otherwise.
      customerName: t.customerName ?? "", mill: t.millUnitName?.trim() || t.mill,
      deliveryAddress: t.directDeliveryAddress ?? "",
      maxQty: avail,
      quantity: avail,
      quantityStr: String(avail),
      loadOrder: trackers.length - i,
      loadType: "Load 1",
    };
  });

  // Pre-seed load addresses from each item's tracker delivery address so the
  // value is in state (not just shown as a placeholder) and survives submit.
  const initialLoadAddresses: Partial<Record<TlpLoadType, string>> = {};
  for (const it of initialItems) {
    if (it.deliveryAddress && !initialLoadAddresses[it.loadType]) {
      initialLoadAddresses[it.loadType] = it.deliveryAddress;
    }
  }

  const [form, setForm] = useState<PlanForm>({
    items: initialItems,
    loadAddresses: initialLoadAddresses,
    truckNumber: "", truckType: "", truckCapacityKg: 15000,
    transporterName: "", driverName: "", driverPhone: "", freightAmount: 0,
    millInvoiceNo: "", deliveryBillNo: "",
    origin: trackers[0]
      ? (() => {
          // Origin shows the unit name when the PO has one (items are
          // unit-wise, so the unit is what dispatched from); mill name
          // otherwise. Address suffix unchanged.
          const label = trackers[0].millUnitName?.trim() || trackers[0].mill;
          return trackers[0].millAddress ? `${label} — ${trackers[0].millAddress}` : label;
        })()
      : "",
    plannedLoadDate: today,
  });
  const [availVehicles,   setAvailVehicles]   = useState<TransporterVehicleDto[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  const setF = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const removeItem = (rowKey: string) =>
    setForm((p) => ({
      ...p,
      items: p.items.filter((it) => it.rowKey !== rowKey).map((it, i, arr) => ({ ...it, loadOrder: arr.length - i })),
    }));

  const splitItem = (rowKey: string) =>
    setForm((p) => {
      const idx = p.items.findIndex((it) => it.rowKey === rowKey);
      if (idx === -1) return p;
      const src = p.items[idx];
      const usedLoads = new Set(p.items.map((it) => it.loadType));
      const nextLoad = TLP_LOAD_TYPES.find((lt) => !usedLoads.has(lt)) ?? ("Load 2" as TlpLoadType);
      // Min 0.01 kg, not 1 kg — partial reels (e.g. 25.5 kg) need to split
      // without rounding the remainder up to a whole kg.
      const splitQty = Math.max(0.01, src.maxQty - src.quantity);
      const newItem: PlanItem = { ...src, rowKey: `${src.trackerId}_s${Date.now()}`, quantity: splitQty, quantityStr: String(splitQty), loadType: nextLoad };
      const items = [...p.items];
      items.splice(idx + 1, 0, newItem);
      return { ...p, items: items.map((it, i, arr) => ({ ...it, loadOrder: arr.length - i })) };
    });

  const handleTransporterChange = async (name: string) => {
    setF("transporterName", name);
    setAvailVehicles([]);
    const found = transporters.find((t) => t.name === name);
    if (!found) return;
    setVehiclesLoading(true);
    try {
      const detail = await transporterApi.getById(found.id);
      setAvailVehicles(detail.vehicles);
      if (detail.vehicles.length === 1) {
        const v = detail.vehicles[0];
        setForm((p) => ({ ...p, truckType: v.vehicleType || p.truckType, truckCapacityKg: v.capacity ?? p.truckCapacityKg, freightAmount: v.freightRate ?? p.freightAmount }));
      }
    } catch { /* silently ignore */ }
    finally { setVehiclesLoading(false); }
  };

  const handleVehicleTypeChange = (type: string) => {
    const masterV = availVehicles.find((v) => v.vehicleType === type);
    if (masterV) {
      setForm((p) => ({ ...p, truckType: masterV.vehicleType, truckCapacityKg: masterV.capacity ?? p.truckCapacityKg, freightAmount: masterV.freightRate ?? p.freightAmount }));
    } else {
      setF("truckType", type);
    }
  };

  const totalWeight   = form.items.reduce((s, it) => s + it.quantity, 0);
  const cap           = form.truckCapacityKg || 15000;
  const pct           = Math.min((totalWeight / cap) * 100, 100);
  const over          = totalWeight > cap;
  const usedLoadTypes = [...new Set(form.items.map((it) => it.loadType))].sort(
    (a, b) => TLP_LOAD_TYPES.indexOf(a) - TLP_LOAD_TYPES.indexOf(b)
  );
  const step1Valid  = form.items.length > 0 && form.items.every((it) => it.quantity > 0);
  const step2Valid  = step1Valid && !!form.truckNumber.trim() && !!form.transporterName.trim() && !!form.plannedLoadDate && !over;

  const iCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100";
  const lCls = "block text-xs font-semibold text-gray-600 mb-1";

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([{ n: 1, label: "Load Assignment" }, { n: 2, label: "Truck Details" }] as const).map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-gray-200"/>}
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                step === n ? "bg-blue-600 text-white" : step > n ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
              )}>{n}</div>
              <span className={cn("text-xs font-medium", step === n ? "text-blue-700" : "text-gray-400")}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── STEP 1: Load Assignment ── */}
      {step === 1 && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assign Items to Loads</p>
              <span className="text-[11px] text-gray-400">{form.items.length} item{form.items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-gray-300">
              <table className="w-full text-xs" style={{ minWidth: 580 }}>
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="w-7 px-2 py-2 text-center">#</th>
                    <th className="px-3 py-2 text-left min-w-[160px]">Material / PO</th>
                    <th className="px-3 py-2 text-left w-28">Load</th>
                    <th className="px-3 py-2 text-right w-36">Plan Qty (kg) / Avail</th>
                    <th className="w-14 px-2 py-2 text-center">Split</th>
                    <th className="w-8 px-2 py-2"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {form.items.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-gray-400">No items</td></tr>
                  )}
                  {form.items.map((it, idx) => (
                    <tr key={it.rowKey} className="bg-white">
                      <td className="px-2 py-2 text-center">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">{idx + 1}</span>
                      </td>
                      <td className="px-3 py-2 min-w-[160px]">
                        <p className="font-medium text-gray-800 truncate max-w-[180px]">{it.paper}</p>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">{it.gsm} GSM · {it.size} · {it.poNumber}</p>
                        {it.customerName && <p className="text-[11px] text-blue-500 truncate max-w-[180px]">{it.customerName}</p>}
                      </td>
                      <td className="px-3 py-2 w-28">
                        <select value={it.loadType}
                          onChange={(e) => setForm((p) => ({
                            ...p,
                            items: p.items.map((it2) => it2.rowKey === it.rowKey ? { ...it2, loadType: e.target.value as TlpLoadType } : it2),
                          }))}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none">
                          {TLP_LOAD_TYPES.map((lt) => <option key={lt} value={lt}>{lt}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 w-36">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Display uses the raw string the user typed
                              (quantityStr) so trailing zeros and the decimal
                              point survive — binding to the numeric
                              `quantity` would strip 23.500 → 23.5 because
                              JS numbers can't carry trailing zeros. */}
                          <input type="number" value={it.quantityStr ?? ""} min={0.01} max={it.maxQty} step="0.01"
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = parseFloat(raw);
                              const kg = isNaN(parsed) ? 0 : Math.min(parsed, it.maxQty);
                              // Keep the typed text in quantityStr (preserves
                              // 23.500); the numeric `quantity` drives totals.
                              const str = isNaN(parsed) ? raw
                                        : (parsed > it.maxQty ? String(it.maxQty) : raw);
                              setForm((p) => ({ ...p, items: p.items.map((it2) => it2.rowKey !== it.rowKey ? it2 : { ...it2, quantity: kg, quantityStr: str }) }));
                            }}
                            className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-xs font-semibold focus:border-blue-400 focus:outline-none"/>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">/{it.maxQty.toLocaleString()} kg</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center w-14">
                        <button onClick={() => splitItem(it.rowKey)} title="Split across another load"
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors">
                          Split
                        </button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => removeItem(it.rowKey)} className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors">
                          <X className="h-3.5 w-3.5"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Load summary */}
          {usedLoadTypes.length > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2">Load Summary</p>
              <div className="grid grid-cols-2 gap-2">
                {usedLoadTypes.map((lt) => {
                  const ltItems = form.items.filter((it) => it.loadType === lt);
                  const ltWt    = ltItems.reduce((s, it) => s + it.quantity, 0);
                  return (
                    <div key={lt} className="flex items-center justify-between rounded-lg bg-white border border-blue-100 px-3 py-2">
                      <span className="text-xs font-semibold text-blue-700">{lt}</span>
                      <span className="text-xs text-gray-500 tabular-nums">{ltWt.toLocaleString()} kg</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onCancel}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="button" disabled={!step1Valid} onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-all">
              Next → Truck Details
            </button>
          </div>
        </>
      )}

      {/* ── STEP 2: Truck Details ── */}
      {step === 2 && (
        <>
          {/* Per-load delivery addresses */}
          {usedLoadTypes.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Delivery Addresses per Load</p>
              <div className="space-y-2">
                {usedLoadTypes.map((lt) => (
                  <div key={lt}>
                    <label className={lCls}>{lt} — Delivery Address</label>
                    <input type="text"
                      value={form.loadAddresses[lt] ?? form.items.find((it) => it.loadType === lt)?.deliveryAddress ?? ""}
                      placeholder="Full delivery address…"
                      onChange={(e) => setForm((p) => ({ ...p, loadAddresses: { ...p.loadAddresses, [lt]: e.target.value } }))}
                      className={iCls}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weight bar */}
          <div className="rounded-xl border bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <Weight className="h-3.5 w-3.5"/> Truck Load
              </span>
              <span className={cn("text-xs font-bold tabular-nums", over ? "text-red-600" : "text-gray-700")}>
                {totalWeight.toLocaleString()} / {cap.toLocaleString()} kg
                {over && <span className="ml-1.5 text-red-600">▲ {(totalWeight - cap).toLocaleString()} kg over!</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : pct > 85 ? "bg-amber-400" : "bg-green-500")} style={{ width: `${pct}%` }}/>
            </div>
            {over && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0"/>
                Truck capacity exceeded by {(totalWeight - cap).toLocaleString()} kg — remove items or reduce quantities.
              </p>
            )}
          </div>

          {/* Transport Details */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Transport Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lCls}>Transporter <span className="text-red-500">*</span></label>
                <input list="transporters-list" value={form.transporterName} placeholder="Transporter name"
                  onChange={(e) => handleTransporterChange(e.target.value)} className={iCls}/>
                <datalist id="transporters-list">
                  {transporters.map((t) => <option key={t.id} value={t.name}/>)}
                </datalist>
              </div>

              <div className="hidden">
                <label className={lCls}>Vehicle Type{vehiclesLoading && <span className="ml-1.5 text-[10px] font-normal text-blue-400">loading…</span>}</label>
                <input list="vehicles-list" type="text" value={form.truckType} placeholder="e.g. 24 ft, Tata Ace…"
                  onChange={(e) => handleVehicleTypeChange(e.target.value)} className={iCls}/>
                <datalist id="vehicles-list">
                  {availVehicles.map((v, i) => (
                    <option key={i} value={v.vehicleType}>
                      {v.capacity ? `${v.capacity.toLocaleString()} kg` : ""}{v.freightRate ? ` · ₹${v.freightRate.toLocaleString()}` : ""}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className={lCls}>Truck Capacity (kg)</label>
                <input type="number" value={form.truckCapacityKg || ""} min={100} step={500}
                  onChange={(e) => setF("truckCapacityKg", parseInt(e.target.value) || 0)} className={iCls}/>
              </div>

              <div>
                <label className={lCls}>Truck / Vehicle No <span className="text-red-500">*</span></label>
                <input type="text" value={form.truckNumber} placeholder="MP09AB1234"
                  onChange={(e) => setF("truckNumber", e.target.value.toUpperCase())} className={cn(iCls, "font-mono")}/>
              </div>

              <div>
                <label className={lCls}>Driver Name</label>
                <input type="text" value={form.driverName} placeholder="Driver full name"
                  onChange={(e) => setF("driverName", e.target.value)} className={iCls}/>
              </div>

              <div>
                <label className={lCls}>Driver Phone</label>
                <input type="tel" value={form.driverPhone} placeholder="+91-9876543210"
                  onChange={(e) => setF("driverPhone", e.target.value)} className={iCls}/>
              </div>

              <div>
                <label className={lCls}>Freight Amount (₹)</label>
                <input type="number" value={form.freightAmount || ""} min={0} step={100} placeholder="0"
                  onChange={(e) => setF("freightAmount", parseFloat(e.target.value) || 0)} className={iCls}/>
              </div>

              <div>
                <label className={lCls}>Origin (Mill / City)</label>
                <input type="text" value={form.origin} onChange={(e) => setF("origin", e.target.value)} className={iCls}/>
              </div>

              <div>
                <label className={lCls}>Planned Load Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.plannedLoadDate}
                  onChange={(e) => setF("plannedLoadDate", e.target.value)} className={iCls}/>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setStep(1)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">← Back</button>
            <div className="flex gap-3">
              <button type="button" onClick={onCancel} disabled={isSubmitting}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">Cancel</button>
              <button type="button" disabled={!step2Valid || isSubmitting}
                onClick={async () => {
                  if (isSubmitting) return;
                  setIsSubmitting(true);
                  try { await onSubmit(form); }
                  finally { setIsSubmitting(false); }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 active:scale-95 transition-all">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Truck className="h-4 w-4"/>}
                {isSubmitting ? "Saving…" : "Save Load Plan"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Plan Drill-Down Modal ─────────────────────────────────────────────────────

function PlanDrillDown({ plan, onClose }: { plan: TLPPlanEx; onClose: () => void }) {
  const { totalWeight, uniquePOs } = planTotals(plan);
  const cap = plan.truckCapacityKg ?? 0;
  const pct = cap > 0 ? Math.min((totalWeight / cap) * 100, 100) : 0;

  return (
    <div className="space-y-5">
      {/* Truck header */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <p className="font-bold text-gray-900 text-base">{plan.planNumber}</p>
              <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[plan.status])}>
                {plan.status}
              </span>
            </div>
            <p className="text-xs text-gray-500">{plan.planDate}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total Weight</p>
            <p className="font-bold text-gray-800 tabular-nums">{totalWeight.toLocaleString()} kg</p>
            {cap > 0 && <p className="text-[11px] text-gray-400">of {cap.toLocaleString()} kg cap.</p>}
          </div>
        </div>

        {cap > 0 && (
          <div className="mt-2.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className={cn("h-full rounded-full", pct > 95 ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-green-500")}
              style={{ width: `${pct}%` }} />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          {[
            ["Truck",          plan.truckNumber    || "—"],
            ["Transporter",    plan.transporterName || "—"],
            ["Driver",         plan.driverName     || "—"],
            ["Phone",          plan.driverPhone    || "—"],
            ["Freight",        plan.freightAmount ? `₹ ${plan.freightAmount.toLocaleString()}` : "—"],
            ["Origin",         plan.origin],
            ["Mode",           plan.deliveryMode],
            ["Load Date",      plan.plannedLoadDate],
          ].map(([label, val]) => (
            <div key={label}>
              <span className="text-gray-400">{label}: </span>
              <span className="font-medium text-gray-700">{val}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-4 pt-2.5 border-t border-gray-200 text-xs">
          <span><span className="text-gray-400">POs: </span><span className="font-bold text-gray-800">{uniquePOs}</span></span>
          <span><span className="text-gray-400">Items: </span><span className="font-bold text-gray-800">{plan.items.length}</span></span>
          <span><span className="text-gray-400">Total Weight: </span><span className="font-bold text-gray-800">{totalWeight.toLocaleString()} kg</span></span>
        </div>
      </div>

      {/* Loads section */}
      {plan.loads.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Loads ({plan.loads.length})</p>
          {plan.loads.map((load) => {
            const ltWt = load.items.reduce((s, i) => s + itemWeight(i), 0);
            return (
              <div key={load.id} className="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden">
                <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">{load.loadType}</span>
                      <span className="text-[11px] text-gray-500">{load.items.length} item{load.items.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-[11px] text-gray-600 tabular-nums font-medium">{ltWt.toLocaleString()} kg</span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-700">
                    <span className="text-gray-400">Delivery Address: </span>
                    {load.address || <span className="text-gray-400 italic">— not set —</span>}
                  </p>
                </div>
                <div className="bg-white">
                  {load.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-4 py-1.5 text-xs border-b border-gray-50 last:border-b-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-gray-500 shrink-0">{item.poNumber}</span>
                        {/* SO number shown alongside PO number so the user
                            can trace the load back to the originating sales
                            order — client UAT: pure PO ref wasn't enough
                            to disambiguate during dispatch follow-up. */}
                        {item.soNumber && (
                          <span className="font-mono text-[11px] text-indigo-500 shrink-0">· {item.soNumber}</span>
                        )}
                        <span className="text-gray-700 truncate">{item.paper} · {item.gsm} GSM · {item.size}</span>
                        {item.customerName && <span className="text-blue-600 truncate">· {item.customerName}</span>}
                      </div>
                      <span className="font-semibold tabular-nums text-gray-800 shrink-0 ml-3">{itemWeight(item).toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
      </div>
    </div>
  );
}

// ─── Status Update Modal ───────────────────────────────────────────────────────

function StatusUpdateModal({ plan, onClose, onSave }: {
  plan: TLPPlanEx; onClose: () => void; onSave: (patch: Partial<TruckLoadPlan>) => void;
}) {
  const currentIdx = STATUS_SEQ.indexOf(plan.status);
  const [newStatus, setNewStatus] = useState<TruckLoadPlan["status"]>(
    STATUS_SEQ[Math.min(currentIdx + 1, STATUS_SEQ.length - 1)]
  );
  const [actualDate, setActualDate] = useState(new Date().toISOString().split("T")[0]);
  const { totalWeight, uniquePOs } = planTotals(plan);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800">{plan.planNumber}</p>
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[plan.status])}>{plan.status}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {uniquePOs} PO{uniquePOs !== 1 ? "s" : ""} · {plan.items.length} item{plan.items.length !== 1 ? "s" : ""} · {totalWeight.toLocaleString()} kg
          {plan.truckNumber ? ` · ${plan.truckNumber}` : ""}
          {plan.truckType ? ` (${plan.truckType})` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Status</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as TruckLoadPlan["status"])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
            {STATUS_SEQ.filter((_, i) => i > currentIdx).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">Current: <span className="font-medium">{plan.status}</span></p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            {newStatus === "Received" ? "Actual Received Date" : "Actual Load Date"}
          </label>
          <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {newStatus === "Dispatched" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Setting to <strong>Dispatched</strong> marks this load as sent from the mill. Mill Tracker will be updated automatically.
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="button"
          onClick={() => onSave({
            status: newStatus,
            actualLoadDate: newStatus === "Dispatched" || newStatus === "Loading" ? actualDate : plan.actualLoadDate,
            actualDeliveryDate: newStatus === "Received" ? actualDate : plan.actualDeliveryDate,
          })}
          className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 active:scale-95 transition-all">
          Update Status
        </button>
      </div>
    </div>
  );
}

// ─── API → frontend model mappers ─────────────────────────────────────────────

function mapTrackerRow(r: MillTrackerRow): MillOrderTracker {
  return {
    id:                    String(r.id),
    poNumber:              r.poNumber,
    poItemId:              r.poItemId != null ? String(r.poItemId) : undefined,
    poDate:                r.poDate ?? "",
    mill:                  r.mill ?? "",
    millAddress:           r.millAddress,
    millUnitId:            r.millUnitId,
    millUnitName:          r.millUnitName,
    paper:                 r.paper ?? "",
    gsm:                   r.gsm ?? 0,
    size:                  r.size ?? "",
    orderedQty:            Number(r.orderedQty),
    readyQty:              Number(r.readyQty),
    dispatchedQty:         Number(r.dispatchedQty),
    balanceQty:            Number(r.balanceQty),
    rate:                  Number(r.rate),
    totalAmount:           Number(r.totalAmount),
    productionStatus:      r.productionStatus as MillOrderTracker["productionStatus"],
    productionProgress:    Number(r.productionProgress),
    expectedDelivery:      r.expectedDelivery ?? "",
    actualDispatchDate:    r.actualDispatchDate,
    lastUpdate:            r.lastUpdate ?? "",
    lastUpdatedBy:         r.lastUpdatedBy,
    delayDays:             r.delayDays,
    soNumber:              r.soNumber,
    deliveryMode:          r.deliveryMode as MillOrderTracker["deliveryMode"],
    millInvoiceNo:         r.millInvoiceNo,
    remarks:               r.remarks,
    customerName:          r.customerName,
    soCustomerName:        r.soCustomerName,
    customerId:            r.customerId != null ? String(r.customerId) : undefined,
    millSONumber:          r.millSONumber,
    soDeliveryDate:        r.soDeliveryDate,
    directDeliveryAddress: r.directDeliveryAddress,
    partialDeliveries:     [],
    history:               [],
  };
}

function mapApiItem(item: TruckLoadPlanItemApiDto): TLPItemEx {
  return {
    id:               String(item.id),
    trackerSourceId:  item.trackerId != null ? String(item.trackerId) : undefined,
    poNumber:         item.poNumber         ?? "",
    soNumber:         item.soNumber         ?? undefined,
    paper:            item.paper            ?? "",
    gsm:              item.gsm              ?? 0,
    size:             item.size             ?? "",
    customerName:     item.customerName     ?? undefined,
    deliveryLocation: item.deliveryLocation ?? undefined,
    deliveryAddress:  item.deliveryAddress  ?? undefined,
    quantity:         Number(item.quantity),
    planQty:          item.planQty != null ? Number(item.planQty) : undefined,
    weightKg:         item.weightKg != null ? Number(item.weightKg) : undefined,
    loadOrder:        item.loadOrder,
    loadType:         item.loadType,
    millInvoiceNo:    item.millInvoiceNo    ?? undefined,
    deliveryBillNo:   item.deliveryBillNo   ?? undefined,
  };
}

function mapApiPlan(plan: TruckLoadPlanApiDto): TLPPlanEx {
  const items = plan.items.map(mapApiItem);
  const loads: TLPLoadEx[] = (plan.loads ?? []).map((l) => ({
    id:           l.id,
    loadType:     l.loadType,
    loadSequence: l.loadSequence,
    address:      l.address ?? undefined,
    items:        items.filter((it) => it.loadType === l.loadType),
  }));
  return {
    id:                  String(plan.id),
    planNumber:          plan.planNumber,
    planDate:            plan.planDate,
    truckNumber:         plan.truckNumber         ?? undefined,
    truckType:           plan.truckType           ?? undefined,
    transporterName:     plan.transporterName     ?? undefined,
    driverName:          plan.driverName          ?? undefined,
    driverPhone:         plan.driverPhone         ?? undefined,
    truckCapacityKg:     plan.truckCapacityKg != null ? Number(plan.truckCapacityKg) : undefined,
    freightAmount:       plan.freightAmount   != null ? Number(plan.freightAmount)   : undefined,
    origin:              plan.origin              ?? "",
    deliveryMode:        (plan.deliveryMode as TruckLoadPlan["deliveryMode"]) ?? "Direct To Customer",
    plannedLoadDate:     plan.plannedLoadDate      ?? "",
    actualLoadDate:      plan.actualLoadDate       ?? undefined,
    actualDeliveryDate:  plan.actualDeliveryDate   ?? undefined,
    status:              (plan.status as TruckLoadPlan["status"]) ?? "Planned",
    items,
    loads,
  };
}

// ─── 3-dot Actions Menu ────────────────────────────────────────────────────────

function PlanActionsMenu({ plan, onView, onUpdateStatus, onDelete, onPrint }: {
  plan: TLPPlanEx;
  onView: () => void; onUpdateStatus: () => void; onDelete: () => void; onPrint: () => void;
}) {
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
  const act = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); setOpen(false); };

  return (
    <>
      {open && createPortal(
        <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />,
        document.body
      )}
      <button ref={btnRef} onClick={toggle}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div className="fixed z-30 min-w-[160px] rounded-xl border border-gray-100 bg-white py-1.5 shadow-xl"
          style={{ top: pos.top, right: pos.right }}>
          <button onClick={act(onView)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Eye className="h-3.5 w-3.5 text-gray-400" /> View Details
          </button>
          {plan.status !== "Received" && (
            <button onClick={act(onUpdateStatus)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <RefreshCw className="h-3.5 w-3.5 text-blue-400" /> Update Status
            </button>
          )}
          <button onClick={act(onPrint)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Printer className="h-3.5 w-3.5 text-gray-400" /> Print
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button onClick={act(onDelete)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function TruckLoadPlanPage() {
  const { success, error: showError } = useToast();
  // Company name + address come from Settings — used in the print HTML
  // header so the printed plan reflects the active tenant (Monit Paper
  // Agency vs Monit Paper Associates).
  const { config: tlpCompanyCfg } = useCompanySettings();
  const monitName = tlpCompanyCfg.companyName?.trim() ?? "";
  const monitAddr = tlpCompanyCfg.address?.trim() ?? "";

  // ── API state ──────────────────────────────────────────────────────────────
  const [truckLoadPlans, setTruckLoadPlans] = useState<TLPPlanEx[]>([]);
  const [readyTrackers,  setReadyTrackers]  = useState<MillOrderTracker[]>([]);
  const [transporters,   setTransporters]   = useState<TransporterDropdown[]>([]);
  const [isPageLoading,  setIsPageLoading]  = useState(true);

  // ── Data loading ───────────────────────────────────────────────────────────
  const refreshReadyTrackers = useCallback(async () => {
    const res = await millTrackerApi.list({ pageSize: 500 });
    setReadyTrackers(
      res.items
        // readyQty is already net of dispatchedQty (backend decrements it at
        // dispatch time) — filtering on readyQty - dispatchedQty again could
        // wrongly hide a tracker that still has stock genuinely sitting
        // ready, once its cumulative dispatchedQty grows large enough
        // (client-reported 2026-10-05, same root cause as availableToPlanQty).
        .filter(t => Number(t.readyQty) > 0 &&
                     ["Ready", "Partial Ready", "Partial Dispatched"].includes(t.productionStatus))
        .map(mapTrackerRow)
    );
  }, []);

  const loadData = useCallback(async () => {
    setIsPageLoading(true);
    try {
      // Run each independently so a single endpoint failing doesn't blank
      // the whole page (previously a silent catch made the page look broken
      // on production whenever any of these three endpoints returned an
      // error — the user had no idea why no data was showing).
      const [plansRes, trackersRes, tpRes] = await Promise.allSettled([
        truckLoadPlanApi.list({ pageSize: 200 }),
        millTrackerApi.list({ pageSize: 500 }),
        transporterApi.dropdown(),
      ]);

      const failures: string[] = [];

      if (plansRes.status === "fulfilled") {
        setTruckLoadPlans(plansRes.value.items.map(mapApiPlan));
      } else {
        failures.push(`Truck Load Plans: ${plansRes.reason instanceof Error ? plansRes.reason.message : "load failed"}`);
      }

      if (trackersRes.status === "fulfilled") {
        setReadyTrackers(
          trackersRes.value.items
            // See refreshReadyTrackers above — readyQty is already net of
            // dispatchedQty, don't subtract it again here.
            .filter(t => Number(t.readyQty) > 0 &&
                         ["Ready", "Partial Ready", "Partial Dispatched"].includes(t.productionStatus))
            .map(mapTrackerRow)
        );
      } else {
        failures.push(`Mill Trackers: ${trackersRes.reason instanceof Error ? trackersRes.reason.message : "load failed"}`);
      }

      if (tpRes.status === "fulfilled") {
        setTransporters(tpRes.value);
      } else {
        failures.push(`Transporters: ${tpRes.reason instanceof Error ? tpRes.reason.message : "load failed"}`);
      }

      if (failures.length > 0) {
        showError(failures.join(" · "));
      }
    } finally {
      setIsPageLoading(false);
    }
  }, [showError]);

  useEffect(() => { loadData(); }, [loadData]);

  // Default landing view = Pending Dispatch (per client UAT). Operators
  // open this page primarily to plan new loads, not to review history —
  // so the page lands on pending trackers. The KPI tile still toggles
  // back to the saved-plans grid for review.
  const [showPending,      setShowPending]      = useState(true);
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set());
  const [showPlanModal,    setShowPlanModal]     = useState(false);
  const [showStatusModal,  setShowStatusModal]   = useState(false);
  const [showDetailModal,  setShowDetailModal]   = useState(false);
  const [showTrackerModal, setShowTrackerModal]  = useState(false);
  const [activePlan,       setActivePlan]        = useState<TLPPlanEx | null>(null);
  const [activeTracker,    setActiveTracker]     = useState<TrackerEx | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<TruckLoadPlan["status"] | null>(null);

  // Sum of qty already committed to an OPEN (Planned/Loading — not yet
  // actually dispatched) truck plan, per source tracker. Once a plan is
  // marked Dispatched, the real Dispatch Receipt flow has already adjusted
  // the tracker's own Dispatched/Ready numbers directly (see backend
  // DispatchReceiptRepository), so counting it here too would double-count.
  const plannedElsewhereByTracker = useMemo(() => {
    const map = new Map<string, number>();
    for (const plan of truckLoadPlans) {
      if (plan.status === "Dispatched" || plan.status === "Received") continue;
      for (const item of plan.items) {
        if (!item.trackerSourceId) continue;
        const wt = itemWeight(item);
        map.set(item.trackerSourceId, (map.get(item.trackerSourceId) ?? 0) + wt);
      }
    }
    return map;
  }, [truckLoadPlans]);

  // Client-reported confusion: Ready always showed the mill's full raw
  // produced qty even after part of it was already allocated to another
  // (not-yet-dispatched) truck plan — planning a 2nd truck for the same PO
  // item showed the full qty again instead of what's genuinely left, and
  // nothing told the user how much was already spoken for. Trackers with
  // nothing left to plan drop off the Pending Dispatch list entirely.
  const pendingTrackers: TrackerEx[] = useMemo(() => readyTrackers
    .map((t) => {
      const plannedElsewhereQty = plannedElsewhereByTracker.get(t.id) ?? 0;
      // readyQty is already net of dispatchedQty (see TrackerEx comment
      // above) — do NOT subtract dispatchedQty again here.
      const availableToPlanQty  = Math.max(0, t.readyQty - plannedElsewhereQty);
      return { ...t, availableToPlanQty, plannedElsewhereQty };
    })
    .filter((t) => t.availableToPlanQty > 0),
    [readyTrackers, plannedElsewhereByTracker]);

  const kpis = useMemo(() => ({
    pending:   pendingTrackers.length,
    planned:   truckLoadPlans.filter((t) => t.status === "Planned").length,
    loading:   truckLoadPlans.filter((t) => t.status === "Loading").length,
    inTransit: truckLoadPlans.filter((t) => t.status === "Dispatched").length,
    delivered: truckLoadPlans.filter((t) => t.status === "Received").length,
  }), [truckLoadPlans, pendingTrackers]);

  const filteredPlans = useMemo(() =>
    activeStatusFilter ? truckLoadPlans.filter((t) => t.status === activeStatusFilter) : truckLoadPlans,
    [truckLoadPlans, activeStatusFilter]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleSubmitPlan = async (form: PlanForm) => {
    try {
      const apiPlan = await truckLoadPlanApi.create({
        truckNumber:         form.truckNumber         || undefined,
        truckType:           form.truckType           || undefined,
        transporterName:     form.transporterName     || undefined,
        driverName:          form.driverName          || undefined,
        driverPhone:         form.driverPhone         || undefined,
        truckCapacityKg:     form.truckCapacityKg,
        freightAmount:       form.freightAmount > 0 ? form.freightAmount : undefined,
        origin:              form.origin              || undefined,
        deliveryMode:        form.items.length > 1 ? "Multi-Stop" : "Direct To Customer",
        millInvoiceNo:       form.millInvoiceNo       || undefined,
        deliveryBillNo:      form.deliveryBillNo      || undefined,
        plannedLoadDate:     form.plannedLoadDate,
        loads: [...new Set(form.items.map((it) => it.loadType))]
          .sort((a, b) => TLP_LOAD_TYPES.indexOf(a) - TLP_LOAD_TYPES.indexOf(b))
          .map((lt, i) => ({
            loadType: lt,
            loadSequence: i + 1,
            address: form.loadAddresses[lt]
                      || form.items.find((it) => it.loadType === lt)?.deliveryAddress
                      || undefined,
          })),
        items: form.items.map((it) => ({
          trackerId:        it.trackerId ? parseInt(it.trackerId) : undefined,
          poNumber:         it.poNumber,
          soNumber:         it.soNumber        || undefined,
          paper:            it.paper,
          gsm:              it.gsm,
          size:             it.size,
          customerName:     it.customerName    || undefined,
          mill:             it.mill            || undefined,
          quantity:         it.quantity,
          planQty:          it.quantity,
          weightKg:         it.quantity || undefined,
          loadOrder:        it.loadOrder,
          loadType:         it.loadType,
          deliveryLocation: it.customerName    || undefined,
          deliveryAddress:  form.loadAddresses[it.loadType] || it.deliveryAddress || undefined,
          millInvoiceNo:    form.millInvoiceNo || undefined,
          deliveryBillNo:   form.deliveryBillNo || undefined,
        })),
      });
      const newPlan = mapApiPlan(apiPlan);
      setTruckLoadPlans((prev) => [newPlan, ...prev]);
      // Do NOT strip planned trackers out of readyTrackers here — that
      // unconditionally hid a tracker from Pending Dispatch the instant ANY
      // quantity from it was planned, even a partial amount (root cause of
      // "planned/remaining nahi dikh raha": planning 3000 of 5000 into one
      // truck made the whole row vanish, so the remaining 2000 could never
      // be planned into a second truck). pendingTrackers (derived below
      // from readyTrackers + plannedElsewhereByTracker, which reacts to
      // truckLoadPlans changing right above) already correctly drops a
      // tracker ONLY once its true availableToPlanQty reaches 0 — partial
      // plans now correctly stay visible with the remaining balance.
      success(`Load plan ${newPlan.planNumber} created — ${form.items.length} item${form.items.length !== 1 ? "s" : ""} on ${form.truckNumber}.`);
      setShowPlanModal(false);
      setSelectedIds(new Set());
      setShowPending(false);
    } catch {
      // error surfaced by global middleware
    }
  };

  const handleStatusUpdate = async (patch: Partial<TruckLoadPlan>) => {
    if (!activePlan) return;
    try {
      const apiPlan = await truckLoadPlanApi.updateStatus(parseInt(activePlan.id), {
        status:             patch.status!,
        actualLoadDate:     patch.actualLoadDate,
        actualDeliveryDate: patch.actualDeliveryDate,
      });
      const updated = mapApiPlan(apiPlan);
      setTruckLoadPlans((prev) => prev.map((p) => p.id === activePlan.id ? updated : p));
      if (patch.status === "Dispatched") await refreshReadyTrackers();
      success(`${activePlan.planNumber} → ${patch.status}`);
      setShowStatusModal(false);
      setActivePlan(null);
    } catch {
      // error surfaced by global middleware
    }
  };

  const handleDelete = async (plan: TLPPlanEx) => {
    if (!confirm(`Delete ${plan.planNumber}? This cannot be undone.`)) return;
    try {
      await truckLoadPlanApi.remove(parseInt(plan.id));
      setTruckLoadPlans((prev) => prev.filter((p) => p.id !== plan.id));
      success(`Plan ${plan.planNumber} deleted.`);
    } catch {
      // error surfaced by global middleware
    }
  };

  const handlePrint = (plan: TLPPlanEx) => {
    const { totalWeight, uniquePOs } = planTotals(plan);
    const sortedItems = [...plan.items].sort((a, b) => b.loadOrder - a.loadOrder);

    const esc = (s: string | undefined | null) =>
      (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const field = (label: string, val: string | number | undefined | null) =>
      `<div class="field"><span class="label">${label}</span><span class="val">${esc(String(val ?? "—"))}</span></div>`;

    const itemRows = sortedItems.map((it, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="center mono">${it.loadOrder}</td>
        <td>
          <strong>${esc(it.paper)}</strong><br/>
          <span class="sub">${it.gsm} GSM &middot; ${esc(it.size)}</span>
        </td>
        <td class="mono">${esc(it.poNumber)}${it.soNumber ? `<br/><span class="sub">${esc(it.soNumber)}</span>` : ""}</td>
        <td>${esc(it.customerName)}</td>
        <td>${esc(it.deliveryAddress || it.deliveryLocation)}</td>
        <td class="right">${itemWeight(it).toLocaleString("en-IN")}</td>
        <td>${esc(it.millInvoiceNo)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TLP ${esc(plan.planNumber)}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
    .company { font-size: 15px; font-weight: 700; letter-spacing: .3px; }
    .doc-title { font-size: 13px; font-weight: 700; color: #1a56db; }
    .plan-no { font-size: 11px; color: #555; margin-top: 2px; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; border: 1px solid #1a56db; color: #1a56db; font-size: 10px; font-weight: 600; margin-top: 4px; }
    .section { margin-bottom: 10px; }
    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 6px; }
    .fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px 12px; }
    .fields-2 { grid-template-columns: repeat(2, 1fr); }
    .field { display: flex; flex-direction: column; }
    .label { font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #777; }
    .val { font-size: 10.5px; color: #111; margin-top: 1px; }
    .mono { font-family: 'Courier New', monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
    thead th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #555; font-weight: 700; }
    tbody td { border: 1px solid #e5e7eb; padding: 5px 6px; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f9fafb; }
    .center { text-align: center; }
    .right { text-align: right; }
    .sub { font-size: 9px; color: #666; }
    .totals-row { background: #f3f4f6 !important; font-weight: 700; }
    .summary-box { display: flex; gap: 20px; border: 1px solid #d1d5db; border-radius: 4px; padding: 8px 12px; margin-top: 8px; background: #f9fafb; }
    .sum-item { display: flex; flex-direction: column; }
    .sum-label { font-size: 8.5px; color: #777; text-transform: uppercase; letter-spacing: .5px; }
    .sum-val { font-size: 13px; font-weight: 700; color: #111; }
    .footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; border-top: 1px solid #ddd; padding-top: 10px; }
    .sig-box { text-align: center; }
    .sig-line { border-top: 1px solid #999; margin: 28px 8px 4px; }
    .sig-label { font-size: 9px; color: #666; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company">${esc(monitName || "—")}</div>
      <div style="font-size:9px;color:#666;margin-top:2px;">${esc(monitAddr || "—")}</div>
    </div>
    <div style="text-align:right">
      <div class="doc-title">TRUCK LOAD PLAN</div>
      <div class="plan-no">${esc(plan.planNumber)} &nbsp;&bull;&nbsp; ${esc(plan.planDate)}</div>
      <div class="status-badge">${esc(plan.status)}</div>
    </div>
  </div>

  <!-- Transport info -->
  <div class="section">
    <div class="section-title">Transport Details</div>
    <div class="fields">
      ${field("Truck / Vehicle No", plan.truckNumber)}
      ${field("Vehicle Type", plan.truckType)}
      ${field("Transporter", plan.transporterName)}
      ${field("Driver", plan.driverName)}
      ${field("Driver Phone", plan.driverPhone)}
      ${field("Freight Amount", plan.freightAmount ? "Rs. " + plan.freightAmount.toLocaleString("en-IN") : null)}
      ${field("Origin", plan.origin)}
      ${field("Delivery Mode", plan.deliveryMode)}
      ${field("Planned Load Date", plan.plannedLoadDate)}
      ${plan.actualLoadDate     ? field("Actual Load Date",     plan.actualLoadDate)     : ""}
      ${plan.actualDeliveryDate ? field("Actual Delivery Date", plan.actualDeliveryDate) : ""}
    </div>
  </div>

  <!-- Items -->
  <div class="section">
    <div class="section-title">Load Items &mdash; LIFO Order (Row 1 = loaded first, delivered last)</div>
    <table>
      <thead>
        <tr>
          <th class="center" style="width:28px">#</th>
          <th class="center" style="width:40px">Load #</th>
          <th style="min-width:120px">Material</th>
          <th style="width:100px">PO / SO Number</th>
          <th style="width:100px">Customer</th>
          <th>Delivery Address</th>
          <th class="right" style="width:80px">Weight (kg)</th>
          <th style="width:90px">Mill Invoice</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="totals-row">
          <td colspan="6" class="right" style="font-size:9px;text-transform:uppercase;letter-spacing:.5px;">Total</td>
          <td class="right">${totalWeight.toLocaleString("en-IN")}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Summary -->
  <div class="summary-box">
    <div class="sum-item"><span class="sum-label">Purchase Orders</span><span class="sum-val">${uniquePOs}</span></div>
    <div class="sum-item"><span class="sum-label">Line Items</span><span class="sum-val">${sortedItems.length}</span></div>
    <div class="sum-item"><span class="sum-label">Total Weight</span><span class="sum-val">${totalWeight.toLocaleString("en-IN")} kg</span></div>
    ${plan.truckCapacityKg ? `<div class="sum-item"><span class="sum-label">Truck Capacity</span><span class="sum-val">${plan.truckCapacityKg.toLocaleString("en-IN")} kg</span></div>` : ""}
  </div>

  <!-- Signature -->
  <div class="footer">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Prepared By</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Transporter Signature</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Authorized Signatory</div></div>
  </div>

</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.onload = () => { win.print(); URL.revokeObjectURL(url); };
  };

  // ── Grid columns ───────────────────────────────────────────────────────────

  const columns: ColumnConfig<TruckLoadPlan>[] = useMemo(() => [
    {
      id: "actions", accessorKey: "id", header: "Actions",
      filterType: "none", enableSorting: false, enableHiding: false, size: 60, sticky: "left",
      cell: (info) => {
        const plan = info.row.original as TLPPlanEx;
        return (
          <PlanActionsMenu
            plan={plan}
            onView={() => { setActivePlan(plan); setShowDetailModal(true); }}
            onUpdateStatus={() => { setActivePlan(plan); setShowStatusModal(true); }}
            onDelete={() => handleDelete(plan)}
            onPrint={() => handlePrint(plan)}
          />
        );
      },
    },
    {
      id: "planNumber", accessorKey: "planNumber", header: "Plan #",
      filterType: "text", enableSorting: true, enableHiding: false, size: 130, align: "left" as const,
      cell: (info) => <span className="font-semibold text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "planDate", accessorKey: "planDate", header: "Date",
      filterType: "dateRange", enableSorting: true, size: 110,
    },
    {
      id: "truckNumber", accessorKey: "truckNumber", header: "Truck",
      filterType: "text", enableSorting: false, size: 120, align: "left" as const,
      cell: (info) => {
        const v  = info.getValue() as string | undefined;
        const tt = (info.row.original as TruckLoadPlan).truckType;
        return v
          ? <span className="font-mono text-xs font-semibold">{v}{tt && <span className="ml-1 text-[11px] text-gray-400 font-normal">({tt})</span>}</span>
          : <span className="text-xs text-amber-600">Not set</span>;
      },
    },
    {
      id: "transporterName", accessorKey: "transporterName", header: "Transporter",
      filterType: "text", enableSorting: false, size: 150, align: "left" as const,
      cell: (info) => <span className="text-gray-600 text-sm">{(info.getValue() as string) ?? "—"}</span>,
    },
    {
      id: "origin", accessorKey: "origin", header: "Origin",
      filterType: "text", enableSorting: false, size: 160, align: "left" as const,
      cell: (info) => <span className="text-gray-600 text-xs truncate max-w-[140px] block">{info.getValue() as string}</span>,
    },
    {
      id: "deliveryMode", accessorKey: "deliveryMode", header: "Mode",
      filterType: "select",
      filterOptions: [
        { label: "Direct To Customer", value: "Direct To Customer" },
        { label: "To Godown",          value: "To Godown" },
        { label: "Multi-Stop",         value: "Multi-Stop" },
      ],
      enableSorting: false, size: 110,
      cell: (info) => {
        const m = info.getValue() as string;
        return (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            m === "Direct To Customer" ? "bg-blue-50 text-blue-700"
            : m === "Multi-Stop"       ? "bg-purple-50 text-purple-700"
            : "bg-amber-50 text-amber-700")}>
            {m === "Direct To Customer" ? "Direct" : m === "Multi-Stop" ? "Multi" : "Godown"}
          </span>
        );
      },
    },
    {
      id: "items", accessorKey: "items", header: "POs / Items",
      filterType: "none", enableSorting: false, size: 90,
      cell: (info) => {
        const items = info.getValue() as TruckLoadPlanItem[];
        const pos = new Set(items.map((i) => i.poNumber)).size;
        return (
          <div className="text-xs text-gray-600 tabular-nums">
            <span className="font-semibold">{pos}</span> PO{pos !== 1 ? "s" : ""}
            <span className="text-gray-400"> / {items.length} item{items.length !== 1 ? "s" : ""}</span>
          </div>
        );
      },
    },
    {
      id: "plannedLoadDate", accessorKey: "plannedLoadDate", header: "Load Date",
      filterType: "dateRange", enableSorting: true, size: 110,
    },
    {
      id: "status", accessorKey: "status", header: "Status",
      filterType: "select",
      filterOptions: STATUS_SEQ.map((s) => ({ label: s, value: s })),
      enableSorting: true, size: 120,
      cell: (info) => {
        const s = info.getValue() as string;
        return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[s] ?? "bg-gray-100 text-gray-600")}>{s}</span>;
      },
    },
  ], [truckLoadPlans]);

  // ── KPI cards data ─────────────────────────────────────────────────────────

  const statusKpis = [
    { key: "planned" as const,   label: "Planned" as TruckLoadPlan["status"],    icon: Clock,         iconBg: "bg-blue-50",   iconColor: "text-blue-500",   activeBg: "bg-blue-500",   activeBorder: "border-blue-400",   hover: "hover:border-blue-200" },
    { key: "loading" as const,   label: "Loading" as TruckLoadPlan["status"],    icon: Package,       iconBg: "bg-amber-50",  iconColor: "text-amber-500",  activeBg: "bg-amber-500",  activeBorder: "border-amber-400",  hover: "hover:border-amber-200" },
    { key: "inTransit" as const, label: "Dispatched" as TruckLoadPlan["status"], icon: Truck,         iconBg: "bg-purple-50", iconColor: "text-purple-500", activeBg: "bg-purple-500", activeBorder: "border-purple-400", hover: "hover:border-purple-200" },
    { key: "delivered" as const, label: "Received" as TruckLoadPlan["status"],   icon: CheckCircle2,  iconBg: "bg-green-50",  iconColor: "text-green-500",  activeBg: "bg-green-500",  activeBorder: "border-green-400",  hover: "hover:border-green-200" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4 overflow-hidden">

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <div className="kpi-grid grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5 flex-shrink-0">

        {/* Pending Dispatch KPI */}
        <button
          onClick={() => { setShowPending((v) => !v); if (showPending) setSelectedIds(new Set()); }}
          className={cn(
            "group relative overflow-hidden rounded-2xl border-2 p-2.5 sm:p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]",
            showPending
              ? "border-orange-400 bg-orange-500 shadow-md shadow-orange-200"
              : "border-orange-200 bg-orange-50 hover:border-orange-300"
          )}
        >
          <p className={cn("text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider", showPending ? "text-white/80" : "text-orange-600")}>
            Pending Dispatch
          </p>
          <p className={cn("mt-1 text-xl sm:text-3xl font-black leading-none tabular-nums", showPending ? "text-white" : "text-gray-900")}>{kpis.pending}</p>
          <p className={cn("mt-0.5 text-[9px] sm:text-[11px]", showPending ? "text-white/60" : "text-orange-400")}>
            {showPending ? "Click to hide" : "Click to plan"}
          </p>
          <div className={cn("pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18]", showPending ? "text-white" : "text-orange-500")}>
            <Package className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={1} />
          </div>
        </button>

        {/* Status KPI cards */}
        {statusKpis.map(({ key, label, icon: Icon, iconBg, iconColor, activeBg, activeBorder }) => {
          const isActive = activeStatusFilter === label;
          return (
            <button key={key}
              onClick={() => setActiveStatusFilter(isActive ? null : label)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-2.5 sm:p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]",
                isActive ? `${activeBorder} ${activeBg} shadow-md` : `border-white/80 ${iconBg}`
              )}
            >
              <p className={cn("text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider", isActive ? "text-white/80" : iconColor)}>{label}</p>
              <p className={cn("mt-1 text-xl sm:text-3xl font-black leading-none tabular-nums animate-kpi-value", isActive ? "text-white" : "text-gray-900")}>{kpis[key]}</p>
              <div className={cn("pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18]", isActive ? "text-white" : iconColor)}>
                <Icon className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={1} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Content area — flex-1 so it's the only part of the page that
          scrolls (Pending section natively, Planned Loads grid via its own
          sticky-header scrollMaxHeight below); KPI row above stays fixed. */}
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
      {/* ── Pending Section ────────────────────────────────────────────────── */}
      {showPending && (
        pendingTrackers.length > 0
          ? <PendingPOsSection
              trackers={pendingTrackers}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
              onPlanSelected={() => setShowPlanModal(true)}
              onViewTracker={(t) => { setActiveTracker(t); setShowTrackerModal(true); }}
            />
          : (
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
              <AlertCircle className="h-5 w-5 text-gray-300 flex-shrink-0" />
              <p className="text-sm text-gray-400">No mill orders ready for dispatch. Update status in Mill Order Tracker first.</p>
            </div>
          )
      )}

      {/* ── Planned Loads grid ─────────────────────────────────────────────── */}
      {!showPending && (
        <div className="flex flex-1 min-h-0 flex-col">
          {activeStatusFilter && (
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[activeStatusFilter])}>
                {activeStatusFilter}
              </span>
              <button onClick={() => setActiveStatusFilter(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-gray-400">{filteredPlans.length} plan{filteredPlans.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div className="flex flex-1 min-h-0 flex-col">
          <DataGrid
            data={filteredPlans}
            columns={columns}
            tableName="truck-load-plans"
            enableFilters={true}
            enablePagination={true}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            scrollMaxHeight="100%"
            initialPageSize={10}
            isLoading={isPageLoading}
            onRowClick={(plan) => { setActivePlan(plan as TLPPlanEx); setShowDetailModal(true); }}
            emptyMessage="No load plans yet. Use New Plan to create one."
            toolbarActions={
              <button
                onClick={() => { setShowPending((v) => !v); if (showPending) setSelectedIds(new Set()); }}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Plan</span>
                <span className="sm:hidden">New</span>
              </button>
            }
          />
          </div>
        </div>
      )}
      </div>

      {/* ── Plan Creation Modal ────────────────────────────────────────────── */}
      <Modal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)}
        title="Create Truck Load Plan"
        subtitle={`${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} selected · LIFO load order`}
        size="xl">
        <PlanCreationModal
          trackers={pendingTrackers.filter((t) => selectedIds.has(t.id))}
          transporters={transporters}
          onSubmit={handleSubmitPlan}
          onCancel={() => setShowPlanModal(false)}
        />
      </Modal>

      {/* ── Tracker Detail Modal ───────────────────────────────────────────── */}
      {showTrackerModal && activeTracker && (
        <TrackerDetailModal
          tracker={activeTracker}
          onClose={() => { setShowTrackerModal(false); setActiveTracker(null); }}
        />
      )}

      {/* ── Plan Detail Drill-Down ─────────────────────────────────────────── */}
      <Modal isOpen={showDetailModal && !!activePlan} onClose={() => { setShowDetailModal(false); setActivePlan(null); }}
        title="Load Plan Details" size="xl">
        {activePlan && <PlanDrillDown plan={activePlan} onClose={() => { setShowDetailModal(false); setActivePlan(null); }} />}
      </Modal>

      {/* ── Status Update Modal ────────────────────────────────────────────── */}
      <Modal isOpen={showStatusModal && !!activePlan} onClose={() => { setShowStatusModal(false); setActivePlan(null); }}
        title={`Update Status — ${activePlan?.planNumber ?? ""}`} size="sm">
        {activePlan && (
          <StatusUpdateModal plan={activePlan}
            onClose={() => { setShowStatusModal(false); setActivePlan(null); }}
            onSave={handleStatusUpdate} />
        )}
      </Modal>
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="logistics.read"><TruckLoadPlanPage /></PermGuard>;
}
