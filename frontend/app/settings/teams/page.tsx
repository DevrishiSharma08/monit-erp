"use client";

import { useState, useMemo } from "react";
import {
  Search, Plus, Pencil, Trash2, X, Save,
  Users, Eye, MapPin, Crown, Calendar,
  AlertTriangle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Data ─────────────────────────────────────────────────────────────────────

const ALL_MEMBERS = [
  "Bhumika", "Amit Gupta", "Ramesh Kumar", "Priya Patel", "Sunita Verma", "Ishwar",
];

const TERRITORIES = [
  "Mumbai", "Delhi", "Pune", "Bangalore", "Ahmedabad", "Hyderabad", "Pan India", "Online",
];

interface TeamMember { name: string; role: string; }
interface AppTeam {
  id: string; name: string; description: string;
  lead: string; members: TeamMember[];
  territory: string; status: "active" | "inactive"; createdAt: string;
}

const INITIAL_TEAMS: AppTeam[] = [
  {
    id: "1", name: "Sales Team Alpha",
    description: "Primary sales team covering Mumbai region",
    lead: "Bhumika", territory: "Mumbai",
    members: [
      { name: "Bhumika",      role: "Manager"  },
      { name: "Ramesh Kumar", role: "Salesman" },
      { name: "Priya Patel",  role: "Salesman" },
    ],
    status: "active", createdAt: "2026-01-10",
  },
  {
    id: "2", name: "Logistics Team",
    description: "Handles dispatch planning and GRN operations",
    lead: "Amit Gupta", territory: "Pan India",
    members: [
      { name: "Amit Gupta", role: "Admin"            },
      { name: "Ishwar",     role: "Warehouse Manager" },
    ],
    status: "active", createdAt: "2026-01-15",
  },
  {
    id: "3", name: "Accounts Team",
    description: "Manages invoicing and payment reconciliation",
    lead: "Sunita Verma", territory: "Pan India",
    members: [
      { name: "Sunita Verma", role: "Accountant" },
    ],
    status: "inactive", createdAt: "2026-01-20",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// Per-team accent palette
const TEAM_PALETTE = [
  { bg: "bg-blue-500",   light: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-100",   icon: "text-blue-500"   },
  { bg: "bg-violet-500", light: "bg-violet-50",  text: "text-violet-700", border: "border-violet-100", icon: "text-violet-500" },
  { bg: "bg-emerald-500",light: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-100",icon: "text-emerald-500"},
  { bg: "bg-orange-500", light: "bg-orange-50",  text: "text-orange-700", border: "border-orange-100", icon: "text-orange-500" },
];

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
];

function Avatar({ name, idx, size = "md" }: { name: string; idx: number; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-10 w-10 text-sm" : size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-xs";
  return (
    <div className={cn("flex items-center justify-center rounded-full font-bold flex-shrink-0", s, AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
      {initials(name)}
    </div>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewTeamModal({ team, palette, onClose, onEdit }: {
  team: AppTeam; palette: typeof TEAM_PALETTE[0];
  onClose: () => void; onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">

        {/* Coloured header band */}
        <div className={cn("relative rounded-t-2xl px-6 pt-6 pb-5", palette.light)}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-white/70 hover:text-gray-600 transition-all"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", palette.light, "border", palette.border, "shadow-sm")}>
              <Users className={cn("h-6 w-6", palette.icon)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{team.name}</h2>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border",
                  team.status === "active"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-500 border-gray-200"
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", team.status === "active" ? "bg-green-500" : "bg-gray-400")} />
                  {team.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              {team.description && (
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{team.description}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: Users,    label: "Members",   value: String(team.members.length) },
              { icon: MapPin,   label: "Territory",  value: team.territory              },
              { icon: Calendar, label: "Created",    value: fmtDate(team.createdAt)     },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/80 border border-white px-3 py-2.5 text-center shadow-sm">
                <Icon className="mx-auto h-3.5 w-3.5 text-gray-400 mb-1" />
                <p className="text-sm font-bold text-gray-800">{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Team Lead */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Team Lead</p>
            <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <Avatar name={team.lead} idx={0} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{team.lead}</p>
                <p className="text-xs text-gray-500">Team Lead</p>
              </div>
              <Crown className="h-4 w-4 text-amber-400 flex-shrink-0" />
            </div>
          </div>

          {/* Members */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              All Members ({team.members.length})
            </p>
            <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {team.members.map((m, idx) => (
                <div key={m.name + idx} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <Avatar name={m.name} idx={idx} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  </div>
                  <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 flex-shrink-0">
                    {m.role}
                  </span>
                  {m.name === team.lead && (
                    <Crown className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Team
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit / Add Modal ─────────────────────────────────────────────────────────

function TeamModal({ team, onClose, onSave }: {
  team: Partial<AppTeam> | null; onClose: () => void; onSave: (t: AppTeam) => void;
}) {
  const isEdit = !!team?.id;
  const [name, setName]               = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [lead, setLead]               = useState(team?.lead ?? ALL_MEMBERS[0]);
  const [territory, setTerritory]     = useState(team?.territory ?? TERRITORIES[0]);
  const [status, setStatus]           = useState<"active" | "inactive">(team?.status ?? "active");
  const [memberInputs, setMemberInputs] = useState<TeamMember[]>(
    team?.members ?? [{ name: ALL_MEMBERS[0], role: "Salesman" }]
  );

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      id: team?.id ?? String(Date.now()),
      name: name.trim(), description: description.trim(),
      lead, territory, status,
      members: memberInputs.filter((m) => m.name),
      createdAt: team?.createdAt ?? new Date().toISOString().slice(0, 10),
    });
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{isEdit ? "Edit Team" : "Add New Team"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{isEdit ? "Update team details and members" : "Set up a new team with members"}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Team name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Team Alpha"
              className={inputCls} />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of team purpose"
              className={inputCls} />
          </div>

          {/* Lead + Territory */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team Lead</label>
              <select value={lead} onChange={(e) => setLead(e.target.value)} className={inputCls}>
                {ALL_MEMBERS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Territory</label>
              <select value={territory} onChange={(e) => setTerritory(e.target.value)} className={inputCls}>
                {TERRITORIES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
            <div className="flex gap-3">
              {(["active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition-all",
                    status === s
                      ? s === "active"
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-gray-300 bg-gray-100 text-gray-700"
                      : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
                  )}
                >
                  <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                    s === "active" ? "bg-green-500" : "bg-gray-400"
                  )} />
                  {s === "active" ? "Active" : "Inactive"}
                </button>
              ))}
            </div>
          </div>

          {/* Members */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Members</label>
              <button
                onClick={() => setMemberInputs((p) => [...p, { name: ALL_MEMBERS[0], role: "Salesman" }])}
                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Member
              </button>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5">
              {memberInputs.map((member, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <Avatar name={member.name} idx={idx} size="sm" />
                  <select
                    value={member.name}
                    onChange={(e) => setMemberInputs((p) => p.map((m, i) => i === idx ? { ...m, name: e.target.value } : m))}
                    className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                  >
                    {ALL_MEMBERS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <input
                    value={member.role}
                    onChange={(e) => setMemberInputs((p) => p.map((m, i) => i === idx ? { ...m, role: e.target.value } : m))}
                    placeholder="Role"
                    className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => setMemberInputs((p) => p.filter((_, i) => i !== idx))}
                    className="flex-shrink-0 rounded-md p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {memberInputs.length === 0 && (
                <p className="py-3 text-center text-xs text-gray-400">No members yet — click Add Member above</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="h-3.5 w-3.5" />
            {isEdit ? "Save Changes" : "Create Team"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function TeamCard({ team, paletteIdx, onView, onEdit, onDelete }: {
  team: AppTeam; paletteIdx: number;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const p = TEAM_PALETTE[paletteIdx % TEAM_PALETTE.length];

  return (
    <div className="group relative flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden">

      {/* Top accent line */}
      <div className={cn("h-1 w-full", p.bg)} />

      <div className="flex flex-col flex-1 p-5 gap-4">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 border", p.light, p.border)}>
              <Users className={cn("h-5 w-5", p.icon)} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm leading-snug truncate">{team.name}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-500">{team.territory}</span>
              </div>
            </div>
          </div>

          {/* Status badge + actions */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
              team.status === "active"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-100 text-gray-500 border-gray-200"
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", team.status === "active" ? "bg-green-500" : "bg-gray-400")} />
              {team.status === "active" ? "Active" : "Inactive"}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onView}  title="View"   className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50   hover:text-blue-600   transition-colors"><Eye     className="h-3.5 w-3.5" /></button>
              <button onClick={onEdit}  title="Edit"   className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100  hover:text-gray-700   transition-colors"><Pencil  className="h-3.5 w-3.5" /></button>
              <button onClick={onDelete}title="Delete" className="rounded-md p-1.5 text-gray-400 hover:bg-red-50    hover:text-red-500    transition-colors"><Trash2  className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>

        {/* Description */}
        {team.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 -mt-1">{team.description}</p>
        )}

        {/* Team Lead row */}
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
          <Crown className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <Avatar name={team.lead} idx={0} size="sm" />
          <span className="text-xs font-semibold text-gray-800 truncate">{team.lead}</span>
          <span className="ml-auto text-[10px] text-amber-600 font-medium">Lead</span>
        </div>

        {/* Members footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {team.members.slice(0, 5).map((m, idx) => (
                <div
                  key={m.name + idx}
                  title={`${m.name} · ${m.role}`}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold",
                    AVATAR_COLORS[idx % AVATAR_COLORS.length]
                  )}
                >
                  {initials(m.name)}
                </div>
              ))}
              {team.members.length > 5 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-bold text-gray-500">
                  +{team.members.length - 5}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400">{team.members.length} member{team.members.length !== 1 ? "s" : ""}</span>
          </div>
          <button
            onClick={onView}
            className={cn("flex items-center gap-1 text-xs font-medium transition-colors", p.text, "hover:underline")}
          >
            View details <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamManagementPage() {
  const [teams, setTeams]       = useState<AppTeam[]>(INITIAL_TEAMS);
  const [search, setSearch]     = useState("");
  const [viewTeam, setViewTeam] = useState<AppTeam | null>(null);
  const [editTeam, setEditTeam] = useState<Partial<AppTeam> | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    teams.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.lead.toLowerCase().includes(search.toLowerCase()) ||
      t.territory.toLowerCase().includes(search.toLowerCase())
    ), [teams, search]);

  function handleSave(t: AppTeam) {
    setTeams((prev) => prev.some((x) => x.id === t.id) ? prev.map((x) => x.id === t.id ? t : x) : [...prev, t]);
    setShowEdit(false); setEditTeam(null);
  }

  function openEdit(team: Partial<AppTeam>) {
    setViewTeam(null); setEditTeam(team); setShowEdit(true);
  }

  // Total stats
  const activeCount = teams.filter((t) => t.status === "active").length;
  const totalMembers = [...new Set(teams.flatMap((t) => t.members.map((m) => m.name)))].length;

  return (
    <div className="space-y-6 pb-24">
      <p className="text-sm text-gray-500">Organize users into teams, assign team leads, and set territories.</p>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Teams",    value: teams.length,  sub: "configured",     color: "text-blue-600",    bg: "bg-blue-50"   },
          { label: "Active Teams",   value: activeCount,   sub: "currently active",color: "text-green-600",  bg: "bg-green-50"  },
          { label: "Total Members",  value: totalMembers,  sub: "across all teams", color: "text-violet-600", bg: "bg-violet-50" },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-4">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
              <Users className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", color)}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, lead, territory…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          />
        </div>
        <button
          onClick={() => openEdit({})}
          className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Team
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((team, idx) => (
          <TeamCard
            key={team.id}
            team={team}
            paletteIdx={idx}
            onView={() => setViewTeam(team)}
            onEdit={() => openEdit(team)}
            onDelete={() => setDeleteId(team.id)}
          />
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No teams found</p>
            {search && <p className="text-xs text-gray-400 mt-1">Try a different search term</p>}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">{filtered.length} of {teams.length} team{teams.length !== 1 ? "s" : ""}</p>

      {/* View Modal */}
      {viewTeam && (
        <ViewTeamModal
          team={viewTeam}
          palette={TEAM_PALETTE[teams.findIndex((t) => t.id === viewTeam.id) % TEAM_PALETTE.length]}
          onClose={() => setViewTeam(null)}
          onEdit={() => openEdit(viewTeam)}
        />
      )}

      {/* Add/Edit Modal */}
      {showEdit && (
        <TeamModal
          team={editTeam}
          onClose={() => { setShowEdit(false); setEditTeam(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Team</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-gray-700">
                    {teams.find((t) => t.id === deleteId)?.name}
                  </span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => { setTeams((p) => p.filter((t) => t.id !== deleteId)); setDeleteId(null); }}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors">
                Delete Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
