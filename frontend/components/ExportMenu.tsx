"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileType2, FileArchive, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ExportData, exportCsv, exportExcel, exportDocx, exportPdf } from "@/lib/exportUtils";

interface ExportMenuProps {
  getData:  () => ExportData;
  filename: string;
  label?:   string;
  // Optional override for the PDF format. When provided, picking "PDF" in the
  // menu calls this instead of the generic table-PDF — used by SO / PO grids
  // so the exported file matches the rich single-document Preview / Print
  // layout (one record per page) rather than a flat row dump.
  customPdfExport?:     () => Promise<void> | void;
  // Optional second PDF action — when set, a "PDF (Separate, ZIP)" entry is
  // shown so the user can download one PDF per row inside a ZIP archive
  // (instead of the single combined multi-page document).
  customPdfZipExport?:  () => Promise<void> | void;
  // Optional "JPG" action — downloads one image file per row directly
  // (no ZIP), same as the row-level "Export as Image" action, so the user
  // can immediately forward each file (e.g. on WhatsApp) without having to
  // extract an archive first. Only shown when the parent page wires it.
  customImageExport?: () => Promise<void> | void;
}

export function ExportMenu({ getData, filename, label = "Export", customPdfExport, customPdfZipExport, customImageExport }: ExportMenuProps) {
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
      // When a separate-ZIP option is also available, label this one
      // "Combined" so the difference is clear in the menu.
      label: customPdfZipExport ? "PDF — Combined" : "PDF (.pdf)",
      icon:  Download,
      color: "text-red-500",
      // If the parent page provides a custom PDF exporter (SO / PO grids do,
      // so the output matches the single-document layout), use it. Otherwise
      // fall back to the generic table-style PDF.
      fn:    customPdfExport
              ? async () => { await customPdfExport(); }
              : (d: ExportData, f: string) => exportPdf(d, f),
    },
    // Optional "Separate PDFs in a ZIP" — only shown when the page wires it.
    ...(customPdfZipExport
      ? [{
          key:   "pdf-zip",
          label: "PDF — Separate (.zip)",
          icon:  FileArchive,
          color: "text-amber-600",
          fn:    async () => { await customPdfZipExport!(); },
        }]
      : []),
    // Optional per-row JPG downloads — only shown when the page wires it.
    ...(customImageExport
      ? [{
          key:   "jpg",
          label: "JPG (.jpg)",
          icon:  ImageIcon,
          color: "text-purple-600",
          fn:    async () => { await customImageExport!(); },
        }]
      : []),
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
