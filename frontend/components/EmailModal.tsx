"use client";

import { useState } from "react";
import { Mail, X, Send } from "lucide-react";
import { createPortal } from "react-dom";

export interface EmailFormData {
  to: string;
  cc: string;
  subject: string;
  body: string;
}

interface EmailModalProps {
  title: string;
  initialData: EmailFormData;
  onSend: (data: EmailFormData) => void;
  onClose: () => void;
}

const fieldCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

export function EmailModal({ title, initialData, onSend, onClose }: EmailModalProps) {
  const [form, setForm] = useState<EmailFormData>(initialData);

  const set =
    (field: keyof EmailFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/10 p-2 sm:p-4">
      <div className="w-full sm:max-w-lg rounded-xl sm:rounded-2xl bg-white shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{title}</p>
              <p className="text-xs text-gray-400">Edit and send approval notification</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className={labelCls}>To *</label>
            <input value={form.to} onChange={set("to")}
              placeholder="customer@example.com" className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>CC</label>
            <input value={form.cc} onChange={set("cc")}
              placeholder="cc@example.com (optional)" className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Subject</label>
            <input value={form.subject} onChange={set("subject")} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <textarea
              value={form.body} onChange={set("body")} rows={10}
              className={fieldCls + " resize-none font-mono text-xs leading-relaxed"}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white transition-colors">
            Cancel
          </button>
          <button onClick={() => onSend(form)} disabled={!form.to.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Send className="h-4 w-4" /> Send Email
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
