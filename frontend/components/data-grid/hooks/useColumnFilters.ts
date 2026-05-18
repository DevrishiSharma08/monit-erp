"use client";

import { useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { ColumnFiltersState } from "@tanstack/react-table";
import { FiltersHookState } from "../types/grid.types";

/**
 * Hook to manage column filters state with URL query parameter persistence
 * @returns Column filters state and setter functions
 */
export function useColumnFilters(): FiltersHookState {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [columnFilters, setColumnFiltersState] = useState<ColumnFiltersState>(() => {
    // Initialize from URL query params
    const filters: ColumnFiltersState = [];
    searchParams.forEach((value, key) => {
      // Skip pagination params
      if (key !== "page" && key !== "pageSize") {
        filters.push({ id: key, value });
      }
    });
    return filters;
  });

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Clear all existing filter params (keep pagination params)
    const pagePagination = params.get("page");
    const pageSize = params.get("pageSize");

    // Remove all params
    Array.from(params.keys()).forEach((key) => {
      if (key !== "page" && key !== "pageSize") {
        params.delete(key);
      }
    });

    // Add current filters
    columnFilters.forEach((filter) => {
      if (filter.value) {
        params.set(filter.id, String(filter.value));
      }
    });

    // Update URL
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    // Only update if URL changed
    if (window.location.pathname + window.location.search !== newUrl) {
      router.replace(newUrl);
    }
  }, [columnFilters, pathname, router, searchParams]);

  const setColumnFilters = (filters: ColumnFiltersState) => {
    setColumnFiltersState(filters);
  };

  const clearFilters = () => {
    setColumnFiltersState([]);
  };

  return {
    columnFilters,
    setColumnFilters,
    clearFilters,
  };
}
