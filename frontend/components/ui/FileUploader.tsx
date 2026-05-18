"use client";

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";
import { Upload, X, FileText, FileImage, Film, File as FileIcon, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string | null;
  uploading: boolean;
  error?: string;
}

interface FileUploaderProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: File) {
  const t = file.type;
  if (t.startsWith("image/")) return FileImage;
  if (t.startsWith("video/")) return Film;
  if (t === "application/pdf") return FileText;
  return FileIcon;
}

function makeUploadedFile(file: File): UploadedFile {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    uploading: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileUploader({
  files,
  onChange,
  maxFiles = 10,
  maxSizeMB = 20,
  accept = "image/*,application/pdf,.doc,.docx,.xls,.xlsx",
  className,
}: FileUploaderProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const arr = Array.from(newFiles);
      const maxBytes = maxSizeMB * 1024 * 1024;
      const remaining = maxFiles - files.length;
      const toAdd: UploadedFile[] = [];
      for (const f of arr.slice(0, remaining)) {
        if (f.size > maxBytes) continue;
        toAdd.push(makeUploadedFile(f));
      }
      if (toAdd.length > 0) onChange([...files, ...toAdd]);
    },
    [files, maxFiles, maxSizeMB, onChange]
  );

  const removeFile = useCallback(
    (id: string) => {
      const removed = files.find((f) => f.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      onChange(files.filter((f) => f.id !== id));
    },
    [files, onChange]
  );

  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ""; }
  };

  const canAddMore = files.length < maxFiles;
  const imageFiles = files.filter((f) => f.previewUrl !== null);
  const docFiles   = files.filter((f) => f.previewUrl === null);

  return (
    <div className={cn("space-y-2", className)}>

      {/* ── Compact drop bar ─────────────────────────────────────────────── */}
      {canAddMore && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-all",
            dragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
          )}
        >
          {/* Icon */}
          <div className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
            dragging ? "bg-blue-100" : "bg-gray-100"
          )}>
            <Upload className={cn("h-4 w-4", dragging ? "text-blue-500" : "text-gray-400")} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-600">
              {dragging ? "Drop files here…" : "Drag & drop or "}
              {!dragging && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
                >
                  browse
                </button>
              )}
            </p>
            <p className="text-[10px] text-gray-400">Max {maxSizeMB}MB · Up to {maxFiles} files</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm"
            >
              <Upload className="h-3 w-3" /> Upload
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm"
            >
              <Camera className="h-3 w-3" /> Camera
            </button>
          </div>

          <input ref={inputRef}  type="file" multiple accept={accept} onChange={onInputChange} className="hidden" />
          <input ref={cameraRef} type="file" multiple accept="image/*" capture="environment" onChange={onInputChange} className="hidden" />
        </div>
      )}

      {/* ── Image previews — compact grid ────────────────────────────────── */}
      {imageFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imageFiles.map((uf) => (
            <div
              key={uf.id}
              className="group relative h-14 w-14 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uf.previewUrl!} alt={uf.file.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(uf.id)}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {canAddMore && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-14 w-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors flex-shrink-0"
            >
              <Upload className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Doc files — compact list ──────────────────────────────────────── */}
      {docFiles.length > 0 && (
        <div className="space-y-1">
          {docFiles.map((uf) => {
            const Icon = getFileIcon(uf.file);
            return (
              <div key={uf.id} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-3 py-1.5">
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span className="flex-1 truncate text-xs font-medium text-gray-700">{uf.file.name}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{formatBytes(uf.file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(uf.id)}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Count */}
      {files.length > 0 && (
        <p className="text-[10px] text-gray-400">
          {files.length}/{maxFiles} files
          {!canAddMore && <span className="ml-1 text-amber-500">· Limit reached</span>}
        </p>
      )}
    </div>
  );
}
