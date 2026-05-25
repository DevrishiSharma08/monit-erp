"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2, Truck, X, CheckCircle2, XCircle, Car } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { cn } from "@/lib/utils";
import { transporterApi, TransporterRow, TransporterDetailRow, TransporterVehicleDto } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";
const cardCls  = "rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3.5";

const CAPACITY_UNITS = ["kg", "ton", "MT"];

type VehicleDraft = { vehicleType: string; capacity: string; capacityUnit: string; freightRate: string; };

function emptyVehicle(): VehicleDraft { return { vehicleType: "", capacity: "", capacityUnit: "ton", freightRate: "" }; }

export default function TransporterMasterPage() {
  const [data,          setData]          = useState<TransporterRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showModal,     setShowModal]     = useState(false);
  const [editItem,      setEditItem]      = useState<TransporterRow | null>(null);
  const [deleteId,      setDeleteId]      = useState<number | null>(null);
  const [viewItem,      setViewItem]      = useState<TransporterDetailRow | null>(null);

  const [fName,       setFName]       = useState("");
  const [fPhone,      setFPhone]      = useState("");
  const [fEmail,      setFEmail]      = useState("");
  const [fAddress,    setFAddress]    = useState("");
  const [fGstNo,      setFGstNo]      = useState("");
  const [fPanNo,      setFPanNo]      = useState("");
  const [fTdsPct,     setFTdsPct]     = useState("");
  const [fActive,     setFActive]     = useState(true);
  const [fVehicles,   setFVehicles]   = useState<VehicleDraft[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await transporterApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFName(""); setFPhone(""); setFEmail(""); setFAddress("");
    setFGstNo(""); setFPanNo(""); setFTdsPct("");
    setFActive(true); setFVehicles([]);
  }

  function openAdd() { setEditItem(null); resetForm(); setShowModal(true); }

  async function openEdit(item: TransporterRow) {
    setEditItem(item); resetForm(); setShowModal(true); setDetailLoading(true);
    try {
      const d = await transporterApi.getById(item.id);
      setFName(d.name); setFPhone(d.phone ?? ""); setFEmail(d.email ?? "");
      setFAddress(d.address ?? ""); setFGstNo(d.gstNo ?? "");
      setFPanNo(d.panNo ?? ""); setFTdsPct(d.tdsPercent != null ? String(d.tdsPercent) : "");
      setFActive(d.isActive);
      setFVehicles(d.vehicles.map(v => ({
        vehicleType: v.vehicleType, capacity: v.capacity ? String(v.capacity) : "",
        capacityUnit: v.capacityUnit ?? "ton", freightRate: v.freightRate ? String(v.freightRate) : "",
      })));
    } catch { /* keep basic state */ }
    finally { setDetailLoading(false); }
  }

  async function openView(item: TransporterRow) {
    try { setViewItem(await transporterApi.getById(item.id)); }
    catch { setError("Failed to load details"); }
  }

  function updateVehicle(idx: number, field: keyof VehicleDraft, val: string) {
    setFVehicles(prev => prev.map((v, i) => i === idx ? { ...v, [field]: val } : v));
  }
  function removeVehicle(idx: number) { setFVehicles(prev => prev.filter((_, i) => i !== idx)); }

  const isFormValid = fName.trim() !== "";

  async function handleSave() {
    if (!isFormValid) return;
    setSaving(true);
    try {
      const vehicles: TransporterVehicleDto[] = fVehicles
        .filter(v => v.vehicleType.trim())
        .map(v => ({
          vehicleType:  v.vehicleType.trim(),
          capacity:     v.capacity ? Number(v.capacity) : undefined,
          capacityUnit: v.capacityUnit || undefined,
          freightRate:  v.freightRate ? Number(v.freightRate) : undefined,
        }));
      const base = {
        name: fName.trim(), phone: fPhone.trim() || undefined, email: fEmail.trim() || undefined,
        address: fAddress.trim() || undefined, gstNo: fGstNo.trim() || undefined,
        panNo: fPanNo.trim() || undefined, tdsPercent: fTdsPct ? Number(fTdsPct) : undefined,
        vehicles,
      };
      if (editItem) {
        await transporterApi.update(editItem.id, { ...base, isActive: fActive });
      } else {
        await transporterApi.create(base);
      }
      await load(); setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try { await transporterApi.remove(id); setData(prev => prev.filter(x => x.id !== id)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  const columns: ColumnConfig<TransporterRow>[] = useMemo(() => [
    {
      id: "name", accessorKey: "name", header: "Name",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 200,
      cell: (info) => <span className="font-semibold text-gray-900 text-sm">{info.getValue() as string}</span>,
    },
    {
      id: "phone", accessorKey: "phone", header: "Phone",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="text-gray-600 text-sm">{(info.getValue() as string | undefined) ?? "—"}</span>,
    },
    {
      id: "email", accessorKey: "email", header: "Email",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 180,
      cell: (info) => <span className="text-gray-600 text-sm">{(info.getValue() as string | undefined) ?? "—"}</span>,
    },
    {
      id: "vehicleCount", accessorKey: "vehicleCount", header: "Vehicles",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 90,
      cell: (info) => {
        const n = info.getValue() as number;
        return n > 0
          ? <span className="inline-flex rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium">{n}</span>
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

  const kpis = useMemo(() => {
    const total    = data.length;
    const active   = data.filter(d => d.isActive).length;
    const inactive = total - active;
    const vehicles = data.reduce((s, d) => s + (d.vehicleCount ?? 0), 0);
    return { total, active, inactive, vehicles };
  }, [data]);

  return (
    <div className="space-y-5 pb-24">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard title="Total Transporters" value={kpis.total}    subtitle="registered"          icon={Truck}        iconBg="bg-blue-50"  iconColor="text-blue-500" />
        <KpiCard title="Active"             value={kpis.active}   subtitle="currently active"    icon={CheckCircle2} iconBg="bg-green-50" iconColor="text-green-500"  subtitleColor="green" />
        <KpiCard title="Inactive"           value={kpis.inactive} subtitle="disabled"            icon={XCircle}      iconBg="bg-rose-50"  iconColor="text-rose-400"   subtitleColor={kpis.inactive > 0 ? "red" : "default"} />
        <KpiCard title="Total Vehicles"     value={kpis.vehicles} subtitle="registered vehicles" icon={Car}          iconBg="bg-amber-50" iconColor="text-amber-500"  subtitleColor="amber" />
      </div>

      <DataGrid
        data={data} columns={columns} tableName="transporters"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Transporter
          </button>
        }
      />

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit Transporter" : "Add Transporter"} size="lg"
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
            <div className={cardCls}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Name *</label>
                  <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Shree Transport Co." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="text" value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="e.g. 9876543210" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="e.g. info@transport.com" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Address</label>
                  <textarea rows={2} value={fAddress} onChange={e => setFAddress(e.target.value)} placeholder="Office / yard address…" className={cn(inputCls, "resize-none")} />
                </div>
                <div>
                  <label className={labelCls}>GST No.</label>
                  <input type="text" value={fGstNo} onChange={e => setFGstNo(e.target.value)} placeholder="e.g. 23AABCT1332L1ZX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>PAN No.</label>
                  <input type="text" value={fPanNo} onChange={e => setFPanNo(e.target.value)} placeholder="e.g. AABCT1332L" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>TDS %</label>
                  <input type="number" min={0} max={100} step={0.01} value={fTdsPct} onChange={e => setFTdsPct(e.target.value)} placeholder="e.g. 1.5" className={inputCls} />
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

            {/* Vehicles */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Vehicles
                  <span className="text-[10px] font-normal normal-case tracking-normal text-gray-400">(optional)</span>
                </p>
                <button type="button" onClick={() => setFVehicles(prev => [...prev, emptyVehicle()])}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {fVehicles.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No vehicles added — can be added anytime.</p>}
              {fVehicles.map((v, i) => (
                <div key={i} className="border-t border-gray-50 pt-3">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      {i === 0 && <label className={labelCls}>Vehicle Type</label>}
                      <input value={v.vehicleType} onChange={e => updateVehicle(i, "vehicleType", e.target.value)} placeholder="e.g. 10 Wheeler" className={inputCls} />
                    </div>
                    <div>
                      {i === 0 && <label className={labelCls}>Capacity</label>}
                      <input type="number" min={0} value={v.capacity} onChange={e => updateVehicle(i, "capacity", e.target.value)} placeholder="e.g. 20" className={inputCls} />
                    </div>
                    <div>
                      {i === 0 && <label className={labelCls}>Unit</label>}
                      <select value={v.capacityUnit} onChange={e => updateVehicle(i, "capacityUnit", e.target.value)} className={inputCls}>
                        {CAPACITY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      {i === 0 && <label className={labelCls}>Freight Rate</label>}
                      <input type="number" min={0} value={v.freightRate} onChange={e => updateVehicle(i, "freightRate", e.target.value)} placeholder="₹/trip" className={inputCls} />
                    </div>
                    <button type="button" onClick={() => removeVehicle(i)}
                      className={cn("text-gray-400 hover:text-red-500 transition-colors rounded p-1", i === 0 ? "mt-5" : "")}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Transporter Details" size="lg">
          <div className="space-y-4">
            <div className={cardCls}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Basic Info</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {[
                  ["Name",    viewItem.name],
                  ["Phone",   viewItem.phone    ?? "—"],
                  ["Email",   viewItem.email    ?? "—"],
                  ["Status",  viewItem.isActive ? "Active" : "Inactive"],
                  ["GST No.", viewItem.gstNo    ?? "—"],
                  ["PAN No.", viewItem.panNo    ?? "—"],
                  ["TDS %",   viewItem.tdsPercent != null ? `${viewItem.tdsPercent}%` : "—"],
                  ["Address", viewItem.address  ?? "—"],
                ].map(([l, v]) => (
                  <div key={l} className={l === "Address" ? "col-span-2" : ""}>
                    <dt className="text-xs text-gray-400 font-medium">{l}</dt>
                    <dd className="text-sm text-gray-800 mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {viewItem.vehicles.length > 0 && (
              <div className={cardCls}>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Vehicles ({viewItem.vehicles.length})</p>
                <div className="divide-y divide-gray-50">
                  {viewItem.vehicles.map((v, i) => (
                    <div key={i} className="py-2 first:pt-0 last:pb-0 flex items-center gap-4">
                      <span className="font-medium text-sm text-gray-800 flex-1">{v.vehicleType}</span>
                      {v.capacity && <span className="text-xs text-gray-500">{v.capacity} {v.capacityUnit}</span>}
                      {v.freightRate && <span className="text-xs text-gray-500">₹{v.freightRate}/trip</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Transporter" size="sm"
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
            Delete <span className="font-semibold text-gray-800">{data.find(x => x.id === deleteId)?.name}</span>? This cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
