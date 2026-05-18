"use client";

import { useState, useRef, useEffect } from "react";
import { Table } from "@tanstack/react-table";
import { Eye, EyeOff, X, Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnConfig } from "./types/grid.types";

interface DataGridToolbarProps<TData> {
  table: Table<TData>;
  columnConfigs: ColumnConfig<TData>[];
  enableFilters?: boolean;
  enableColumnVisibility?: boolean;
  toolbarActions?: React.ReactNode;
  onClearFilters?: () => void;
}

export function DataGridToolbar<TData>({
  table,
  columnConfigs,
  enableFilters = true,
  enableColumnVisibility = true,
  toolbarActions,
  onClearFilters,
}: DataGridToolbarProps<TData>) {
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target as Node)
      ) {
        setShowColumnMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filterableColumns = columnConfigs.filter(
    (config) => config.filterType && config.filterType !== "none"
  );

  const activeFiltersCount = table.getState().columnFilters.length;
  const hiddenColumnsCount = table
    .getAllColumns()
    .filter((col) => !col.getIsVisible()).length;

  const globalFilter = (table.getState().globalFilter as string) ?? "";

  const handleFilterChange = (columnId: string, value: string) => {
    table.getColumn(columnId)?.setFilterValue(value || undefined);
  };

  const handleClearFilters = () => {
    table.resetColumnFilters();
    table.setGlobalFilter("");
    if (onClearFilters) onClearFilters();
  };

  const handleShowAll = () => {
    table.getAllColumns().forEach((col) => {
      if (col.getCanHide()) col.toggleVisibility(true);
    });
  };

  const handleHideAll = () => {
    table.getAllColumns().forEach((col) => {
      if (col.getCanHide()) col.toggleVisibility(false);
    });
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      {/* ── Single toolbar row ── */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Global search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-150"
          />
          {globalFilter && (
            <button
              onClick={() => table.setGlobalFilter("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter toggle button */}
        {enableFilters && filterableColumns.length > 0 && (
          <button
            onClick={() => setShowFilterPanel((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors flex-shrink-0",
              showFilterPanel || activeFiltersCount > 0
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}

        {/* Column visibility button */}
        {enableColumnVisibility && (
          <div className="relative flex-shrink-0" ref={columnMenuRef}>
            <button
              onClick={() => setShowColumnMenu((p) => !p)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                showColumnMenu
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <Eye className="h-4 w-4" />
              <span>Columns</span>
              {hiddenColumnsCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-400 text-[10px] font-bold text-white">
                  {hiddenColumnsCount}
                </span>
              )}
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border bg-white shadow-lg">
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between border-b pb-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Toggle Columns
                    </span>
                    <button
                      onClick={() => setShowColumnMenu(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-0.5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {table.getAllLeafColumns().map((column) => {
                      const canHide = column.getCanHide();
                      const isVisible = column.getIsVisible();
                      return (
                        <label
                          key={column.id}
                          className={cn(
                            "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                            canHide
                              ? "cursor-pointer hover:bg-gray-50"
                              : "cursor-not-allowed opacity-40"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={column.getToggleVisibilityHandler()}
                            disabled={!canHide}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                          />
                          <span className="text-gray-700 flex-1">
                            {typeof column.columnDef.header === "string"
                              ? column.columnDef.header
                              : column.id}
                          </span>
                          {isVisible ? (
                            <Eye className="h-3.5 w-3.5 text-blue-400" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-gray-300" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 border-t pt-2">
                    <button
                      onClick={handleShowAll}
                      className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Show All
                    </button>
                    <button
                      onClick={handleHideAll}
                      className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toolbar actions (e.g. Export button) */}
        {toolbarActions && (
          <div className="flex-shrink-0">{toolbarActions}</div>
        )}
      </div>

      {/* ── Collapsible filter panel ── */}
      {enableFilters && showFilterPanel && filterableColumns.length > 0 && (
        <div className="border-t px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {filterableColumns.map((config) => {
              const column = table.getColumn(config.id);
              const filterValue = (column?.getFilterValue() as string) ?? "";

              if (config.filterType === "text") {
                return (
                  <input
                    key={config.id}
                    type="text"
                    placeholder={`${config.header}...`}
                    value={filterValue}
                    onChange={(e) =>
                      handleFilterChange(config.id, e.target.value)
                    }
                    className="min-w-[140px] flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                );
              }

              if (config.filterType === "select" && config.filterOptions) {
                return (
                  <select
                    key={config.id}
                    value={filterValue}
                    onChange={(e) =>
                      handleFilterChange(config.id, e.target.value)
                    }
                    className="min-w-[140px] rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">All {config.header}</option>
                    {config.filterOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                );
              }

              if (config.filterType === "date") {
                return (
                  <div key={config.id} className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {config.header}:
                    </span>
                    <input
                      type="date"
                      value={filterValue}
                      onChange={(e) =>
                        handleFilterChange(config.id, e.target.value)
                      }
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                );
              }

              return null;
            })}

            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 flex-shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
