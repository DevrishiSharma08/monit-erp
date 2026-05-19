"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Shield, AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/Modal";
import { roleApi, RoleListRow, RoleDetailRow, PermissionGroup } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls  = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls  = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

const ROLE_COLORS: Record<string, string> = {
  Admin:              "bg-blue-50 text-blue-700 border-blue-200",
  Manager:            "bg-purple-50 text-purple-700 border-purple-200",
  Salesman:           "bg-green-50 text-green-700 border-green-200",
  Accountant:         "bg-amber-50 text-amber-700 border-amber-200",
  Planner:            "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Warehouse Manager":"bg-orange-50 text-orange-700 border-orange-200",
};

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2,"0")}/${(dt.getMonth()+1).toString().padStart(2,"0")}/${dt.getFullYear()}`;
}

function Cb({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input type="checkbox" checked={checked} onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 accent-blue-500 cursor-pointer" />
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function RolesPermissionsPage() {
  const [roles,       setRoles]       = useState<RoleListRow[]>([]);
  const [permGroups,  setPermGroups]  = useState<PermissionGroup[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // selected role detail
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [detail,      setDetail]      = useState<RoleDetailRow | null>(null);
  const [perms,       setPerms]       = useState<string[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  // add/edit modal
  const [showModal,   setShowModal]   = useState(false);
  const [editRole,    setEditRole]    = useState<RoleListRow | null>(null);
  const [rName,       setRName]       = useState("");
  const [rDesc,       setRDesc]       = useState("");
  const [rActive,     setRActive]     = useState(true);
  const [modalSaving, setModalSaving] = useState(false);

  // delete
  const [deleteId,    setDeleteId]    = useState<number | null>(null);

  // collapsed groups
  const [collapsed,   setCollapsed]   = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [r, pg] = await Promise.all([roleApi.list(), roleApi.permissions()]);
      setRoles(r.items);
      setPermGroups(pg);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function selectRole(id: number) {
    if (id === selectedId) { setSelectedId(null); setDetail(null); return; }
    setSelectedId(id); setLoadingDetail(true); setSaved(false);
    try {
      const d = await roleApi.getById(id);
      setDetail(d);
      setPerms(d.permissions ?? []);
    } catch { setError("Failed to load role details"); }
    finally { setLoadingDetail(false); }
  }

  function togglePerm(p: string) {
    setPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  function toggleGroup(group: PermissionGroup, enable: boolean) {
    if (enable) {
      setPerms((prev) => [...new Set([...prev, ...group.permissions])]);
    } else {
      setPerms((prev) => prev.filter((p) => !group.permissions.includes(p)));
    }
  }

  function isGroupAll(group: PermissionGroup) {
    return group.permissions.every((p) => perms.includes(p));
  }

  async function handleSavePerms() {
    if (!detail) return;
    setSaving(true); setSaved(false);
    try {
      await roleApi.update(detail.id, {
        name: detail.name,
        description: detail.description,
        permissions: perms,
        isActive: detail.isActive,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setRoles((prev) => prev.map((r) => r.id === detail.id ? { ...r } : r));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  function openAdd() {
    setEditRole(null); setRName(""); setRDesc(""); setRActive(true);
    setShowModal(true);
  }

  function openEdit(r: RoleListRow, e: React.MouseEvent) {
    e.stopPropagation();
    setEditRole(r); setRName(r.name); setRDesc(r.description ?? ""); setRActive(r.isActive);
    setShowModal(true);
  }

  async function handleModalSave() {
    if (!rName.trim()) return;
    setModalSaving(true);
    try {
      if (editRole) {
        const updated = await roleApi.update(editRole.id, {
          name: rName.trim(), description: rDesc.trim() || undefined,
          permissions: detail?.id === editRole.id ? perms : [],
          isActive: rActive,
        });
        setRoles((prev) => prev.map((r) => r.id === editRole.id ? { ...r, name: updated.name, description: updated.description, isActive: updated.isActive } : r));
        if (detail?.id === editRole.id) setDetail((d) => d ? { ...d, name: updated.name } : d);
      } else {
        const created = await roleApi.create({ name: rName.trim(), description: rDesc.trim() || undefined, permissions: [] });
        setRoles((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setModalSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      await roleApi.remove(id);
      setRoles((prev) => prev.filter((r) => r.id !== id));
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  return (
    <div className="space-y-5 pb-24">

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">

        {/* ── Role List ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Roles</p>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 shadow-sm">
              <Plus className="h-3.5 w-3.5" /> Add Role
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((r) => (
                <div key={r.id}
                  onClick={() => selectRole(r.id)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all",
                    selectedId === r.id
                      ? "border-blue-200 bg-blue-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-blue-100 hover:bg-gray-50"
                  )}>
                  <Shield className={cn("h-4 w-4 flex-shrink-0", selectedId === r.id ? "text-blue-500" : "text-gray-400")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-gray-400">{r.userCount} user{r.userCount !== 1 ? "s" : ""} · {fmtDate(r.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={(e) => openEdit(r, e)}
                      className="rounded p-1 hover:bg-blue-100 text-gray-400 hover:text-blue-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {r.name !== "Admin" && r.userCount === 0 && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}
                        className="rounded p-1 hover:bg-red-100 text-gray-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {roles.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No roles yet</p>
              )}
            </div>
          )}
        </div>

        {/* ── Permission Editor ─────────────────────────────────────────────── */}
        <div>
          {!selectedId && (
            <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-center">
                <Shield className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-500">Select a role to manage permissions</p>
              </div>
            </div>
          )}

          {selectedId && loadingDetail && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-gray-100 bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          )}

          {selectedId && detail && !loadingDetail && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-blue-50 border-b border-blue-100">
                <div className="flex items-center gap-2.5">
                  <p className="text-sm font-semibold text-gray-800">
                    Permissions for: <span className="text-blue-700">{detail.name}</span>
                  </p>
                  <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    ROLE_COLORS[detail.name] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
                    {detail.name}
                  </span>
                </div>
                <button onClick={handleSavePerms} disabled={saving}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all shadow-sm",
                    saved ? "bg-green-500 text-white"
                           : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                  )}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                   : saved ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
                           : <><Save className="h-4 w-4" /> Save Permissions</>}
                </button>
              </div>

              {/* Admin wildcard note */}
              {perms.includes("*") && (
                <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                  <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                  This role has <strong>full access (*)</strong> — all permissions are granted automatically.
                </div>
              )}

              {/* Permission groups */}
              <div className="divide-y divide-gray-50">
                {permGroups.map((group) => {
                  const allOn    = isGroupAll(group);
                  const isCollapsed = collapsed[group.group];
                  return (
                    <div key={group.group}>
                      {/* Group header */}
                      <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50/70">
                        <button onClick={() => setCollapsed((c) => ({ ...c, [group.group]: !c[group.group] }))}
                          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600">
                          {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                          {group.group}
                        </button>
                        <label className="ml-auto flex items-center gap-2 cursor-pointer select-none">
                          <span className="text-[11px] text-gray-400">All</span>
                          <div
                            onClick={() => toggleGroup(group, !allOn)}
                            className={cn("relative h-5 w-9 rounded-full transition-colors cursor-pointer",
                              allOn ? "bg-blue-500" : "bg-gray-200")}>
                            <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                              allOn ? "translate-x-4" : "translate-x-0.5")} />
                          </div>
                        </label>
                      </div>

                      {/* Permission rows */}
                      {!isCollapsed && (
                        <div className="px-5 py-2 space-y-2.5">
                          {group.permissions.map((p) => (
                            <label key={p} className="flex items-center gap-3 cursor-pointer group/perm">
                              <Cb checked={perms.includes(p) || perms.includes("*")} onChange={() => togglePerm(p)} />
                              <span className="text-sm font-mono text-gray-700 group-hover/perm:text-blue-600 transition-colors">{p}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
                <p className="text-xs text-gray-400">
                  {perms.length} permission{perms.length !== 1 ? "s" : ""} selected
                </p>
                <button onClick={handleSavePerms} disabled={saving}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all shadow-sm",
                    saved ? "bg-green-500 text-white"
                           : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                  )}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                   : saved ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
                           : <><Save className="h-4 w-4" /> Save</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Role Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editRole ? "Edit Role" : "Add New Role"} size="sm"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={modalSaving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleModalSave} disabled={modalSaving || !rName.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {modalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editRole ? "Save Changes" : "Add Role"}
            </button>
          </>
        }>
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3.5">
          <div>
            <label className={labelCls}>Role Name *</label>
            <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="e.g. Manager" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={rDesc} onChange={(e) => setRDesc(e.target.value)} placeholder="Optional description" className={inputCls} />
          </div>
          {editRole && (
            <div className="flex items-center gap-3">
              <label className={labelCls + " mb-0"}>Active</label>
              <button type="button" onClick={() => setRActive((v) => !v)}
                className={cn("relative h-5 w-9 rounded-full transition-colors cursor-pointer", rActive ? "bg-blue-500" : "bg-gray-200")}>
                <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", rActive ? "translate-x-4" : "translate-x-0.5")} />
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Role" size="sm"
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
            Delete <span className="font-semibold">{roles.find((r) => r.id === deleteId)?.name}</span>? This cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
