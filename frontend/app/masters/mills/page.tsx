"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2, X, Star } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { cn } from "@/lib/utils";
import { millApi, MillRow, MillUnitDto, MillContactDto, MillDetailRow } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";
const selectCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400";

const DESIGNATIONS = ["", "Owner", "Purchaser", "Accountant", "Sales"];

function emptyContact(): MillContactDto { return { contactPerson: "", designation: "", phone: "", email: "" }; }
function emptyUnit(): MillUnitDto { return { unitName: "", address: "", contacts: [emptyContact()] }; }

export default function MillMasterPage() {
  const [data,      setData]      = useState<MillRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem,  setEditItem]  = useState<MillRow | null>(null);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [viewId,    setViewId]    = useState<number | null>(null);
  const [viewData,  setViewData]  = useState<MillDetailRow | null>(null);

  // Basic fields
  const [fCode,         setFCode]         = useState("");
  const [fName,         setFName]         = useState("");
  const [fOwner,        setFOwner]        = useState("");
  const [fPhone,        setFPhone]        = useState("");
  const [fEmail,        setFEmail]        = useState("");
  const [fGstNo,        setFGstNo]        = useState("");
  const [fPaymentTerms, setFPaymentTerms] = useState("");
  const [fActive,       setFActive]       = useState(true);
  const [fUnits,        setFUnits]        = useState<MillUnitDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await millApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openAdd() {
    setEditItem(null);
    setFCode(""); setFName(""); setFOwner(""); setFPhone(""); setFEmail("");
    setFGstNo(""); setFPaymentTerms(""); setFActive(true);
    setFUnits([]);
    setShowModal(true);
  }

  async function openEdit(item: MillRow) {
    setEditItem(item);
    setFCode(item.code); setFName(item.name);
    setFOwner(item.ownerName ?? ""); setFPhone(item.phone ?? ""); setFEmail(item.email ?? "");
    setFGstNo(item.gstNo ?? ""); setFPaymentTerms(item.paymentTerms ?? "");
    setFActive(item.isActive);
    // Load detail with units
    try {
      const detail = await millApi.getById(item.id);
      setFUnits(detail.units ?? []);
    } catch { setFUnits([]); }
    setShowModal(true);
  }

  async function openView(id: number) {
    setViewId(id);
    try { setViewData(await millApi.getById(id)); }
    catch { setViewData(null); }
  }

  // ── Units management ──────────────────────────────────────────────────────

  function addUnit() {
    setFUnits((prev) => [...prev, emptyUnit()]);
  }

  function removeUnit(ui: number) {
    setFUnits((prev) => prev.filter((_, i) => i !== ui));
  }

  function updateUnit(ui: number, field: keyof MillUnitDto, val: string) {
    setFUnits((prev) => prev.map((u, i) => i === ui ? { ...u, [field]: val } : u));
  }

  function addContact(ui: number) {
    setFUnits((prev) => prev.map((u, i) =>
      i === ui ? { ...u, contacts: [...u.contacts, emptyContact()] } : u
    ));
  }

  function removeContact(ui: number, ci: number) {
    setFUnits((prev) => prev.map((u, i) =>
      i === ui ? { ...u, contacts: u.contacts.filter((_, j) => j !== ci) } : u
    ));
  }

  function updateContact(ui: number, ci: number, field: keyof MillContactDto, val: string) {
    setFUnits((prev) => prev.map((u, i) =>
      i === ui ? {
        ...u,
        contacts: u.contacts.map((c, j) => j === ci ? { ...c, [field]: val } : c)
      } : u
    ));
  }

  function setUnitDefault(ui: number) {
    setFUnits((prev) => prev.map((u, i) => ({ ...u, isDefault: i === ui })));
  }

  function setContactDefaultInUnit(ui: number, ci: number) {
    setFUnits((prev) => prev.map((u, i) =>
      i === ui
        ? { ...u, contacts: u.contacts.map((c, j) => ({ ...c, isDefault: j === ci })) }
        : u
    ));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!fCode.trim() || !fName.trim()) return;
    setSaving(true);
    try {
      const dto = {
        code: fCode.trim(),
        name: fName.trim(),
        ownerName: fOwner.trim() || undefined,
        phone: fPhone.trim() || undefined,
        email: fEmail.trim() || undefined,
        gstNo: fGstNo.trim() || undefined,
        paymentTerms: fPaymentTerms || undefined,
        units: fUnits
          .filter((u) => u.unitName.trim())
          .map((u) => ({
            ...u,
            unitName: u.unitName.trim(),
            address: u.address?.trim() || undefined,
            contacts: u.contacts
              .filter((c) => c.contactPerson.trim())
              .map((c) => ({
                ...c,
                contactPerson: c.contactPerson.trim(),
                designation: c.designation || undefined,
                phone: c.phone?.trim() || undefined,
                email: c.email?.trim() || undefined,
              })),
          })),
      };
      if (editItem) {
        const u = await millApi.update(editItem.id, { ...dto, isActive: fActive });
        setData((prev) => prev.map((x) => x.id === u.id ? u : x));
      } else {
        const c = await millApi.create(dto);
        setData((prev) => [...prev, c]);
      }
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      await millApi.remove(id);
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnConfig<MillRow>[] = useMemo(() => [
    {
      id: "code", accessorKey: "code", header: "Code",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 90,
      cell: (info) => <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{info.getValue() as string}</span>,
    },
    {
      id: "name", accessorKey: "name", header: "Mill Name",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 220,
      cell: (info) => <span className="font-semibold text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "ownerName", accessorKey: "ownerName", header: "Owner",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 160,
      cell: (info) => <span className="text-gray-600 text-sm">{(info.getValue() as string) ?? "—"}</span>,
    },
    {
      id: "phone", accessorKey: "phone", header: "Phone",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 140,
      cell: (info) => <span className="text-gray-600 text-sm">{(info.getValue() as string) ?? "—"}</span>,
    },
    {
      id: "gstNo", accessorKey: "gstNo", header: "GST No.",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 160,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className="font-mono text-xs text-gray-700">{v}</span>
          : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      id: "paymentTerms", accessorKey: "paymentTerms", header: "Payment Terms",
      filterType: "text",
      enableSorting: false, defaultVisible: true, size: 140,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className="inline-flex rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-medium">{v}</span>
          : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      id: "unitCount", accessorKey: "unitCount", header: "Units",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 80,
      cell: (info) => {
        const v = info.getValue() as number;
        return v > 0
          ? <span className="inline-flex rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium">{v}</span>
          : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      id: "isActive", accessorKey: "isActive", header: "Status",
      filterType: "select", filterOptions: [{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }],
      enableSorting: true, defaultVisible: true, size: 100,
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
            { label: "View",   icon: Eye,    onClick: () => openView(row.id)      },
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
        data={data} columns={columns} tableName="mills"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={10}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Mill
          </button>
        }
      />

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit Mill" : "Add Mill"} size="md"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !fCode.trim() || !fName.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editItem ? "Save Changes" : "Add Mill"}
            </button>
          </>
        }>
        <div className="space-y-3">

          {/* Basic Details */}
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Code *</label>
                <input value={fCode} onChange={(e) => setFCode(e.target.value.toUpperCase())} placeholder="e.g. ITC" className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Mill Name *</label>
                <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. ITC Paperboards" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Owner Name</label>
                <input value={fOwner} onChange={(e) => setFOwner(e.target.value)} placeholder="Owner / MD" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} placeholder="+91 98765 00000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} type="email" placeholder="mill@example.com" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>GST No.</label>
                <input value={fGstNo} onChange={(e) => setFGstNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 22AAAAA0000A1Z5" maxLength={15} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Payment Terms</label>
                <input value={fPaymentTerms} onChange={(e) => setFPaymentTerms(e.target.value)}
                  list="payment-terms-list" placeholder="e.g. 30 Days" className={inputCls} />
                <datalist id="payment-terms-list">
                  <option value="Advance" />
                  <option value="Against Delivery" />
                  <option value="7 Days" />
                  <option value="15 Days" />
                  <option value="30 Days" />
                  <option value="45 Days" />
                  <option value="60 Days" />
                  <option value="90 Days" />
                </datalist>
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

          {/* Units Section */}
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Units <span className="text-gray-300 font-normal normal-case">(optional)</span>
              </p>
              <button type="button" onClick={addUnit}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                <Plus className="h-3.5 w-3.5" /> Add Unit
              </button>
            </div>

            {fUnits.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No units added. Click + Add Unit to add production units.</p>
            )}

            {fUnits.map((unit, ui) => (
              <div key={ui} className={cn(
                "relative border rounded-xl p-4 space-y-3 transition-colors",
                unit.isDefault ? "border-amber-300 bg-amber-50/30" : "border-gray-200"
              )}>
                {/* Corner remove button */}
                <button type="button" onClick={() => removeUnit(ui)}
                  className="absolute top-3 right-3 text-gray-300 hover:text-red-400 transition-colors">
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Unit {ui + 1}</p>
                  {/* Default unit star */}
                  <button type="button"
                    title={unit.isDefault ? "Default unit for PO" : "Set as default unit"}
                    onClick={() => setUnitDefault(ui)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors">
                    <Star className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      unit.isDefault ? "fill-amber-400 text-amber-400" : "fill-none text-gray-300 hover:text-amber-300"
                    )} />
                    {unit.isDefault && (
                      <span className="text-[10px] font-semibold text-amber-600">Default</span>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Unit Name *</label>
                    <input value={unit.unitName}
                      onChange={(e) => updateUnit(ui, "unitName", e.target.value)}
                      placeholder="e.g. Silvassa Unit" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Address</label>
                    <input value={unit.address ?? ""}
                      onChange={(e) => updateUnit(ui, "address", e.target.value)}
                      placeholder="Full address" className={inputCls} />
                  </div>
                </div>

                {/* Contacts */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls} style={{ margin: 0 }}>Contacts</label>
                    <button type="button" onClick={() => addContact(ui)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      <Plus className="h-3 w-3" /> Add Contact
                    </button>
                  </div>
                  {unit.contacts.map((c, ci) => (
                    <div key={ci} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-2 mb-2 items-center">
                      <input value={c.contactPerson}
                        onChange={(e) => updateContact(ui, ci, "contactPerson", e.target.value)}
                        placeholder="Name" className={inputCls} />
                      <select value={c.designation ?? ""}
                        onChange={(e) => updateContact(ui, ci, "designation", e.target.value)}
                        className={selectCls}>
                        {DESIGNATIONS.map((d) => <option key={d} value={d}>{d || "Designation"}</option>)}
                      </select>
                      <input value={c.phone ?? ""}
                        onChange={(e) => updateContact(ui, ci, "phone", e.target.value)}
                        placeholder="Phone" className={inputCls} />
                      <input value={c.email ?? ""}
                        onChange={(e) => updateContact(ui, ci, "email", e.target.value)}
                        placeholder="Email" className={inputCls} />
                      {/* Default contact star */}
                      <button type="button"
                        title={c.isDefault ? "Default contact for PO" : "Set as default contact"}
                        onClick={() => setContactDefaultInUnit(ui, ci)}>
                        <Star className={cn(
                          "h-4 w-4 transition-colors",
                          c.isDefault ? "fill-amber-400 text-amber-400" : "fill-none text-gray-300 hover:text-amber-300"
                        )} />
                      </button>
                      <button type="button" onClick={() => removeContact(ui, ci)}
                        className="text-gray-300 hover:text-red-400 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={!!viewId} onClose={() => { setViewId(null); setViewData(null); }} title="Mill Details" size="md"
        footer={<button onClick={() => { setViewId(null); setViewData(null); }}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Close</button>}>
        {viewData ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ["Code",       viewData.code],
                  ["Name",          viewData.name],
                  ["Owner",         viewData.ownerName ?? "—"],
                  ["Phone",         viewData.phone ?? "—"],
                  ["Email",         viewData.email ?? "—"],
                  ["GST No.",       viewData.gstNo ?? "—"],
                  ["Payment Terms", viewData.paymentTerms ?? "—"],
                  ["Status",        viewData.isActive ? "Active" : "Inactive"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{l}</p>
                    <p className="text-gray-800">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            {viewData.units.length > 0 && (
              <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Units</p>
                {viewData.units.map((u, i) => (
                  <div key={i} className={cn(
                    "border rounded-lg p-3 space-y-2",
                    u.isDefault ? "border-amber-200 bg-amber-50/40" : "border-gray-100"
                  )}>
                    <div className="flex items-center gap-2">
                      <Star className={cn("h-3.5 w-3.5 flex-shrink-0",
                        u.isDefault ? "fill-amber-400 text-amber-400" : "fill-none text-gray-200")} />
                      <p className="text-sm font-semibold text-gray-800">{u.unitName}</p>
                      {u.isDefault && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5 font-medium">Default</span>
                      )}
                    </div>
                    {u.address && <p className="text-xs text-gray-500 pl-5">{u.address}</p>}
                    {u.contacts.length > 0 && (
                      <div className="space-y-1 pl-5">
                        {u.contacts.map((c, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                            <Star className={cn("h-3 w-3 flex-shrink-0",
                              c.isDefault ? "fill-amber-400 text-amber-400" : "fill-none text-gray-200")} />
                            <span className="font-medium">{c.contactPerson}</span>
                            {c.designation && <span className="text-gray-400">{c.designation}</span>}
                            {c.phone && <span>{c.phone}</span>}
                            {c.email && <span>{c.email}</span>}
                            {c.isDefault && (
                              <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5">Default contact</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
        )}
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Mill" size="sm"
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
