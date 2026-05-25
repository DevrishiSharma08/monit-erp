"use client";

import { useState, useMemo, Suspense } from "react";
import { cn } from "@/lib/utils";
import { flexRender } from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DataGridProps } from "./types/grid.types";
import { DataGridColumnHeader } from "./DataGridColumnHeader";
import { DataGridToolbar } from "./DataGridToolbar";
import { DataGridPagination } from "./DataGridPagination";
import { useDataGrid } from "./hooks/useDataGrid";
import { useColumnVisibility } from "./hooks/useColumnVisibility";
import { useColumnFilters } from "./hooks/useColumnFilters";
import { useColumnOrder } from "./hooks/useColumnOrder";
import { useRowDensity } from "./hooks/useRowDensity";
import { Loader2 } from "lucide-react";

const DENSITY_CELL_CLS = {
  compact:     "px-2 py-1",
  normal:      "px-3 py-2.5",
  comfortable: "px-3 py-4",
} as const;

function DataGridInner<TData>({
  data,
  columns: columnConfigs,
  tableName,
  enableFilters = true,
  enablePagination = true,
  enableColumnReordering = true,
  enableColumnVisibility = true,
  enableExport = true,
  exportFilename,
  onRowClick,
  initialPageSize = 10,
  isLoading = false,
  emptyMessage = "No data available",
  emptyState,
  toolbarActions,
  hideToolbar = false,
  externalColumnVisibility,
  onExternalColumnVisibilityChange,
  highlightRow,
}: DataGridProps<TData>) {
  const [sorting, setSorting] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  // Custom hooks for state management
  const { columnVisibility: internalVisibility, setColumnVisibility: setInternalVisibility } =
    useColumnVisibility(tableName);

  const columnVisibility     = externalColumnVisibility     ?? internalVisibility;
  const setColumnVisibility  = onExternalColumnVisibilityChange ?? setInternalVisibility;

  const { columnFilters, setColumnFilters, clearFilters } =
    useColumnFilters();

  const defaultColumnOrder = useMemo(
    () => columnConfigs.map((col) => col.id),
    [columnConfigs]
  );

  const { columnOrder, setColumnOrder } = useColumnOrder(
    tableName,
    defaultColumnOrder
  );

  const [rowDensity, setRowDensity] = useRowDensity(tableName);

  // Map column id → config for sticky lookup
  const configMap = useMemo(
    () => Object.fromEntries(columnConfigs.map((c) => [c.id, c])),
    [columnConfigs]
  );

  // Create table instance
  const table = useDataGrid({
    data,
    columns: columnConfigs,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    pagination,
    setPagination,
    enablePagination,
    globalFilter,
    setGlobalFilter,
  });

  // Drag and drop sensors — distance constraint lets resize handle claim the
  // initial mousedown before DnD activates, so column resizing works properly.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as string);
      const newIndex = columnOrder.indexOf(over.id as string);

      const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
      setColumnOrder(newOrder);
    }
  }

  const cellPadding = DENSITY_CELL_CLS[rowDensity];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 rounded-lg border bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Empty state — still show toolbar so Add button is accessible
  if (data.length === 0) {
    return (
      <div className="space-y-4">
        {!hideToolbar && (
          <DataGridToolbar
            table={table}
            columnConfigs={columnConfigs}
            enableFilters={enableFilters}
            enableColumnVisibility={enableColumnVisibility && !externalColumnVisibility}
            enableExport={enableExport}
            exportFilename={exportFilename ?? tableName}
            onClearFilters={clearFilters}
            toolbarActions={toolbarActions}
            rowDensity={rowDensity}
            onRowDensityChange={setRowDensity}
          />
        )}
        <div className="rounded-lg border bg-white shadow-sm">
          {emptyState ?? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-gray-500">{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar with filters and column visibility */}
      {!hideToolbar && (
        <DataGridToolbar
          table={table}
          columnConfigs={columnConfigs}
          enableFilters={enableFilters}
          enableColumnVisibility={enableColumnVisibility && !externalColumnVisibility}
          onClearFilters={clearFilters}
          toolbarActions={toolbarActions}
          rowDensity={rowDensity}
          onRowDensityChange={setRowDensity}
        />
      )}

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
          <DndContext
            id={`dnd-${tableName}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table
              className="text-sm w-full"
              style={{ tableLayout: "fixed", minWidth: table.getTotalSize() || undefined }}
            >
              <thead className="border-b-2 border-gray-200 bg-gradient-to-b from-slate-50 to-gray-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    <SortableContext
                      items={columnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {headerGroup.headers.map((header) => {
                        const hCfg = configMap[header.column.id];
                        return (
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className={cn(
                            "relative px-3 py-3 font-semibold text-gray-700 select-none whitespace-nowrap text-[11px] uppercase tracking-wider",
                            hCfg?.align === "left" ? "text-left" : hCfg?.align === "right" ? "text-right" : "text-center",
                            hCfg?.sticky === "right" && "sticky right-0 z-20 bg-slate-50 border-l border-gray-200 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]",
                            hCfg?.sticky === "left"  && "sticky left-0 z-20 bg-slate-50 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]",
                          )}
                        >
                          {header.isPlaceholder ? null : (
                            <DataGridColumnHeader
                              column={header.column}
                              title={
                                typeof header.column.columnDef.header ===
                                "string"
                                  ? header.column.columnDef.header
                                  : header.id
                              }
                              enableReordering={enableColumnReordering}
                              align={hCfg?.align}
                            />
                          )}
                          {/* Resize handle */}
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-0 h-full w-3 cursor-col-resize touch-none select-none flex items-center justify-end group"
                          >
                            <div
                              className={`h-4/5 w-0.5 rounded-full transition-colors ${
                                header.column.getIsResizing()
                                  ? "bg-blue-500"
                                  : "bg-transparent group-hover:bg-blue-300"
                              }`}
                            />
                          </div>
                        </th>
                        );
                      })}
                    </SortableContext>
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, rowIdx) => {
                  const isEven = rowIdx % 2 === 0;
                  return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b transition-colors duration-100 cursor-pointer group",
                      highlightRow?.(row.original)
                        ? "bg-blue-50 border-l-2 border-l-blue-400"
                        : isEven ? "bg-white" : "bg-slate-50/50",
                      "hover:bg-blue-50/60"
                    )}
                    onClick={() => onRowClick && onRowClick(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const cCfg = configMap[cell.column.id];
                      const stickyR = cCfg?.sticky === "right";
                      const stickyL = cCfg?.sticky === "left";
                      return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                          cellPadding,
                          "text-gray-600 group-hover:text-gray-900 transition-colors duration-100",
                          !cCfg?.noTruncate && "overflow-hidden whitespace-nowrap text-ellipsis",
                          cCfg?.align === "left" ? "text-left" : cCfg?.align === "right" ? "text-right" : "text-center",
                          stickyR && cn(
                            "sticky right-0 z-10 border-l border-gray-200 group-hover:!bg-blue-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]",
                            isEven ? "bg-white" : "bg-slate-50",
                          ),
                          stickyL && cn(
                            "sticky left-0 z-10 border-r border-gray-200 group-hover:!bg-blue-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]",
                            isEven ? "bg-white" : "bg-slate-50",
                          ),
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </DndContext>
        </div>

        {/* Pagination */}
        {enablePagination && <DataGridPagination table={table} />}
      </div>
    </div>
  );
}

export function DataGrid<TData>(props: React.ComponentProps<typeof DataGridInner<TData>>) {
  return (
    <Suspense fallback={
      <div className="rounded-lg border bg-white shadow-sm flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    }>
      <DataGridInner {...props} />
    </Suspense>
  );
}
