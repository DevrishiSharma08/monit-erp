"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Save, AlertTriangle, Eye, Pencil, Trash2, Loader2, UserPlus, MapPin, X, Star } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { cn } from "@/lib/utils";
import {
  customerApi, CustomerRow, CustomerDetailRow,
  CustomerContactDto, CustomerDeliveryLocationDto,
  localityApi, LocalityDropdown,
} from "@/lib/api-services";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const inputCls  = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls  = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";
const cardCls   = "rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3.5";

type ContactDraft  = { name: string; designation: string; phone: string; email: string; isDefault: boolean; };
type LocationDraft = { label: string; address: string; isDefault: boolean; };

function emptyContact():  ContactDraft  { return { name: "", designation: "", phone: "", email: "", isDefault: false }; }
function emptyLocation(): LocationDraft { return { label: "", address: "", isDefault: false }; }

const MASKED = "••••••••";

export default function CustomerMasterPage() {
  const { canViewContacts } = useAuth();
  const [data,          setData]          = useState<CustomerRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showModal,     setShowModal]     = useState(false);
  const [editItem,      setEditItem]      = useState<CustomerRow | null>(null);
  const [deleteId,      setDeleteId]      = useState<number | null>(null);
  const [viewItem,      setViewItem]      = useState<CustomerDetailRow | null>(null);

  // form fields
  const [fName,          setFName]          = useState("");
  const [fOwner,         setFOwner]         = useState("");
  const [fPhone,         setFPhone]         = useState("");
  const [fEmail,         setFEmail]         = useState("");
  const [fGst,           setFGst]           = useState("");
  const [fBilling,       setFBilling]       = useState("");
  const [fSameAsBilling, setFSameAsBilling] = useState(false);
  const [fCreditLimit,   setFCreditLimit]   = useState("");
  const [fCreditDays,    setFCreditDays]    = useState("");
  const [fPaymentTerms,  setFPaymentTerms]  = useState("");
  const [fActive,        setFActive]        = useState(true);
  const [fContacts,      setFContacts]      = useState<ContactDraft[]>([]);
  const [fLocations,     setFLocations]     = useState<LocationDraft[]>([]);
  const [fLocalityId,    setFLocalityId]    = useState<number | "">("");
  const [localities,     setLocalities]     = useState<LocalityDropdown[]>([]);

  // Keep the "Billing Address" delivery location in sync while toggle is ON
  useEffect(() => {
    if (!fSameAsBilling) return;
    setFLocations(prev => {
      const idx = prev.findIndex(l => l.label === "Billing Address");
      if (!fBilling.trim()) return prev;
      if (idx >= 0) {
        return prev.map((l, i) => i === idx ? { ...l, address: fBilling } : l);
      }
      return [{ label: "Billing Address", address: fBilling, isDefault: prev.every(l => !l.isDefault) }, ...prev];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fBilling, fSameAsBilling]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await customerApi.list()).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  const loadLocalities = useCallback(async () => {
    try { setLocalities(await localityApi.dropdown()); }
    catch { /* non-fatal */ }
  }, []);

  useEffect(() => { load(); loadLocalities(); }, [load, loadLocalities]);

  function resetForm() {
    setFName(""); setFOwner(""); setFPhone(""); setFEmail(""); setFGst("");
    setFBilling(""); setFSameAsBilling(false);
    setFCreditLimit(""); setFCreditDays(""); setFPaymentTerms(""); setFActive(true);
    setFContacts([]); setFLocations([]); setFLocalityId("");
  }

  function openAdd() { setEditItem(null); resetForm(); setShowModal(true); }

  async function openEdit(item: CustomerRow) {
    setEditItem(item); resetForm(); setShowModal(true); setDetailLoading(true);
    try {
      const d = await customerApi.getById(item.id);
      setFName(d.name); setFOwner(d.ownerName ?? ""); setFPhone(d.phone ?? "");
      setFEmail(d.email ?? ""); setFGst(d.gstNo ?? ""); setFBilling(d.billingAddress ?? "");
      setFCreditLimit(String(d.creditLimit)); setFCreditDays(String(d.creditDays)); setFPaymentTerms(d.paymentTerms ?? ""); setFActive(d.isActive);
      setFContacts(d.contacts.map(c => ({
        name: c.name, designation: c.designation ?? "",
        phone: c.phone ?? "", email: c.email ?? "",
        isDefault: c.isDefault ?? false,
      })));
      setFLocations(d.deliveryLocations.map(l => ({ label: l.label ?? "", address: l.address, isDefault: l.isDefault })));
      setFSameAsBilling(d.deliveryLocations.some(l => l.label === "Billing Address"));
      setFLocalityId(d.localityId ?? "");
    } catch { /* form still usable with basic info */ }
    finally { setDetailLoading(false); }
  }

  async function openView(item: CustomerRow) {
    try { setViewItem(await customerApi.getById(item.id)); }
    catch { setError("Failed to load details"); }
  }

  // Contact helpers — default is radio-button: only one at a time
  function updateContact(idx: number, field: keyof ContactDraft, val: string) {
    setFContacts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }
  function setContactDefault(idx: number) {
    setFContacts(prev => prev.map((c, i) => ({ ...c, isDefault: i === idx })));
  }
  function removeContact(idx: number) {
    setFContacts(prev => prev.filter((_, i) => i !== idx));
  }

  // Location helpers — default is radio-button: only one at a time
  function updateLocation(idx: number, field: "label" | "address", val: string) {
    setFLocations(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  }
  function setLocationDefault(idx: number) {
    setFLocations(prev => prev.map((l, i) => ({ ...l, isDefault: i === idx })));
  }
  function removeLocation(idx: number) {
    setFLocations(prev => prev.filter((_, i) => i !== idx));
  }

  const isFormValid = fName.trim() !== "";

  async function handleSave() {
    if (!isFormValid) return;
    setSaving(true);
    try {
      const contacts: CustomerContactDto[] = fContacts
        .filter(c => c.name.trim())
        .map(c => ({
          name: c.name.trim(), designation: c.designation.trim() || undefined,
          phone: c.phone.trim() || undefined, email: c.email.trim() || undefined,
          isDefault: c.isDefault,
        }));
      const deliveryLocations: CustomerDeliveryLocationDto[] = fLocations
        .filter(l => l.address.trim())
        .map(l => ({ label: l.label.trim() || undefined, address: l.address.trim(), isDefault: l.isDefault }));
      const base = {
        name: fName.trim(), ownerName: fOwner.trim() || undefined,
        phone: fPhone.trim() || undefined, email: fEmail.trim() || undefined,
        gstNo: fGst.trim() || undefined, billingAddress: fBilling.trim() || undefined,
        creditLimit: Number(fCreditLimit) || 0, creditDays: Number(fCreditDays) || 0, paymentTerms: fPaymentTerms.trim() || undefined,
        localityId: fLocalityId !== "" ? Number(fLocalityId) : undefined,
        contacts, deliveryLocations,
      };
      if (editItem) {
        await customerApi.update(editItem.id, { ...base, isActive: fActive });
      } else {
        await customerApi.create(base);
      }
      await load();
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try { await customerApi.remove(id); setData(prev => prev.filter(x => x.id !== id)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  const columns: ColumnConfig<CustomerRow>[] = useMemo(() => [
    {
      id: "name", accessorKey: "name", header: "Name",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 200,
      cell: (info) => <span className="font-semibold text-gray-900 text-sm">{info.getValue() as string}</span>,
    },
    {
      id: "ownerName", accessorKey: "ownerName", header: "Owner",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => <span className="text-gray-600 text-sm">{(info.getValue() as string | undefined) ?? "—"}</span>,
    },
    {
      id: "phone", accessorKey: "phone", header: "Phone",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => canViewContacts
        ? <span className="text-gray-600 text-sm">{(info.getValue() as string | undefined) ?? "—"}</span>
        : <span className="text-gray-300 select-none tracking-widest">{MASKED}</span>,
    },
    {
      id: "gstNo", accessorKey: "gstNo", header: "GST No",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 160,
      cell: (info) => <span className="font-mono text-gray-600 text-xs">{(info.getValue() as string | undefined) ?? "—"}</span>,
    },
    {
      id: "locality", accessorKey: "locality", header: "Locality",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{v}</span>
          : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      id: "creditLimit", accessorKey: "creditLimit", header: "Credit",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => {
        const row = info.row.original;
        return <span className="text-xs text-gray-700">₹{row.creditLimit.toLocaleString("en-IN")} / {row.creditDays}d</span>;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        data={data} columns={columns} tableName="customers"
        enableFilters enablePagination enableColumnReordering enableColumnVisibility
        initialPageSize={15}
        toolbarActions={
          <button onClick={openAdd} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Customer
          </button>
        }
      />

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editItem ? "Edit Customer" : "Add Customer"} size="lg"
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

            {/* ── Basic Info ──────────────────────────────────────── */}
            <div className={cardCls}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Customer Name *</label>
                  <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Sharma Traders" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Owner Name</label>
                  <input type="text" value={fOwner} onChange={e => setFOwner(e.target.value)} placeholder="e.g. Ramesh Sharma" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="text" value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="e.g. 9876543210" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="e.g. info@sharma.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>GST No.</label>
                  <input type="text" value={fGst} onChange={e => setFGst(e.target.value)} placeholder="e.g. 23AABCU9603R1ZX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Locality / Area</label>
                  <select value={fLocalityId} onChange={e => setFLocalityId(e.target.value === "" ? "" : Number(e.target.value))}
                    className={inputCls}>
                    <option value="">— None —</option>
                    {localities.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}{l.city ? `, ${l.city}` : ""}</option>
                    ))}
                  </select>
                </div>

                {/* Billing Address + same-as-delivery toggle */}
                <div className="col-span-2">
                  <label className={labelCls}>Billing Address</label>
                  <textarea rows={2} value={fBilling} onChange={e => setFBilling(e.target.value)}
                    placeholder="Full billing address…" className={cn(inputCls, "resize-none")} />
                  <div className="flex items-center gap-2 mt-1.5">
                    <button type="button" onClick={() => setFSameAsBilling(v => !v)}
                      className={cn("relative h-4 w-8 rounded-full transition-colors cursor-pointer flex-shrink-0",
                        fSameAsBilling ? "bg-blue-500" : "bg-gray-200")}>
                      <div className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                        fSameAsBilling ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                    <span className="text-xs text-gray-500 select-none cursor-pointer" onClick={() => setFSameAsBilling(v => !v)}>
                      Same as delivery address
                    </span>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Credit Limit (₹)</label>
                  <input type="number" min={0} step={1000} value={fCreditLimit} onChange={e => setFCreditLimit(e.target.value)} placeholder="e.g. 500000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Credit Days</label>
                  <input type="number" min={0} value={fCreditDays} onChange={e => setFCreditDays(e.target.value)} placeholder="e.g. 30" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Payment Terms</label>
                  <input type="text" value={fPaymentTerms} onChange={e => setFPaymentTerms(e.target.value)} placeholder="e.g. 30 days net" className={inputCls} />
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

            {/* ── Contacts ────────────────────────────────────────── */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> Contacts
                  <span className="text-[10px] font-normal normal-case tracking-normal text-gray-400">
                    — ★ marks the default contact for SO
                  </span>
                </p>
                <button type="button" onClick={() => setFContacts(prev => [...prev, emptyContact()])}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {fContacts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No contacts added yet.</p>
              )}

              {fContacts.map((c, i) => (
                <div key={i} className="border-t border-gray-50 pt-3">
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-2 items-end">
                    <div>
                      {i === 0 && <label className={labelCls}>Name *</label>}
                      <input value={c.name} onChange={e => updateContact(i, "name", e.target.value)} placeholder="Name" className={inputCls} />
                    </div>
                    <div>
                      {i === 0 && <label className={labelCls}>Designation</label>}
                      <input value={c.designation} onChange={e => updateContact(i, "designation", e.target.value)} placeholder="e.g. Manager" className={inputCls} />
                    </div>
                    <div>
                      {i === 0 && <label className={labelCls}>Phone</label>}
                      <input value={c.phone} onChange={e => updateContact(i, "phone", e.target.value)} placeholder="Phone" className={inputCls} />
                    </div>
                    <div>
                      {i === 0 && <label className={labelCls}>Email</label>}
                      <input value={c.email} onChange={e => updateContact(i, "email", e.target.value)} placeholder="Email" className={inputCls} />
                    </div>
                    {/* Default star */}
                    <button type="button"
                      title={c.isDefault ? "Default contact" : "Set as default"}
                      onClick={() => setContactDefault(i)}
                      className={cn(
                        "rounded p-1 transition-colors flex-shrink-0",
                        i === 0 ? "mt-5" : ""
                      )}>
                      <Star className={cn(
                        "h-4 w-4 transition-colors",
                        c.isDefault ? "fill-amber-400 text-amber-400" : "fill-none text-gray-300 hover:text-amber-300"
                      )} />
                    </button>
                    <button type="button" onClick={() => removeContact(i)}
                      className={cn("text-gray-400 hover:text-red-500 transition-colors rounded p-1", i === 0 ? "mt-5" : "")}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Delivery Locations ──────────────────────────────── */}
            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Delivery Locations
                  <span className="text-[10px] font-normal normal-case tracking-normal text-gray-400">
                    — ★ marks the default for SO
                  </span>
                </p>
                <button type="button" onClick={() => setFLocations(prev => [...prev, emptyLocation()])}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {fLocations.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No delivery locations added yet.</p>
              )}

              {fLocations.map((l, i) => (
                <div key={i} className="border-t border-gray-50 pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={l.label}
                      onChange={e => updateLocation(i, "label", e.target.value)}
                      placeholder="Label (e.g. Factory, Office)"
                      className={cn(inputCls, "flex-1")}
                    />
                    {/* Default star */}
                    <button type="button"
                      title={l.isDefault ? "Default location" : "Set as default"}
                      onClick={() => setLocationDefault(i)}
                      className={cn(
                        "rounded p-1 transition-colors flex-shrink-0",
                        l.isDefault ? "text-amber-400 hover:text-amber-500" : "text-gray-300 hover:text-amber-300"
                      )}>
                      <Star className={cn("h-4 w-4", l.isDefault && "fill-amber-400")} />
                    </button>
                    <button type="button" onClick={() => removeLocation(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors rounded p-1 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea rows={2} value={l.address}
                    onChange={e => updateLocation(i, "address", e.target.value)}
                    placeholder="Full delivery address *"
                    className={cn(inputCls, "resize-none")} />
                </div>
              ))}
            </div>

          </div>
        )}
      </Modal>

      {/* View Modal */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Customer Details" size="lg">
          <div className="space-y-4">
            <div className={cardCls}>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Basic Info</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {[
                  ["Name",         viewItem.name],
                  ["Owner",        viewItem.ownerName ?? "—"],
                  ["Phone",        canViewContacts ? (viewItem.phone ?? "—") : MASKED],
                  ["Email",        canViewContacts ? (viewItem.email ?? "—") : MASKED],
                  ["GST No.",      viewItem.gstNo ?? "—"],
                  ["Credit Limit", `₹${viewItem.creditLimit.toLocaleString("en-IN")}`],
                  ["Credit Days",  `${viewItem.creditDays} days`],
                  ["Status",       viewItem.isActive ? "Active" : "Inactive"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <dt className="text-xs text-gray-400 font-medium">{l}</dt>
                    <dd className="text-sm text-gray-800 mt-0.5">{v}</dd>
                  </div>
                ))}
                {viewItem.billingAddress && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-400 font-medium">Billing Address</dt>
                    <dd className="text-sm text-gray-800 mt-0.5">{viewItem.billingAddress}</dd>
                  </div>
                )}
              </dl>
            </div>

            {viewItem.contacts.length > 0 && (
              <div className={cardCls}>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Contacts ({viewItem.contacts.length})</p>
                {viewItem.contacts.map((c, i) => (
                  <div key={i} className="border-t border-gray-50 pt-2.5 first:border-0 first:pt-0 flex items-start gap-2">
                    <Star className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0",
                      c.isDefault ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {c.name}
                        {c.designation && <span className="ml-1 text-xs text-gray-500 font-normal">· {c.designation}</span>}
                        {c.isDefault && (
                          <span className="ml-2 rounded-full bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium">Default</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {canViewContacts ? ([c.phone, c.email].filter(Boolean).join("  ·  ") || "—") : MASKED}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {viewItem.deliveryLocations.length > 0 && (
              <div className={cardCls}>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Delivery Locations ({viewItem.deliveryLocations.length})</p>
                {viewItem.deliveryLocations.map((l, i) => (
                  <div key={i} className="border-t border-gray-50 pt-2.5 first:border-0 first:pt-0 flex items-start gap-2">
                    <Star className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0",
                      l.isDefault ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-600">
                        {l.label || "No label"}
                        {l.isDefault && (
                          <span className="ml-2 rounded-full bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium">Default</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-800">{l.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Customer" size="sm"
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
