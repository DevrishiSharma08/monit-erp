"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Save, Copy, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Users + Roles (mirrors User Management data) ─────────────────────────────

const ALL_USERS = [
  { id: "1", name: "System Admin",  role: "Admin"             },
  { id: "2", name: "Bhumika",       role: "Manager"           },
  { id: "3", name: "Amit Gupta",    role: "Planner"           },
  { id: "4", name: "Ishwar",        role: "Warehouse Manager" },
  { id: "5", name: "Ramesh Kumar",  role: "Salesman"          },
  { id: "6", name: "Priya Patel",   role: "Salesman"          },
  { id: "7", name: "Sunita Verma",  role: "Accountant"        },
];

// ─── System Pages ──────────────────────────────────────────────────────────────

const PAGE_GROUPS = [
  { group: "Main",        pages: ["Dashboard"] },
  { group: "Sales",       pages: ["Sales Order"] },
  { group: "Procurement", pages: ["Purchase Order", "Mill Order Tracker"] },
  { group: "Logistics",   pages: ["Truck Load Planner", "GRN", "Stock Lots"] },
  { group: "Masters",     pages: ["Material Master", "Category Master", "Customer Master", "Mill Master", "Salesman Master", "Warehouse Master", "Transporter Master", "Rate Master"] },
  { group: "Settings",    pages: ["User Management", "Permissions"] },
];

const ALL_PAGES = PAGE_GROUPS.flatMap((g) => g.pages);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PagePerm { view: boolean; edit: boolean; delete: boolean; print: boolean; }
type UserPerms = Record<string, PagePerm>;

function emptyPerms(): UserPerms {
  const result: UserPerms = {};
  ALL_PAGES.forEach((p) => { result[p] = { view: false, edit: false, delete: false, print: false }; });
  return result;
}

function adminPerms(): UserPerms {
  const result: UserPerms = {};
  ALL_PAGES.forEach((p) => { result[p] = { view: true, edit: true, delete: true, print: true }; });
  return result;
}

function managerPerms(): UserPerms {
  const p = emptyPerms();
  ["Dashboard","Sales Order","Purchase Order","Mill Order Tracker","Truck Load Planner","GRN","Stock Lots",
   "Material Master","Category Master","Customer Master","Mill Master","Salesman Master"].forEach((pg) => {
    p[pg] = { view: true, edit: true, delete: false, print: true };
  });
  return p;
}

function salesmanPerms(): UserPerms {
  const p = emptyPerms();
  ["Dashboard","Sales Order","Customer Master"].forEach((pg) => {
    p[pg] = { view: true, edit: false, delete: false, print: true };
  });
  return p;
}

const INITIAL_ALL_PERMS: Record<string, UserPerms> = {
  "1": adminPerms(),
  "2": managerPerms(),
  "3": (() => {
    const p = emptyPerms();
    ["Dashboard","Purchase Order","Mill Order Tracker","Truck Load Planner","GRN","Stock Lots","Material Master"].forEach((pg) => {
      p[pg] = { view: true, edit: true, delete: false, print: true };
    });
    return p;
  })(),
  "4": (() => {
    const p = emptyPerms();
    ["Dashboard","GRN","Stock Lots","Material Master","Warehouse Master"].forEach((pg) => {
      p[pg] = { view: true, edit: true, delete: false, print: false };
    });
    return p;
  })(),
  "5": salesmanPerms(),
  "6": salesmanPerms(),
  "7": (() => {
    const p = emptyPerms();
    ["Dashboard","Sales Order","Purchase Order"].forEach((pg) => {
      p[pg] = { view: true, edit: false, delete: false, print: true };
    });
    return p;
  })(),
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  Admin:              "bg-blue-50 text-blue-700 border-blue-200",
  Manager:            "bg-purple-50 text-purple-700 border-purple-200",
  Salesman:           "bg-green-50 text-green-700 border-green-200",
  Accountant:         "bg-amber-50 text-amber-700 border-amber-200",
  Planner:            "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Warehouse Manager":"bg-orange-50 text-orange-700 border-orange-200",
  Driver:             "bg-gray-50 text-gray-600 border-gray-200",
};

// ─── User Search Dropdown ──────────────────────────────────────────────────────

