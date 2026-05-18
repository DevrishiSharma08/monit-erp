"use client";

import { useMemo, useState, useRef } from "react";
import { MillOrderTracker, TruckLoadPlan } from "@/data/mockData";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
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

const ACCENT_COLORS: Record<string, string> = {
  "In Production": "bg-blue-400",
  "Partial Ready": "bg-amber-400",
  "Ready":         "bg-green-400",
  "Dispatched":    "bg-cyan-400",
  "Delayed":       "bg-red-400",
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

// ─── Simulated Excel preview rows ────────────────────────────────────────────
const MOCK_PREVIEW_ROWS = [
  { poNumber: "PO-2024-001", spec: "FBB 300 GSM 23x36", readyQty: 9000, status: "In Production", remarks: "Expected Feb 10" },
  { poNumber: "PO-2024-003", spec: "FBB 300 GSM 23x36", readyQty: 20000, status: "Ready",         remarks: "Full batch ready" },
  { poNumber: "PO-2024-007", spec: "WB 250 GSM 22x36",  readyQty: 0,     status: "Order Placed",  remarks: "Start Feb 5" },
  { poNumber: "PO-2024-999", spec: "Grey 200 GSM 24x36",readyQty: 5000,  status: "Partial Ready", remarks: "" },
  { poNumber: "PO-2024-006", spec: "FBB 300 GSM 23x36", readyQty: 3500,  status: "Partial Ready", remarks: "45% done" },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MillTrackerPage() {
  const { millTrackers, updateMillTracker, addTruckLoadPlan } = usePurchaseOrder();
  const { success } = useToast();

  // View state
  const [activeTab, setActiveTab]                 = useState<"customer" | "mill" | "po">("customer");
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedMills, setExpandedMills]         = useState<Set<string>>(new Set());

  // Toolbar state
  const [searchQuery, setSearchQuery]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilters, setShowFilters]   = useState(false);
  const [showImpExp, setShowImpExp]     = useState(false);

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
    if (filterStatus && t.productionStatus !== filterStatus) return false;
    return true;
  }), [millTrackers, searchQuery, filterStatus]);

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
      <div className="flex items-center justify-center w-10">
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
    { id: "poNumber",    accessorKey: "poNumber",    header: "PO Number", filterType: "text",   enableSorting: true, enableHiding: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-mono font-medium text-gray-900">{info.getValue() as string}</span> },
    { id: "customerName",accessorKey: "customerName",header: "Customer",  filterType: "text",   enableSorting: true, defaultVisible: true, size: 160,
      cell: (info) => info.getValue() ? <span className="font-medium text-blue-700">{info.getValue() as string}</span> : <span className="text-xs text-gray-400">Stock PO</span> },
    { id: "mill",        accessorKey: "mill",        header: "Mill",      filterType: "text",   enableSorting: true, defaultVisible: true, size: 150 },
    { id: "paper",       accessorKey: "paper",       header: "Paper",     filterType: "text",   enableSorting: true, defaultVisible: true, size: 150 },
    { id: "specification",accessorKey: "gsm",        header: "Spec",      filterType: "none",   enableSorting: false,defaultVisible: true, size: 100,
      cell: (info) => { const t = info.row.original; return <div className="text-xs"><div className="font-medium">{t.gsm} GSM</div><div className="text-gray-500">{t.size}</div></div>; } },
    { id: "orderedQty",  accessorKey: "orderedQty",  header: "Ordered",   filterType: "none",   enableSorting: true, defaultVisible: true, size: 85,
      cell: (info) => <span className="font-medium">{(info.getValue() as number).toLocaleString()}</span> },
    { id: "readyQty",    accessorKey: "readyQty",    header: "Ready",     filterType: "none",   enableSorting: true, defaultVisible: true, size: 85,
      cell: (info) => { const v = info.getValue() as number; return <span className={v > 0 ? "font-medium text-green-600" : "text-gray-400"}>{v.toLocaleString()}</span>; } },
    { id: "dispatchedQty",accessorKey: "dispatchedQty",header: "Dispatched",filterType:"none",  enableSorting: true, defaultVisible: true, size: 85,
      cell: (info) => { const v = info.getValue() as number; return v > 0 ? <span className="font-medium text-blue-600">{v.toLocaleString()}</span> : <span className="text-gray-400">—</span>; } },
    { id: "balanceQty",  accessorKey: "balanceQty",  header: "Balance",   filterType: "none",   enableSorting: true, defaultVisible: true, size: 85,
      cell: (info) => { const v = info.getValue() as number; return <span className={v > 0 ? "font-medium text-orange-600" : "font-medium text-green-600"}>{v.toLocaleString()}</span>; } },
    { id: "productionProgress",accessorKey:"productionProgress",header:"Progress",filterType:"none",enableSorting:true,defaultVisible:true,size:120,
      cell: (info) => { const p = info.getValue() as number; const c = p>=90?"bg-green-500":p>=50?"bg-blue-500":p>=25?"bg-amber-500":"bg-orange-400";
        return <div className="flex items-center gap-1.5"><div className="h-1.5 flex-1 rounded-full bg-gray-200"><div className={`h-full rounded-full ${c}`} style={{width:`${Math.min(p,100)}%`}}/></div><span className="text-xs w-7 text-right text-gray-600">{p}%</span></div>; } },
    { id: "productionStatus",accessorKey:"productionStatus",header:"Status",filterType:"select",filterOptions:productionStatusOptions,enableSorting:true,defaultVisible:true,size:130,
      cell: (info) => { const s = info.getValue() as string; return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s]||"bg-gray-100 text-gray-600"}`}>{s}</span>; } },
    { id: "actions", accessorKey: "id", header: "Actions", filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 52,
      cell: (info) => <ThreeDotsMenu tracker={info.row.original}/> },
  ], [productionStatusOptions]);

  // ── Compact PO row — single line, used in both Client + Mill tree views ──────
  // Keeps large lists (500+ rows) scannable; batch details accessible via Detail modal.
  function TrackerPORow({ tracker }: { tracker: MillOrderTracker }) {
    const batches    = tracker.partialDeliveries || [];
    const dispatched = batches.reduce((s, b) => s + b.qty, 0) || tracker.dispatchedQty;
    const accentColor = ACCENT_COLORS[tracker.productionStatus] ?? "bg-gray-300";
    const paperName   = tracker.paper.split("/").slice(-1)[0] || tracker.paper;

    return (
      <div
        className="grid items-center border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors pr-4"
        style={{ gridTemplateColumns: "3px 1fr auto" }}
        onClick={() => openDetail(tracker)}
      >
        <div className={`self-stretch ${accentColor}`}/>

        <div className="flex min-w-0 items-center gap-2 py-1.5 pl-7 pr-2">
          <span className="shrink-0 font-mono text-xs font-semibold text-gray-800">{tracker.poNumber}</span>
          <span className={`shrink-0 inline-flex rounded-full px-1.5 text-[11px] font-medium ${statusColors[tracker.productionStatus]}`}>
            {tracker.productionStatus}
          </span>
          <span className="truncate text-xs text-gray-500">
            {paperName} · {tracker.gsm} GSM · {tracker.size}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-gray-400">ETA {tracker.expectedDelivery}</span>
          {batches.length > 0 && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700">
              {batches.length}b
            </span>
          )}
          {(tracker.delayDays ?? 0) > 0 && (
            <span className="shrink-0 text-[10px] font-medium text-red-600">+{tracker.delayDays}d</span>
          )}
        </div>

        <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex text-xs font-medium tabular-nums">
            <span className="w-20 py-1.5 text-right text-gray-900">{tracker.orderedQty.toLocaleString()}</span>
            <span className="w-20 py-1.5 text-right text-green-600">{tracker.readyQty.toLocaleString()}</span>
            <span className="w-20 py-1.5 text-right text-blue-600">{dispatched > 0 ? dispatched.toLocaleString() : "—"}</span>
            <span className="w-20 py-1.5 text-right text-orange-600">{tracker.balanceQty.toLocaleString()}</span>
          </div>
          <ThreeDotsMenu tracker={tracker}/>
        </div>
      </div>
    );
  }

  // ── Tree column header ─────────────────────────────────────────────────────
  function TreeHeader({ label }: { label: string }) {
    return (
      <div className="grid border-b border-gray-200 bg-gray-50 px-4 py-2" style={{ gridTemplateColumns: "3px 1fr auto" }}>
        <div/>
        <span className="pl-9 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <div className="flex shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          <span className="w-20 text-right">Ordered</span>
          <span className="w-20 text-right">Ready</span>
          <span className="w-20 text-right">Dispatched</span>
          <span className="w-20 text-right">Balance</span>
          <span className="w-10 text-center">·</span>
        </div>
      </div>
    );
  }

  const activeFilterCount = (filterStatus ? 1 : 0) + (searchQuery ? 1 : 0);

  // ─────────────────────────────────────────────────────────────────────────────
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

      {/* ── Compact Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">

        {/* Search — grows to fill */}
        <div className="flex flex-1 min-w-0 items-center gap-1.5">
          <Search className="h-4 w-4 text-gray-400 shrink-0"/>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO, customer, mill, paper…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5"/></button>}
        </div>

        <div className="h-5 w-px bg-gray-200 shrink-0"/>

        {/* View switcher */}
        <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 shrink-0">
          {([
            { id: "customer", Icon: Users,   label: "Client" },
            { id: "mill",     Icon: Factory, label: "Mill"   },
            { id: "po",       Icon: List,    label: "PO"     },
          ] as const).map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${activeTab===id?"bg-white text-blue-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
              <Icon className="h-3.5 w-3.5"/><span>{label}</span>
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200 shrink-0"/>

        {/* ── Right-side controls ──────────────────────────────── */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Column selector — PO view only */}
          {activeTab === "po" && (
            <div className="relative">
              <button onClick={() => setShowColumnPanel((v) => !v)}
                className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${showColumnPanel?"bg-blue-50 text-blue-700":"text-gray-500 hover:bg-gray-100"}`}>
                <Eye className="h-3.5 w-3.5"/>
                <span className="hidden sm:inline">Columns</span>
                {Object.values(poColumnVis).filter((v) => v === false).length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-500 text-[9px] font-bold text-white">
                    {Object.values(poColumnVis).filter((v) => v === false).length}
                  </span>
                )}
              </button>
              {showColumnPanel && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowColumnPanel(false)}/>
                  <div className="absolute right-0 top-full mt-1 z-30 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                      <span className="text-xs font-semibold text-gray-600">Toggle Columns</span>
                      <button onClick={() => setPoColumnVis({})} className="text-[11px] text-blue-600 hover:underline">Show all</button>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {columns.filter((c) => c.enableHiding !== false).map((col) => (
                        <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={poColumnVis[col.id] !== false}
                            onChange={(e) => setPoColumnVis((prev) => ({ ...prev, [col.id]: e.target.checked }))}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500"
                          />
                          <span className="flex-1 text-gray-700">{col.header}</span>
                          {poColumnVis[col.id] === false
                            ? <EyeOff className="h-3 w-3 text-gray-300"/>
                            : <Eye    className="h-3 w-3 text-blue-400"/>}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Filter */}
          <button onClick={() => setShowFilters((v) => !v)}
            className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${showFilters||filterStatus?"bg-blue-50 text-blue-700":"text-gray-500 hover:bg-gray-100"}`}>
            <Filter className="h-3.5 w-3.5"/>
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{activeFilterCount}</span>
            )}
          </button>

          {/* Import/Export */}
          <div className="relative">
            <button onClick={() => setShowImpExp((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
              <FileSpreadsheet className="h-3.5 w-3.5"/>
              <ChevronDown className="h-3 w-3 text-gray-400"/>
            </button>
            {showImpExp && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowImpExp(false)}/>
                <div className="absolute right-0 top-full mt-1 z-30 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <button onClick={() => setShowImpExp(false)}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                    <Download className="h-4 w-4 text-gray-400 shrink-0"/>
                    <div className="text-left"><p className="text-xs font-medium">Download Template</p><p className="text-[11px] text-gray-400">Excel format for mill updates</p></div>
                  </button>
                  <div className="border-t border-gray-100"/>
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
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
          <span className="text-xs font-semibold text-blue-700">Filter:</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none shadow-sm">
            <option value="">All Statuses</option>
            {["Order Placed","In Production","Partial Ready","Ready","Dispatched","Delayed","Cancelled"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {filteredTrackers.length !== millTrackers.length && (
            <span className="text-xs font-medium text-blue-600">{filteredTrackers.length} of {millTrackers.length} orders</span>
          )}
          {(filterStatus || searchQuery) && (
            <button onClick={() => { setFilterStatus(""); setSearchQuery(""); }}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
              Clear All
            </button>
          )}
        </div>
      )}

      {/* ── CLIENT VIEW ─────────────────────────────────────────────────── */}
      {activeTab === "customer" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <TreeHeader label="Client / Mill / PO"/>
          {customerGroups.length === 0
            ? <div className="py-10 text-center text-sm text-gray-400">No orders match your search</div>
            : customerGroups.map((cg) => {
              const isOpen = expandedCustomers.has(cg.key);
              const dispPct = cg.totalOrdered > 0 ? Math.round((cg.totalDispatched / cg.totalOrdered) * 100) : 0;
              return (
                <div key={cg.key} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => toggleCustomer(cg.key)}
                    className={`w-full grid items-center px-4 py-3 text-left transition-colors ${isOpen?"bg-blue-50 hover:bg-blue-100":"hover:bg-gray-50"}`}
                    style={{ gridTemplateColumns: "3px 1fr auto" }}>
                    <div className="self-stretch rounded-full bg-blue-300"/>
                    <div className="flex items-center gap-2 pl-1 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-blue-500 shrink-0"/> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0"/>}
                      <div className="min-w-0">
                        <span className={`text-sm font-semibold ${isOpen?"text-blue-800":"text-gray-900"}`}>
                          {cg.key==="__stock__" ? "📦 Stock POs" : `👤 ${cg.customerName}`}
                        </span>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">{cg.poCount} PO{cg.poCount!==1?"s":""}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">{cg.mills.length} Mill{cg.mills.length!==1?"s":""}</span>
                          {dispPct > 0 && <span className="font-medium text-green-600">{dispPct}% dispatched</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 text-xs font-medium tabular-nums">
                      <span className="w-20 text-right text-gray-900">{cg.totalOrdered.toLocaleString()}</span>
                      <span className="w-20 text-right text-green-600">{cg.totalReady.toLocaleString()}</span>
                      <span className="w-20 text-right text-blue-600">{cg.totalDispatched.toLocaleString()}</span>
                      <span className="w-20 text-right text-orange-600">{cg.totalBalance.toLocaleString()}</span>
                      <span className="w-10"/>
                    </div>
                  </button>

                  {isOpen && cg.mills.map((mg) => (
                    <div key={mg.millName} className="border-t border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-100/60 px-8 py-1.5">
                        <Factory className="h-3.5 w-3.5 text-gray-500 shrink-0"/>
                        <span className="text-xs font-semibold text-gray-700">{mg.millName}</span>
                        <span className="text-xs text-gray-500">· {mg.trackers.length} PO{mg.trackers.length!==1?"s":""}</span>
                      </div>
                      {mg.trackers.map((t) => <TrackerPORow key={t.id} tracker={t}/>)}
                    </div>
                  ))}
                </div>
              );
            })}
        </div>
      )}

      {/* ── MILL VIEW ───────────────────────────────────────────────────── */}
      {activeTab === "mill" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <TreeHeader label="Mill / PO"/>
          {millViewGroups.length === 0
            ? <div className="py-10 text-center text-sm text-gray-400">No orders match your search</div>
            : millViewGroups.map((mg) => {
              const isOpen    = expandedMills.has(mg.millName);
              const readyPct  = mg.totalOrdered > 0 ? Math.round((mg.totalReady      / mg.totalOrdered) * 100) : 0;
              const dispPct   = mg.totalOrdered > 0 ? Math.round((mg.totalDispatched / mg.totalOrdered) * 100) : 0;
              return (
                <div key={mg.millName} className="border-b border-gray-100 last:border-0">
                  <button onClick={() => toggleMill(mg.millName)}
                    className={`w-full grid items-center px-4 py-3 text-left transition-colors ${isOpen?"bg-indigo-50 hover:bg-indigo-100":"hover:bg-gray-50"}`}
                    style={{ gridTemplateColumns: "3px 1fr auto" }}>
                    <div className="self-stretch rounded-full bg-indigo-300"/>
                    <div className="flex items-center gap-2 pl-1 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-indigo-500 shrink-0"/> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0"/>}
                      <Factory className="h-4 w-4 text-indigo-500 shrink-0"/>
                      <div className="min-w-0">
                        <span className={`text-sm font-semibold ${isOpen?"text-indigo-800":"text-gray-900"}`}>{mg.millName}</span>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">{mg.poCount} PO{mg.poCount!==1?"s":""}</span>
                          {readyPct > 0 && <span className="font-medium text-green-600">{readyPct}% ready</span>}
                          {dispPct  > 0 && <span className="font-medium text-cyan-600">{dispPct}% dispatched</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 text-xs font-medium tabular-nums">
                      <span className="w-20 text-right text-gray-900">{mg.totalOrdered.toLocaleString()}</span>
                      <span className="w-20 text-right text-green-600">{mg.totalReady.toLocaleString()}</span>
                      <span className="w-20 text-right text-blue-600">{mg.totalDispatched.toLocaleString()}</span>
                      <span className="w-20 text-right text-orange-600">{mg.totalBalance.toLocaleString()}</span>
                      <span className="w-10"/>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/30">
                      {mg.trackers.map((t) => <TrackerPORow key={t.id} tracker={t}/>)}
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
          initialPageSize={15}
          emptyMessage="No mill orders match your search."
        />
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {showUpdateModal && editingTracker && (
        <UpdateStatusModal
          tracker={editingTracker}
          onClose={() => { setShowUpdateModal(false); setEditingTracker(undefined); }}
          onSave={(data) => {
            const readyQty = data.readyQty ?? editingTracker.readyQty;
            updateMillTracker(editingTracker.id, {
              ...data,
              productionProgress: Math.round((readyQty / editingTracker.orderedQty) * 100),
              lastUpdate: new Date().toISOString().split("T")[0],
            });
            if (data.productionStatus === "Dispatched") {
              const batches      = data.partialDeliveries ?? editingTracker.partialDeliveries ?? [];
              const latestBatch  = batches.slice(-1)[0];
              const dispatchQty  = batches.reduce((s, b) => s + b.qty, 0) || readyQty;
              const today        = new Date().toISOString().split("T")[0];
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
                status: "In Transit",
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
          onUpload={(file) => { console.log("Upload file:", file.name); setShowBulkUploadModal(false); }}
        />
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({
  tracker,
  onClose,
  onAddBatch,
}: {
  tracker: MillOrderTracker;
  onClose: () => void;
  onAddBatch: () => void;
}) {
  const batches = tracker.partialDeliveries || [];
  const readyPct      = tracker.orderedQty > 0 ? Math.round((tracker.readyQty      / tracker.orderedQty) * 100) : 0;
  const dispatchedPct = tracker.orderedQty > 0 ? Math.round((tracker.dispatchedQty / tracker.orderedQty) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{tracker.poNumber}</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              {tracker.customerName && <span className="font-medium text-blue-700">👤 {tracker.customerName}</span>}
              <span>🏭 {tracker.mill}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[tracker.productionStatus]}`}>{tracker.productionStatus}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Material + Qty section */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Material & Quantities</p>
            <div className="text-sm font-medium text-gray-900 mb-3">{tracker.paper} · {tracker.gsm} GSM · {tracker.size}</div>

            {/* Stacked progress bar */}
            <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden flex mb-2">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${dispatchedPct}%` }} title={`Dispatched: ${dispatchedPct}%`} />
              <div className="h-full bg-green-400 transition-all" style={{ width: `${Math.max(0, readyPct - dispatchedPct)}%` }} title={`Ready (not dispatched): ${readyPct - dispatchedPct}%`} />
            </div>
            <div className="flex gap-4 text-xs text-gray-500 mb-4">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" />Dispatched {dispatchedPct}%</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-400" />Ready {readyPct}%</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-gray-200" />Pending {100 - readyPct}%</span>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Ordered",    value: tracker.orderedQty,    color: "text-gray-900" },
                { label: "Ready",      value: tracker.readyQty,      color: "text-green-600" },
                { label: "Dispatched", value: tracker.dispatchedQty, color: "text-blue-600" },
                { label: "Balance",    value: tracker.balanceQty,    color: "text-orange-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">sheets</p>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Batches */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Delivery Batches</p>
              {tracker.readyQty > tracker.dispatchedQty && (
                <button onClick={onAddBatch} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add New Batch
                </button>
              )}
            </div>

            {batches.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-400">
                No delivery batches recorded yet
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Batch", "Date", "Qty (sheets)", "Truck No", "Mill Invoice", "Remarks"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {batches.map((b) => (
                      <tr key={b.id} className="bg-white">
                        <td className="px-4 py-2.5 font-medium text-amber-700">#{b.batchNo}</td>
                        <td className="px-4 py-2.5 text-gray-700">{b.date}</td>
                        <td className="px-4 py-2.5 font-semibold text-blue-700">{b.qty.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-700">{b.truckNumber || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-600">{b.millInvoiceNo || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{b.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-500">Total Dispatched</td>
                      <td className="px-4 py-2 font-bold text-blue-700">{batches.reduce((s, b) => s + b.qty, 0).toLocaleString()}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Info footer */}
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
            <div><span className="font-medium text-gray-700">Expected Delivery:</span> {tracker.expectedDelivery}</div>
            {tracker.actualDispatchDate && <div><span className="font-medium text-gray-700">Actual Dispatch:</span> {tracker.actualDispatchDate}</div>}
            <div><span className="font-medium text-gray-700">Last Updated:</span> {tracker.lastUpdate} by {tracker.lastUpdatedBy}</div>
            {tracker.deliveryMode && <div><span className="font-medium text-gray-700">Mode:</span> {tracker.deliveryMode}</div>}
            {tracker.millInvoiceNo && <div><span className="font-medium text-gray-700">Mill Invoice:</span> {tracker.millInvoiceNo}</div>}
            {tracker.remarks && <div className="col-span-3"><span className="font-medium text-gray-700">Remarks:</span> {tracker.remarks}</div>}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Update Status Modal (with Partial Delivery section) ──────────────────────
function UpdateStatusModal({
  tracker,
  onClose,
  onSave,
}: {
  tracker: MillOrderTracker;
  onClose: () => void;
  onSave: (data: Partial<MillOrderTracker>) => void;
}) {
  const [formData, setFormData] = useState({
    productionStatus:  tracker.productionStatus,
    readyQty:          tracker.readyQty,
    dispatchedQty:     tracker.dispatchedQty,
    balanceQty:        tracker.balanceQty,
    expectedDelivery:  tracker.expectedDelivery,
    actualDispatchDate: tracker.actualDispatchDate || "",
    partialDeliveries: tracker.partialDeliveries ?? [],
    remarks:           "",
    lastUpdatedBy:     "Mill Team",
  });

  // New batch form — use formData.partialDeliveries so it updates reactively after batch saves
  const existingBatches = formData.partialDeliveries;
  const alreadyDispatched = existingBatches.reduce((s, b) => s + b.qty, 0);
  const maxBatchQty = formData.readyQty - alreadyDispatched;

  const [showBatchForm, setShowBatchForm] = useState(false);
  const [newBatch, setNewBatch] = useState({
    date: new Date().toISOString().split("T")[0],
    qty: 0,
    truckNumber: "",
    millInvoiceNo: "",
    remarks: "",
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Update Production Status</h2>
            <p className="mt-0.5 text-sm text-gray-500">{tracker.poNumber} · {tracker.mill} · {tracker.gsm} GSM {tracker.size}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Production Status <span className="text-red-500">*</span></label>
              <select
                value={formData.productionStatus}
                onChange={(e) => setFormData({ ...formData, productionStatus: e.target.value as MillOrderTracker["productionStatus"] })}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              >
                {["Order Placed","In Production","Partial Ready","Ready","Dispatched","Delayed"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ready Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={formData.readyQty}
                onChange={(e) => setFormData({ ...formData, readyQty: parseInt(e.target.value) || 0 })}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                min="0" max={tracker.orderedQty} required
              />
              <p className="mt-1 text-xs text-gray-500">Max: {tracker.orderedQty.toLocaleString()} sheets</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Expected Dispatch Date</label>
              <input type="date" value={formData.expectedDelivery} onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Last Updated By</label>
              <input type="text" value={formData.lastUpdatedBy} onChange={(e) => setFormData({ ...formData, lastUpdatedBy: e.target.value })} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Name of person updating" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Remarks</label>
              <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" rows={2} placeholder="Production updates, quality notes, delay reasons..." />
            </div>
          </div>

          {/* ── Partial Delivery Section ── */}
          <div className="rounded-xl border border-orange-200 bg-orange-50/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-800">Partial Delivery Batches</span>
              </div>
              {maxBatchQty > 0 && (
                <button type="button" onClick={() => setShowBatchForm(!showBatchForm)} className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> {showBatchForm ? "Cancel" : "Add Batch"}
                </button>
              )}
            </div>

            <div className="px-4 py-3 space-y-2">
              {/* Existing batches */}
              {existingBatches.length === 0 && !showBatchForm && (
                <p className="text-xs text-gray-500 py-1">No delivery batches yet. {maxBatchQty > 0 ? "Click 'Add Batch' to record a partial delivery." : "No ready qty available for dispatch."}</p>
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

              {/* New batch form */}
              {showBatchForm && (
                <div className="rounded-lg border border-orange-200 bg-white p-3 space-y-3">
                  <p className="text-xs font-semibold text-orange-700">New Delivery Batch (max {maxBatchQty.toLocaleString()} sht)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dispatch Date <span className="text-red-500">*</span></label>
                      <input type="date" value={newBatch.date} onChange={(e) => setNewBatch({ ...newBatch, date: e.target.value })} className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantity (sheets) <span className="text-red-500">*</span></label>
                      <input type="number" value={newBatch.qty || ""} onChange={(e) => setNewBatch({ ...newBatch, qty: Math.min(parseInt(e.target.value) || 0, maxBatchQty) })} className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none" min="1" max={maxBatchQty} placeholder={`Max ${maxBatchQty}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Truck Number</label>
                      <input type="text" value={newBatch.truckNumber} onChange={(e) => setNewBatch({ ...newBatch, truckNumber: e.target.value.toUpperCase() })} className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm font-mono focus:border-orange-400 focus:outline-none" placeholder="MH04AB1234" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Mill Invoice No</label>
                      <input type="text" value={newBatch.millInvoiceNo} onChange={(e) => setNewBatch({ ...newBatch, millInvoiceNo: e.target.value })} className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none" placeholder="MI-2024-003" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                      <input type="text" value={newBatch.remarks} onChange={(e) => setNewBatch({ ...newBatch, remarks: e.target.value })} className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none" placeholder="Notes about this delivery..." />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setShowBatchForm(false)} className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button
                      type="button"
                      disabled={newBatch.qty <= 0}
                      onClick={() => {
                        const batch = { id: `b_${Date.now()}`, batchNo: formData.partialDeliveries.length + 1, ...newBatch };
                        const updatedBatches = [...formData.partialDeliveries, batch];
                        const totalDispatched = updatedBatches.reduce((s, b) => s + b.qty, 0);
                        setFormData((prev) => ({
                          ...prev,
                          partialDeliveries: updatedBatches,
                          dispatchedQty: totalDispatched,
                          balanceQty: Math.max(0, tracker.orderedQty - totalDispatched),
                          productionStatus: totalDispatched >= prev.readyQty ? "Dispatched" : prev.productionStatus,
                        }));
                        setNewBatch({ date: new Date().toISOString().split("T")[0], qty: 0, truckNumber: "", millInvoiceNo: "", remarks: "" });
                        setShowBatchForm(false);
                      }}
                      className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600"
                    >
                      Save Batch
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors">Save Update</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── History Modal ─────────────────────────────────────────────────────────────
function HistoryModal({ tracker, onClose }: { tracker: MillOrderTracker; onClose: () => void }) {
  const history = tracker.history || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Production History</h2>
            <p className="mt-0.5 text-sm text-gray-500">{tracker.poNumber} · {tracker.mill}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-96 overflow-y-auto p-6">
          {history.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <History className="mx-auto h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm">No history available for this PO</p>
            </div>
          ) : (
            <div className="relative space-y-4 pl-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {history.map((log) => (
                <div key={log.id} className="relative pl-5">
                  <div className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full border-2 border-blue-400 bg-white" />
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.action}</p>
                        {log.oldStatus && log.newStatus && (
                          <p className="mt-1 text-xs text-gray-600">Status: <span className="font-medium">{log.oldStatus}</span> → <span className="font-medium text-blue-600">{log.newStatus}</span></p>
                        )}
                        {log.oldQty !== undefined && log.newQty !== undefined && (
                          <p className="mt-1 text-xs text-gray-600">Qty: <span className="font-medium">{log.oldQty.toLocaleString()}</span> → <span className="font-medium text-green-600">{log.newQty.toLocaleString()}</span></p>
                        )}
                        {log.remarks && <p className="mt-1 text-xs text-gray-400 italic">{log.remarks}</p>}
                      </div>
                      <div className="text-right text-xs text-gray-500 shrink-0 ml-3">
                        <p>{log.date}</p>
                        <p className="mt-0.5 font-medium">{log.user}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Upload Modal (2-stage with auto-detect) ─────────────────────────────
function BulkUploadModal({ existingPONumbers, onClose, onUpload }: { existingPONumbers: string[]; onClose: () => void; onUpload: (file: File) => void }) {
  const [stage, setStage]             = useState<"upload" | "detecting" | "preview">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<"po" | "millcode">("po");
  const [dragActive, setDragActive]   = useState(false);

  const existingPOs = new Set(existingPONumbers);

  const getMatchStatus = (poNumber: string) => {
    if (existingPOs.has(poNumber)) return "matched";
    // Fuzzy: check if any existing PO starts similarly
    const similar = [...existingPOs].some((p) => p.startsWith(poNumber.slice(0, 8)));
    return similar ? "fuzzy" : "unmatched";
  };

  const matchedCount   = MOCK_PREVIEW_ROWS.filter((r) => getMatchStatus(r.poNumber) === "matched").length;
  const unmatchedCount = MOCK_PREVIEW_ROWS.filter((r) => getMatchStatus(r.poNumber) === "unmatched").length;

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setStage("detecting");
    // Simulate detection (500ms)
    setTimeout(() => {
      // If file name contains "po" or excel header likely has PO column → PO format
      setDetectedFormat(file.name.toLowerCase().includes("code") ? "millcode" : "po");
      setStage("preview");
    }, 600);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Upload Mill Readiness</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {stage === "upload" ? "Select Excel file from mill" : stage === "detecting" ? "Analysing file format…" : `Preview — ${selectedFile?.name}`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6">
          {/* Stage 1: Upload */}
          {stage === "upload" && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-300"}`}
              >
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">Drag & drop Excel file here</p>
                <p className="text-xs text-gray-500 mt-1 mb-4">or</p>
                <label className="cursor-pointer rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors">
                  Browse File
                  <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
                </label>
                <p className="mt-3 text-xs text-gray-400">Supported: .xlsx · .xls · .csv</p>
              </div>

              {/* Format hints */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { title: "Format A — PO Number Based", items: ["Column A: PO Number (e.g. PO-2024-001)", "Column B: Item Specification", "Column C: Ready Qty", "Column D: Status", "Column E: Expected Date", "Column F: Remarks"] },
                  { title: "Format B — Mill Code Based", items: ["Column A: Mill Item Code", "Column B: Item Description", "Column C: Ready Qty", "Column D: Status", "Column E: Expected Date", "Column F: PO Number (optional)"] },
                ].map(({ title, items }) => (
                  <div key={title} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{title}</p>
                    <ul className="space-y-1">
                      {items.map((item) => <li key={item} className="text-xs text-gray-500">• {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage: Detecting */}
          {stage === "detecting" && (
            <div className="py-16 text-center">
              <div className="mx-auto h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-700">Analysing file format…</p>
              <p className="text-xs text-gray-500 mt-1">{selectedFile?.name}</p>
            </div>
          )}

          {/* Stage 2: Preview */}
          {stage === "preview" && (
            <div className="space-y-4">
              {/* Format detected badge */}
              <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${detectedFormat === "po" ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                {detectedFormat === "po"
                  ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  : <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />}
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${detectedFormat === "po" ? "text-green-800" : "text-amber-800"}`}>
                    {detectedFormat === "po" ? "PO-based format detected ✓" : "Mill-code format detected"}
                  </p>
                  {detectedFormat === "millcode" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-amber-700">Map PO column:</span>
                      <select className="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs text-gray-700">
                        <option>Column F (PO Number)</option>
                        <option>Column A (Item Code → auto-map)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 text-xs shrink-0">
                  <span className="flex items-center gap-1 text-green-700"><span className="h-2.5 w-2.5 rounded-full bg-green-400 inline-block" />{matchedCount} matched</span>
                  <span className="flex items-center gap-1 text-red-600"><span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" />{unmatchedCount} unmatched</span>
                </div>
              </div>

              {/* Preview table */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-6"></th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">PO Number</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Specification</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Ready Qty</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Status</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Remarks</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MOCK_PREVIEW_ROWS.map((row) => {
                        const match = getMatchStatus(row.poNumber);
                        const rowBg = match === "matched" ? "bg-green-50" : match === "fuzzy" ? "bg-amber-50" : "bg-red-50";
                        const dotColor = match === "matched" ? "bg-green-500" : match === "fuzzy" ? "bg-amber-500" : "bg-red-500";
                        return (
                          <tr key={row.poNumber} className={rowBg}>
                            <td className="px-3 py-2.5"><div className={`h-2 w-2 rounded-full ${dotColor}`} /></td>
                            <td className="px-3 py-2.5 font-mono font-medium text-gray-800">{row.poNumber}</td>
                            <td className="px-3 py-2.5 text-gray-600">{row.spec}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-900">{row.readyQty.toLocaleString()}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[row.status] || "bg-gray-100 text-gray-600"}`}>{row.status}</span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{row.remarks || "—"}</td>
                            <td className="px-3 py-2.5 text-xs font-medium">
                              {match === "matched" && <span className="text-green-700">✓ Matched</span>}
                              {match === "fuzzy"   && <span className="text-amber-700">~ Fuzzy</span>}
                              {match === "unmatched" && <span className="text-red-600">✗ No match</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-gray-500">Showing 5 sample rows from the file. Unmatched rows will be skipped unless you map them manually.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button onClick={() => { setStage("upload"); setSelectedFile(null); }} className={`text-sm text-gray-500 hover:text-gray-700 ${stage === "upload" ? "invisible" : ""}`}>
            ← Back
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            {stage === "preview" && (
              <button
                onClick={() => { if (selectedFile) onUpload(selectedFile); }}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
              >
                Confirm Import ({matchedCount} rows)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
