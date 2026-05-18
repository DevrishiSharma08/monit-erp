"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus, Save, AlertTriangle, Trash2, Loader2, Pencil,
  ShoppingCart, Factory, IndianRupee, History, Check, Search, TrendingUp, TrendingDown,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { Combobox, ComboboxOption } from "@/components/ui/Combobox";
import { cn } from "@/lib/utils";
import {
  rateApi, RateRow, RateHistoryRow,
  stockGroupApi, SubGroupDropdown,
  millApi, MillDropdown,
  customerApi, CustomerDropdown,
} from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

const TYPE_OPTIONS = ["Reel", "Sheet"] as const;

// ── Multi-customer selector ───────────────────────────────────────────────────
function CustomerMultiSelect({
  customers, selected, onChange,
}: {
  customers: CustomerDropdown[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => search.trim() ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : customers,
    [customers, search]
  );
  const toggle    = (id: number) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const toggleAll = () => onChange(selected.length === customers.length ? [] : customers.map(c => c.id));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm outline-none focus:border-blue-400" />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
        <button type="button" onClick={toggleAll} className="text-blue-500 hover:text-blue-700 font-medium">
          {selected.length === customers.length ? "Deselect all" : "Select all"}
        </button>
        {selected.length > 0 && (
          <span className="bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-semibold">{selected.length} selected</span>
        )}
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No customers found</p>
        ) : filtered.map(c => {
          const checked = selected.includes(c.id);
          return (
            <label key={c.id} className={cn("flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors",
              checked ? "bg-blue-50" : "hover:bg-gray-50")}>
              <div onClick={() => toggle(c.id)}
                className={cn("h-4 w-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors",
                  checked ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white")}>
                {checked && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="text-sm text-gray-700 truncate">{c.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RateMasterPage() {
  const [data,      setData]      = useState<RateRow[]>([]);
  const [mills,     setMills]     = useState<MillDropdown[]>([]);
  const [subgroups, setSubgroups] = useState<SubGroupDropdown[]>([]);
  const [customers, setCustomers] = useState<CustomerDropdown[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"Sale" | "Purchase">("Sale");

  // Modal state
  const [showModal,  setShowModal]  = useState(false);
  const [editingRate, setEditingRate] = useState<RateRow | null>(null); // pre-fill for edit mode
  const [deleteId,   setDeleteId]   = useState<number | null>(null);
  const [viewItem,   setViewItem]   = useState<RateRow | null>(null);

  // History modal
  const [historyRow,     setHistoryRow]     = useState<RateRow | null>(null);
  const [historyData,    setHistoryData]    = useState<RateHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form state
  const [fMillInput,    setFMillInput]    = useState("");
  const [fMillId,       setFMillId]       = useState<number | null>(null);
  const [fQualInput,    setFQualInput]    = useState("");
  const [fQualId,       setFQualId]       = useState<number | null>(null);
  const [fGsmMin,       setFGsmMin]       = useState("");
  const [fGsmMax,       setFGsmMax]       = useState("");
  const [fType,         setFType]         = useState<"Reel" | "Sheet">("Reel");
  const [fRateCat,      setFRateCat]      = useState<"Self" | "Customer">("Self");
  const [fCustomerIds,  setFCustomerIds]  = useState<number[]>([]);
  const [fAmount,       setFAmount]       = useState("");
  const [fDiscount,     setFDiscount]     = useState("");
  const [fEffFrom,      setFEffFrom]      = useState("");

  // Combobox options
  const millOptions = useMemo<ComboboxOption[]>(
    () => mills.map(m => ({ value: String(m.id), label: `${m.code} · ${m.name}` })),
    [mills]
  );
  const qualOptions = useMemo<ComboboxOption[]>(
    () => subgroups.map(s => ({
      value: String(s.id),
      label: s.name,
      sub: s.groupName,
    })),
    [subgroups]
  );

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rates, ml, sq, cu] = await Promise.all([
        rateApi.list(),
        millApi.dropdown(),
        stockGroupApi.subgroups(),
        customerApi.dropdown(),
      ]);
      setData(rates.items);
      setMills(ml);
      setSubgroups(sq);
      setCustomers(cu);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFMillInput(""); setFMillId(null);
    setFQualInput(""); setFQualId(null);
    setFGsmMin(""); setFGsmMax(""); setFType("Reel");
    setFRateCat("Self"); setFCustomerIds([]);
    setFAmount(""); setFDiscount(""); setFEffFrom("");
  }

  function openAdd() { resetForm(); setEditingRate(null); setShowModal(true); }

  function openEdit(row: RateRow) {
    resetForm();
    setEditingRate(row);
    // Pre-fill mill
    const mill = mills.find(m => m.id === row.millId);
    setFMillId(row.millId);
    setFMillInput(mill ? `${mill.code} · ${mill.name}` : row.millName);
    // Pre-fill quality
    const qual = subgroups.find(s => s.id === row.qualityId);
    setFQualId(row.qualityId ?? null);
    setFQualInput(qual?.name ?? row.qualityName);
    // Pre-fill GSM, type, amount, discount, effectiveFrom
    setFGsmMin(String(row.gsmMin));
    setFGsmMax(String(row.gsmMax));
    setFType(row.type as "Reel" | "Sheet");
    setFAmount(String(row.amount));
    setFDiscount(row.discount ? String(row.discount) : "");
    setFEffFrom(row.effectiveFrom);
    if (row.rateType === "Purchase") setFRateCat((row.rateCategory as "Self" | "Customer") ?? "Self");
    if (row.customerId) setFCustomerIds([row.customerId]);
    setActiveTab(row.rateType as "Sale" | "Purchase");
    setShowModal(true);
  }

  async function openHistory(row: RateRow) {
    setHistoryRow(row);
    setHistoryLoading(true);
    try {
      const h = await rateApi.history(row.id);
      setHistoryData(h);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const gsmMinNum      = Number(fGsmMin);
  const gsmMaxNum      = Number(fGsmMax);
  const gsmRangeError  = fGsmMin && fGsmMax && gsmMaxNum < gsmMinNum;

  const canSave =
    !!fMillId && !!fQualId &&
    fGsmMin.trim() !== "" && fGsmMax.trim() !== "" &&
    gsmMinNum > 0 && gsmMaxNum >= gsmMinNum &&
    !!fType &&
    !!fAmount && Number(fAmount) > 0 &&
    !!fEffFrom &&
    (activeTab === "Sale" || fRateCat === "Self" || fCustomerIds.length > 0);

  async function handleSave() {
    if (!canSave || !fMillId || !fQualId) return;
    setSaving(true); setError(null);
    try {
      const base = {
        millId:       fMillId,
        qualityId:    fQualId,
        gsmMin:       gsmMinNum,
        gsmMax:       gsmMaxNum,
        type:         fType,
        amount:       Number(fAmount),
        discount:     fDiscount ? Number(fDiscount) : undefined,
        effectiveFrom: fEffFrom,
        customerIds:  fCustomerIds.length > 0 ? fCustomerIds : undefined,
      };

      let rows: RateRow[];
      if (activeTab === "Sale") {
        rows = await rateApi.createSale(base);
      } else {
        rows = await rateApi.createPurchase({ ...base, rateCategory: fRateCat });
      }

      setData(prev => {
        const newIds = new Set(rows.map(r => `${r.millId}|${r.qualityId}|${r.gsmMin}|${r.gsmMax}|${r.type}|${r.rateType}|${r.rateCategory ?? ""}|${r.customerId ?? ""}`));
        const pruned = prev.filter(r => !newIds.has(`${r.millId}|${r.qualityId}|${r.gsmMin}|${r.gsmMax}|${r.type}|${r.rateType}|${r.rateCategory ?? ""}|${r.customerId ?? ""}`));
        return [...rows, ...pruned];
      });
      setShowModal(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await rateApi.remove(id);
      setData(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  const tabData = useMemo(() => data.filter(r => r.rateType === activeTab), [data, activeTab]);

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns: ColumnConfig<RateRow>[] = useMemo(() => [
    {
      id: "millName", accessorKey: "millName", header: "Mill",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 160,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div>
            <span className="font-semibold text-gray-900 text-xs">{row.millCode ?? row.millName}</span>
            {row.millCode && <span className="ml-1.5 text-xs text-gray-400">{row.millName}</span>}
          </div>
        );
      },
    },
    {
      id: "qualityName", accessorKey: "qualityName", header: "Quality",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => (
        <span className="inline-flex rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-xs font-medium">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      id: "brandName", accessorKey: "brandName", header: "Brand",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 90,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className="inline-flex rounded-full bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 text-xs font-medium">{v}</span>
          : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      id: "gsmMin", accessorKey: "gsmMin", header: "GSM Range",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => {
        const row = info.row.original;
        return (
          <span className="inline-flex rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-medium">
            {row.gsmMin}–{row.gsmMax}
          </span>
        );
      },
    },
    {
      id: "type", accessorKey: "type", header: "Type",
      filterType: "select",
      filterOptions: [{ label: "Reel", value: "Reel" }, { label: "Sheet", value: "Sheet" }],
      enableSorting: true, defaultVisible: true, size: 80,
      cell: (info) => {
        const v = info.getValue() as string;
        return (
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium border",
            v === "Reel" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
            {v}
          </span>
        );
      },
    },
    ...(activeTab === "Purchase"
      ? [{
          id: "rateCategory", accessorKey: "rateCategory" as keyof RateRow, header: "Category",
          filterType: "select" as const,
          filterOptions: [{ label: "Self", value: "Self" }, { label: "Customer", value: "Customer" }],
          enableSorting: true, defaultVisible: true, size: 100,
          cell: (info: { getValue: () => unknown }) => {
            const v = info.getValue() as string | undefined;
            return (
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                v === "Self" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-orange-50 text-orange-700 border-orange-200")}>
                {v ?? "—"}
              </span>
            );
          },
        }]
      : []),
    {
      id: "customerName", accessorKey: "customerName", header: "Customer",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 170,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className="text-sm text-gray-700">{v}</span>
          : <span className="text-xs text-gray-400 italic">All customers</span>;
      },
    },
    {
      id: "amount", accessorKey: "amount", header: "Rate (₹/KG)",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 110,
      cell: (info) => (
        <span className={cn("font-semibold text-sm", activeTab === "Sale" ? "text-blue-700" : "text-purple-700")}>
          ₹{(info.getValue() as number).toFixed(2)}
        </span>
      ),
    },
    {
      id: "discount", accessorKey: "discount", header: "Discount (₹/KG)",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 120,
      cell: (info) => {
        const v = info.getValue() as number | undefined;
        return v && v > 0
          ? <span className="font-medium text-sm text-rose-600">−₹{v.toFixed(2)}</span>
          : <span className="text-xs text-gray-300">—</span>;
      },
    },
    {
      id: "effectiveFrom", accessorKey: "effectiveFrom", header: "Effective From",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => <span className="text-xs text-gray-600">{info.getValue() as string}</span>,
    },
    {
      id: "isActive", accessorKey: "isActive", header: "Status",
      filterType: "select",
      filterOptions: [{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }],
      enableSorting: true, defaultVisible: true, size: 90,
      cell: (info) => {
        const v = info.getValue() as boolean;
        return (
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border",
            v ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
            {v ? "Active" : "Inactive"}
          </span>
        );
      },
    },
    {
      id: "_actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 50,
      cell: (info) => {
        const row = info.row.original as RateRow;
        return (
          <ActionMenu items={[
            { label: "View",    icon: IndianRupee, onClick: () => setViewItem(row) },
            { label: "Edit",    icon: Pencil,      onClick: () => openEdit(row) },
            { label: "History", icon: History,     onClick: () => openHistory(row) },
            { label: "Delete",  icon: Trash2,      onClick: () => setDeleteId(row.id), variant: "danger" },
          ]} />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [activeTab]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Sale Rates",     value: data.filter(r => r.rateType === "Sale").length,     icon: ShoppingCart, color: "text-blue-600",   bg: "bg-blue-50"   },
          { label: "Purchase Rates", value: data.filter(r => r.rateType === "Purchase").length, icon: Factory,      color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Active",         value: data.filter(r => r.isActive).length,                icon: IndianRupee,  color: "text-green-600",  bg: "bg-green-50"  },
          { label: "With Discount",  value: data.filter(r => r.discount && r.discount > 0).length, icon: IndianRupee, color: "text-rose-600", bg: "bg-rose-50"  },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${k.bg}`}>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {(["Sale", "Purchase"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab ? "bg-white text-blue-600 shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-700")}>
            {tab === "Sale" ? <ShoppingCart className="h-4 w-4" /> : <Factory className="h-4 w-4" />}
            {tab} Rates
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
              activeTab === tab ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600")}>
              {data.filter(r => r.rateType === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <DataGrid
        data={tabData} columns={columns}
        tableName={`${activeTab.toLowerCase()}-rates`}
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={10}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-60",
              activeTab === "Sale" ? "bg-blue-500 hover:bg-blue-600" : "bg-purple-600 hover:bg-purple-700")}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add {activeTab} Rate
          </button>
        }
      />

      {/* ── Add Rate Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingRate(null); }}
        title={editingRate ? `Edit ${activeTab} Rate` : `Add ${activeTab} Rate`} size="sm"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !canSave}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60",
                activeTab === "Sale" ? "bg-blue-500 hover:bg-blue-600" : "bg-purple-600 hover:bg-purple-700")}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Rate{fCustomerIds.length > 1 ? ` (${fCustomerIds.length})` : ""}
            </button>
          </>
        }
      >
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3.5">

          {/* Effective From */}
          <div>
            <label className={labelCls}>Effective From *</label>
            <input type="date" value={fEffFrom} onChange={e => setFEffFrom(e.target.value)} className={inputCls} />
          </div>

          {/* Mill */}
          <div>
            <label className={labelCls}>Mill *</label>
            {editingRate ? (
              <div className="flex items-center h-[38px] px-3 rounded-lg border border-gray-200 bg-gray-50">
                <span className="text-sm font-semibold text-gray-700">{fMillInput}</span>
                <span className="ml-auto text-[10px] text-gray-400 bg-gray-200 rounded px-1.5 py-0.5">locked</span>
              </div>
            ) : (
              <Combobox options={millOptions} inputValue={fMillInput} allowCustom={false}
                placeholder="Search mill…"
                onChange={(val, opt) => { setFMillInput(val); setFMillId(opt ? Number(opt.value) : null); }} />
            )}
          </div>

          {/* Quality + Brand Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Quality *</label>
              {editingRate ? (
                <div className="flex items-center h-[38px] px-3 rounded-lg border border-gray-200 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-700">{fQualInput}</span>
                  <span className="ml-auto text-[10px] text-gray-400 bg-gray-200 rounded px-1.5 py-0.5">locked</span>
                </div>
              ) : (
                <Combobox options={qualOptions} inputValue={fQualInput} allowCustom={false}
                  placeholder="Search quality…"
                  onChange={(val, opt) => { setFQualInput(val); setFQualId(opt ? Number(opt.value) : null); }} />
              )}
            </div>
            <div>
              <label className={labelCls}>Brand Name</label>
              {(() => {
                const alias = fQualId ? subgroups.find(s => s.id === fQualId)?.alias : undefined;
                return (
                  <div className={cn(
                    "flex items-center h-[38px] px-3 rounded-lg border",
                    alias ? "bg-violet-50 border-violet-200" : "bg-gray-50 border-gray-200"
                  )}>
                    {alias
                      ? <span className="text-sm font-semibold text-violet-700">{alias}</span>
                      : <span className="text-xs text-gray-400">auto from quality</span>
                    }
                  </div>
                );
              })()}
            </div>
          </div>

          {/* GSM Range */}
          {editingRate ? (
            <div>
              <label className={labelCls}>GSM Range</label>
              <div className="flex items-center h-[38px] px-3 rounded-lg border border-gray-200 bg-gray-50 gap-1">
                <span className="text-sm font-semibold text-amber-700">{fGsmMin}–{fGsmMax} GSM</span>
                <span className="ml-auto text-[10px] text-gray-400 bg-gray-200 rounded px-1.5 py-0.5">locked</span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>GSM Min *</label>
                  <input type="number" min={1} value={fGsmMin}
                    onChange={e => setFGsmMin(e.target.value)}
                    placeholder="e.g. 70" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>GSM Max *</label>
                  <input type="number" min={1} value={fGsmMax}
                    onChange={e => setFGsmMax(e.target.value)}
                    placeholder="e.g. 90" className={inputCls} />
                </div>
              </div>
              {gsmRangeError && <p className="text-xs text-red-500 -mt-1">GSM Max must be ≥ GSM Min</p>}
            </>
          )}

          {/* Type */}
          <div>
            <label className={labelCls}>Type *</label>
            {editingRate ? (
              <div className="flex items-center h-[38px] px-3 rounded-lg border border-gray-200 bg-gray-50">
                <span className={cn("text-sm font-semibold",
                  fType === "Reel" ? "text-blue-700" : "text-purple-700")}>{fType}</span>
                <span className="ml-auto text-[10px] text-gray-400 bg-gray-200 rounded px-1.5 py-0.5">locked</span>
              </div>
            ) : (
              <div className="flex gap-2">
                {TYPE_OPTIONS.map(t => (
                  <button key={t} type="button" onClick={() => setFType(t)}
                    className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      fType === t ? "bg-blue-500 border-blue-500 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50")}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Purchase-only: Rate Category */}
          {activeTab === "Purchase" && (
            <div>
              <label className={labelCls}>Rate Category *</label>
              <div className="flex gap-2">
                {(["Self", "Customer"] as const).map(cat => (
                  <button key={cat} type="button"
                    onClick={() => { setFRateCat(cat); setFCustomerIds([]); }}
                    className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      fRateCat === cat
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50")}>
                    {cat === "Self" ? "Self (Monit)" : "Customer-wise"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer multi-select */}
          {(activeTab === "Sale" || fRateCat === "Customer") && (
            <div>
              <label className={labelCls}>
                Customers {activeTab === "Purchase" ? "*" : ""}
                {fCustomerIds.length > 0 && (
                  <span className="ml-2 normal-case font-normal text-blue-600">{fCustomerIds.length} selected</span>
                )}
              </label>
              {activeTab === "Sale" && (
                <p className="text-[11px] text-gray-400 mb-2">Leave empty for a universal rate (all customers).</p>
              )}
              <CustomerMultiSelect customers={customers} selected={fCustomerIds} onChange={setFCustomerIds} />
            </div>
          )}

          {/* Rate + Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rate (₹/KG) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={fAmount} onChange={e => setFAmount(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Discount (₹/KG)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={fDiscount} onChange={e => setFDiscount(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Net rate preview */}
          {fAmount && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Net rate = ₹{(Number(fAmount) - (Number(fDiscount) || 0)).toFixed(2)}/KG
              {fDiscount && Number(fDiscount) > 0 && (
                <span className="ml-1 text-rose-500">(after ₹{Number(fDiscount).toFixed(2)} discount)</span>
              )}
            </p>
          )}
        </div>
      </Modal>

      {/* ── View Detail Modal ──────────────────────────────────────────────── */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Rate Details" size="sm"
          footer={
            <button onClick={() => setViewItem(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Close</button>
          }>
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            {[
              { label: "Mill",           value: `${viewItem.millCode ?? ""} ${viewItem.millName}`.trim() },
              { label: "Quality",        value: viewItem.qualityName },
              ...(viewItem.brandName ? [{ label: "Brand", value: viewItem.brandName }] : []),
              { label: "GSM Range",      value: `${viewItem.gsmMin} – ${viewItem.gsmMax}` },
              { label: "Type",           value: viewItem.type },
              { label: "Rate Type",      value: viewItem.rateType },
              ...(viewItem.rateType === "Purchase"
                ? [{ label: "Category", value: viewItem.rateCategory ?? "—" }]
                : []),
              { label: "Customer",       value: viewItem.customerName ?? "All customers" },
              { label: "Rate",           value: `₹${viewItem.amount.toFixed(2)}/KG` },
              { label: "Discount",       value: viewItem.discount && viewItem.discount > 0 ? `₹${viewItem.discount.toFixed(2)}/KG` : "—" },
              { label: "Net Rate",       value: `₹${(viewItem.amount - (viewItem.discount ?? 0)).toFixed(2)}/KG` },
              { label: "Effective From", value: viewItem.effectiveFrom },
              { label: "Status",         value: viewItem.isActive ? "Active" : "Inactive" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-500 shrink-0">{label}</span>
                <span className="font-medium text-gray-900 text-right">{value}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── History Modal ──────────────────────────────────────────────────── */}
      {historyRow && (
        <Modal isOpen={!!historyRow} onClose={() => setHistoryRow(null)} title="Rate History" size="sm"
          footer={
            <button onClick={() => setHistoryRow(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Close</button>
          }>
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-800">{historyRow.millName}</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">{historyRow.qualityName}</span>
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">{historyRow.gsmMin}–{historyRow.gsmMax} GSM</span>
                <span className={cn("text-[10px] rounded-full px-2 py-0.5 border",
                  historyRow.type === "Reel" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
                  {historyRow.type}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{historyRow.rateType}</span>
                {historyRow.customerName && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">{historyRow.customerName}</span>
                )}
                {!historyRow.customerName && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 italic">All customers</span>
                )}
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : historyData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No history found</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {historyData.map((h, i) => {
                  const prev = historyData[i + 1]; // older entry
                  const delta = prev ? h.amount - prev.amount : null;
                  return (
                    <div key={h.id} className="flex items-start justify-between py-2.5 gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                          i === 0 ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500")}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">₹{h.amount.toFixed(2)}</span>
                            {delta !== null && (
                              <span className={cn(
                                "inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5",
                                delta > 0 ? "bg-green-50 text-green-700 border border-green-200"
                                           : delta < 0 ? "bg-red-50 text-red-600 border border-red-200"
                                           : "bg-gray-100 text-gray-500 border border-gray-200"
                              )}>
                                {delta > 0
                                  ? <><TrendingUp className="h-2.5 w-2.5" /> +₹{delta.toFixed(2)}</>
                                  : delta < 0
                                  ? <><TrendingDown className="h-2.5 w-2.5" /> −₹{Math.abs(delta).toFixed(2)}</>
                                  : "no change"}
                              </span>
                            )}
                          </div>
                          {h.discount && h.discount > 0 && (
                            <p className="text-[10px] text-rose-500">Disc: ₹{h.discount.toFixed(2)}</p>
                          )}
                          <p className="text-[10px] text-gray-400">by {h.createdBy}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-gray-700">{h.effectiveFrom}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Rate" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={() => handleDelete(deleteId!)}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Delete</button>
          </>
        }>
        <div className="rounded-xl bg-white p-4 shadow-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">Delete this rate record? The rate history will be permanently removed.</p>
        </div>
      </Modal>
    </div>
  );
}