function UserSearchDropdown({
  value, onChange, placeholder, excludeId,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  excludeId?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedUser = ALL_USERS.find((u) => u.id === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() =>
    ALL_USERS.filter((u) =>
      u.id !== excludeId &&
      (u.name.toLowerCase().includes(query.toLowerCase()) ||
       u.role.toLowerCase().includes(query.toLowerCase()))
    ), [query, excludeId]);

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        {selectedUser ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-800 truncate">{selectedUser.name}</span>
            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0",
              ROLE_COLORS[selectedUser.role] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
              {selectedUser.role}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400 flex-1">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedUser && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange(""); setQuery(""); }}
              className="rounded p-0.5 hover:bg-gray-100 text-gray-400"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-gray-100 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-50">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter..."
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">No users found</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { onChange(u.id); setOpen(false); setQuery(""); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left",
                    value === u.id && "bg-blue-50"
                  )}
                >
                  <span className="text-sm font-medium text-gray-800 flex-1">{u.name}</span>
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0",
                    ROLE_COLORS[u.role] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
                    {u.role}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Checkbox ──────────────────────────────────────────────────────────────────

function Cb({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 text-blue-500 cursor-pointer accent-blue-500"
    />
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [allPerms, setAllPerms] = useState<Record<string, UserPerms>>(INITIAL_ALL_PERMS);
  const [selectedUser, setSelectedUser] = useState("");
  const [copyFromUser, setCopyFromUser] = useState("");
  const [saved, setSaved] = useState(false);

  const user = ALL_USERS.find((u) => u.id === selectedUser);
  const perms: UserPerms = selectedUser ? (allPerms[selectedUser] ?? emptyPerms()) : emptyPerms();

  function setPerm(page: string, field: keyof PagePerm, val: boolean) {
    if (!selectedUser) return;
    setAllPerms((prev) => ({
      ...prev,
      [selectedUser]: {
        ...(prev[selectedUser] ?? emptyPerms()),
        [page]: { ...(prev[selectedUser]?.[page] ?? { view: false, edit: false, delete: false, print: false }), [field]: val },
      },
    }));
  }

  function setAllForPage(page: string, val: boolean) {
    if (!selectedUser) return;
    setAllPerms((prev) => ({
      ...prev,
      [selectedUser]: {
        ...(prev[selectedUser] ?? emptyPerms()),
        [page]: { view: val, edit: val, delete: val, print: val },
      },
    }));
  }

  function isAllForPage(page: string) {
    const p = perms[page];
    return p?.view && p?.edit && p?.delete && p?.print;
  }

  function handleCopyFrom() {
    if (!selectedUser || !copyFromUser) return;
    const source = allPerms[copyFromUser] ?? emptyPerms();
    setAllPerms((prev) => ({ ...prev, [selectedUser]: { ...source } }));
    setCopyFromUser("");
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Search + Copy bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] max-w-xs">
          <UserSearchDropdown
            value={selectedUser}
            onChange={(id) => { setSelectedUser(id); setCopyFromUser(""); }}
            placeholder="Search user to edit permissions…"
          />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-xs">
          <Copy className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <div className="flex-1">
            <UserSearchDropdown
              value={copyFromUser}
              onChange={setCopyFromUser}
              placeholder="Copy permissions from…"
              excludeId={selectedUser}
            />
          </div>
          {copyFromUser && (
            <button
              onClick={handleCopyFrom}
              disabled={!selectedUser}
              className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40 whitespace-nowrap flex-shrink-0"
            >
              Apply
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!selectedUser}
          className={cn(
            "ml-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-sm",
            saved
              ? "bg-green-500 text-white"
              : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
          )}
        >
          <Save className="h-4 w-4" />
          {saved ? "Saved!" : "Save Permissions"}
        </button>
      </div>

      {/* No user selected */}
      {!selectedUser && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Search className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Search and select a user to manage permissions</p>
          <p className="text-xs text-gray-400 mt-1">You can also copy permissions from another user</p>
        </div>
      )}

      {/* Permissions Table */}
      {selectedUser && user && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Selected user header */}
          <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50 border-b border-blue-100">
            <p className="text-sm font-semibold text-gray-800">
              Editing permissions for: <span className="text-blue-700">{user.name}</span>
            </p>
            <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
              ROLE_COLORS[user.role] ?? "bg-gray-50 text-gray-600 border-gray-200")}>
              {user.role}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-[40%]">Page / Module</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">View</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Edit</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Delete</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Print</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">All</th>
              </tr>
            </thead>
            <tbody>
              {PAGE_GROUPS.map((group) => (
                <>
                  {/* Group header row */}
                  <tr key={`group-${group.group}`} className="bg-gray-50/70">
                    <td colSpan={6} className="px-5 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {group.group}
                      </span>
                    </td>
                  </tr>

                  {/* Page rows */}
                  {group.pages.map((page, idx) => {
                    const p = perms[page] ?? { view: false, edit: false, delete: false, print: false };
                    const allOn = isAllForPage(page);
                    return (
                      <tr
                        key={page}
                        className={cn(
                          "border-b border-gray-50 hover:bg-blue-50/30 transition-colors",
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                        )}
                      >
                        <td className="px-5 py-3 text-sm font-medium text-gray-700">{page}</td>
                        <td className="px-4 py-3 text-center">
                          <Cb checked={p.view} onChange={() => setPerm(page, "view", !p.view)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Cb checked={p.edit} onChange={() => setPerm(page, "edit", !p.edit)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Cb checked={p.delete} onChange={() => setPerm(page, "delete", !p.delete)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Cb checked={p.print} onChange={() => setPerm(page, "print", !p.print)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <div
                              onClick={() => setAllForPage(page, !allOn)}
                              className={cn(
                                "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
                                allOn ? "bg-blue-500" : "bg-gray-200"
                              )}
                            >
                              <div className={cn(
                                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                                allOn ? "translate-x-4" : "translate-x-0.5"
                              )} />
                            </div>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>

          {/* Footer save */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">
              Changes will take effect when {user.name} next logs in
            </p>
            <button
              onClick={handleSave}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-sm",
                saved ? "bg-green-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600"
              )}
            >
              <Save className="h-4 w-4" />
              {saved ? "Saved!" : "Save Permissions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
