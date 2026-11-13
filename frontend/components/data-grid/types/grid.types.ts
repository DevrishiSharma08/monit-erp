import { CellContext, ColumnDef, SortingState, ColumnFiltersState, VisibilityState, PaginationState } from "@tanstack/react-table";
import { ReactNode } from "react";

/**
 * Filter type options for column filtering
 */
export type FilterType = "text" | "select" | "date" | "dateRange" | "number-range" | "none";

/**
 * Filter option for select-type filters
 */
export interface FilterOption {
  label: string;
  value: string;
}

/**
 * Column configuration for the data grid
 * @template TData - The type of data being displayed in the table
 */
export interface ColumnConfig<TData> {
  /** Unique identifier for the column */
  id: string;

  /** Key to access the data in the row object */
  accessorKey: keyof TData;

  /** Computed accessor — when provided, this value is what sort / search /
   *  text-filter operate on (overrides `accessorKey` for read purposes).
   *  Use when the displayed value combines multiple fields (e.g. "Mill —
   *  Unit") and you want filtering to match either side. */
  accessorFn?: (row: TData) => string | number | null | undefined;

  /** Display name for the column header */
  header: string;

  /** Custom cell renderer function */
  cell?: (info: CellContext<TData, unknown>) => ReactNode;

  /** Type of filter for this column */
  filterType?: FilterType;

  /** Options for select-type filters */
  filterOptions?: FilterOption[];

  /** Whether sorting is enabled for this column */
  enableSorting?: boolean;

  /** Whether this column can be hidden */
  enableHiding?: boolean;

  /** Whether this column is visible by default */
  defaultVisible?: boolean;

  /** Column width in pixels */
  size?: number;

  /** Minimum column width in pixels */
  minSize?: number;

  /** Maximum column width in pixels */
  maxSize?: number;

  /** Pin column to left or right edge (sticky) */
  sticky?: "left" | "right";

  /** Text alignment for this column's header and cells. Defaults to "center". */
  align?: "left" | "center" | "right";

  /** When true, cell text is not truncated — useful for material/item name columns. */
  noTruncate?: boolean;

  /** Custom export serializer — use when the column value is an object/array that needs flattening for CSV/PDF export. */
  exportValue?: (row: TData) => string | number | null;

}

/**
 * Props for the main DataGrid component
 * @template TData - The type of data being displayed in the table
 */
export interface DataGridProps<TData> {
  /** Array of data to display */
  data: TData[];

  /** Column configuration array */
  columns: ColumnConfig<TData>[];

  /** Unique name for this table (used for localStorage keys) */
  tableName: string;

  /** Enable column-specific filters */
  enableFilters?: boolean;

  /** Enable pagination controls */
  enablePagination?: boolean;

  /** Enable column drag-and-drop reordering */
  enableColumnReordering?: boolean;

  /** Enable column visibility controls */
  enableColumnVisibility?: boolean;

  /** Callback when a row is clicked */
  onRowClick?: (row: TData) => void;

  /** When truthy for a row, that row gets a persistent blue highlight (e.g. while its modal is open) */
  highlightRow?: (row: TData) => boolean;

  /** When truthy for a row, that row is greyed out (e.g. Cancelled records) — stays visible for tracking but visually de-emphasized */
  dimRow?: (row: TData) => boolean;

  /** Initial page size for pagination */
  initialPageSize?: number;

  /** Loading state */
  isLoading?: boolean;

  /** Empty state message */
  emptyMessage?: string;

  /** Custom empty state node — overrides emptyMessage when data is empty */
  emptyState?: ReactNode;

  /** Additional content rendered inside the toolbar (e.g. a global search bar) */
  toolbarActions?: ReactNode;

  /** Hides the built-in toolbar entirely — use when the parent page provides its own toolbar */
  hideToolbar?: boolean;

  /** Show the Export dropdown (CSV / Excel / DOCX / PDF). Defaults to true. */
  enableExport?: boolean;

  /** Base filename used for exported files (no extension). Defaults to tableName. */
  exportFilename?: string;

