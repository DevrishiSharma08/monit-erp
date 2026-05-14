"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Save, Eye, EyeOff, Pencil, Trash2, Shield, AlertTriangle, Loader2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/Modal";
import { ActionMenu } from "@/components/ActionMenu";
import { userApi, UserRow, roleApi, RoleDropdown } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

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

export default function UserManagementPage() {
  const [data,      setData]      = useState<UserRow[]>([]);
  const [roles,     setRoles]     = useState<RoleDropdown[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [search,    setSearch]    = useState("");

  const [showModal, setShowModal]   = useState(false);
  const [editItem,  setEditItem]    = useState<UserRow | null>(null);
  const [viewItem,  setViewItem]    = useState<UserRow | null>(null);
  const [deleteId,  setDeleteId]    = useState<number | null>(null);
  const [resetItem, setResetItem]   = useState<UserRow | null>(null);

  const [uUsername, setUUsername] = useState("");
  const [uName,     setUName]     = useState("");
  const [uEmail,    setUEmail]    = useState("");
  const [uRoleId,   setURoleId]   = useState<number | "">("");
  const [uActive,   setUActive]   = useState(true);
  const [uPwd,      setUPwd]      = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [newPwd,    setNewPwd]    = useState("");
  const [showNewPwd,setShowNewPwd]= useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [users, roleList] = await Promise.all([userApi.list(), roleApi.dropdown()]);
      setData(users.items);
      setRoles(roleList);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditItem(null);
    setUUsername(""); setUName(""); setUEmail("");
    setURoleId(roles[0]?.id ?? ""); setUActive(true);
    setUPwd(""); setShowPwd(false);
    setShowModal(true);
  }

  function openEdit(u: UserRow) {
    setEditItem(u);
    setUUsername(u.username); setUName(u.name); setUEmail(u.email ?? "");
    setURoleId(u.roleId); setUActive(u.isActive);
    setUPwd(""); setShowPwd(false);
    setShowModal(true);
  }

  async function handleSave() {
    if (!uName.trim() || !uRoleId) return;
    if (!editItem && (!uUsername.trim() || !uPwd.trim())) return;
    setSaving(true);
    try {
      if (editItem) {
        const u = await userApi.update(editItem.id, {
          name: uName.trim(), email: uEmail.trim() || undefined,
          roleId: uRoleId as number, isActive: uActive,
        });
        setData((prev) => prev.map((x) => x.id === u.id ? u : x));
      } else {
        const c = await userApi.create({
          username: uUsername.trim(), password: uPwd,
          name: uName.trim(), email: uEmail.trim() || undefined,
          roleId: uRoleId as number,
        });
        setData((prev) => [...prev, c]);
      }
      setShowModal(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    try {
      await userApi.remove(id);
      setData((prev) => prev.filter((x) => x.id !== id));
    } catch (e) { setError(e instanceof ApiError ? e.message : "Delete failed"); }
    finally { setDeleteId(null); }
  }

  async function handleResetPassword() {
    if (!resetItem || !newPwd.trim()) return;
    setSaving(true);
    try {
      await userApi.resetPassword(resetItem.id, newPwd);
      setResetItem(null); setNewPwd(""); setShowNewPwd(false);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Reset failed"); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(() =>
    data.filter((u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
    ), [data, search]);

  const isEdit = !!editItem;

  return (
    <div className="space-y-5 pb-24">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={openAdd} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 shadow-sm disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add User
        </button>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-64 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left border-b border-gray-100">
              {["Name", "Username", "Email", "Role", "Status", "Created", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{u.username}</td>
                <td className="px-4 py-3 text-gray-500">{u.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    ROLE_COLORS[u.role] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border",
                    u.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <ActionMenu items={[
                    { label: "View",           icon: Eye,      onClick: () => setViewItem(u)   },
                    { label: "Edit",           icon: Pencil,   onClick: () => openEdit(u)      },
                    { label: "Reset Password", icon: KeyRound, onClick: () => { setResetItem(u); setNewPwd(""); setShowNewPwd(false); } },
                    { label: "Delete",         icon: Trash2,   onClick: () => setDeleteId(u.id), variant: "danger" },
                  ]} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  {loading ? "Loading…" : `No users found${search ? ` matching "${search}"` : ""}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-4 py-2.5">
          <p className="text-xs text-gray-400">{filtered.length} of {data.length} user{data.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Add / Edit User */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={isEdit ? "Edit User" : "Add New User"} size="sm"
        footer={
          <>
            <button onClick={() => setShowModal(false)} disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave}
              disabled={saving || !uName.trim() || !uRoleId || (!isEdit && (!uUsername.trim() || !uPwd.trim()))}
              className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Save Changes" : "Add User"}
            </button>
          </>
        }>
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3.5">
          {!isEdit && (
            <div>
              <label className={labelCls}>Username *</label>
              <input value={uUsername} onChange={(e) => setUUsername(e.target.value)} placeholder="Login username" className={inputCls} />
            </div>
          )}
          <div>
            <label className={labelCls}>Full Name *</label>
            <input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="Enter full name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input value={uEmail} onChange={(e) => setUEmail(e.target.value)} type="email" placeholder="Enter email" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Role *</label>
              <select value={uRoleId} onChange={(e) => setURoleId(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                <option value="">— select —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {isEdit && (
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Status</label>
                <button type="button" onClick={() => setUActive((v) => !v)}
                  className={cn("relative mt-2 h-5 w-9 rounded-full transition-colors cursor-pointer",
                    uActive ? "bg-blue-500" : "bg-gray-200")}>
                  <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    uActive ? "translate-x-4" : "translate-x-0.5")} />
                </button>
              </div>
            )}
          </div>
          {!isEdit && (
            <div>
              <label className={labelCls}>Password *</label>
              <div className="relative">
                <input value={uPwd} onChange={(e) => setUPwd(e.target.value)}
                  type={showPwd ? "text" : "password"} placeholder="Set initial password"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-9 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* View User */}
      {viewItem && (
        <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="User Details" size="sm"
          footer={
            <>
              <button onClick={() => setViewItem(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Close</button>
              <button onClick={() => { const u = viewItem!; setViewItem(null); openEdit(u); }}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </>
          }>
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            {[
              { label: "Full Name", value: viewItem.name     },
              { label: "Username",  value: viewItem.username },
              { label: "Email",     value: viewItem.email    },
              { label: "Role",      value: viewItem.role     },
              { label: "Status",    value: viewItem.isActive ? "Active" : "Inactive" },
              { label: "Created",   value: fmtDate(viewItem.createdAt) },
              { label: "Last Login",value: viewItem.lastLoginAt ? fmtDate(viewItem.lastLoginAt) : "Never" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="w-24 flex-shrink-0 text-xs font-medium text-gray-400 pt-0.5">{label}</span>
                <span className="text-sm font-medium text-gray-800">{value ?? "—"}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Reset Password */}
      {resetItem && (
        <Modal isOpen={!!resetItem} onClose={() => setResetItem(null)} title="Reset Password" size="sm"
          footer={
            <>
              <button onClick={() => setResetItem(null)} disabled={saving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleResetPassword} disabled={saving || !newPwd.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Reset Password
              </button>
            </>
          }>
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
            <p className="text-sm text-gray-600">Set a new password for <span className="font-semibold">{resetItem.name}</span>.</p>
            <div>
              <label className={labelCls}>New Password</label>
              <div className="relative">
                <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                  type={showNewPwd ? "text" : "password"} placeholder="Enter new password"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-9 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
                <button type="button" onClick={() => setShowNewPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete User" size="sm"
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
          <p className="text-sm text-gray-600">Delete <span className="font-semibold">{data.find((u) => u.id === deleteId)?.name}</span>? This cannot be undone.</p>
        </div>
      </Modal>
    </div>
  );
}
