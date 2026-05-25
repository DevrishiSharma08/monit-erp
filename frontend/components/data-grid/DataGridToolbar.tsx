"use client";

import { useState, useRef, useEffect } from "react";
import { Table } from "@tanstack/react-table";
import { Eye, EyeOff, X, Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnConfig } from "./types/grid.types";
import { ExportMenu } from "@/components/ExportMenu";
import { RowDensity } from "./hooks/useRowDensity";

interface DataGridToolbarProps<TData> {
  table: Table<TData>;
  columnConfigs: ColumnConfig<TData>[];
  enableFilters?: boolean;
  enableColumnVisibility?: boolean;
  enableExport?: boolean;
  exportFilename?: string;
  toolbarActions?: React.ReactNode;
  onClearFilters?: () => void;
  rowDensity?: RowDensity;
  onRowDensityChange?: (d: RowDensity) => void;
}

const DENSITY_ORDER: RowDensity[] = ["compact", "normal", "comfortable"];
const DENSITY_LABEL: Record<RowDensity, string> = {
  compact: "Compact",
  normal: "Normal",
  comfortable: "Cozy",
};

export function DataGridToolbar<TData>({
  table,
  columnConfigs,
  enableFilters = true,
  enableColumnVisibility = true,
  enableExport = true,
  exportFilename = "export",
  toolbarActions,
  onClearFilters,
  rowDensity = "normal",
  onRowDensityChange,
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

  // Build export data from current filtered + visible rows
  const getExportData = () => {
    const visibleCols = table
      .getAllLeafColumns()
      .filter((col: any) => col.getIsVisible() && col.id !== "_select" && col.id !== "_actions");
    const configMap = new Map(columnConfigs.map((c) => [c.id, c]));

    // Build headers + per-column value resolvers, expanding exportColumns into multiple columns
    const headers: string[] = [];
    const resolvers: Array<(row: any) => string> = [];

    visibleCols.forEach((col: any) => {
      const config = configMap.get(col.id);
      if (config?.exportColumns?.length) {
        config.exportColumns.forEach((ec: { header: string; value: (row: any) => any }) => {
          headers.push(ec.header);
          resolvers.push((row: any) => {
            const v = ec.value(row.original);
            return v === null || v === undefined ? "" : String(v);
          });
        });
      } else {
        headers.push(typeof col.columnDef.header === "string" ? col.columnDef.header : col.id);
        resolvers.push((row: any) => {
          if (config?.exportValue) {
            const v = config.exportValue(row.original);
            return v === null || v === undefined ? "" : String(v);
          }
          const val = row.getValue(col.id);
          if (val === null || val === undefined) return "";
          if (typeof val === "boolean") return val ? "Yes" : "No";
          if (typeof val === "object") return "";
          return String(val);
        });
      }
    });

    const rows = table.getFilteredRowModel().rows.map((row: any) =>
      resolvers.map((resolver) => resolver(row))
    );
    return { headers, rows };
  };

  const handleFilterChange = (columnId: string, value: string) => {
    table.getColumn(columnId)?.setFilterValue(value || undefined);
  };

  const handleClearFilters = () => {
    table.resetColumnFilters();
    table.setGlobalFilter("");
    if (onClearFilters) onClearFilters();
  };

  // Set all visible at once — avoids stale-closure bug from forEach + toggleVisibility
  const handleShowAll = () => {
    table.setColumnVisibility({});
  };

  const handleHideAll = () => {
    const newVis: Record<string, boolean> = {};
    table.getAllColumns().forEach((col) => {
      if (col.getCanHide()) newVis[col.id] = false;
    });
    table.setColumnVisibility(newVis);
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      {/* ── Mobile: search full-width on its own row ── */}
      <div className="px-3 pt-2.5 pb-2 sm:hidden">
        <div className="relative">
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
      </div>

      {/* ── Mobile: buttons row (below search) | Desktop: single row with search inline ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 sm:border-t-0 border-t border-gray-100">
        {/* Desktop-only inline search */}
        <div className="relative flex-1 hidden sm:block">
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
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors flex-shrink-0",
              showFilterPanel || activeFiltersCount > 0
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
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
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors",
                showColumnMenu
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Columns</span>
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
                      className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      Show All
                    </button>
                    <button
                      onClick={handleHideAll}
                      className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      Hide All
                    </button>
                  </div>

                  {/* Row density */}
                  {onRowDensityChange && (
                    <div className="border-t pt-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                        Row Density
                      </p>
                      <div className="flex gap-1.5">
                        {DENSITY_ORDER.map((d) => (
                          <button
                            key={d}
                            onClick={() => onRowDensityChange(d)}
                            className={cn(
                              "flex-1 rounded px-2 py-1 text-xs font-medium transition-all",
                              rowDensity === d
                                ? "bg-blue-500 text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {DENSITY_LABEL[d]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export dropdown */}
        {enableExport && (
          <ExportMenu getData={getExportData} filename={exportFilename} />
        )}

        {/* Toolbar actions (e.g. Add button) */}
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

              if (config.filterType === "dateRange") {
                const rangeVal = (column?.getFilterValue() as [string, string] | undefined) ?? ["", ""];
                const [from, to] = rangeVal;
                const setRange = (newFrom: string, newTo: string) => {
                  column?.setFilterValue(newFrom || newTo ? [newFrom, newTo] : undefined);
                };
                return (
                  <div key={config.id} className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-500 flex-shrink-0">{config.header}:</span>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setRange(e.target.value, to)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-xs text-gray-400 flex-shrink-0">—</span>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setRange(from, e.target.value)}
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
