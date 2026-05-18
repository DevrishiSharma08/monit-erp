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
}

export function DataGridColumnHeader<TData, TValue>({
  column,
  title,
  enableReordering = true,
}: DataGridColumnHeaderProps<TData, TValue>) {
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
          "flex items-center gap-2",
          isDragging && "cursor-grabbing"
        )}
      >
        {enableReordering && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab hover:text-gray-900 text-gray-400 touch-none"
            aria-label="Drag to reorder column"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span>{title}</span>
      </div>
    );
  }

  const isSorted = column.getIsSorted();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2",
        isDragging && "cursor-grabbing"
      )}
    >
      {enableReordering && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab hover:text-gray-900 text-gray-400 touch-none"
          aria-label="Drag to reorder column"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={() => column.toggleSorting(isSorted === "asc")}
        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
        aria-label={`Sort by ${title}`}
      >
        <span>{title}</span>
        {isSorted === "asc" && <ArrowUp className="h-4 w-4" />}
        {isSorted === "desc" && <ArrowDown className="h-4 w-4" />}
        {!isSorted && <ArrowUpDown className="h-4 w-4 text-gray-400" />}
      </button>
    </div>
  );
}
