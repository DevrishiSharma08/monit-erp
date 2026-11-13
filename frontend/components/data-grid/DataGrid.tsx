"use client";

import { useState, useMemo, Suspense } from "react";
import { cn } from "@/lib/utils";
import { flexRender, RowSelectionState } from "@tanstack/react-table";
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
  // Defaults to true so every grid that supports Export also supports
  // "Export only selected" — the user just ticks the rows they want. Pages
  // that explicitly don't want checkboxes can pass enableRowSelection={false}.
  enableRowSelection = true,
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
  dimRow,
  onPdfExport,
  onPdfZipExport,
  onImageExport,
  scrollMaxHeight,
}: DataGridProps<TData>) {
  const [sorting, setSorting] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  // Row selection — only enabled when the page asks for it. When enabled, the
  // export menu hands the SELECTED rows to the export pipeline instead of the
  // full filtered set, so users get "export just these N rows" by default.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

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

  // A sticky column must always render at its pinned edge — CSS `position:
  // sticky` doesn't care about DOM order, but the offset math (and just
  // visual sense) does. Force sticky:"left" columns to the front and
  // sticky:"right" columns to the back on every render, regardless of what
  // a per-user localStorage-persisted drag order (from before a column
  // became sticky, or a stray drag) says — self-heals instead of requiring
  // every user to clear browser storage per table.
  const resolvedColumnOrder = useMemo(() => {
    const leftIds  = columnConfigs.filter((c) => c.sticky === "left").map((c) => c.id);
    const rightIds = columnConfigs.filter((c) => c.sticky === "right").map((c) => c.id);
    const pinned = new Set([...leftIds, ...rightIds]);
    const middle = columnOrder.filter((id) => !pinned.has(id));
    return [...leftIds, ...middle, ...rightIds];
  }, [columnOrder, columnConfigs]);

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
    columnOrder: resolvedColumnOrder,
    setColumnOrder,
    pagination,
    setPagination,
    enablePagination,
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
    enableRowSelection,
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
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

  // Sticky-left data columns (e.g. a pinned Actions column) sit right after
  // the built-in row-selection checkbox column, which is itself always
  // sticky-left at 0. Both can't sit at left:0 without overlapping, so a
  // sticky-left data column is offset by the checkbox column's width (w-10
  // = 40px) whenever that checkbox column is actually rendered.
  const stickyLeftOffset = enableRowSelection ? 40 : 0;

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
            onPdfExport={onPdfExport}
            onPdfZipExport={onPdfZipExport}
            onImageExport={onImageExport}
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
    <div className={cn(
      "space-y-4",
      // In viewport-lock mode the outermost wrapper must also fill its
      // parent (a height-constrained flex column) so the rounded inner
      // wrapper + scroll container + pagination chain all get a definite
      // height to flex against. Without this the inner flex-1 collapses
      // and the bottom of the grid (horizontal scrollbar + pagination row)
      // falls off-screen.
      scrollMaxHeight && "flex flex-col flex-1 min-h-0",
    )}>
      {/* Toolbar with filters and column visibility */}
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
          onPdfExport={onPdfExport}
          onPdfZipExport={onPdfZipExport}
          onImageExport={onImageExport}
        />
      )}

      {/* Table */}
      {/* Viewport-lock mode (scrollMaxHeight set): outer wrapper becomes a
          flex column with maxHeight, the scroll container fills it via
          flex-1 + min-h-0. Header row inside the table is sticky so column
          titles stay pinned while the body scrolls. Without scrollMaxHeight,
          behavior is unchanged — horizontal-only scroll, no height cap. */}
      <div
        style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
        className={cn(
          "rounded-lg border bg-white shadow-sm",
          // Flex column + flex-1 so the outer wrapper fills the parent's
          // remaining height (parent is expected to be a height-constrained
          // flex column); the scroll container inside then takes 100% of
          // it via flex-1 + min-h-0. maxHeight (when supplied) is an upper
          // bound — viewport-relative calc still wins on tall screens.
          scrollMaxHeight && "flex flex-col flex-1 min-h-0",
        )}
      >
        <div
          className={cn(
            scrollMaxHeight ? "flex-1 min-h-0 overflow-auto" : "overflow-x-auto",
            "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
          )}
        >
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
              {/* Sticky thead so column headers stay pinned to the top of
                  the scroll viewport while data rows scroll under them.
                  Active only when scrollMaxHeight is set (viewport-locked
                  mode); otherwise the page itself scrolls and a sticky
                  header would float in the middle of nowhere.
                  z-20 (was z-30) so toolbar dropdowns (Import / Export /
                  Columns / Filters) at z-30 still layer ABOVE the sticky
                  header — thead just needs to be above z-10 body cells. */}
              <thead className={cn(
                "border-b-2 border-gray-200 bg-gradient-to-b from-slate-50 to-gray-50",
                scrollMaxHeight && "sticky top-0 z-20",
              )}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {/* Select-all checkbox column — only when row selection
                        is enabled by the parent page. Sticky-left so it's
                        always visible while horizontal-scrolling. */}
                    {enableRowSelection && (
                      <th className="sticky left-0 z-20 w-10 bg-slate-50 border-r border-gray-200 px-2 py-3 text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <input
                          type="checkbox"
                          checked={table.getIsAllPageRowsSelected()}
                          ref={(el) => {
                            if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
                          }}
                          onChange={table.getToggleAllPageRowsSelectedHandler()}
                          aria-label="Select all rows on this page"
                          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400 cursor-pointer"
                        />
                      </th>
                    )}
                    <SortableContext
                      items={resolvedColumnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {headerGroup.headers.map((header) => {
                        const hCfg = configMap[header.column.id];
                        return (
                        <th
                          key={header.id}
                          style={{
                            width: header.getSize(),
                            ...(hCfg?.sticky === "left" ? { left: stickyLeftOffset } : undefined),
                          }}
                          className={cn(
                            // group/th lets the column header reveal drag /
                            // sort icons only when this <th> is hovered, which
                            // keeps narrow columns uncluttered at rest.
                            "group/th relative px-2 py-3 font-semibold text-gray-700 select-none whitespace-nowrap text-[11px] uppercase tracking-wider",
                            hCfg?.align === "left" ? "text-left" : hCfg?.align === "right" ? "text-right" : "text-center",
                            hCfg?.sticky === "right" && "sticky right-0 z-20 bg-slate-50 border-l border-gray-200 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]",
                            hCfg?.sticky === "left"  && "sticky z-20 bg-slate-50 border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]",
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
                              enableReordering={enableColumnReordering && !hCfg?.sticky}
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
                      row.getIsSelected()
                        ? "bg-amber-50/70 border-l-2 border-l-amber-400"
                        : highlightRow?.(row.original)
                        ? "bg-blue-50 border-l-2 border-l-blue-400"
                        : isEven ? "bg-white" : "bg-slate-50/50",
                      "hover:bg-blue-50/60",
                      dimRow?.(row.original) && "opacity-50 grayscale-[0.4]"
                    )}
                    onClick={() => onRowClick && onRowClick(row.original)}
                  >
                    {/* Row selection checkbox cell. stopPropagation so clicking
                        the checkbox doesn't also fire onRowClick (which opens
                        details on some pages). */}
                    {enableRowSelection && (
                      <td
                        className={cn(
                          "sticky left-0 z-10 w-10 px-2 py-2 text-center border-r border-gray-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]",
                          row.getIsSelected()
                            ? "bg-amber-50"
                            : isEven ? "bg-white" : "bg-slate-50"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={row.getIsSelected()}
                          onChange={row.getToggleSelectedHandler()}
                          aria-label="Select row"
                          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-400 cursor-pointer"
                        />
                      </td>
                    )}
                    {row.getVisibleCells().map((cell) => {
                      const cCfg = configMap[cell.column.id];
                      const stickyR = cCfg?.sticky === "right";
                      const stickyL = cCfg?.sticky === "left";
                      return (
                      <td
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          ...(stickyL ? { left: stickyLeftOffset } : undefined),
                        }}
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
                            "sticky z-10 border-r border-gray-200 group-hover:!bg-blue-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]",
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
