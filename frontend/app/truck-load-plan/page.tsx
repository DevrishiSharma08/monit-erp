"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { TruckLoadPlan, TruckLoadPlanItem, MillOrderTracker, mockTransporters } from "@/data/mockData";
import {
  Truck, Clock, CheckCircle2, Plus, Package, AlertCircle,
  MoreVertical, Eye, Trash2, Printer, RefreshCw, X, Weight,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  Planned:      "bg-blue-50 text-blue-700 border border-blue-200",
  Loading:      "bg-amber-50 text-amber-700 border border-amber-200",
  "In Transit": "bg-purple-50 text-purple-700 border border-purple-200",
  Delivered:    "bg-green-50 text-green-700 border border-green-200",
};
const STATUS_SEQ: TruckLoadPlan["status"][] = ["Planned", "Loading", "In Transit", "Delivered"];

// ─── Weight helper ─────────────────────────────────────────────────────────────

function calcWeightKg(gsm: number, sizeStr: string, qty: number): number {
  const parts = sizeStr.toLowerCase().replace("cm", "").split("x").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return 0;
  let [w, h] = parts;
  if (w < 100) { w = w * 2.54; h = h * 2.54; }
  const areaSqM = (w / 100) * (h / 100);
  return Math.round((qty * gsm * areaSqM) / 1000);
}

function itemWeight(item: TruckLoadPlanItem): number {
  return item.weightKg ?? calcWeightKg(item.gsm, item.size, item.quantity);
}

function planTotals(plan: TruckLoadPlan) {
  const totalQty    = plan.items.reduce((s, i) => s + i.quantity, 0);
  const totalWeight = plan.items.reduce((s, i) => s + itemWeight(i), 0);
  const uniquePOs   = new Set(plan.items.map((i) => i.poNumber)).size;
  return { totalQty, totalWeight, uniquePOs };
}

// ─── Pending POs Section ───────────────────────────────────────────────────────

interface PendingFilters { search: string; customer: string; mill: string; status: string; }

