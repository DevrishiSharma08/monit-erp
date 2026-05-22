"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Mail, X, Send, Paperclip } from "lucide-react";
import { createPortal } from "react-dom";

export interface EmailContact {
  name: string;
  email: string;
  isDefault?: boolean;
}

export interface EmailFormData {
  to:      string[];   // array of email addresses
  cc:      string[];
  subject: string;
  body:    string;
}

interface EmailModalProps {
  title:        string;
  initialData:  EmailFormData;
  contacts:     EmailContact[];   // all contacts for the entity (customer / mill)
  onSend:       (data: EmailFormData) => Promise<void>;
  onClose:      () => void;
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5";

// ── Chip-based email input ────────────────────────────────────────────────────

function ChipInput({
  label, chips, contacts, onChange,
}: { label: string; chips: string[]; contacts: EmailContact[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || chips.includes(trimmed)) { setDraft(""); return; }
    onChange([...chips, trimmed]);
    setDraft("");
  };

  const removeChip = (email: string) => onChange(chips.filter((c) => c !== email));

  const toggleContact = (email: string) => {
    const lc = email.toLowerCase();
    if (chips.includes(lc)) removeChip(lc);
    else onChange([...chips, lc]);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === "," || e.key === " ") && draft.trim()) {
      e.preventDefault();
      addEmail(draft);
    } else if (e.key === "Backspace" && !draft && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  };

  return (
    <div>
      <label className={labelCls}>{label}</label>

      {/* Contact quick-select buttons */}
      {contacts.filter((c) => c.email).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {contacts.filter((c) => c.email).map((c) => {
            const selected = chips.includes(c.email.toLowerCase());
            return (
              <button
                key={c.email}
                type="button"
                onClick={() => toggleContact(c.email)}
                title={c.email}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {c.name}
                {c.isDefault && !selected && (
                  <span className="opacity-40 text-[10px] ml-0.5">★</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Chips + free-text input */}
      <div
        className="min-h-[38px] w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100"
        onClick={() => inputRef.current?.focus()}
      >
        {chips.map((chip) => (
          <span key={chip}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-medium">
            {chip}
            <button type="button" onClick={(e) => { e.stopPropagation(); removeChip(chip); }}
              className="hover:text-blue-600 ml-0.5">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => draft.trim() && addEmail(draft)}
          placeholder={chips.length === 0 ? "Type email and press Enter or comma…" : ""}
          className="flex-1 min-w-[160px] text-sm outline-none bg-transparent py-0.5"
        />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Press Enter or comma to add · Backspace to remove last</p>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function EmailModal({ title, initialData, contacts, onSend, onClose }: EmailModalProps) {
  const [form,    setForm]    = useState<EmailFormData>(initialData);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSend = async () => {
    if (form.to.length === 0) { setError("Please add at least one recipient."); return; }
    setSending(true); setError(null);
    try {
      await onSend(form);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send email. Check SMTP config in Company Settings.");
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Mail className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{title}</p>
              <p className="text-xs text-gray-400">Review and send — PDF auto-attached</p>
            </div>
          </div>
          <button onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="h-3.5 w-3.5 flex-shrink-0" /></button>
            </div>
          )}

          <ChipInput
            label="To *"
            chips={form.to}
            contacts={contacts}
            onChange={(to) => setForm((p) => ({ ...p, to }))}
          />

          <ChipInput
            label="CC"
            chips={form.cc}
            contacts={[]}
            onChange={(cc) => setForm((p) => ({ ...p, cc }))}
          />

          <div>
            <label className={labelCls}>Subject</label>
            <input value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Message</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows={10}
              className={inputCls + " resize-none font-mono text-xs leading-relaxed"}
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
            PDF of this document will be automatically generated and attached.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} disabled={sending}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-white transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSend} disabled={form.to.length === 0 || sending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {sending
              ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
              : <><Send className="h-4 w-4" />Send Email</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
