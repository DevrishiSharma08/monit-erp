"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2, X } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { RowDetailModal } from "@/components/RowDetailModal";
import { cn } from "@/lib/utils";
import { instructionApi, InstructionRow, millApi, MillDropdown } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

export default function InstructionMasterPage() {
  const [data,      setData]      = useState<InstructionRow[]>([]);
  const [mills,     setMills]     = useState<MillDropdown[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<InstructionRow | null>(null);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [viewItem,  setViewItem]  = useState<InstructionRow | null>(null);

  // form state
  const [fTitle,         setFTitle]         = useState("");
  const [fApplicableTo,  setFApplicableTo]  = useState<"All" | "Specific">("All");
  const [fMillIds,       setFMillIds]       = useState<number[]>([]);
  const [fLines,         setFLines]         = useState<string[]>([""]);
  const [fActive,        setFActive]        = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await instructionApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  const loadMills = useCallback(async () => {
    try { setMills(await millApi.dropdown()); }
    catch { /* non-fatal */ }
  }, []);

  useEffect(() => { load(); loadMills(); }, [load, loadMills]);

  function openAdd() {
    setEditItem(null);
    setFTitle(""); setFApplicableTo("All"); setFMillIds([]); setFLines([""]); setFActive(true);
    setShowModal(true);
  }

  function openEdit(item: InstructionRow) {
    setEditItem(item);
    setFTitle(item.title ?? "");
    setFApplicableTo(item.applicableTo);
    setFMillIds(item.millIds ?? []);
    setFLines(item.lines.length > 0 ? item.lines : [""]);
    setFActive(item.isActive);
    setShowModal(true);
  }

  function toggleMill(id: number) {
    setFMillIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function updateLine(idx: number, val: string) {
    setFLines((prev) => prev.map((l, i) => i === idx ? val : l));
  }

  function addLine() {
    setFLines((prev) => [...prev, ""]);
  }

  function removeLine(idx: number) {
    setFLines((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  const cleanLines = fLines.filter((l) => l.trim().length > 0);

  const canSave =
    cleanLines.length > 0 &&
    (fApplicableTo === "All" || fMillIds.length > 0);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editItem) {
        const u = await instructionApi.update(editItem.id, {
          title: fTitle.trim() || undefined,
          applicableTo: fApplicableTo,
          millIds: fApplicableTo === "All" ? [] : fMillIds,
          lines: cleanLines,
          isActive: fActive,
        });
        setData((prev) => prev.map((x) => x.id === u.id ? u : x));
      } else {
        const c = await instructionApi.create({
          title: fTitle.trim() || undefined,
          applicableTo: fApplicableTo,
          millIds: fApplicableTo === "All" ? [] : fMillIds,
          lines: cleanLines,
        });
        setData((prev) => [...prev, c]);
      }
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      await instructionApi.remove(id);
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  const columns: ColumnConfig<InstructionRow>[] = useMemo(() => [
    {
      id: "title", accessorKey: "title", header: "Title",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 220,
      cell: (info) => <span className="font-medium text-gray-900">{(info.getValue() as string | undefined) ?? <span className="text-gray-400 italic">Untitled</span>}</span>,
    },
    {
      id: "applicableTo", accessorKey: "applicableTo", header: "Scope",
      filterType: "select",
      filterOptions: [{ label: "All Mills", value: "All" }, { label: "Specific Mills", value: "Specific" }],
      enableSorting: false, defaultVisible: true, size: 180,
      cell: (info) => {
        const row = info.row.original;
        if (row.applicableTo === "All") {
          return (
            <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              All Mills
            </span>
          );
        }
        const names = (row.millIds ?? []).map(id => mills.find(m => m.id === id)?.name ?? `Mill #${id}`);
        return (
          <span title={names.join(", ")}
            className="inline-flex items-center rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-xs font-semibold text-violet-700 cursor-default">
            {names.length} {names.length === 1 ? "Mill" : "Mills"}
          </span>
        );
      },
    },
    {
      id: "lines", accessorKey: "lines", header: "Instructions",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 160,
      cell: (info) => {
        const lines = info.getValue() as string[];
        const first = lines[0] ?? "";
        return (
          <span title={first}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 cursor-default">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        );
      },
    },
    {
      id: "isActive", accessorKey: "isActive", header: "Status",
      filterType: "select", filterOptions: [{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }],
      enableSorting: true, defaultVisible: true, size: 110,
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
        const row = info.row.original;
        return (
          <ActionMenu items={[
            { label: "View",   icon: Eye,    onClick: () => setViewItem(row) },
            { label: "Edit",   icon: Pencil, onClick: () => openEdit(row) },
            { label: "Delete", icon: Trash2, onClick: () => setDeleteId(row.id), variant: "danger" },
          ]} />
        );
      },
    },
  ], [mills]);

  return (
    <div className="space-y-5 pb-24">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <DataGrid
        data={data} columns={columns} tableName="instructions"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Instruction Set
          </button>
        }
      />

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit Instruction Set" : "Add Instruction Set"} size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !canSave}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? "Save Changes" : "Add"}
            </button>
          </>
        }>
        <div className="space-y-4 p-1">

          {/* Title */}
          <div>
            <label className={labelCls}>Instruction Set Title</label>
            <input value={fTitle} onChange={(e) => setFTitle(e.target.value)}
              placeholder='e.g. "Standard Mill Instructions", "Premium Quality Set"'
              className={inputCls} />
          </div>

          {/* Applicable To */}
          <div>
            <label className={labelCls}>Applicable To *</label>
            <div className="flex gap-2 mb-3">
              {(["All", "Specific"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setFApplicableTo(v)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                    fApplicableTo === v
                      ? "bg-blue-500 text-white shadow-sm"
                      : "border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}>
                  {v === "All" ? "All Mills" : "Specific Mills"}
                </button>
              ))}
            </div>

            {/* Mill multi-select — only when Specific */}
            {fApplicableTo === "Specific" && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Mills</p>
                  {fMillIds.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      {fMillIds.length} selected
                    </span>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                  {mills.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-400">No mills available</p>
                  ) : mills.map((m) => {
                    const checked = fMillIds.includes(m.id);
                    return (
                      <label key={m.id}
                        className={cn("flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors",
                          checked ? "bg-blue-50" : "hover:bg-gray-50")}>
                        <input type="checkbox" checked={checked} onChange={() => toggleMill(m.id)}
                          className="h-3.5 w-3.5 accent-blue-500 cursor-pointer flex-shrink-0" />
                        <span className={cn("text-sm", checked ? "text-blue-700 font-medium" : "text-gray-700")}>
                          {m.name}
                        </span>
                        {m.code && (
                          <span className="ml-auto text-[10px] font-mono text-gray-400">{m.code}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {fMillIds.length === 0 && (
                  <p className="px-3 py-1.5 text-[10px] text-amber-600 bg-amber-50 border-t border-amber-100">
                    Select at least one mill
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Instruction Lines */}
          <div>
            <label className={labelCls}>Instructions *</label>
            <div className="space-y-2">
              {fLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-600">
                    {idx + 1}
                  </div>
                  <input
                    value={line}
                    onChange={(e) => updateLine(idx, e.target.value)}
                    placeholder={`Instruction ${idx + 1}…`}
                    className={inputCls + " flex-1"}
                  />
                  <button type="button" onClick={() => removeLine(idx)}
                    disabled={fLines.length === 1}
                    className="rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors w-full justify-center">
              <Plus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>

          {editItem && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
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

      {/* ── View Modal ───────────────────────────────────────────────────────── */}
      {viewItem && (
        <RowDetailModal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Instruction Set Details"
          fields={[
            { label: "Title",        value: viewItem.title ?? "(Untitled)" },
            { label: "Scope",        value: viewItem.applicableTo === "All" ? "All Mills" : (() => { const names = (viewItem.millIds ?? []).map(id => mills.find(m => m.id === id)?.name ?? `Mill #${id}`); return `${names.length} mill(s): ${names.join(", ")}`; })() },
            { label: "# Lines",      value: String(viewItem.lines.length) },
            { label: "Status",       value: viewItem.isActive ? "Active" : "Inactive" },
            { label: "Instructions", value: viewItem.lines.map((l, i) => `${i + 1}. ${l}`).join("\n"), span: true },
            { label: "Created At",   value: viewItem.createdAt, span: true },
          ]}
        />
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Instruction Set" size="sm"
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
            Delete instruction set <span className="font-semibold">{data.find((x) => x.id === deleteId)?.title}</span>?{" "}
            It will no longer appear in PO forms for any mill.
          </p>
        </div>
      </Modal>
    </div>
  );
}
