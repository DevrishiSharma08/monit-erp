"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { RowDetailModal } from "@/components/RowDetailModal";
import { cn } from "@/lib/utils";
import { localityApi, LocalityRow } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

export default function LocalityMasterPage() {
  const [data,      setData]      = useState<LocalityRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<LocalityRow | null>(null);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [viewItem,  setViewItem]  = useState<LocalityRow | null>(null);

  const [fName,   setFName]   = useState("");
  const [fCity,   setFCity]   = useState("");
  const [fState,  setFState]  = useState("");
  const [fDesc,   setFDesc]   = useState("");
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await localityApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditItem(null);
    setFName(""); setFCity(""); setFState(""); setFDesc(""); setFActive(true);
    setShowModal(true);
  }

  function openEdit(item: LocalityRow) {
    setEditItem(item);
    setFName(item.name);
    setFCity(item.city ?? "");
    setFState(item.state ?? "");
    setFDesc(item.description ?? "");
    setFActive(item.isActive);
    setShowModal(true);
  }

  const canSave = fName.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editItem) {
        const u = await localityApi.update(editItem.id, {
          name:        fName.trim(),
          city:        fCity.trim() || undefined,
          state:       fState.trim() || undefined,
          description: fDesc.trim() || undefined,
          isActive:    fActive,
        });
        setData((prev) => prev.map((x) => x.id === u.id ? u : x));
      } else {
        const c = await localityApi.create({
          name:        fName.trim(),
          city:        fCity.trim() || undefined,
          state:       fState.trim() || undefined,
          description: fDesc.trim() || undefined,
        });
        setData((prev) => [...prev, c]);
      }
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      await localityApi.remove(id);
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  const columns: ColumnConfig<LocalityRow>[] = useMemo(() => [
    {
      id: "name", accessorKey: "name", header: "Name",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 200,
      cell: (info) => <span className="font-medium text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "city", accessorKey: "city", header: "City",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
    },
    {
      id: "state", accessorKey: "state", header: "State",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 170,
      cell: (info) => <span>{(info.getValue() as string) ?? "—"}</span>,
    },
    {
      id: "description", accessorKey: "description", header: "Description",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 260,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return <span className="text-gray-400 text-xs">{v ?? "—"}</span>;
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
        data={data} columns={columns} tableName="localities"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Locality
          </button>
        }
      />

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit Locality" : "Add Locality"} size="sm"
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
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Locality Name *</label>
              <input value={fName} onChange={(e) => setFName(e.target.value)}
                placeholder="e.g. Vijay Nagar, Scheme 54" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input value={fCity} onChange={(e) => setFCity(e.target.value)}
                placeholder="e.g. Indore" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>State</label>
              <input value={fState} onChange={(e) => setFState(e.target.value)}
                placeholder="e.g. Madhya Pradesh" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input value={fDesc} onChange={(e) => setFDesc(e.target.value)}
                placeholder="Optional hint" className={inputCls} />
            </div>
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

      {/* ── View Modal ───────────────────────────────────────────────────────── */}
      {viewItem && (
        <RowDetailModal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Locality Details"
          fields={[
            { label: "Name",        value: viewItem.name },
            { label: "City",        value: viewItem.city },
            { label: "State",       value: viewItem.state },
            { label: "Status",      value: viewItem.isActive ? "Active" : "Inactive" },
            { label: "Description", value: viewItem.description, span: true },
            { label: "Created At",  value: viewItem.createdAt,   span: true },
          ]}
        />
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Locality" size="sm"
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
            Delete locality <span className="font-semibold">{data.find((x) => x.id === deleteId)?.name}</span>?{" "}
            This will prevent it from being used in new customer records.
          </p>
        </div>
      </Modal>
    </div>
  );
}
