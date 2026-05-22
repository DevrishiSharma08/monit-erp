"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { notificationApi, NotificationDto } from "@/lib/api-services";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifType = "SO" | "PO" | "GRN" | "TLP" | "MILL";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  refNumber: string;
  href: string;
  timestamp: string;
  read: boolean;
}

interface NotificationCtx {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const Ctx = createContext<NotificationCtx>({
  notifications: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
  dismiss: () => {},
  dismissAll: () => {},
});

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toApp(dto: NotificationDto): AppNotification {
  return {
    id:        dto.key,
    type:      dto.type as NotifType,
    title:     dto.title,
    body:      dto.body,
    refNumber: dto.refNumber,
    href:      dto.href,
    timestamp: dto.notifTs,
    read:      dto.isRead,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const failCountRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const dtos = await notificationApi.getAll();
      failCountRef.current = 0;
      setNotifications(dtos.map(toApp));
    } catch (err: any) {
      if (err?.status === 401) {
        // Auth expired — stop polling silently
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      } else {
        failCountRef.current += 1;
        // Stop polling after 3 consecutive server/network errors to avoid log spam
        if (failCountRef.current >= 3) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    notificationApi.markRead(id)
      .then(() => fetchNotifications())
      .catch((err) => { console.error("[Notifications] markRead failed:", err); fetchNotifications(); });
  }, [fetchNotifications]);

  const markAllRead = useCallback(() => {
    const keys = notifications.filter((n) => !n.read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (keys.length) {
      notificationApi.markAllRead(keys)
        .then(() => fetchNotifications())
        .catch((err) => { console.error("[Notifications] markAllRead failed:", err); fetchNotifications(); });
    }
  }, [notifications, fetchNotifications]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    notificationApi.dismiss(id)
      .then(() => fetchNotifications())
      .catch((err) => { console.error("[Notifications] dismiss failed:", err); fetchNotifications(); });
  }, [fetchNotifications]);

  const dismissAll = useCallback(() => {
    const keys = notifications.map((n) => n.id);
    setNotifications([]);
    if (keys.length) {
      notificationApi.dismissAll(keys)
        .then(() => fetchNotifications())
        .catch((err) => { console.error("[Notifications] dismissAll failed:", err); fetchNotifications(); });
    }
  }, [notifications, fetchNotifications]);

  return (
    <Ctx.Provider value={{ notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll }}>
      {children}
    </Ctx.Provider>
  );
}

export const useNotifications = () => useContext(Ctx);
