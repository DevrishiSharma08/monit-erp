"use client";

import { useState, useEffect } from "react";
import { OrderHookState } from "../types/grid.types";

/**
 * Hook to manage column order state with localStorage persistence
 * @param tableName - Unique identifier for the table
 * @param defaultOrder - Default column order
 * @returns Column order state and setter functions
 */
export function useColumnOrder(
  tableName: string,
  defaultOrder: string[] = []
): OrderHookState {
  const storageKey = `${tableName}-column-order`;

  // Always start with defaultOrder to match SSR
  const [columnOrder, setColumnOrderState] = useState<string[]>(defaultOrder);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after hydration — validate against current columns to avoid stale IDs
  useEffect(() => {
    setIsHydrated(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        const defaultSet = new Set(defaultOrder);
        const valid =
          parsed.length === defaultOrder.length &&
          parsed.every((id) => defaultSet.has(id));
        if (valid) {
          setColumnOrderState(parsed);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist to localStorage whenever order changes (but only after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(columnOrder));
    } catch (error) {
      console.error("Failed to save column order to localStorage:", error);
    }
  }, [columnOrder, storageKey, isHydrated]);

  const setColumnOrder = (order: string[]) => {
    setColumnOrderState(order);
  };

  const resetOrder = () => {
    setColumnOrderState(defaultOrder);
  };

  return {
    columnOrder,
    setColumnOrder,
    resetOrder,
  };
}
