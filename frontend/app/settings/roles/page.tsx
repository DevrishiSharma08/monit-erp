"use client";

import { PermGuard } from "@/components/PermGuard";
import { useState, useEffect, useCallback, useRef } from "react";
import { Save, ChevronDown, X, Loader2, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { roleApi, RoleListRow, RoleDetailRow, PermissionGroup } from "@/lib/api-services";
import { ApiError } from "@/lib/api";

// ─── Config ───────────────────────────────────────────────────────────────────

const PERM_COLS = [
  { suffix: "read",   label: "VIEW"   },
  { suffix: "write",  label: "EDIT"   },
  { suffix: "delete", label: "DELETE" },
  { suffix: "print",  label: "PRINT"  },
] as const;

const SECTIONS: { label: string; groups: string[] }[] = [
  { label: "MAIN",        groups: ["Dashboard"] },
  { label: "SALES",       groups: ["Sales Order", "Approvals"] },
  { label: "PROCUREMENT", groups: ["Purchase Order", "Mill Order Tracker"] },
  { label: "LOGISTICS",   groups: ["Truck Load Planner", "GRN", "Stock Lots"] },
  { label: "MASTERS",     groups: ["Masters"] },
  { label: "SETTINGS",    groups: ["Users", "Company Setting", "Permission"] },
];

const RESTRICTION_META: Record<string, { label: string; desc: string }> = {
  "financial.hide_cost": { label: "Hide Cost / Total Value",    desc: "Hides all cost figures in SO, PO, Mill Tracker, TLP and Dashboard." },
  "contact.hide_phone":  { label: "Hide Customer Phone Number", desc: "Hides phone in customer list, sales orders and contact views." },
};

const ROLE_BADGE: Record<string, string> = {
  Admin:               "bg-blue-100 text-blue-700",
  Manager:             "bg-purple-100 text-purple-700",
  Salesman:            "bg-green-100 text-green-700",
  Accountant:          "bg-amber-100 text-amber-700",
  Planner:             "bg-indigo-100 text-indigo-700",
  "Warehouse Manager": "bg-orange-100 text-orange-700",
};

function findPerm(group: PermissionGroup, suffix: string): string {
  const found = group.permissions.find((p) => p.endsWith("." + suffix));
  if (found) return found;
  // Generate a synthetic key from the first known perm's prefix
  const first = group.permissions[0] ?? "";
  const prefix = first.includes(".") ? first.substring(0, first.lastIndexOf(".")) : group.permissions[0] ?? group.permissions[0] ?? "unknown";
  return `${prefix}.${suffix}`;
}

// ─── Checkbox cell ────────────────────────────────────────────────────────────

function Checkbox({ checked, disabled, onChange }: {
  checked: boolean; disabled?: boolean; onChange?: () => void;
}) {
  return (
    <div className="flex justify-center">
      <button type="button" onClick={onChange} disabled={disabled}
        className={cn(
          "h-5 w-5 rounded flex items-center justify-center border-2 transition-all",
          disabled
            ? "border-gray-100 bg-gray-50 cursor-not-allowed"
            : checked
              ? "border-blue-500 bg-blue-500 hover:bg-blue-600"
              : "border-gray-300 bg-white hover:border-blue-400"
        )}>
        {checked && !disabled && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div className="flex justify-center">
      <button type="button" role="switch" aria-checked={on} onClick={onChange}
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
          on ? "bg-blue-500" : "bg-gray-200"
        )}>
        <span className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          on ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}

// ─── Role selector dropdown ───────────────────────────────────────────────────

function RoleSelector({ roles, selected, onSelect }: {
  roles: RoleListRow[];
  selected: RoleDetailRow | null;
  onSelect: (r: RoleListRow) => void;
}) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <div className={cn(
        "flex items-center gap-2 rounded-lg border bg-white px-3 py-2 min-w-[220px] cursor-pointer",
        open ? "border-blue-400 ring-1 ring-blue-100" : "border-gray-200"
      )} onClick={() => setOpen((v) => !v)}>
        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>

        {selected ? (
          <span className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800 truncate">{selected.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0",
              ROLE_BADGE[selected.name] ?? "bg-gray-100 text-gray-600")}>
              {selected.name}
            </span>
          </span>
        ) : (
          <span className="text-sm text-gray-400 flex-1">Select role…</span>
        )}

        <ChevronDown className={cn("h-4 w-4 text-gray-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] rounded-xl border border-gray-100 bg-white shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-50">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles…"
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
              onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400 text-center">No roles found</p>
            ) : filtered.map((r) => (
              <div key={r.id} onClick={() => { onSelect(r); setOpen(false); setQuery(""); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors",
                  selected?.id === r.id && "bg-blue-50"
                )}>
                <span className={cn("h-2 w-2 rounded-full flex-shrink-0",
                  selected?.id === r.id ? "bg-blue-500" : "bg-gray-200")} />
                <span className={cn("text-sm flex-1", selected?.id === r.id ? "font-semibold text-blue-700" : "text-gray-700")}>
                  {r.name}
                </span>
                <span className="text-[10px] text-gray-400">{r.userCount} users</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Copy-from selector ───────────────────────────────────────────────────────

function CopyFromSelector({ roles, currentId, onCopy }: {
  roles: RoleListRow[];
  currentId?: number;
  onCopy: (permissions: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleCopy(r: RoleListRow) {
    setOpen(false);
    setBusy(true);
    try {
      const detail = await roleApi.getById(r.id);
      onCopy(detail.permissions);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  const others = roles.filter((r) => r.id !== currentId);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => others.length && setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 min-w-[200px] text-sm transition-colors",
          others.length ? "cursor-pointer hover:border-gray-300" : "opacity-50 cursor-not-allowed"
        )}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
               : <Copy className="h-4 w-4 text-gray-400 flex-shrink-0" />}
        <span className="text-gray-400 flex-1">Copy permissions from…</span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full rounded-xl border border-gray-100 bg-white shadow-lg z-50 overflow-hidden">
          {others.map((r) => (
            <div key={r.id} onClick={() => handleCopy(r)}
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors">
              <Copy className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm text-gray-700">{r.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RolesPage() {
  const [roles,      setRoles]      = useState<RoleListRow[]>([]);
  const [permGroups, setPermGroups] = useState<PermissionGroup[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [selected,    setSelected]    = useState<RoleDetailRow | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [activePerms, setActivePerms] = useState<Set<string>>(new Set());

  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // ── Load roles + permission schema ────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, groups] = await Promise.all([roleApi.list(), roleApi.permissions()]);
      setRoles(list.items);
      setPermGroups(groups);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Select role ───────────────────────────────────────────────────────────
  async function selectRole(r: RoleListRow) {
    if (selected?.id === r.id) return;
    setLoadingRole(true); setSaved(false); setSaveErr(null);
    try {
      const detail = await roleApi.getById(r.id);
      setSelected(detail);
      setActivePerms(new Set(detail.permissions));
    } catch { /* ignore */ }
    finally { setLoadingRole(false); }
  }

  // ── Toggle one permission ─────────────────────────────────────────────────
  function togglePerm(perm: string) {
    setActivePerms((prev) => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
    setSaved(false);
  }

  // ── Toggle all perms for a group ──────────────────────────────────────────
  function toggleGroupAll(perms: string[]) {
    setActivePerms((prev) => {
      const next     = new Set(prev);
      const realPerms = perms.filter(Boolean);
      const allOn     = realPerms.every((p) => next.has(p));
      realPerms.forEach((p) => allOn ? next.delete(p) : next.add(p));
      return next;
    });
    setSaved(false);
  }

  // ── Copy permissions from another role ────────────────────────────────────
  function applyPermissions(perms: string[]) {
    setActivePerms(new Set(perms));
    setSaved(false);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selected) return;
    setSaving(true); setSaved(false); setSaveErr(null);
    try {
      await roleApi.update(selected.id, {
        name:        selected.name,
        description: selected.description,
        permissions: [...activePerms],
        isActive:    selected.isActive,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveErr(e instanceof ApiError ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const groupMap      = Object.fromEntries(permGroups.map((g) => [g.group, g]));
  const restrictGroup = permGroups.find((g) => g.group === "Data Restrictions");

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0 pb-24">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 min-w-[220px]">
            <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
            <span className="text-sm text-gray-400">Loading roles…</span>
          </div>
        ) : (
          <RoleSelector roles={roles} selected={selected} onSelect={selectRole} />
        )}

        {selected && (
          <CopyFromSelector
            roles={roles}
            currentId={selected.id}
            onCopy={applyPermissions}
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          {saveErr && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> {saveErr}
            </span>
          )}
          {selected && (
            <button onClick={handleSave} disabled={saving || !selected}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition-all",
                saved  ? "bg-green-500 text-white"
                       : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
              )}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" />
               : saved  ? <CheckCircle2 className="h-4 w-4" />
               : <Save className="h-4 w-4" />}
              {saved ? "Saved!" : "Save Permissions"}
            </button>
          )}
        </div>
      </div>

      {/* ── Placeholder ───────────────────────────────────────────────────── */}
      {!selected && !loadingRole && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-24">
          <Save className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">Select a role above to manage its permissions</p>
        </div>
      )}

      {loadingRole && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      )}

      {selected && !loadingRole && (
        <>
          {/* Editing sub-header */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500">Editing permissions for:</span>
            <span className="text-sm font-semibold text-blue-600">{selected.name}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
              ROLE_BADGE[selected.name] ?? "bg-gray-100 text-gray-600")}>
              {selected.name}
            </span>
          </div>

          {/* Permission table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

            {/* Column header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px_72px] border-b border-gray-200 bg-gray-50 px-5 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Page / Module</span>
              {PERM_COLS.map((c) => (
                <span key={c.suffix} className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center">
                  {c.label}
                </span>
              ))}
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center">ALL</span>
            </div>

            {/* Sections + rows */}
            {SECTIONS.map((section) => {
              const sectionGroups = section.groups
                .map((g) => groupMap[g])
                .filter(Boolean);
              if (sectionGroups.length === 0) return null;

              return (
                <div key={section.label}>
                  {/* Section label row */}
                  <div className="grid grid-cols-[1fr_80px_80px_80px_80px_72px] border-t border-gray-100 bg-gray-50/70 px-5 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 col-span-6">
                      {section.label}
                    </span>
                  </div>

                  {/* Module rows */}
                  {sectionGroups.map((group) => {
                    const rowPerms = PERM_COLS.map((c) => findPerm(group, c.suffix));
                    const realPerms = rowPerms.filter((p): p is string => !!p);
                    const allOn = realPerms.length > 0 && realPerms.every((p) => activePerms.has(p));

                    return (
                      <div key={group.group}
                        className="grid grid-cols-[1fr_80px_80px_80px_80px_72px] items-center border-t border-gray-100 px-5 py-3 hover:bg-gray-50/60 transition-colors">

                        <span className="text-sm text-gray-700">{group.group}</span>

                        {rowPerms.map((perm, i) => (
                          <Checkbox
                            key={i}
                            checked={activePerms.has(perm)}
                            onChange={() => togglePerm(perm)}
                          />
                        ))}

                        <Toggle on={allOn} onChange={() => toggleGroupAll(rowPerms)} />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Data Restrictions section */}
            {restrictGroup && (
              <>
                <div className="grid grid-cols-[1fr_80px_80px_80px_80px_72px] border-t border-amber-200 bg-amber-50 px-5 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 col-span-6">
                    DATA RESTRICTIONS
                    <span className="ml-2 normal-case font-normal text-amber-400">server-enforced · hidden from affected users</span>
                  </span>
                </div>

                {restrictGroup.permissions.map((perm) => {
                  const meta   = RESTRICTION_META[perm] ?? { label: perm, desc: "" };
                  const active = activePerms.has(perm);
                  return (
                    <div key={perm}
                      className="grid grid-cols-[1fr_80px_80px_80px_80px_72px] items-center border-t border-amber-100 bg-amber-50/30 px-5 py-3 hover:bg-amber-50/60 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-amber-900">{meta.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{meta.desc}</p>
                      </div>
                      {/* Span 4 empty cols */}
                      <div /><div /><div /><div />
                      <Toggle on={active} onChange={() => togglePerm(perm)} />
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <p className="text-xs text-gray-400 text-right mt-3">
            Permission changes take effect when affected users next log in.
          </p>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="roles.read"><RolesPage /></PermGuard>;
}
