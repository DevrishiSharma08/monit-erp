"use client";

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  RowSelectionState,
  Table,
  FilterFn,
  Updater,
  Row,
} from "@tanstack/react-table";

// Splits search by "/" and checks every token exists anywhere in the row (any order).
// "75/58.5" and "58.5/75" both match a row containing those values.
const anyOrderGlobalFilter: FilterFn<unknown> = (row: Row<unknown>, _columnId: string, filterValue: unknown) => {
  const search = String(filterValue ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!search) return true;
  const rowStr = JSON.stringify((row as Row<Record<string, unknown>>).original).toLowerCase().replace(/\s+/g, " ");
  const tokens = search.split(/[/\s]+/).filter(Boolean);
  return tokens.every(t => rowStr.includes(t));
};
anyOrderGlobalFilter.autoRemove = (val: unknown) => !val || String(val).trim() === "";
import { ColumnConfig } from "../types/grid.types";

// Resolves TanStack's Updater<T> (value or functional updater) into a plain value
function resolveUpdater<T>(updaterOrValue: Updater<T>, currentValue: T): T {
  return typeof updaterOrValue === "function"
    ? (updaterOrValue as (old: T) => T)(currentValue)
    : updaterOrValue;
}

interface UseDataGridOptions<TData> {
  data: TData[];
  columns: ColumnConfig<TData>[];
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
  sorting?: SortingState;
  setSorting?: (sorting: SortingState) => void;
  columnFilters?: ColumnFiltersState;
  setColumnFilters?: (filters: ColumnFiltersState) => void;
  columnVisibility?: VisibilityState;
  setColumnVisibility?: (visibility: VisibilityState) => void;
  columnOrder?: string[];
  setColumnOrder?: (order: string[]) => void;
  pagination?: PaginationState;
  setPagination?: (pagination: PaginationState) => void;
  globalFilter?: string;
  setGlobalFilter?: (filter: string) => void;
  rowSelection?: RowSelectionState;
  setRowSelection?: (selection: RowSelectionState) => void;
  enableRowSelection?: boolean;
}

export function useDataGrid<TData>(
  options: UseDataGridOptions<TData>
): Table<TData> {
  const {
    data,
    columns: columnConfigs,
    enableSorting = true,
    enableFiltering = true,
    enablePagination = true,
    sorting = [],
    setSorting,
    columnFilters = [],
    setColumnFilters,
    columnVisibility = {},
    setColumnVisibility,
    columnOrder = [],
    setColumnOrder,
    pagination = { pageIndex: 0, pageSize: 10 },
    setPagination,
    globalFilter = "",
    setGlobalFilter,
    rowSelection = {},
    setRowSelection,
    enableRowSelection = false,
  } = options;

  const columns = useMemo<ColumnDef<TData>[]>(
    () =>
      columnConfigs.map((config) => {
        // When a computed accessor is supplied, TanStack uses it for sort /
        // search / filter — the displayed cell can still pull from the raw
        // row via its own renderer. Falls back to `accessorKey` (current
        // behavior for every existing column).
        const colDef: ColumnDef<TData> = config.accessorFn
          ? {
              id: config.id,
              accessorFn: config.accessorFn,
              header: config.header,
              enableSorting: config.enableSorting ?? true,
              enableHiding: config.enableHiding ?? true,
              size: config.size,
              minSize: config.minSize,
              maxSize: config.maxSize,
            }
          : {
              id: config.id,
              accessorKey: config.accessorKey as string,
              header: config.header,
              enableSorting: config.enableSorting ?? true,
              enableHiding: config.enableHiding ?? true,
              size: config.size,
              minSize: config.minSize,
              maxSize: config.maxSize,
            };
        if (config.cell) {
          colDef.cell = config.cell;
        }
        if (config.filterType === "dateRange") {
          colDef.filterFn = (row, columnId, filterValue) => {
            const [from, to] = (filterValue as [string, string]) ?? ["", ""];
            const val = String(row.getValue(columnId) ?? "");
            if (!val) return true;
            if (from && val < from) return false;
            if (to && val > to) return false;
            return true;
          };
        }
        // "text" filterType must always do a plain substring match. Without
        // an explicit filterFn, TanStack's default ("auto") picks a filter
        // function based on the CELL VALUE'S JS TYPE — for a numeric column
        // (e.g. GSM) it silently switches to inNumberRange, which expects
        // the filter value as a [min, max] tuple. Our filter inputs are
        // plain text boxes that send a string, so inNumberRange destructures
        // that string char-by-char (`"390"` → min:"3", max:"9"`) and almost
        // nothing matches — client-reported (GSM filter returning zero rows
        // even for values that visibly exist). Forcing includesString-style
        // matching here fixes every "text" column, not just GSM.
        if (config.filterType === "text") {
          colDef.filterFn = (row, columnId, filterValue) => {
            const val = row.getValue(columnId);
            if (val === null || val === undefined) return false;
            return String(val).toLowerCase().includes(String(filterValue).toLowerCase());
          };
        }
        return colDef;
      }),
    [columnConfigs]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder: columnOrder.length > 0 ? columnOrder : undefined,
      pagination,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting
      ? (u) => setSorting(resolveUpdater(u, sorting))
      : undefined,
    onColumnFiltersChange: setColumnFilters
      ? (u) => setColumnFilters(resolveUpdater(u, columnFilters))
      : undefined,
    onColumnVisibilityChange: setColumnVisibility
      ? (u) => setColumnVisibility(resolveUpdater(u, columnVisibility))
      : undefined,
    onColumnOrderChange: setColumnOrder
      ? (u) => setColumnOrder(resolveUpdater(u, columnOrder))
      : undefined,
    onPaginationChange: setPagination
      ? (u) => setPagination(resolveUpdater(u, pagination))
      : undefined,
    onGlobalFilterChange: setGlobalFilter
      ? (u) => setGlobalFilter(resolveUpdater(u, globalFilter))
      : undefined,
    onRowSelectionChange: setRowSelection
      ? (u) => setRowSelection(resolveUpdater(u, rowSelection))
      : undefined,
    enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    manualPagination: false,
    enableSorting,
    enableFilters: enableFiltering,
    globalFilterFn: anyOrderGlobalFilter as FilterFn<TData>,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  return table;
}