  /** External column visibility state — when provided the built-in Columns button is hidden */
  externalColumnVisibility?: Record<string, boolean>;

  /** Called when external column visibility changes */
  onExternalColumnVisibilityChange?: (vis: Record<string, boolean>) => void;

  /**
   * Show a checkbox column on the left for row selection. When any rows are
   * ticked, the Export menu only exports the selected ones — otherwise it
   * falls back to the full filtered set (current behavior).
   */
  enableRowSelection?: boolean;

  /**
   * Override the "Export → PDF" action with a page-specific renderer. Receives
   * the source rows (selected if any ticked, else the full filtered set). SO
   * and PO grids wire this to a backend bulk-PDF endpoint so the exported
   * file matches the in-app Preview / Print layout.
   */
  onPdfExport?:    (rows: TData[]) => Promise<void> | void;

  /**
   * Optional second PDF action — when set the Export menu adds a "PDF
   * (Separate, ZIP)" entry that ships one PDF per row inside a ZIP archive.
   * Useful for SO / PO grids when the user wants individual files instead
   * of a single combined multi-page document.
   */
  onPdfZipExport?: (rows: TData[]) => Promise<void> | void;

  /**
   * Optional "Export → JPG" action — when set the Export menu adds a "JPG"
   * entry that downloads one image file per row directly (no ZIP) — the
   * same rendered layout as the row's own "Export as Image" action, just
   * triggered for every selected/filtered row at once so each file can be
   * forwarded immediately (e.g. on WhatsApp) with no archive to extract.
   */
  onImageExport?: (rows: TData[]) => Promise<void> | void;

  /**
   * Lock the table to the visible viewport so the horizontal scrollbar
   * always sits at the bottom of the on-screen window (no need to scroll
   * the whole page down to reach it). Vertical scroll happens inside the
   * grid; KPI / filters / toolbar above stay fixed.
   *
   * Pass a CSS calc string (e.g. `"calc(100vh - 320px)"`) tailored to how
   * much chrome sits above the grid on that page.
   */
  scrollMaxHeight?: string;
}

/**
 * State for column visibility with localStorage persistence
 */
export interface VisibilityHookState {
  columnVisibility: VisibilityState;
  setColumnVisibility: (visibility: VisibilityState) => void;
  resetVisibility: () => void;
}

/**
 * State for column filters with URL query param persistence
 */
export interface FiltersHookState {
  columnFilters: ColumnFiltersState;
  setColumnFilters: (filters: ColumnFiltersState) => void;
  clearFilters: () => void;
}

/**
 * State for column ordering with localStorage persistence
 */
export interface OrderHookState {
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;
  resetOrder: () => void;
}

/**
 * State for pagination with localStorage persistence
 */
export interface PaginationHookState {
  pagination: PaginationState;
  setPagination: (pagination: PaginationState) => void;
}

/**
 * Props for DataGridToolbar component
 */
export interface DataGridToolbarProps<TData> {
  /** Column definitions */
  columns: ColumnDef<TData>[];

  /** Table instance from TanStack Table */
  table: any; // Will be typed as Table<TData> but avoiding circular dependency

  /** Column configurations */
  columnConfigs: ColumnConfig<TData>[];

  /** Whether filters are enabled */
  enableFilters: boolean;

  /** Whether column visibility is enabled */
  enableColumnVisibility: boolean;

  /** Additional toolbar actions */
  toolbarActions?: ReactNode;
}

/**
 * Props for DataGridPagination component
 */
export interface DataGridPaginationProps {
  /** Table instance from TanStack Table */
  table: any; // Will be typed as Table<TData>

  /** Total number of items */
  totalItems: number;
}

/**
 * Props for DataGridColumnHeader component
 */
export interface DataGridColumnHeaderProps<TData> {
  /** Column from TanStack Table */
  column: any; // Will be typed as Column<TData>

  /** Column title */
  title: string;

  /** Whether drag-and-drop is enabled */
  enableReordering: boolean;
}
