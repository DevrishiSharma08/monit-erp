"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2, Layers, Scale } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { cn } from "@/lib/utils";
import {
  materialApi, MaterialRow,
  millApi, MillDropdown,
  stockGroupApi, SubGroupDropdown,
  itemTypeApi, ItemTypeRow,
  hsnCodeApi, HsnCodeDropdown,
} from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls  = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls  = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";
const selectCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400";

const COMMON_GSM = [45, 50, 55, 58, 60, 65, 70, 75, 80, 90, 100, 110, 115, 120, 125, 130, 140, 150, 160, 170, 180, 200, 210, 220, 230, 250, 300, 350, 400];

function sheetWeightKg(gsm: number, len: number, wid: number): number {
  return (gsm * len * wid) / 1e7;
}

function formatCode(millCode: string, quality: string, brand: string, gsm: string, len: string, wid: string): string {
  if (!millCode || !quality || !gsm || !len) return "";
  const size     = wid ? `${len}x${wid}` : len;
  const qualPart = brand ? `${quality}/${brand}` : quality;
  return `${millCode}/${qualPart}/${gsm}/${size}`.toUpperCase();
}

export default function ItemMasterPage() {
  const [data,       setData]       = useState<MaterialRow[]>([]);
  const [mills,      setMills]      = useState<MillDropdown[]>([]);
  const [qualities,  setQualities]  = useState<SubGroupDropdown[]>([]);
  const [itemTypes,  setItemTypes]  = useState<ItemTypeRow[]>([]);
  const [hsnCodes,   setHsnCodes]   = useState<HsnCodeDropdown[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState<MaterialRow | null>(null);
  const [deleteId,   setDeleteId]   = useState<number | null>(null);
  const [viewItem,   setViewItem]   = useState<MaterialRow | null>(null);

  // Form fields
  const [fMillId,      setFMillId]      = useState<number | "">("");
  const [fQualityId,   setFQualityId]   = useState<number | "">("");
  const [fItemTypeId,  setFItemTypeId]  = useState<number | "">("");
  const [fGsm,         setFGsm]         = useState("");
  const [fSizeLen,     setFSizeLen]     = useState("");
  const [fSizeWid,     setFSizeWid]     = useState("");
  const [fHsnCodeId,   setFHsnCodeId]   = useState<number | "">("");
  const [fDescription, setFDescription] = useState("");
  const [fActive,      setFActive]      = useState(true);

  // Derived
  const selectedMill     = mills.find((m) => m.id === fMillId);
  const selectedQuality  = qualities.find((q) => q.id === fQualityId);
  const selectedItemType = itemTypes.find((t) => t.id === fItemTypeId);
  const isReel           = selectedItemType?.name.toLowerCase().includes("reel") ?? false;

  const grain = useMemo(() => {
    if (isReel) return null;
    const len = Number(fSizeLen);
    const wid = Number(fSizeWid);
    if (!len || !wid) return null;
    return wid > len ? "Long Grain" : "Short Grain";
  }, [isReel, fSizeLen, fSizeWid]);

  const sheetWeight = useMemo(() => {
    if (isReel) return null;
    const g = Number(fGsm), l = Number(fSizeLen), w = Number(fSizeWid);
    if (!g || !l || !w) return null;
    return sheetWeightKg(g, l, w);
  }, [fGsm, fSizeLen, fSizeWid, isReel]);

  const codePreview = useMemo(() => formatCode(
    selectedMill?.code ?? "",
    selectedQuality?.name ?? "",
    selectedQuality?.alias ?? "",
    fGsm, fSizeLen,
    isReel ? "" : fSizeWid
  ), [selectedMill, selectedQuality, fGsm, fSizeLen, fSizeWid, isReel]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [items, millList, qualList, typeList, hsnList] = await Promise.all([
        materialApi.list(),
        millApi.dropdown(),
        stockGroupApi.subgroups(),
        itemTypeApi.list(),
        hsnCodeApi.dropdown(),
      ]);
      setData(items.items);
      setMills(millList);
      setQualities(qualList);
      setItemTypes(typeList.items);
      setHsnCodes(hsnList);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFMillId(""); setFQualityId(""); setFItemTypeId("");
    setFGsm(""); setFSizeLen(""); setFSizeWid("");
    setFHsnCodeId(""); setFDescription(""); setFActive(true);
  }

  function openAdd() { setEditItem(null); resetForm(); setShowModal(true); }

  function openEdit(row: MaterialRow) {
    setEditItem(row);
    setFMillId(row.millId);
    setFQualityId(row.qualityId);
    setFItemTypeId(row.itemTypeId);
    setFGsm(String(row.gsm));
    setFSizeLen(String(row.sizeLength));
    setFSizeWid(row.sizeWidth != null ? String(row.sizeWidth) : "");
    setFHsnCodeId(row.hsnCodeId ?? "");
    setFDescription(row.description ?? "");
    setFActive(row.isActive);
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const dto: Record<string, unknown> = {
        millId: fMillId, qualityId: fQualityId, itemTypeId: fItemTypeId,
        gsm: Number(fGsm),
        sizeLength: Number(fSizeLen),
        sizeWidth: (!isReel && fSizeWid) ? Number(fSizeWid) : undefined,
        grain: grain ?? undefined,
        hsnCodeId: fHsnCodeId || undefined,
        description: fDescription.trim() || undefined,
      };
      if (editItem) {
        const u = await materialApi.update(editItem.id, { ...dto, isActive: fActive });
        setData((prev) => prev.map((x) => x.id === u.id ? u : x));
      } else {
        const c = await materialApi.create(dto);
        setData((prev) => [c, ...prev]);
      }
      setShowModal(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await materialApi.remove(id);
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setDeleteId(null);
    }
  }

  const canSave =
    !!fMillId && !!fQualityId && !!fItemTypeId &&
    Number(fGsm) > 0 && Number(fSizeLen) > 0 &&
    (isReel || Number(fSizeWid) > 0);

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns: ColumnConfig<MaterialRow>[] = useMemo(() => [
    {
      id: "code", accessorKey: "code", header: "Item Code",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 220,
      cell: (info) => <span className="font-mono text-xs font-semibold text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "millName", accessorKey: "millName", header: "Mill",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => <span className="text-sm text-gray-700">{info.getValue() as string}</span>,
    },
    {
      id: "qualityName", accessorKey: "qualityName", header: "Quality",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => (
        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      id: "brandName", accessorKey: "brandName", header: "Brand",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 100,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 border border-violet-100">{v}</span>
          : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      id: "gsm", accessorKey: "gsm", header: "GSM",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 70,
      cell: (info) => (
        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-100">
          {info.getValue() as number}
        </span>
      ),
    },
    {
      id: "itemTypeName", accessorKey: "itemTypeName", header: "Type",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 85,
      cell: (info) => {
        const t = info.getValue() as string;
        const isR = t?.toLowerCase().includes("reel");
        return (
          <span className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium border",
            isR ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-green-50 text-green-700 border-green-100"
          )}>{t}</span>
        );
      },
    },
    {
      id: "sizeLabel", accessorKey: "sizeLabel", header: "Size",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 90,
      cell: (info) => <span className="font-mono text-xs text-gray-700">{info.getValue() as string}</span>,
    },
    {
      id: "grain", accessorKey: "grain", header: "Grain",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 110,
      cell: (info) => {
        const g = info.getValue() as string | undefined;
        if (!g) return <span className="text-gray-300 text-xs">—</span>;
        return (
          <span className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium border",
            g === "Long Grain" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-orange-50 text-orange-700 border-orange-200"
          )}>{g}</span>
        );
      },
    },
    {
      id: "isActive", accessorKey: "isActive", header: "Status",
      filterType: "select",
      filterOptions: [{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }],
      enableSorting: true, defaultVisible: true, size: 90,
      cell: (info) => {
        const v = info.getValue() as boolean;
        return (
          <span className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border",
            v ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"
          )}>{v ? "Active" : "Inactive"}</span>
        );
      },
    },
    {
      id: "_actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 50,
      cell: (info) => {
        const row = info.row.original as MaterialRow;
        return (
          <ActionMenu items={[
            { label: "View",   icon: Eye,    onClick: () => setViewItem(row) },
            { label: "Edit",   icon: Pencil, onClick: () => openEdit(row) },
            { label: "Delete", icon: Trash2, onClick: () => setDeleteId(row.id), variant: "danger" },
          ]} />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <DataGrid
        data={data} columns={columns} tableName="items"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Item
          </button>
        }
      />

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit Item" : "Add Item"} size="md"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !canSave}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? "Save Changes" : "Add Item"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Item Details
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Mill *</label>
                <select value={fMillId} onChange={(e) => setFMillId(Number(e.target.value))} className={selectCls}>
                  <option value="">— select mill —</option>
                  {mills.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Quality *</label>
                <select value={fQualityId} onChange={(e) => setFQualityId(Number(e.target.value))} className={selectCls}>
                  <option value="">— select quality —</option>
                  {qualities.map((q) => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Brand Name</label>
                <div className={cn(
                  "flex items-center h-[38px] px-3 rounded-lg border",
                  selectedQuality?.alias
                    ? "bg-violet-50 border-violet-200"
                    : "bg-gray-50 border-gray-200"
                )}>
                  {selectedQuality?.alias
                    ? <span className="text-sm font-semibold text-violet-700">{selectedQuality.alias}</span>
                    : <span className="text-xs text-gray-400">auto from quality</span>
                  }
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>GSM *</label>
                <input
                  value={fGsm} onChange={(e) => setFGsm(e.target.value)}
                  type="number" min="1" placeholder="e.g. 80"
                  list="gsm-options" className={inputCls}
                />
                <datalist id="gsm-options">
                  {COMMON_GSM.map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Item Type *</label>
                <select
                  value={fItemTypeId}
                  onChange={(e) => { setFItemTypeId(e.target.value ? Number(e.target.value) : ""); setFSizeWid(""); }}
                  className={selectCls}
                >
                  <option value="">— select type —</option>
                  {itemTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Size fields */}
            <div className={cn("grid gap-3", isReel ? "grid-cols-1" : "grid-cols-2")}>
              <div>
                <label className={labelCls}>{isReel ? "Width (cm) *" : "Length (cm) *"}</label>
                <input value={fSizeLen} onChange={(e) => setFSizeLen(e.target.value)}
                  type="number" min="0.01" step="0.01" placeholder="e.g. 72" className={inputCls} />
              </div>
              {!isReel && (
                <div>
                  <label className={labelCls}>Width (cm) *</label>
                  <input value={fSizeWid} onChange={(e) => setFSizeWid(e.target.value)}
                    type="number" min="0.01" step="0.01" placeholder="e.g. 100" className={inputCls} />
                </div>
              )}
            </div>

            {/* Grain + sheet weight row */}
            {(grain || sheetWeight != null) && (
              <div className="flex items-center gap-3">
                {grain && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Grain</span>
                    <span className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                      grain === "Long Grain"
                        ? "bg-teal-50 text-teal-700 border-teal-200"
                        : "bg-orange-50 text-orange-700 border-orange-200"
                    )}>{grain}</span>
                  </div>
                )}
                {sheetWeight != null && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Scale className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-700 font-medium">
                      1 sheet ≈ <span className="font-mono font-semibold">
                        {sheetWeight < 0.01 ? sheetWeight.toFixed(6) : sheetWeight.toFixed(4)} kg
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* HSN Code */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>HSN Code</label>
                <select value={fHsnCodeId} onChange={(e) => setFHsnCodeId(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
                  <option value="">— none —</option>
                  {hsnCodes.map((h) => <option key={h.id} value={h.id}>{h.code}{h.description ? ` — ${h.description}` : ""}</option>)}
                </select>
              </div>
              {fHsnCodeId !== "" && (() => {
                const h = hsnCodes.find((x) => x.id === fHsnCodeId);
                return h ? (
                  <div className="flex flex-col justify-end pb-0.5">
                    <label className={labelCls}>GST %</label>
                    <div className="flex items-center h-[38px] px-3 rounded-lg bg-indigo-50 border border-indigo-200">
                      <span className="text-sm font-semibold text-indigo-700">{h.gstPercent}%</span>
                      <span className="ml-2 text-xs text-indigo-400">(from HSN master)</span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Code preview */}
            {codePreview && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">Item Code</span>
                <span className="font-mono text-xs font-bold text-gray-900">{codePreview}</span>
              </div>
            )}
          </div>

          {/* Notes + Active */}
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <div>
              <label className={labelCls}>Description</label>
              <input value={fDescription} onChange={(e) => setFDescription(e.target.value)}
                placeholder="Optional notes" className={inputCls} />
            </div>
            {editItem && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button type="button" onClick={() => setFActive((v) => !v)}
                  className={cn("relative h-5 w-9 rounded-full transition-colors cursor-pointer",
                    fActive ? "bg-blue-500" : "bg-gray-200")}>
                  <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    fActive ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ── View Modal ────────────────────────────────────────────────────── */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Item Details" size="sm"
          footer={
            <button onClick={() => setViewItem(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Close
            </button>
          }
        >
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            {[
              { label: "Item Code", value: viewItem.code,                        mono: true  },
              { label: "Mill",      value: viewItem.millName                                  },
              { label: "Quality",   value: viewItem.qualityName                               },
              ...(viewItem.brandName ? [{ label: "Brand", value: viewItem.brandName }] : []),
              { label: "GSM",       value: `${viewItem.gsm}`                                  },
              { label: "Type",      value: viewItem.itemTypeName                              },
              { label: "Size",      value: viewItem.sizeLabel,                   mono: true  },
              ...(viewItem.grain ? [{ label: "Grain", value: viewItem.grain }] : []),
              ...(viewItem.hsnCode ? [{ label: "HSN Code", value: viewItem.hsnCode, mono: true }] : []),
              ...(viewItem.gstPercent != null ? [{ label: "GST %", value: `${viewItem.gstPercent}%` }] : []),
              { label: "Status",    value: viewItem.isActive ? "Active" : "Inactive"          },
              ...(viewItem.description ? [{ label: "Notes", value: viewItem.description }] : []),
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <span className="text-gray-500 shrink-0">{label}</span>
                <span className={cn("font-medium text-gray-900 text-right", mono && "font-mono text-xs")}>{value}</span>
              </div>
            ))}
            {!viewItem.itemTypeName?.toLowerCase().includes("reel") && viewItem.sizeWidth && (
              <div className="mt-2 pt-2 border-t border-gray-100 rounded-lg bg-green-50 px-3 py-2">
                <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                  <Scale className="h-3 w-3" />
                  1 sheet ≈ {sheetWeightKg(viewItem.gsm, viewItem.sizeLength, viewItem.sizeWidth).toFixed(4)} kg
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Item" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteId(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => handleDelete(deleteId!)}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">
              Delete
            </button>
          </>
        }>
        <div className="rounded-xl bg-white p-4 shadow-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">
            Delete <span className="font-semibold font-mono">{data.find((x) => x.id === deleteId)?.code}</span>? This cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
