"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { RowDetailModal } from "@/components/RowDetailModal";
import { cn } from "@/lib/utils";
import { stockCategoryApi, StockCategoryRow } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";
const textareaCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none";

type GsmItem = { type: "single"; gsm: string } | { type: "range"; min: string; max: string };

function parseBulkInput(raw: string): GsmItem[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((tok) => {
      const rangeMatch = tok.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (rangeMatch) return { type: "range" as const, min: rangeMatch[1], max: rangeMatch[2] };
      return { type: "single" as const, gsm: tok };
    });
}

export default function GsmMasterPage() {
  const [data,      setData]      = useState<StockCategoryRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<StockCategoryRow | null>(null);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [viewItem,  setViewItem]  = useState<StockCategoryRow | null>(null);

  // Edit mode fields
  const [fGsmType, setFGsmType] = useState<"single" | "range">("single");
  const [fGsm,     setFGsm]     = useState("");
  const [fGsmMin,  setFGsmMin]  = useState("");
  const [fGsmMax,  setFGsmMax]  = useState("");
  const [fActive,  setFActive]  = useState(true);

  // Add mode — bulk input
  const [fBulk, setFBulk] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await stockCategoryApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditItem(null);
    setFBulk(""); setFGsmType("single"); setFGsm(""); setFGsmMin(""); setFGsmMax(""); setFActive(true);
    setShowModal(true);
  }

  function openEdit(item: StockCategoryRow) {
    setEditItem(item);
    setFGsmType(item.gsmType as "single" | "range");
    setFGsm(item.gsm != null ? String(item.gsm) : "");
    setFGsmMin(item.gsmMin != null ? String(item.gsmMin) : "");
    setFGsmMax(item.gsmMax != null ? String(item.gsmMax) : "");
    setFActive(item.isActive);
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editItem) {
        // single-edit mode
        const dto = {
          gsmType: fGsmType,
          gsm:    fGsmType === "single" ? Number(fGsm)    : undefined,
          gsmMin: fGsmType === "range"  ? Number(fGsmMin) : undefined,
          gsmMax: fGsmType === "range"  ? Number(fGsmMax) : undefined,
          isActive: fActive,
        };
        const u = await stockCategoryApi.update(editItem.id, dto);
        setData((prev) => prev.map((x) => x.id === u.id ? u : x));
      } else {
        // bulk-add mode
        const parsed = parseBulkInput(fBulk);
        if (parsed.length === 0) { setSaving(false); return; }
        const items = parsed.map((p) =>
          p.type === "single"
            ? { gsmType: "single" as const, gsm: Number(p.gsm) }
            : { gsmType: "range"  as const, gsmMin: Number(p.min), gsmMax: Number(p.max) }
        );
        const created = await stockCategoryApi.bulkCreate(items);
        setData((prev) => [...prev, ...created]);
      }
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      await stockCategoryApi.remove(id);
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  const canSave = editItem
    ? (fGsmType === "single" ? !!fGsm : !!fGsmMin && !!fGsmMax)
    : parseBulkInput(fBulk).length > 0;

  // Preview chips for bulk input
  const bulkPreview = useMemo(() => parseBulkInput(fBulk), [fBulk]);

  const columns: ColumnConfig<StockCategoryRow>[] = useMemo(() => [
    {
      id: "name", accessorKey: "name", header: "GSM Label",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 160,
      cell: (info) => <span className="font-semibold text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "gsmType", accessorKey: "gsmType", header: "Type",
      filterType: "select",
      filterOptions: [{ label: "Single", value: "single" }, { label: "Range", value: "range" }],
      enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => {
        const v = info.getValue() as string;
        return (
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border",
            v === "single" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200")}>
            {v === "single" ? "Single" : "Range"}
          </span>
        );
      },
    },
    {
      id: "gsm", accessorKey: "gsm", header: "GSM",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 90,
      cell: (info) => <span className="font-mono text-sm text-gray-700">{(info.getValue() as number) ?? "—"}</span>,
    },
    {
      id: "gsmMin", accessorKey: "gsmMin", header: "Min",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 80,
      cell: (info) => <span className="font-mono text-sm text-gray-700">{(info.getValue() as number) ?? "—"}</span>,
    },
    {
      id: "gsmMax", accessorKey: "gsmMax", header: "Max",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 80,
      cell: (info) => <span className="font-mono text-sm text-gray-700">{(info.getValue() as number) ?? "—"}</span>,
    },
    {
      id: "isActive", accessorKey: "isActive", header: "Status",
      filterType: "select", filterOptions: [{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }],
      enableSorting: true, defaultVisible: true, size: 110,
      cell: (info) => {
        const v = info.getValue() as boolean;
        return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border",
          v ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200")}>{v ? "Active" : "Inactive"}</span>;
      },
    },
    {
      id: "_actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 50,
      cell: (info) => {
        const row = info.row.original;
        return (
          <ActionMenu items={[
            { label: "View",   icon: Eye,    onClick: () => setViewItem(row)      },
            { label: "Edit",   icon: Pencil, onClick: () => openEdit(row)         },
            { label: "Delete", icon: Trash2, onClick: () => setDeleteId(row.id), variant: "danger" },
          ]} />
        );
      },
    },
  ], []);

  return (
    <div className="space-y-5 pb-24">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      <DataGrid
        data={data} columns={columns} tableName="gsm-master"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add GSM
          </button>
        }
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit GSM" : "Add GSM"} size="sm"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !canSave}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? "Save Changes" : `Add${bulkPreview.length > 1 ? ` (${bulkPreview.length})` : ""}`}
            </button>
          </>
        }>
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3.5">
          {!editItem ? (
            <>
              <div>
                <label className={labelCls}>GSM Values *</label>
                <textarea
                  value={fBulk}
                  onChange={(e) => setFBulk(e.target.value)}
                  rows={3}
                  placeholder={"e.g.  80, 90, 100, 120, 200-400"}
                  className={textareaCls}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Separate with commas. Use <span className="font-mono">200-400</span> for a range.
                </p>
              </div>
              {bulkPreview.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Preview</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bulkPreview.map((p, i) => (
                      <span key={i} className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border",
                        p.type === "range"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      )}>
                        {p.type === "range" ? `${p.min}–${p.max} GSM` : `${p.gsm} GSM`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>GSM Type</label>
                <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                  {(["single", "range"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setFGsmType(t)}
                      className={cn("flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-all",
                        fGsmType === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                      {t === "single" ? "Single GSM" : "GSM Range"}
                    </button>
                  ))}
                </div>
              </div>
              {fGsmType === "single" ? (
                <div>
                  <label className={labelCls}>GSM Value *</label>
                  <input value={fGsm} onChange={(e) => setFGsm(e.target.value)} type="number" placeholder="e.g. 200" className={inputCls} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>GSM Min *</label>
                    <input value={fGsmMin} onChange={(e) => setFGsmMin(e.target.value)} type="number" placeholder="200" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>GSM Max *</label>
                    <input value={fGsmMax} onChange={(e) => setFGsmMax(e.target.value)} type="number" placeholder="400" className={inputCls} />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button type="button" onClick={() => setFActive((v) => !v)}
                  className={cn("relative h-5 w-9 rounded-full transition-colors cursor-pointer",
                    fActive ? "bg-blue-500" : "bg-gray-200")}>
                  <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    fActive ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {viewItem && (
        <RowDetailModal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="GSM Details"
          fields={[
            { label: "Label",   value: viewItem.name },
            { label: "Type",    value: viewItem.gsmType === "single" ? "Single" : "Range" },
            { label: "GSM",     value: viewItem.gsm != null ? String(viewItem.gsm) : undefined },
            { label: "GSM Min", value: viewItem.gsmMin != null ? String(viewItem.gsmMin) : undefined },
            { label: "GSM Max", value: viewItem.gsmMax != null ? String(viewItem.gsmMax) : undefined },
            { label: "Status",  value: viewItem.isActive ? "Active" : "Inactive" },
          ]}
        />
      )}

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete GSM" size="sm"
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
          <p className="text-sm text-gray-600">Delete <span className="font-semibold">{data.find((x) => x.id === deleteId)?.name}</span>? This cannot be undone.</p>
        </div>
      </Modal>
    </div>
  );
}
