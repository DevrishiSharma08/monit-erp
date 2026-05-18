"use client";

import { useState, useEffect } from "react";
import { VisibilityState } from "@tanstack/react-table";
import { VisibilityHookState } from "../types/grid.types";

/**
 * Hook to manage column visibility state with localStorage persistence
 * @param tableName - Unique identifier for the table
 * @param defaultVisibility - Default visibility state
 * @returns Column visibility state and setter functions
 */
export function useColumnVisibility(
  tableName: string,
  defaultVisibility: VisibilityState = {}
): VisibilityHookState {
  const storageKey = `${tableName}-column-visibility`;

  // Always start with defaultVisibility to match SSR
  const [columnVisibility, setColumnVisibilityState] = useState<VisibilityState>(defaultVisibility);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after hydration
  useEffect(() => {
    setIsHydrated(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setColumnVisibilityState(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load column visibility from localStorage:", error);
    }
  }, [storageKey]);

  // Persist to localStorage whenever visibility changes (but only after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch (error) {
      console.error("Failed to save column visibility to localStorage:", error);
    }
  }, [columnVisibility, storageKey, isHydrated]);

  const setColumnVisibility = (visibility: VisibilityState) => {
    setColumnVisibilityState(visibility);
  };

  const resetVisibility = () => {
    setColumnVisibilityState(defaultVisibility);
  };

  return {
    columnVisibility,
    setColumnVisibility,
    resetVisibility,
  };
}
