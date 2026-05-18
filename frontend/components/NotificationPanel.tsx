"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ShoppingCart,
  Package,
  Truck,
  ClipboardCheck,
  Factory,
  CheckCheck,
  Trash2,
  Bell,
} from "lucide-react";
import { useNotifications, type NotifType, type AppNotification } from "@/context/NotificationContext";

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotifType,
  { label: string; Icon: React.ElementType; accent: string; badge: string }
> = {
  SO: {
    label: "Sales Order",
    Icon: ShoppingCart,
    accent: "border-l-blue-500",
    badge: "bg-blue-500/15 text-blue-400",
  },
  PO: {
    label: "Purchase Order",
    Icon: Package,
    accent: "border-l-violet-500",
    badge: "bg-violet-500/15 text-violet-400",
  },
  TLP: {
    label: "Truck Load Plan",
    Icon: Truck,
    accent: "border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-400",
  },
  GRN: {
    label: "GRN",
    Icon: ClipboardCheck,
    accent: "border-l-rose-500",
    badge: "bg-rose-500/15 text-rose-400",
  },
  MILL: {
    label: "Mill Order",
    Icon: Factory,
    accent: "border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400",
  },
};

const TABS: { key: "ALL" | NotifType | "UNREAD"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "UNREAD", label: "Unread" },
  { key: "SO", label: "SO" },
  { key: "PO", label: "PO" },
  { key: "TLP", label: "TLP" },
  { key: "GRN", label: "GRN" },
  { key: "MILL", label: "Mill" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Single notification card ─────────────────────────────────────────────────

function NotifCard({ n, onDismiss, onRead }: {
  n: AppNotification;
  onDismiss: (id: string) => void;
  onRead: (id: string) => void;
}) {
  const { Icon, accent, badge } = TYPE_CONFIG[n.type];

  return (
    <div
      onClick={() => !n.read && onRead(n.id)}
      className={`relative flex gap-3 border-l-[3px] px-3 py-2.5 cursor-pointer transition-colors duration-150
        ${accent}
        ${n.read
          ? "bg-transparent hover:bg-white/5"
          : "bg-blue-500/5 hover:bg-blue-500/10"
        }`}
    >
      {/* Unread dot */}
      {!n.read && (
        <span className="absolute right-8 top-3 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      )}

      {/* Icon */}
      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${badge}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${badge.split(" ")[1]}`}>
            {n.refNumber}
          </span>
          <span className="ml-auto text-[10px] text-slate-500 flex-shrink-0">{relativeTime(n.timestamp)}</span>
        </div>
        <p className={`text-xs font-medium leading-snug mt-0.5 ${n.read ? "text-slate-400" : "text-slate-200"}`}>
          {n.title}
        </p>
        <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{n.body}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
        title="Dismiss"
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-600 hover:bg-rose-500/20 hover:text-rose-400 transition-colors duration-150"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ anchorRef, open, onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll } = useNotifications();
  const [tab, setTab] = useState<"ALL" | NotifType | "UNREAD">("ALL");
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 340 });

  // Position below the bell button — clamped within viewport for mobile
  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const margin = 8;
      const panelWidth = Math.min(340, window.innerWidth - margin * 2);
      // Prefer right-aligned to the bell; clamp so it never overflows left or right
      const idealLeft = rect.right - panelWidth;
      const left = Math.max(margin, Math.min(idealLeft, window.innerWidth - panelWidth - margin));
      setPos({ top: rect.bottom + 8, left, width: panelWidth });
    }
  }, [open, anchorRef]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const filtered = notifications.filter((n) => {
    if (tab === "ALL") return true;
    if (tab === "UNREAD") return !n.read;
    return n.type === tab;
  });

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, width: pos.width, position: "fixed", zIndex: 9999 }}
      className="rounded-xl border border-white/10 bg-[#111827] shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden
        animate-[notif-enter_0.18s_ease-out]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-white">Notifications</span>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              title="Mark all as read"
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white transition-colors duration-150"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={dismissAll}
              title="Clear all"
              className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors duration-150"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/5 overflow-x-auto scrollbar-none">
        {TABS.map((t) => {
          const count =
            t.key === "ALL"
              ? notifications.length
              : t.key === "UNREAD"
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => n.type === t.key).length;

          if (count === 0 && t.key !== "ALL" && t.key !== "UNREAD") return null;

          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-150
                ${tab === t.key
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1 text-[9px] ${tab === t.key ? "text-blue-400" : "text-slate-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto max-h-[360px] divide-y divide-white/[0.04]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-8 w-8 text-slate-700 mb-2" />
            <p className="text-sm text-slate-500">No notifications</p>
            <p className="text-[11px] text-slate-700 mt-0.5">You&apos;re all caught up</p>
          </div>
        ) : (
          filtered.map((n) => (
            <NotifCard key={n.id} n={n} onDismiss={dismiss} onRead={markRead} />
          ))
        )}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="border-t border-white/5 px-4 py-2 text-center">
          <span className="text-[11px] text-slate-600">
            {/* BACKEND: replace with: <Link href="/notifications">View all notifications →</Link> */}
            {filtered.length} notification{filtered.length !== 1 ? "s" : ""}
            {tab === "UNREAD" ? " unread" : tab !== "ALL" ? ` in ${tab}` : ""}
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}