function PendingPOsSection({
  trackers, selectedIds, onToggle, onPlanSelected,
}: {
  trackers: MillOrderTracker[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onPlanSelected: () => void;
}) {
  const [filters, setFilters] = useState<PendingFilters>({ search: "", customer: "", mill: "", status: "" });

  const customers = useMemo(() => [...new Set(trackers.map((t) => t.customerName).filter(Boolean))] as string[], [trackers]);
  const mills     = useMemo(() => [...new Set(trackers.map((t) => t.mill))], [trackers]);
  const statuses  = useMemo(() => [...new Set(trackers.map((t) => t.productionStatus))], [trackers]);

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase();
    return trackers.filter((t) => {
      if (q && !t.poNumber.toLowerCase().includes(q) && !t.paper.toLowerCase().includes(q) && !(t.customerName ?? "").toLowerCase().includes(q)) return false;
      if (filters.customer && t.customerName !== filters.customer) return false;
      if (filters.mill && t.mill !== filters.mill) return false;
      if (filters.status && t.productionStatus !== filters.status) return false;
      return true;
    });
  }, [trackers, filters]);

  const allSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));
  const toggleAll = () => {
    if (allSelected) filtered.forEach((t) => onToggle(t.id));
    else filtered.filter((t) => !selectedIds.has(t.id)).forEach((t) => onToggle(t.id));
  };

  const setF = (k: keyof PendingFilters, v: string) => setFilters((p) => ({ ...p, [k]: v }));

  return (
    <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-3.5">
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
            <Truck className="h-3.5 w-3.5" /> Plan {selectedIds.size} Selected
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-2.5">
        <input type="search" placeholder="Search PO, material, customer…" value={filters.search}
          onChange={(e) => setF("search", e.target.value)}
          className="flex-1 min-w-[180px] rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-blue-400 focus:outline-none" />
        <select value={filters.customer} onChange={(e) => setF("customer", e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white">
          <option value="">All Customers</option>
          {customers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.mill} onChange={(e) => setF("mill", e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white">
          <option value="">All Mills</option>
          {mills.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setF("status", e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none bg-white">
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filters.search || filters.customer || filters.mill || filters.status) && (
          <button onClick={() => setFilters({ search: "", customer: "", mill: "", status: "" })}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100">Clear</button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-500" />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold">PO #</th>
              <th className="px-3 py-2.5 text-left font-semibold">Material</th>
              <th className="px-3 py-2.5 text-left font-semibold">Mill</th>
              <th className="px-3 py-2.5 text-left font-semibold">Customer</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold">Avail Qty</th>
              <th className="px-3 py-2.5 text-right font-semibold">Est. Weight</th>
              <th className="px-3 py-2.5 text-left font-semibold">ETA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0
              ? <tr><td colSpan={9} className="py-8 text-center text-sm text-gray-400">No pending items match filters</td></tr>
              : filtered.map((t) => {
                  const avail = t.readyQty - t.dispatchedQty;
                  const wt = calcWeightKg(t.gsm, t.size, avail);
                  const checked = selectedIds.has(t.id);
                  return (
                    <tr key={t.id} onClick={() => onToggle(t.id)}
                      className={cn("cursor-pointer transition-colors", checked ? "bg-blue-50/70" : "hover:bg-gray-50/70")}>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={checked} onChange={() => onToggle(t.id)}
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-500" />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs font-semibold text-gray-800">{t.poNumber}</span>
                        {t.soNumber && <span className="ml-1.5 text-[11px] text-purple-500">→ {t.soNumber}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-800 text-xs">{t.paper}</p>
                        <p className="text-[11px] text-gray-400">{t.gsm} GSM · {t.size}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{t.mill}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{t.customerName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          t.productionStatus === "Ready" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                          {t.productionStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-green-700 tabular-nums">{avail.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500 tabular-nums">{wt > 0 ? `${wt.toLocaleString()} kg` : "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{t.expectedDelivery ?? "—"}</td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Plan Creation Modal ───────────────────────────────────────────────────────

interface PlanItem {
  trackerId: string; poNumber: string; soNumber: string;
  paper: string; gsm: number; size: string;
  customerName: string; mill: string; deliveryAddress: string;
  maxQty: number; quantity: number; loadOrder: number;
}

interface PlanForm {
  items: PlanItem[];
  truckNumber: string; truckCapacityKg: number;
  transporterName: string; driverName: string; driverPhone: string;
  millInvoiceNo: string; deliveryBillNo: string;
  origin: string; deliveryMode: "Direct To Customer" | "To Godown" | "Multi-Stop";
  plannedLoadDate: string; plannedDeliveryDate: string;
}

function PlanCreationModal({ trackers, onSubmit, onCancel }: {
  trackers: MillOrderTracker[];
  onSubmit: (form: PlanForm) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const mode: PlanForm["deliveryMode"] = trackers.length > 1 ? "Multi-Stop"
    : (trackers[0]?.deliveryMode as "Direct To Customer" | "To Godown") ?? "To Godown";

  const initialItems: PlanItem[] = trackers.map((t, i) => ({
    trackerId: t.id, poNumber: t.poNumber, soNumber: t.soNumber ?? "",
    paper: t.paper, gsm: t.gsm, size: t.size,
    customerName: t.customerName ?? "", mill: t.mill, deliveryAddress: "",
    maxQty: t.readyQty - t.dispatchedQty,
    quantity: t.readyQty - t.dispatchedQty,
    loadOrder: trackers.length - i,
  }));

  const [form, setForm] = useState<PlanForm>({
    items: initialItems, truckNumber: "", truckCapacityKg: 15000,
    transporterName: "", driverName: "", driverPhone: "",
    millInvoiceNo: "", deliveryBillNo: "",
    origin: trackers[0]?.mill ?? "",
    deliveryMode: mode,
    plannedLoadDate: today, plannedDeliveryDate: today,
  });

  const setF = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const updateItem = (idx: number, qty: number) =>
    setForm((p) => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, Math.min(qty, it.maxQty)) } : it) }));
  const updateItemAddr = (idx: number, addr: string) =>
    setForm((p) => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, deliveryAddress: addr } : it) }));
  const removeItem = (idx: number) =>
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx).map((it, i, arr) => ({ ...it, loadOrder: arr.length - i })) }));

  const totalWeight = form.items.reduce((s, it) => s + calcWeightKg(it.gsm, it.size, it.quantity), 0);
  const cap = form.truckCapacityKg || 15000;
  const pct = Math.min((totalWeight / cap) * 100, 100);
  const over = totalWeight > cap;
  const isValid = form.items.length > 0 && form.truckNumber.trim() && form.transporterName.trim() && form.plannedLoadDate && !over;

  return (
    <div className="space-y-5">
      {/* Item list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Items — LIFO (top = first delivery stop)</p>
          <span className="text-[11px] text-gray-400">{form.items.length} item{form.items.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="w-7 px-2 py-2 text-center">#</th>
                <th className="px-3 py-2 text-left">Material / PO</th>
                <th className="px-3 py-2 text-left">Delivery Address</th>
                <th className="px-3 py-2 text-right">Qty (sht)</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {form.items.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400">No items</td></tr>
              )}
              {form.items.map((it, idx) => (
                <tr key={it.trackerId} className="bg-white">
                  <td className="px-2 py-2 text-center">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">{idx + 1}</span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-800">{it.paper}</p>
                    <p className="text-[11px] text-gray-400">{it.gsm} GSM · {it.size} · {it.poNumber}</p>
                    {it.customerName && <p className="text-[11px] text-blue-500">{it.customerName}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={it.deliveryAddress} placeholder="Full delivery address"
                      onChange={(e) => updateItemAddr(idx, e.target.value)}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={it.quantity} min={1} max={it.maxQty}
                      onChange={(e) => updateItem(idx, parseInt(e.target.value) || 1)}
                      className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-xs font-semibold focus:border-blue-400 focus:outline-none" />
                    <p className="text-[10px] text-gray-400 text-right mt-0.5">max {it.maxQty.toLocaleString()}</p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{calcWeightKg(it.gsm, it.size, it.quantity).toLocaleString()} kg</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => removeItem(idx)} className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weight bar */}
      <div className="rounded-xl border bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <Weight className="h-3.5 w-3.5" /> Truck Weight
          </span>
          <span className={cn("text-xs font-bold tabular-nums", over ? "text-red-600" : "text-gray-700")}>
            {totalWeight.toLocaleString()} / {cap.toLocaleString()} kg
            {over && <span className="ml-1.5 text-red-600">▲ {(totalWeight - cap).toLocaleString()} kg over!</span>}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : pct > 85 ? "bg-amber-400" : "bg-green-500")} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[11px] text-gray-500 whitespace-nowrap">Capacity (kg):</label>
          <input type="number" value={form.truckCapacityKg} min={1000} step={500}
            onChange={(e) => setF("truckCapacityKg", parseInt(e.target.value) || 15000)}
            className="w-28 rounded border border-gray-200 px-2 py-0.5 text-xs focus:border-blue-400 focus:outline-none" />
        </div>
        {over && <p className="mt-1.5 text-xs text-red-600 font-medium">Remove items or reduce quantities to fit truck capacity.</p>}
      </div>

      {/* Transport details */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Transport Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Truck / Vehicle No <span className="text-red-500">*</span></label>
            <input type="text" value={form.truckNumber} placeholder="MP09AB1234"
              onChange={(e) => setF("truckNumber", e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Transporter <span className="text-red-500">*</span></label>
            <input list="transporters-list" value={form.transporterName} placeholder="Transporter name"
              onChange={(e) => setF("transporterName", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <datalist id="transporters-list">
              {mockTransporters.map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Driver Name</label>
            <input type="text" value={form.driverName} placeholder="Driver full name"
              onChange={(e) => setF("driverName", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Driver Phone</label>
            <input type="tel" value={form.driverPhone} placeholder="+91-9876543210"
              onChange={(e) => setF("driverPhone", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Mill Invoice No.</label>
            <input type="text" value={form.millInvoiceNo} placeholder="INV-2024-001"
              onChange={(e) => setF("millInvoiceNo", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Delivery Bill No.</label>
            <input type="text" value={form.deliveryBillNo} placeholder="DB-2024-001"
              onChange={(e) => setF("deliveryBillNo", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Origin</label>
            <input type="text" value={form.origin}
              onChange={(e) => setF("origin", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Delivery Mode</label>
            <select value={form.deliveryMode} onChange={(e) => setF("deliveryMode", e.target.value as PlanForm["deliveryMode"])}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="Direct To Customer">Direct To Customer</option>
              <option value="To Godown">To Godown</option>
              <option value="Multi-Stop">Multi-Stop</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Planned Load Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.plannedLoadDate} onChange={(e) => setF("plannedLoadDate", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Planned Delivery Date</label>
            <input type="date" value={form.plannedDeliveryDate} onChange={(e) => setF("plannedDeliveryDate", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="button" disabled={!isValid} onClick={() => onSubmit(form)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 active:scale-95 transition-all">
          <Truck className="h-4 w-4" /> Save Load Plan
        </button>
      </div>
    </div>
  );
}

// ─── Plan Drill-Down Modal ─────────────────────────────────────────────────────

function PlanDrillDown({ plan, onClose }: { plan: TruckLoadPlan; onClose: () => void }) {
  const { totalQty, totalWeight, uniquePOs } = planTotals(plan);
  const cap = plan.truckCapacityKg ?? 0;
  const pct = cap > 0 ? Math.min((totalWeight / cap) * 100, 100) : 0;

  // Group items by PO
  const byPO = useMemo(() => {
    const map = new Map<string, TruckLoadPlanItem[]>();
    [...plan.items].sort((a, b) => b.loadOrder - a.loadOrder).forEach((item) => {
      const list = map.get(item.poNumber) ?? [];
      list.push(item);
      map.set(item.poNumber, list);
    });
    return map;
  }, [plan.items]);

  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set(byPO.keys()));
  const togglePO = (po: string) => setExpandedPOs((prev) => {
    const next = new Set(prev);
    next.has(po) ? next.delete(po) : next.add(po);
    return next;
  });

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
            ["Truck", plan.truckNumber || "—"],
            ["Transporter", plan.transporterName || "—"],
            ["Driver", plan.driverName || "—"],
            ["Phone", plan.driverPhone || "—"],
            ["Origin", plan.origin],
            ["Mode", plan.deliveryMode],
            ["Load Date", plan.plannedLoadDate],
            ["Delivery Date", plan.plannedDeliveryDate],
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
          <span><span className="text-gray-400">Total Qty: </span><span className="font-bold text-gray-800">{totalQty.toLocaleString()} sht</span></span>
        </div>
      </div>

      {/* Items grouped by PO */}
      <div className="space-y-2">
        {[...byPO.entries()].map(([poNumber, items]) => {
          const poWeight = items.reduce((s, i) => s + itemWeight(i), 0);
          const poQty    = items.reduce((s, i) => s + i.quantity, 0);
          const expanded = expandedPOs.has(poNumber);
          return (
            <div key={poNumber} className="rounded-xl border border-gray-200 overflow-hidden">
              {/* PO group header */}
              <button onClick={() => togglePO(poNumber)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                <div className="flex items-center gap-2.5">
                  {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                  <span className="font-mono text-xs font-bold text-gray-800">{poNumber}</span>
                  <span className="text-[11px] text-gray-400">{items[0]?.soNumber ? `→ ${items[0].soNumber}` : ""}</span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="tabular-nums">{poQty.toLocaleString()} sht</span>
                  <span className="tabular-nums">{poWeight.toLocaleString()} kg</span>
                </div>
              </button>

              {/* Item rows */}
              {expanded && (
                <table className="w-full text-xs border-t border-gray-100">
                  <thead className="bg-white text-[11px] uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-center w-8">Load#</th>
                      <th className="px-3 py-2 text-left">Material</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Delivery Location</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Weight</th>
                      <th className="px-3 py-2 text-left">Mill Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">
                            {item.loadOrder}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-800">{item.paper}</p>
                          <p className="text-[11px] text-gray-400">{item.gsm} GSM · {item.size}</p>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{item.customerName || "—"}</td>
                        <td className="px-3 py-2.5">
                          <p className="text-gray-700">{item.deliveryLocation || "—"}</p>
                          {item.deliveryAddress && <p className="text-[11px] text-gray-400">{item.deliveryAddress}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-800">{item.quantity.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{itemWeight(item).toLocaleString()} kg</td>
                        <td className="px-3 py-2.5 text-gray-500">{item.millInvoiceNo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
      </div>
    </div>
  );
}

// ─── Status Update Modal ───────────────────────────────────────────────────────

function StatusUpdateModal({ plan, onClose, onSave }: {
  plan: TruckLoadPlan; onClose: () => void; onSave: (patch: Partial<TruckLoadPlan>) => void;
}) {
  const currentIdx = STATUS_SEQ.indexOf(plan.status);
  const [newStatus, setNewStatus] = useState<TruckLoadPlan["status"]>(
    STATUS_SEQ[Math.min(currentIdx + 1, STATUS_SEQ.length - 1)]
  );
  const [actualDate, setActualDate] = useState(new Date().toISOString().split("T")[0]);
  const { totalQty, totalWeight, uniquePOs } = planTotals(plan);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800">{plan.planNumber}</p>
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[plan.status])}>{plan.status}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {uniquePOs} PO{uniquePOs !== 1 ? "s" : ""} · {plan.items.length} item{plan.items.length !== 1 ? "s" : ""} · {totalQty.toLocaleString()} sht · {totalWeight.toLocaleString()} kg
          {plan.truckNumber ? ` · ${plan.truckNumber}` : ""}
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
            {newStatus === "Delivered" ? "Actual Delivery Date" : "Actual Load Date"}
          </label>
          <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {newStatus === "In Transit" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Setting to <strong>In Transit</strong> marks this load as dispatched. A GRN entry will appear when material arrives.
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="button"
          onClick={() => onSave({
            status: newStatus,
            actualLoadDate: newStatus === "In Transit" || newStatus === "Loading" ? actualDate : plan.actualLoadDate,
            actualDeliveryDate: newStatus === "Delivered" ? actualDate : plan.actualDeliveryDate,
          })}
          className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 active:scale-95 transition-all">
          Update Status
        </button>
      </div>
    </div>
  );
}

// ─── 3-dot Actions Menu ────────────────────────────────────────────────────────

function PlanActionsMenu({ plan, onView, onUpdateStatus, onDelete, onPrint }: {
  plan: TruckLoadPlan;
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
      {open && <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />}
      <button ref={btnRef} onClick={toggle}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed z-30 min-w-[160px] rounded-xl border border-gray-100 bg-white py-1.5 shadow-xl"
          style={{ top: pos.top, right: pos.right }}>
          <button onClick={act(onView)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Eye className="h-3.5 w-3.5 text-gray-400" /> View Details
          </button>
          {plan.status !== "Delivered" && (
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
        </div>
      )}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TruckLoadPlanPage() {
  const { truckLoadPlans, addTruckLoadPlan, updateTruckLoadPlan, deleteTruckLoadPlan, readyTrackers } = usePurchaseOrder();
  const { success } = useToast();

  const [showPending, setShowPending]   = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [showPlanModal, setShowPlanModal]     = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activePlan, setActivePlan]     = useState<TruckLoadPlan | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<TruckLoadPlan["status"] | null>(null);

  const kpis = useMemo(() => ({
    pending:   readyTrackers.length,
    planned:   truckLoadPlans.filter((t) => t.status === "Planned").length,
    loading:   truckLoadPlans.filter((t) => t.status === "Loading").length,
    inTransit: truckLoadPlans.filter((t) => t.status === "In Transit").length,
    delivered: truckLoadPlans.filter((t) => t.status === "Delivered").length,
  }), [truckLoadPlans, readyTrackers]);

  const filteredPlans = useMemo(() =>
    activeStatusFilter ? truckLoadPlans.filter((t) => t.status === activeStatusFilter) : truckLoadPlans,
    [truckLoadPlans, activeStatusFilter]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleSubmitPlan = (form: PlanForm) => {
    const planNumber = `TLP-${new Date().getFullYear()}-${String(truckLoadPlans.length + 1).padStart(3, "0")}`;
    const newTLP: TruckLoadPlan = {
      id: `tlp_${Date.now()}`,
      planNumber,
      planDate: new Date().toISOString().split("T")[0],
      truckNumber:     form.truckNumber || undefined,
      driverName:      form.driverName || undefined,
      driverPhone:     form.driverPhone || undefined,
      transporterName: form.transporterName || undefined,
      truckCapacityKg: form.truckCapacityKg,
      origin:          form.origin,
      deliveryMode:    form.deliveryMode,
      plannedLoadDate:     form.plannedLoadDate,
      plannedDeliveryDate: form.plannedDeliveryDate,
      status: "Planned",
      items: form.items.map((it, idx) => ({
        id: `item_${Date.now()}_${idx}`,
        trackerSourceId:  it.trackerId,
        poNumber:         it.poNumber,
        soNumber:         it.soNumber || undefined,
        paper:            it.paper,
        gsm:              it.gsm,
        size:             it.size,
        quantity:         it.quantity,
        weightKg:         calcWeightKg(it.gsm, it.size, it.quantity),
        loadOrder:        it.loadOrder,
        customerName:     it.customerName || undefined,
        deliveryLocation: it.customerName || undefined,
        deliveryAddress:  it.deliveryAddress || undefined,
        millInvoiceNo:    form.millInvoiceNo || undefined,
        deliveryBillNo:   form.deliveryBillNo || undefined,
      })),
    };
    addTruckLoadPlan(newTLP);
    success(`Load plan ${planNumber} created — ${form.items.length} item${form.items.length !== 1 ? "s" : ""} on ${form.truckNumber}.`);
    setShowPlanModal(false);
    setSelectedIds(new Set());
    setShowPending(false);
  };

  const handleStatusUpdate = (patch: Partial<TruckLoadPlan>) => {
    if (!activePlan) return;
    updateTruckLoadPlan(activePlan.id, patch);
    success(`${activePlan.planNumber} → ${patch.status}`);
    setShowStatusModal(false);
    setActivePlan(null);
  };

  const handleDelete = (plan: TruckLoadPlan) => {
    if (!confirm(`Delete ${plan.planNumber}? This cannot be undone.`)) return;
    deleteTruckLoadPlan(plan.id);
    success(`Plan ${plan.planNumber} deleted.`);
  };

  const handlePrint = (plan: TruckLoadPlan) => {
    const { totalQty, totalWeight } = planTotals(plan);
    const itemLines = plan.items
      .sort((a, b) => b.loadOrder - a.loadOrder)
      .map((it, i) => `  ${i + 1}. [Load#${it.loadOrder}] ${it.paper} ${it.gsm}GSM ${it.size} — ${it.quantity.toLocaleString()} sht — ${itemWeight(it).toLocaleString()} kg\n     PO: ${it.poNumber}  Customer: ${it.customerName || "—"}  Delivery: ${it.deliveryLocation || "—"}`)
      .join("\n");
    const content = `TRUCK LOAD PLAN — ${plan.planNumber}\nDate: ${plan.planDate}  Status: ${plan.status}\nTruck: ${plan.truckNumber ?? "—"}  Transporter: ${plan.transporterName ?? "—"}\nDriver: ${plan.driverName ?? "—"}  Phone: ${plan.driverPhone ?? "—"}\nOrigin: ${plan.origin}  Mode: ${plan.deliveryMode}\nLoad Date: ${plan.plannedLoadDate}  Delivery Date: ${plan.plannedDeliveryDate}\nTotal: ${totalQty.toLocaleString()} sht  ${totalWeight.toLocaleString()} kg\n\nITEMS (LIFO Order — top loaded first, delivered last):\n${itemLines}`;
    const blob = new Blob([`<html><body><pre style="font-family:monospace;padding:24px">${content}</pre></body></html>`], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) win.onload = () => { win.print(); URL.revokeObjectURL(url); };
  };

  // ── Grid columns ───────────────────────────────────────────────────────────

  const columns: ColumnConfig<TruckLoadPlan>[] = useMemo(() => [
    {
      id: "planNumber", accessorKey: "planNumber", header: "Plan #",
      filterType: "text", enableSorting: true, enableHiding: false, size: 130,
      cell: (info) => <span className="font-semibold text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "planDate", accessorKey: "planDate", header: "Date",
      filterType: "date", enableSorting: true, size: 110,
    },
    {
      id: "truckNumber", accessorKey: "truckNumber", header: "Truck",
      filterType: "text", enableSorting: false, size: 120,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v ? <span className="font-mono text-xs font-semibold">{v}</span>
                 : <span className="text-xs text-amber-600">Not set</span>;
      },
    },
    {
      id: "transporterName", accessorKey: "transporterName", header: "Transporter",
      filterType: "text", enableSorting: false, size: 150,
      cell: (info) => <span className="text-gray-600 text-sm">{(info.getValue() as string) ?? "—"}</span>,
    },
    {
      id: "origin", accessorKey: "origin", header: "Origin",
      filterType: "text", enableSorting: false, size: 160,
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
      filterType: "date", enableSorting: true, size: 110,
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
    {
      id: "actions", accessorKey: "id", header: "Actions",
      filterType: "none", enableSorting: false, enableHiding: false, size: 60,
      cell: (info) => {
        const plan = info.row.original as TruckLoadPlan;
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
  ], [truckLoadPlans]);

  // ── KPI cards data ─────────────────────────────────────────────────────────

  const statusKpis = [
    { key: "planned" as const,   label: "Planned" as TruckLoadPlan["status"],    icon: Clock,         iconBg: "bg-blue-50",   iconColor: "text-blue-500",   activeBg: "bg-blue-500",   activeBorder: "border-blue-400",   hover: "hover:border-blue-200" },
    { key: "loading" as const,   label: "Loading" as TruckLoadPlan["status"],    icon: Package,       iconBg: "bg-amber-50",  iconColor: "text-amber-500",  activeBg: "bg-amber-500",  activeBorder: "border-amber-400",  hover: "hover:border-amber-200" },
    { key: "inTransit" as const, label: "In Transit" as TruckLoadPlan["status"], icon: Truck,         iconBg: "bg-purple-50", iconColor: "text-purple-500", activeBg: "bg-purple-500", activeBorder: "border-purple-400", hover: "hover:border-purple-200" },
    { key: "delivered" as const, label: "Delivered" as TruckLoadPlan["status"],  icon: CheckCircle2,  iconBg: "bg-green-50",  iconColor: "text-green-500",  activeBg: "bg-green-500",  activeBorder: "border-green-400",  hover: "hover:border-green-200" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* ── KPI + New Plan row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-stretch gap-3">

        {/* Pending Dispatch KPI */}
        <button
          onClick={() => { setShowPending((v) => !v); if (showPending) setSelectedIds(new Set()); }}
          className={cn(
            "flex-1 min-w-[140px] rounded-xl border-2 p-4 text-left transition-all hover:shadow-md active:scale-[0.98]",
            showPending
              ? "border-orange-400 bg-orange-500 text-white shadow-md shadow-orange-200"
              : "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 hover:border-orange-400"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={cn("text-xs font-medium uppercase tracking-wide", showPending ? "text-white/70" : "text-orange-600")}>
                Pending Dispatch
              </p>
              <p className={cn("mt-1.5 text-2xl font-bold", showPending ? "text-white" : "text-orange-700")}>{kpis.pending}</p>
              <p className={cn("mt-0.5 text-xs", showPending ? "text-white/60" : "text-orange-400")}>
                {showPending ? "Click to hide" : "Click to plan"}
              </p>
            </div>
            <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", showPending ? "bg-white/20" : "bg-orange-100")}>
              <Package className={cn("h-5 w-5", showPending ? "text-white" : "text-orange-500")} />
            </div>
          </div>
        </button>

        {/* Status KPI cards */}
        {statusKpis.map(({ key, label, icon: Icon, iconBg, iconColor, activeBg, activeBorder, hover }) => {
          const isActive = activeStatusFilter === label;
          return (
            <button key={key}
              onClick={() => setActiveStatusFilter(isActive ? null : label)}
              className={cn(
                "flex-1 min-w-[120px] rounded-xl border p-4 text-left transition-all hover:shadow-md active:scale-[0.98]",
                isActive ? `${activeBorder} ${activeBg} text-white shadow-md` : `border-gray-100 bg-white ${hover}`
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-xs font-medium uppercase tracking-wide", isActive ? "text-white/70" : "text-gray-400")}>{label}</p>
                  <p className={cn("mt-1.5 text-2xl font-bold", isActive ? "text-white" : "text-gray-900")}>{kpis[key]}</p>
                </div>
                <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", isActive ? "bg-white/20" : iconBg)}>
                  <Icon className={cn("h-5 w-5", isActive ? "text-white" : iconColor)} />
                </div>
              </div>
            </button>
          );
        })}

        {/* New Plan button aligned to the right */}
        <div className="flex items-center">
          <button
            onClick={() => { setShowPending((v) => !v); if (showPending) setSelectedIds(new Set()); }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 active:scale-[0.97] transition-all whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> New Plan
          </button>
        </div>
      </div>

      {/* ── Pending Section ────────────────────────────────────────────────── */}
      {showPending && (
        readyTrackers.length > 0
          ? <PendingPOsSection trackers={readyTrackers} selectedIds={selectedIds} onToggle={toggleSelect} onPlanSelected={() => setShowPlanModal(true)} />
          : (
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
              <AlertCircle className="h-5 w-5 text-gray-300 flex-shrink-0" />
              <p className="text-sm text-gray-400">No mill orders ready for dispatch. Update status in Mill Order Tracker first.</p>
            </div>
          )
      )}

      {/* ── Planned Loads grid ─────────────────────────────────────────────── */}
      {!showPending && (
        <div>
          {activeStatusFilter && (
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_COLOR[activeStatusFilter])}>
                {activeStatusFilter}
              </span>
              <button onClick={() => setActiveStatusFilter(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-gray-400">{filteredPlans.length} plan{filteredPlans.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          <DataGrid
            data={filteredPlans}
            columns={columns}
            tableName="truck-load-plans"
            enableFilters={true}
            enablePagination={true}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            initialPageSize={10}
            onRowClick={(plan) => { setActivePlan(plan); setShowDetailModal(true); }}
            emptyMessage="No load plans yet. Use New Plan to create one."
          />
        </div>
      )}

      {/* ── Plan Creation Modal ────────────────────────────────────────────── */}
      <Modal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)}
        title="Create Truck Load Plan"
        subtitle={`${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} selected · LIFO load order`}
        size="xl">
        <PlanCreationModal
          trackers={readyTrackers.filter((t) => selectedIds.has(t.id))}
          onSubmit={handleSubmitPlan}
          onCancel={() => setShowPlanModal(false)}
        />
      </Modal>

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
