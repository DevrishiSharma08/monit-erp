"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { Search, X, SlidersHorizontal, Columns3, ChevronDown, Check } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { ReportChart, ChartType, ChartDataPoint } from "./ReportChart";
import { cn } from "@/lib/utils";

export type { ChartDataPoint, ChartType };

export interface ReportKPI {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}

export interface ReportFilter {
  id: string;
  label: string;
  options: string[];
}

interface ReportPageLayoutProps {
  categoryName?: string;
  categoryHref?: string;
  reportName?: string;
  reportDescription: string;

  kpis: ReportKPI[];

  chartTitle?: string;
  chartData?: ChartDataPoint[];
  chartType?: ChartType;
  chartColor?: string;
  chartHeight?: number;
  chartFormatValue?: (v: number) => string;

  searchPlaceholder?: string;
  filters?: ReportFilter[];

  /** Column labels in left-to-right order matching the table <th> elements */
  tableColumns?: string[];
  /** First row = headers, remaining rows = data cells (for CSV export) */
  exportData?: (string | number | null)[][];
  exportFilename?: string;

  children: React.ReactNode;
}

export function ReportPageLayout({
  reportDescription,
  kpis,
  chartTitle,
  chartData,
  chartType = "bar",
  chartColor = "#3b82f6",
  chartHeight = 260,
  chartFormatValue,
  searchPlaceholder = "Search...",
  filters = [],
  tableColumns,
  exportData,
  exportFilename = "report",
  children,
}: ReportPageLayoutProps) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  const rawId = useId();
  const uid = rawId.replace(/:/g, "");

  const activeFilters = Object.values(filterValues).filter(Boolean).length;
  const hasFilters = filters.length > 0;
  const hasColumns = tableColumns && tableColumns.length > 0;
  const hasExportData = exportData && exportData.length > 0;

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setShowColumns(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Compute hidden column indices (1-based for CSS nth-child)
  const hiddenIndices: number[] = tableColumns
    ? tableColumns
        .map((col, i) => (hiddenColumns.has(col) ? i + 1 : null))
        .filter((v): v is number => v !== null)
    : [];

  const cssRules =
    hiddenIndices.length > 0
      ? hiddenIndices
          .map(
            (i) =>
              `#rpt-${uid} table th:nth-child(${i}), #rpt-${uid} table td:nth-child(${i}) { display: none !important; }`
          )
          .join("\n")
      : "";

  function toggleColumn(col: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  function clearAll() {
    setSearch("");
    setFilterValues({});
  }

  function getReportExportData() {
    if (!exportData || exportData.length < 2) return { headers: [], rows: [] };
    const [headerRow, ...dataRows] = exportData;
    return {
      headers: headerRow.map((h) => String(h ?? "")),
      rows:    dataRows.map((row) => row.map((cell) => String(cell ?? ""))),
      title:   exportFilename,
    };
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <p className="text-sm text-gray-500">{reportDescription}</p>

      {/* KPI Cards */}
      <div
        className={cn(
          "grid gap-4",
          kpis.length <= 3
            ? "grid-cols-3"
            : kpis.length === 4
            ? "grid-cols-4"
            : "grid-cols-5"
        )}
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm card-hover"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {kpi.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-bold",
                    kpi.valueColor ?? "text-gray-900"
                  )}
                >
                  {kpi.value}
                </p>
                {kpi.sub && (
                  <p className="mt-0.5 text-[11px] text-gray-500">{kpi.sub}</p>
                )}
              </div>
              <div
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                  kpi.iconBg
                )}
              >
                <kpi.icon
                  className={cn("h-4 w-4", kpi.iconColor)}
                  strokeWidth={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData && chartData.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm card-hover">
          {chartTitle && (
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {chartTitle}
            </p>
          )}
          <ReportChart
            data={chartData}
            type={chartType}
            color={chartColor}
            formatValue={chartFormatValue}
            height={chartHeight}
          />
        </div>
      )}

      {/* ── Toolbar: Search | Filters▾ | Columns▾ | Export CSV ── */}
      <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">

          {/* Search */}
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* ── Filters button — always visible ── */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => {
                if (!hasFilters) return;
                setShowFilters((v) => !v);
                setShowColumns(false);
              }}
              title={hasFilters ? "Filter data" : "No filters configured for this report"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                !hasFilters
                  ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                  : showFilters || activeFilters > 0
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilters > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                  {activeFilters}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  showFilters && "rotate-180"
                )}
              />
            </button>

            {showFilters && hasFilters && (
              <div className="absolute left-0 top-full z-30 mt-1.5 min-w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Filter by
                </p>
                <div className="space-y-2">
                  {filters.map((f) => (
                    <div key={f.id}>
                      <label className="mb-1 block text-[11px] font-medium text-gray-500">
                        {f.label}
                      </label>
                      <select
                        value={filterValues[f.id] ?? ""}
                        onChange={(e) =>
                          setFilterValues((prev) => ({
                            ...prev,
                            [f.id]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 py-1.5 pl-2.5 pr-7 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                      >
                        <option value="">All</option>
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {activeFilters > 0 && (
                  <button
                    onClick={() => setFilterValues({})}
                    className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                  >
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Columns visibility button — always visible ── */}
          <div className="relative" ref={columnRef}>
            <button
              onClick={() => {
                if (!hasColumns) return;
                setShowColumns((v) => !v);
                setShowFilters(false);
              }}
              title={hasColumns ? "Toggle column visibility" : "Column visibility not configured"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                !hasColumns
                  ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                  : showColumns || hiddenColumns.size > 0
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
              {hiddenColumns.size > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                  {hiddenColumns.size}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  showColumns && "rotate-180"
                )}
              />
            </button>

            {showColumns && hasColumns && (
              <div className="absolute right-0 top-full z-30 mt-1.5 min-w-48 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Visible columns
                  </p>
                  {hiddenColumns.size > 0 && (
                    <button
                      onClick={() => setHiddenColumns(new Set())}
                      className="text-[10px] font-medium text-blue-500 hover:underline"
                    >
                      Show all
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {tableColumns!.map((col) => {
                    const visible = !hiddenColumns.has(col);
                    return (
                      <label
                        key={col}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-gray-50"
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors",
                            visible
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300 bg-white"
                          )}
                        >
                          {visible && (
                            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={visible}
                          onChange={() => toggleColumn(col)}
                        />
                        <span className="text-sm text-gray-700">{col}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Clear search/filter */}
          {(search || activeFilters > 0) && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}

          {/* ── Export (CSV / Excel / DOCX / PDF) ── */}
          {hasExportData && (
            <ExportMenu
              getData={getReportExportData}
              filename={exportFilename}
            />
          )}
        </div>
      </div>

      {/* Table with CSS column hiding */}
      <div id={`rpt-${uid}`}>
        {cssRules && <style>{cssRules}</style>}
        {children}
      </div>
    </div>
  );
}
