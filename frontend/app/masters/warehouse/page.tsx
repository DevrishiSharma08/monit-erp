"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, X } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { cn } from "@/lib/utils";
import { warehouseApi, WarehouseRow, WarehouseDetailRow } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls  = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls  = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";
const cardCls   = "rounded-xl border border-gray-100 bg-white p-4 shadow-sm";
const smInputCls = "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";

type RackDraft = { name: string; stackCount: string; };
type BinDraft  = { name: string; expanded: boolean; racks: RackDraft[]; };

function emptyRack(): RackDraft { return { name: "", stackCount: "1" }; }
function emptyBin():  BinDraft  { return { name: "", expanded: true, racks: [emptyRack()] }; }

export default function WarehouseMasterPage() {
  const [data,          setData]          = useState<WarehouseRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showModal,     setShowModal]     = useState(false);
  const [editItem,      setEditItem]      = useState<WarehouseRow | null>(null);
  const [deleteId,      setDeleteId]      = useState<number | null>(null);
  const [viewItem,      setViewItem]      = useState<WarehouseDetailRow | null>(null);

  const [fUnit,   setFUnit]   = useState("");
  const [fName,   setFName]   = useState("");
  const [fActive, setFActive] = useState(true);
  const [fBins,   setFBins]   = useState<BinDraft[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await warehouseApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() { setFUnit(""); setFName(""); setFActive(true); setFBins([]); }

  function openAdd() { setEditItem(null); resetForm(); setShowModal(true); }

  async function openEdit(item: WarehouseRow) {
    setEditItem(item); resetForm(); setShowModal(true); setDetailLoading(true);
    try {
      const d = await warehouseApi.getById(item.id);
      setFUnit(d.unit); setFName(d.name); setFActive(d.isActive);
      setFBins(d.bins.map(b => ({
        name: b.name, expanded: true,
        racks: b.racks.map(r => ({ name: r.name, stackCount: String(r.stackCount) })),
      })));
    } catch { /* keep basic fields */ }
    finally { setDetailLoading(false); }
  }

  async function openView(item: WarehouseRow) {
    try { setViewItem(await warehouseApi.getById(item.id)); }
    catch { setError("Failed to load details"); }
  }

  // Bin helpers
  function addBin() { setFBins(prev => [...prev, emptyBin()]); }
  function removeBin(bi: number) { setFBins(prev => prev.filter((_, i) => i !== bi)); }
  function toggleBin(bi: number) { setFBins(prev => prev.map((b, i) => i === bi ? { ...b, expanded: !b.expanded } : b)); }
  function updateBinName(bi: number, val: string) { setFBins(prev => prev.map((b, i) => i === bi ? { ...b, name: val } : b)); }

  // Rack helpers
  function addRack(bi: number) { setFBins(prev => prev.map((b, i) => i === bi ? { ...b, racks: [...b.racks, emptyRack()] } : b)); }
  function removeRack(bi: number, ri: number) { setFBins(prev => prev.map((b, i) => i === bi ? { ...b, racks: b.racks.filter((_, j) => j !== ri) } : b)); }
  function updateRack(bi: number, ri: number, field: keyof RackDraft, val: string) {
    setFBins(prev => prev.map((b, i) => i === bi ? { ...b, racks: b.racks.map((r, j) => j === ri ? { ...r, [field]: val } : r) } : b));
  }

  const isFormValid = fUnit.trim() !== "" && fName.trim() !== "";

  async function handleSave() {
    if (!isFormValid) return;
    setSaving(true);
    try {
      const bins = fBins
        .filter(b => b.name.trim())
        .map(b => ({
          name: b.name.trim(), isActive: true,
          racks: b.racks.filter(r => r.name.trim()).map(r => ({
            name: r.name.trim(), stackCount: Math.max(1, Number(r.stackCount) || 1), isActive: true,
          })),
        }));
      const base = { unit: fUnit.trim(), name: fName.trim(), bins };
      if (editItem) {
        await warehouseApi.update(editItem.id, { ...base, isActive: fActive });
      } else {
        await warehouseApi.create(base);
      }
      await load(); setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try { await warehouseApi.remove(id); setData(prev => prev.filter(x => x.id !== id)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  const columns: ColumnConfig<WarehouseRow>[] = useMemo(() => [
    {
      id: "unit", accessorKey: "unit", header: "Unit",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 120,
      cell: (info) => <span className="font-semibold text-gray-900 text-sm">{info.getValue() as string}</span>,
    },
    {
      id: "name", accessorKey: "name", header: "Warehouse",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 200,
      cell: (info) => <span className="text-gray-700 text-sm">{info.getValue() as string}</span>,
    },
    {
      id: "binCount", accessorKey: "binCount", header: "Bins",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 80,
      cell: (info) => {
        const n = info.getValue() as number;
        return n > 0
          ? <span className="inline-flex rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-xs font-medium">{n}</span>
          : <span className="text-gray-400 text-xs">—</span>;
      },
    },
    {
      id: "rackCount", accessorKey: "rackCount", header: "Racks",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 80,
      cell: (info) => {
        const n = info.getValue() as number;
        return n > 0
          ? <span className="inline-flex rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-medium">{n}</span>
          : <span className="text-gray-400 text-xs">—</span>;
      },
    },
    {
      id: "isActive", accessorKey: "isActive", header: "Status",
      filterType: "select", filterOptions: [{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }],
      enableSorting: true, defaultVisible: true, size: 100,
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
            { label: "View",   icon: Eye,    onClick: () => openView(row) },
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
        data={data} columns={columns} tableName="warehouses"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Warehouse
          </button>
        }
      />

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit Warehouse" : "Add Warehouse"} size="lg"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !isFormValid || detailLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? "Save Changes" : "Add"}
            </button>
          </>
        }>

        {detailLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
        ) : (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className={cn(cardCls, "space-y-3.5")}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Unit *</label>
                  <input type="text" value={fUnit} onChange={e => setFUnit(e.target.value)} placeholder="e.g. Main Unit" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Warehouse Name *</label>
                  <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Godown A" className={inputCls} />
                </div>
                {editItem && (
                  <div className="col-span-2 flex items-center justify-between pt-1">
                    <label className="text-sm font-medium text-gray-700">Active</label>
                    <button type="button" onClick={() => setFActive(v => !v)}
                      className={cn("relative h-5 w-9 rounded-full transition-colors cursor-pointer", fActive ? "bg-blue-500" : "bg-gray-200")}>
                      <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", fActive ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bins & Racks */}
            <div className={cn(cardCls, "space-y-2")}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Bins &amp; Racks</p>
                <button type="button" onClick={addBin}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                  <Plus className="h-3 w-3" /> Add Bin
                </button>
              </div>

              {fBins.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No bins yet. Click &ldquo;Add Bin&rdquo; to start.</p>}

              {fBins.map((bin, bi) => (
                <div key={bi} className="rounded-lg border border-gray-200 overflow-hidden">
                  {/* Bin header row */}
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
                    <button type="button" onClick={() => toggleBin(bi)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      {bin.expanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-8 flex-shrink-0">Bin</span>
                    <input
                      value={bin.name}
                      onChange={e => updateBinName(bi, e.target.value)}
                      placeholder="e.g. A"
                      className="flex-1 rounded border border-gray-200 bg-white px-2.5 py-1 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-w-0"
                    />
                    <span className="text-xs text-gray-400 flex-shrink-0">{bin.racks.length} rack{bin.racks.length !== 1 ? "s" : ""}</span>
                    <button type="button" onClick={() => removeBin(bi)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Racks (collapsible) */}
                  {bin.expanded && (
                    <div className="px-3 pb-2 pt-1 space-y-1.5 bg-white">
                      {bin.racks.length === 0 && <p className="text-xs text-gray-400 py-1">No racks. Click &ldquo;+ Rack&rdquo; to add.</p>}

                      {/* Column headers for first rack */}
                      {bin.racks.length > 0 && (
                        <div className="grid grid-cols-[1fr_80px_auto] gap-2 px-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Rack Name</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Stacks</span>
                          <span />
                        </div>
                      )}

                      {bin.racks.map((rack, ri) => (
                        <div key={ri} className="grid grid-cols-[1fr_80px_auto] gap-2 items-center">
                          <input
                            value={rack.name}
                            onChange={e => updateRack(bi, ri, "name", e.target.value)}
                            placeholder={`e.g. ${bin.name || "A"}${ri + 1}`}
                            className={smInputCls}
                          />
                          <input
                            type="number" min={1} max={99}
                            value={rack.stackCount}
                            onChange={e => updateRack(bi, ri, "stackCount", e.target.value)}
                            className={smInputCls}
                          />
                          <button type="button" onClick={() => removeRack(bi, ri)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      <button type="button" onClick={() => addRack(bi)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium mt-1 px-1">
                        <Plus className="h-3 w-3" /> Add Rack
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Warehouse Details" size="lg">
          <div className="space-y-4">
            <div className={cn(cardCls, "space-y-2.5")}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Basic Info</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                {[
                  ["Unit",    viewItem.unit],
                  ["Name",    viewItem.name],
                  ["Bins",    String(viewItem.binCount)],
                  ["Racks",   String(viewItem.rackCount)],
                  ["Status",  viewItem.isActive ? "Active" : "Inactive"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <dt className="text-xs text-gray-400 font-medium">{l}</dt>
                    <dd className="text-sm text-gray-800 mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {viewItem.bins.length > 0 && (
              <div className={cn(cardCls, "space-y-2")}>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Bins &amp; Racks</p>
                {viewItem.bins.map((bin, bi) => (
                  <div key={bi} className="rounded-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-600">Bin {bin.name}</span>
                      <span className="text-xs text-gray-400">· {bin.racks.length} rack{bin.racks.length !== 1 ? "s" : ""}</span>
                    </div>
                    {bin.racks.length > 0 && (
                      <div className="px-3 py-2 flex flex-wrap gap-2">
                        {bin.racks.map((r, ri) => (
                          <span key={ri} className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-200 px-2 py-1 text-xs text-gray-700">
                            <span className="font-medium">{r.name}</span>
                            <span className="text-gray-400">×{r.stackCount}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Warehouse" size="sm"
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
          <p className="text-sm text-gray-600">
            Delete warehouse <span className="font-semibold text-gray-800">{data.find(x => x.id === deleteId)?.name}</span>? All bins and racks will be removed. This cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
