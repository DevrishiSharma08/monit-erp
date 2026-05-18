"use client";

import { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataGridPaginationProps<TData> {
  table: Table<TData>;
}

export function DataGridPagination<TData>({
  table,
}: DataGridPaginationProps<TData>) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const pageSize = table.getState().pagination.pageSize;
  const totalItems = table.getFilteredRowModel().rows.length;

  const startItem = pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (pageCount <= maxPagesToShow) {
      // Show all pages if total is less than max
      for (let i = 0; i < pageCount; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);

      if (pageIndex > 2) {
        pages.push("...");
      }

      // Show pages around current page
      const start = Math.max(1, pageIndex - 1);
      const end = Math.min(pageCount - 2, pageIndex + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (pageIndex < pageCount - 3) {
        pages.push("...");
      }

      // Always show last page
      if (pageCount > 1) {
        pages.push(pageCount - 1);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between border-t px-6 py-4">
      <p className="text-sm text-gray-600">
        Showing {startItem} to {endItem} of {totalItems} items
      </p>

      <div className="flex items-center gap-2">
        {/* Previous button */}
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            table.getCanPreviousPage()
              ? "border-gray-300 text-gray-700 hover:bg-gray-50"
              : "border-gray-200 text-gray-400 cursor-not-allowed"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((page, index) => {
          if (page === "...") {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                ...
              </span>
            );
          }

          const pageNumber = page as number;
          const isActive = pageNumber === pageIndex;

          return (
            <button
              key={pageNumber}
              onClick={() => table.setPageIndex(pageNumber)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-500 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
              aria-label={`Page ${pageNumber + 1}`}
              aria-current={isActive ? "page" : undefined}
            >
              {pageNumber + 1}
            </button>
          );
        })}

        {/* Next button */}
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            table.getCanNextPage()
              ? "border-gray-300 text-gray-700 hover:bg-gray-50"
              : "border-gray-200 text-gray-400 cursor-not-allowed"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
