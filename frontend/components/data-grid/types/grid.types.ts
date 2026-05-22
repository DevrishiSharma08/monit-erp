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
