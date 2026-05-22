"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileType2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ExportData, exportCsv, exportExcel, exportDocx, exportPdf } from "@/lib/exportUtils";

interface ExportMenuProps {
  getData:  () => ExportData;
  filename: string;
  label?:   string;
}

export function ExportMenu({ getData, filename, label = "Export" }: ExportMenuProps) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const run = async (key: string, fn: (d: ExportData, f: string) => void | Promise<void>) => {
    setLoading(key);
    setOpen(false);
    try { await fn(getData(), filename); } finally { setLoading(null); }
  };

  const options = [
    {
      key:   "csv",
      label: "CSV (.csv)",
      icon:  FileText,
      color: "text-green-600",
      fn:    (d: ExportData, f: string) => exportCsv(d, f),
    },
    {
      key:   "excel",
      label: "Excel (.xlsx)",
      icon:  FileSpreadsheet,
      color: "text-emerald-600",
      fn:    (d: ExportData, f: string) => exportExcel(d, f),
    },
    {
      key:   "docx",
      label: "Word (.doc)",
      icon:  FileType2,
      color: "text-blue-600",
      fn:    (d: ExportData, f: string) => exportDocx(d, f),
    },
    {
      key:   "pdf",
      label: "PDF (.pdf)",
      icon:  Download,
      color: "text-red-500",
      fn:    (d: ExportData, f: string) => exportPdf(d, f),
    },
  ] as const;

  const busy = loading !== null;

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => !busy && setOpen((p) => !p)}
        disabled={busy}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          open
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-200 text-gray-600 hover:bg-gray-50",
          busy && "opacity-60 cursor-not-allowed"
        )}
      >
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Download className="h-4 w-4" />}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-lg border bg-white shadow-lg">
          <div className="p-1">
            {options.map(({ key, label: optLabel, icon: Icon, color, fn }) => (
              <button
                key={key}
                onClick={() => run(key, fn)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", color)} />
                <span>{optLabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
