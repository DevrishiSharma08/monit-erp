"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { RowDetailModal } from "@/components/RowDetailModal";
import { cn } from "@/lib/utils";
import { hsnCodeApi, HsnCodeRow } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

export default function HsnMasterPage() {
  const [data,      setData]      = useState<HsnCodeRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<HsnCodeRow | null>(null);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [viewItem,  setViewItem]  = useState<HsnCodeRow | null>(null);

  const [fCode,   setFCode]   = useState("");
  const [fDesc,   setFDesc]   = useState("");
  const [fGst,    setFGst]    = useState("");
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await hsnCodeApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditItem(null);
    setFCode(""); setFDesc(""); setFGst(""); setFActive(true);
    setShowModal(true);
  }

  function openEdit(item: HsnCodeRow) {
    setEditItem(item);
    setFCode(item.code);
    setFDesc(item.description ?? "");
    setFGst(String(item.gstPercent));
    setFActive(item.isActive);
    setShowModal(true);
  }

  const canSave = fCode.trim().length > 0 && fGst !== "" && !isNaN(Number(fGst)) && Number(fGst) >= 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editItem) {
        const u = await hsnCodeApi.update(editItem.id, {
          code: fCode.trim(),
          description: fDesc.trim() || undefined,
          gstPercent: Number(fGst),
          isActive: fActive,
        });
        setData((prev) => prev.map((x) => x.id === u.id ? u : x));
      } else {
        const c = await hsnCodeApi.create({
          code: fCode.trim(),
          description: fDesc.trim() || undefined,
          gstPercent: Number(fGst),
        });
        setData((prev) => [...prev, c]);
      }
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      await hsnCodeApi.remove(id);
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  const columns: ColumnConfig<HsnCodeRow>[] = useMemo(() => [
    {
      id: "code", accessorKey: "code", header: "HSN Code",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 140,
      cell: (info) => <span className="font-mono font-semibold text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "description", accessorKey: "description", header: "Description",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 300,
      cell: (info) => <span className="text-gray-500 text-xs">{(info.getValue() as string) ?? "—"}</span>,
    },
    {
      id: "gstPercent", accessorKey: "gstPercent", header: "GST %",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 90,
      cell: (info) => {
        const v = info.getValue() as number;
        return (
          <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {v}%
          </span>
        );
      },
    },
    {
      id: "cgstPercent", accessorKey: "cgstPercent", header: "CGST %",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 90,
      cell: (info) => {
        const row = info.row.original;
        const v = row.cgstPercent ?? row.gstPercent / 2;
        return <span className="text-xs text-blue-600 font-medium">{v}%</span>;
      },
    },
    {
      id: "sgstPercent", accessorKey: "sgstPercent", header: "SGST %",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 90,
      cell: (info) => {
        const row = info.row.original;
        const v = row.sgstPercent ?? row.gstPercent / 2;
        return <span className="text-xs text-teal-600 font-medium">{v}%</span>;
      },
    },
    {
      id: "igstPercent", accessorKey: "igstPercent", header: "IGST %",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 90,
      cell: (info) => {
        const row = info.row.original;
        const v = row.igstPercent ?? row.gstPercent;
        return <span className="text-xs text-purple-600 font-medium">{v}%</span>;
      },
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
            { label: "View",   icon: Eye,    onClick: () => setViewItem(row)       },
            { label: "Edit",   icon: Pencil, onClick: () => openEdit(row)          },
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
        data={data} columns={columns} tableName="hsn-codes"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add HSN Code
          </button>
        }
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit HSN Code" : "Add HSN Code"} size="sm"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !canSave}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? "Save Changes" : "Add"}
            </button>
          </>
        }>
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>HSN Code *</label>
              <input value={fCode} onChange={(e) => setFCode(e.target.value)}
                placeholder="e.g. 4802, 4810" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>GST % *</label>
              <input type="number" min="0" max="100" step="0.01"
                value={fGst} onChange={(e) => setFGst(e.target.value)}
                placeholder="e.g. 18" className={inputCls} />
            </div>
          </div>

          {/* Auto-computed tax split — read-only */}
          {fGst !== "" && !isNaN(Number(fGst)) && Number(fGst) > 0 && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Tax Rate Breakdown (auto-computed)</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-blue-50 border border-blue-100 px-2 py-1.5">
                  <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">CGST</p>
                  <p className="text-sm font-bold text-blue-700">{(Number(fGst) / 2).toFixed(Number(fGst) % 2 === 0 ? 0 : 2)}%</p>
                  <p className="text-[9px] text-blue-400">Intra-state</p>
                </div>
                <div className="rounded-md bg-teal-50 border border-teal-100 px-2 py-1.5">
                  <p className="text-[10px] text-teal-400 font-semibold uppercase tracking-wide">SGST</p>
                  <p className="text-sm font-bold text-teal-700">{(Number(fGst) / 2).toFixed(Number(fGst) % 2 === 0 ? 0 : 2)}%</p>
                  <p className="text-[9px] text-teal-400">Intra-state</p>
                </div>
                <div className="rounded-md bg-purple-50 border border-purple-100 px-2 py-1.5">
                  <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide">IGST</p>
                  <p className="text-sm font-bold text-purple-700">{Number(fGst)}%</p>
                  <p className="text-[9px] text-purple-400">Inter-state</p>
                </div>
              </div>
              <p className="mt-1.5 text-[10px] text-gray-400">CGST + SGST = {Number(fGst)}% (for same-state). IGST = {Number(fGst)}% (for cross-state).</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Description</label>
            <input value={fDesc} onChange={(e) => setFDesc(e.target.value)}
              placeholder="e.g. Uncoated writing/printing paper" className={inputCls} />
          </div>
          {editItem && (
            <div className="flex items-center justify-between pt-1">
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
      </Modal>

      {viewItem && (
        <RowDetailModal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="HSN Code Details"
          fields={[
            { label: "HSN Code",    value: viewItem.code },
            { label: "GST %",       value: `${viewItem.gstPercent}%` },
            { label: "Status",      value: viewItem.isActive ? "Active" : "Inactive" },
            { label: "Description", value: viewItem.description, span: true },
          ]}
        />
      )}

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete HSN Code" size="sm"
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
          <p className="text-sm text-gray-600">Delete HSN code <span className="font-semibold font-mono">{data.find((x) => x.id === deleteId)?.code}</span>? This cannot be undone.</p>
        </div>
      </Modal>
    </div>
  );
}
