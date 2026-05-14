"use client";

import { createContext, useContext, useState, useCallback } from "react";
import {
  mockSalesOrders,
  mockPurchaseOrders,
  mockGRNs,
  mockTruckLoadPlans,
  mockMillTrackers,
} from "@/data/mockData";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifType = "SO" | "PO" | "GRN" | "TLP" | "MILL";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  refNumber: string;   // SO-2024-001, etc.
  href: string;        // deep-link to the relevant page
  timestamp: string;   // ISO string
  read: boolean;
}

interface NotificationCtx {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  // ── BACKEND HOOK ──────────────────────────────────────────────────────────
  // When integrating the backend, replace `buildMockNotifications()` below
  // with a `useEffect` that calls your API:
  //   GET /api/notifications?limit=50
  // and replace `markRead` / `dismiss` to call:
  //   POST /api/notifications/:id/read
  //   DELETE /api/notifications/:id
  // The interface above is intentionally generic so no component needs changing.
  // ─────────────────────────────────────────────────────────────────────────
}

const Ctx = createContext<NotificationCtx>({
  notifications: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
  dismiss: () => {},
  dismissAll: () => {},
});

// ─── Mock-data builder (replace with API call) ────────────────────────────────

function buildMockNotifications(): AppNotification[] {
  const items: AppNotification[] = [];

  // Sales Orders — alert on Pending Allocation / Partially Allocated / Draft
  mockSalesOrders
    .filter((so) => ["Pending Allocation", "Partially Allocated", "Draft"].includes(so.status))
    .slice(0, 4)
    .forEach((so, i) => {
      const messages: Record<string, string> = {
        "Pending Allocation": `${so.customer} — coverage not yet allocated.`,
        "Partially Allocated": `${so.customer} — partially allocated, balance pending.`,
        "Draft": `${so.customer} — order still in draft.`,
      };
      items.push({
        id: `so-${so.id}`,
        type: "SO",
        title: "Sales Order Alert",
        body: messages[so.status] ?? so.status,
        refNumber: so.soNumber,
        href: "/orders",
        timestamp: new Date(Date.now() - i * 18 * 60 * 1000).toISOString(),
        read: i > 1,
      });
    });

  // Purchase Orders — alert on Sent to Mill / In Production / Partial Ready
  mockPurchaseOrders
    .filter((po) => ["Sent to Mill", "In Production", "Partial Ready"].includes(po.status))
    .slice(0, 4)
    .forEach((po, i) => {
      const messages: Record<string, string> = {
        "Sent to Mill": `${po.mill} — waiting for mill acknowledgement.`,
        "In Production": `${po.mill} — order is in production.`,
        "Partial Ready": `${po.mill} — partial stock ready for dispatch.`,
      };
      items.push({
        id: `po-${po.id}`,
        type: "PO",
        title: "Purchase Order Update",
        body: messages[po.status] ?? po.status,
        refNumber: po.poNumber,
        href: "/purchase-orders",
        timestamp: new Date(Date.now() - (i + 2) * 35 * 60 * 1000).toISOString(),
        read: i > 0,
      });
    });

  // Truck Load Plans — alert on Planned / Loading
  mockTruckLoadPlans
    .filter((tlp) => ["Planned", "Loading"].includes(tlp.status))
    .slice(0, 3)
    .forEach((tlp, i) => {
      const messages: Record<string, string> = {
        "Planned": `${tlp.origin} → truck not yet loaded.`,
        "Loading": `${tlp.origin} → loading in progress.`,
      };
      items.push({
        id: `tlp-${tlp.id}`,
        type: "TLP",
        title: "Truck Load Plan",
        body: messages[tlp.status] ?? tlp.status,
        refNumber: tlp.planNumber,
        href: "/truck-load-plan",
        timestamp: new Date(Date.now() - (i + 1) * 55 * 60 * 1000).toISOString(),
        read: i > 0,
      });
    });

  // GRNs — alert on short/damaged/rejected items
  mockGRNs
    .filter((grn) => grn.qcResult !== "Accepted" || grn.shortQty > 0 || grn.damagedQty > 0)
    .slice(0, 3)
    .forEach((grn, i) => {
      const issues: string[] = [];
      if (grn.shortQty > 0) issues.push(`short ${grn.shortQty} reams`);
      if (grn.damagedQty > 0) issues.push(`${grn.damagedQty} damaged`);
      if (grn.qcResult === "Rejected") issues.push("QC rejected");
      if (grn.qcResult === "Accepted with Remark") issues.push("QC remark");
      items.push({
        id: `grn-${grn.id}`,
        type: "GRN",
        title: "GRN Quality Alert",
        body: `${grn.paper} (${grn.mill}) — ${issues.join(", ") || grn.qcResult}.`,
        refNumber: grn.grnNumber,
        href: "/grn",
        timestamp: new Date(Date.now() - (i + 3) * 80 * 60 * 1000).toISOString(),
        read: false,
      });
    });

  // Mill Trackers — alert on delayed items
  mockMillTrackers
    .filter((mt) => mt.productionStatus === "Delayed" || (mt.delayDays ?? 0) > 0)
    .slice(0, 2)
    .forEach((mt, i) => {
      const delayInfo = mt.delayDays && mt.delayDays > 0 ? ` (${mt.delayDays}d delay)` : "";
      items.push({
        id: `mill-${mt.id}`,
        type: "MILL",
        title: "Mill Order Delay",
        body: `${mt.mill} — ${mt.paper} is ${mt.productionStatus}${delayInfo}.`,
        refNumber: mt.poNumber,
        href: "/mill-tracker",
        timestamp: new Date(Date.now() - (i + 5) * 120 * 60 * 1000).toISOString(),
        read: true,
      });
    });

  // Sort newest-first
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    buildMockNotifications()
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <Ctx.Provider value={{ notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll }}>
      {children}
    </Ctx.Provider>
  );
}

export const useNotifications = () => useContext(Ctx);
