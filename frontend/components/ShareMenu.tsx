"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Share2, MessageCircle, Mail, Download, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShareData {
  title: string;
  text: string;
  subject?: string;
  /** Optional PDF fetcher. When provided, the share buttons will attempt
   *  to attach this PDF via the Web Share API; on platforms that don't
   *  support file sharing, the PDF is downloaded so the user can attach
   *  it manually in their mail / chat app. */
  getPdf?: () => Promise<{ blob: Blob; filename: string }>;
}

// ── Web Share helpers ────────────────────────────────────────────────────────
// navigator.share({ files }) is mobile-first (Android Chrome / iOS Safari /
// macOS Safari). Desktop Chrome/Firefox don't support file share — we fall
// back to downloading the PDF so the user can attach it themselves.
async function tryNativeFileShare(
  blob: Blob, filename: string, title: string, text: string,
): Promise<boolean> {
  try {
    const file = new File([blob], filename, { type: blob.type || "application/pdf" });
    // navigator.canShare / navigator.share types vary across TS lib targets;
    // narrow via an explicit shape that matches the Web Share API L2 spec.
    type NavWithShare = Navigator & {
      canShare?: (d: { files?: File[]; title?: string; text?: string }) => boolean;
      share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    const nav = navigator as NavWithShare;
    if (typeof nav.canShare === "function" && nav.share &&
        nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title, text });
      return true;
    }
  } catch {
    // User canceled the share sheet, or share threw — fall back below.
  }
  return false;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ── Outlook SVG icon ──────────────────────────────────────────────────────────
function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 7.387v10.478L19.2 21V15.27l-7.2-2.12v-1.892l7.2-2.31V3l4.8 4.387zM0 8.11l8.4-1.223v8.124L0 13.815V8.11zm9.6-1.4L18 8.11v5.705l-8.4 1.216V6.71z" />
    </svg>
  );
}

interface SharePanelProps {
  data: ShareData;
  anchor: { top: number; left?: number; right?: number };
  onClose: () => void;
}

function SharePanel({ data, anchor, onClose }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const subject = data.subject ?? data.title;
  const encoded = encodeURIComponent(data.text);
  const encodedSubject = encodeURIComponent(subject);
  const [busy, setBusy] = useState<string | null>(null);

  // Common path: fetch PDF, try native file-share. If unsupported (desktop
  // Chrome/Firefox), download the PDF and open the messaging app's URL with
  // text — user attaches the downloaded file manually.
  async function shareWithFallback(openUrl: () => void) {
    if (!data.getPdf) { openUrl(); onClose(); return; }
    try {
      const { blob, filename } = await data.getPdf();
      const shared = await tryNativeFileShare(blob, filename, data.title, data.text);
      if (shared) { onClose(); return; }
      downloadBlob(blob, filename);
    } catch {
      // PDF fetch failed — still open the chat / mail URL so the user can
      // send the plain-text fallback without losing the action entirely.
    }
    openUrl();
    onClose();
  }

  const handleWhatsApp = async () => {
    setBusy("whatsapp");
    await shareWithFallback(() =>
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank", "noopener,noreferrer"),
    );
    setBusy(null);
  };

  const handleEmail = async () => {
    setBusy("email");
    await shareWithFallback(() => {
      window.location.href = `mailto:?subject=${encodedSubject}&body=${encoded}`;
    });
    setBusy(null);
  };

  const handleOutlook = async () => {
    setBusy("outlook");
    await shareWithFallback(() =>
      window.open(
        `https://outlook.office.com/mail/deeplink/compose?subject=${encodedSubject}&body=${encoded}`,
        "_blank",
        "noopener,noreferrer",
      ),
    );
    setBusy(null);
  };

  // "Copy" repurposed: when a PDF is available, download it (cleaner action
  // than copying text — the user wants the file). When no PDF, fall back
  // to clipboard text copy.
  const handleCopy = async () => {
    if (data.getPdf) {
      setBusy("copy");
      try {
        const { blob, filename } = await data.getPdf();
        downloadBlob(blob, filename);
        setCopied(true);
        setTimeout(() => { setCopied(false); onClose(); }, 1200);
      } catch { onClose(); }
      finally { setBusy(null); }
      return;
    }
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    } catch {
      onClose();
    }
  };

  const options = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      color: "text-green-600",
      bg: "hover:bg-green-50",
      onClick: handleWhatsApp,
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      color: "text-blue-600",
      bg: "hover:bg-blue-50",
      onClick: handleEmail,
    },
    {
      key: "outlook",
      label: "Outlook",
      icon: OutlookIcon,
      color: "text-indigo-600",
      bg: "hover:bg-indigo-50",
      onClick: handleOutlook,
    },
    {
      key: "copy",
      // Label flips based on whether a PDF was supplied: "Download PDF" is
      // a clearer action than "Copy Link" when the share payload is a file.
      label: copied
        ? (data.getPdf ? "Downloaded!" : "Copied!")
        : (data.getPdf ? "Download PDF" : "Copy Link"),
      icon: copied ? Check : Download,
      color: copied ? "text-green-600" : "text-gray-600",
      bg: "hover:bg-gray-50",
      onClick: handleCopy,
    },
  ] as const;

  const style: React.CSSProperties = {
    position: "fixed",
    top: anchor.top,
    zIndex: 9999,
    ...(anchor.right !== undefined
      ? { right: anchor.right }
      : { left: anchor.left }),
  };

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className="w-44 rounded-xl border border-gray-100 bg-white py-1.5 shadow-xl"
    >
      <p className="truncate px-3.5 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Share
      </p>
      {options.map(({ key, label, icon: Icon, color, bg, onClick }) => {
        const isBusy = busy === key;
        return (
          <button
            key={key}
            disabled={busy !== null}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 transition-colors",
              bg,
              busy !== null && !isBusy && "opacity-40 cursor-not-allowed",
              isBusy && "bg-blue-50",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
            <span className={cn(key === "copy" && copied && "text-green-700 font-medium")}>
              {isBusy ? "Preparing PDF…" : label}
            </span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}

// ── Standalone trigger + panel (for toolbar use) ──────────────────────────────
interface ShareMenuProps {
  getData: () => ShareData;
  label?: string;
  className?: string;
}

export function ShareMenu({ getData, label = "Share", className }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          open
            ? "border-blue-300 bg-blue-50 text-blue-700"
            : "border-gray-200 text-gray-600 hover:bg-gray-50",
          className
        )}
      >
        <Share2 className="h-4 w-4" />
        <span>{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && anchor && (
        <SharePanel
          data={getData()}
          anchor={anchor}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── Inline row share trigger (for 3-dot menus) ────────────────────────────────
interface RowShareTriggerProps {
  data: ShareData;
  onShareOpen: () => void;
  shareAnchor: { top: number; right: number } | null;
  onShareClose: () => void;
  shareOpen: boolean;
}

export { SharePanel };
