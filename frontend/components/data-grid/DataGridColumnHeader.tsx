"use client";

import { Column } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataGridColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  enableReordering?: boolean;
  align?: "left" | "center" | "right";
}

export function DataGridColumnHeader<TData, TValue>({
  column,
  title,
  enableReordering = true,
  align,
}: DataGridColumnHeaderProps<TData, TValue>) {
  const justifyCls = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: !enableReordering,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!column.getCanSort()) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          `flex items-center gap-1 min-w-0 ${justifyCls}`,
          isDragging && "cursor-grabbing"
        )}
      >
        {enableReordering && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab hover:text-gray-900 text-gray-400 touch-none shrink-0 opacity-0 group-hover/th:opacity-100 transition-opacity"
            aria-label="Drag to reorder column"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span className="truncate">{title}</span>
      </div>
    );
  }

  const isSorted = column.getIsSorted();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        `flex items-center gap-1 min-w-0 ${justifyCls}`,
        isDragging && "cursor-grabbing"
      )}
    >
      {enableReordering && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab hover:text-gray-900 text-gray-400 touch-none shrink-0 opacity-0 group-hover/th:opacity-100 transition-opacity"
          aria-label="Drag to reorder column"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <button
        onClick={() => column.toggleSorting(isSorted === "asc")}
        className="flex items-center gap-1 hover:text-gray-900 transition-colors min-w-0"
        aria-label={`Sort by ${title}`}
      >
        <span className="truncate">{title}</span>
        {isSorted === "asc"  && <ArrowUp   className="h-3 w-3 shrink-0" />}
        {isSorted === "desc" && <ArrowDown className="h-3 w-3 shrink-0" />}
        {!isSorted && <ArrowUpDown className="h-3 w-3 text-gray-300 shrink-0 opacity-0 group-hover/th:opacity-100 transition-opacity" />}
      </button>
    </div>
  );
}
