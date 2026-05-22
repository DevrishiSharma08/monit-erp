"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Share2 } from "lucide-react";
import { SharePanel, ShareData } from "@/components/ShareMenu";

export interface ActionItem {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: "default" | "danger";
}

interface DropdownPos { top: number; left: number; openUp: boolean; }

export function ActionMenu({ items, shareData }: { items: ActionItem[]; shareData?: ShareData }) {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareAnchor, setShareAnchor] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, openUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const extraItems = shareData ? 1 : 0;
      const dropdownHeight = (items.length + extraItems) * 40 + 16;
      const openUp = window.innerHeight - rect.bottom < dropdownHeight;
      setPos({
        top: openUp ? rect.top - dropdownHeight : rect.bottom + 4,
        left: rect.right - 160,
        openUp,
      });
    }
    setOpen((o) => !o);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setShareAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setShareOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[160px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={(e) => { e.stopPropagation(); item.onClick(); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                item.variant === "danger"
                  ? "text-red-500 hover:bg-red-50"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
              {item.label}
            </button>
          ))}
          {shareData && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={handleShare}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                Share
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {shareOpen && shareAnchor && shareData && (
        <SharePanel
          data={shareData}
          anchor={shareAnchor}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
