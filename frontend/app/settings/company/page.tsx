"use client";

import { PermGuard } from "@/components/PermGuard";
import { useState, useEffect, useCallback } from "react";
import { Save, Shield, Loader2, CheckCircle2, AlertTriangle, Mail, Eye, EyeOff, Building2 } from "lucide-react";
import { companyConfigApi, CompanyConfigData } from "@/lib/api-services";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

const CURRENT_YEAR = new Date().getFullYear();
const FY_OPTIONS = [-1, 0, 1, 2].map((offset) => {
  const start = CURRENT_YEAR + offset;
  return `${start}-${String(start + 1).slice(2)}`;
});

// ─── Per-company editor ───────────────────────────────────────────────────────

function CompanyEditor({ data, onSaved }: { data: CompanyConfigData; onSaved: () => void }) {
  const [policyNo,     setPolicyNo]     = useState(data.insurancePolicyNo ?? "");
  const [policyFy,     setPolicyFy]     = useState(data.insurancePolicyFy ?? FY_OPTIONS[1]);
  const [issuer,       setIssuer]       = useState(data.insuranceIssuer   ?? "");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const [smtpEmail,    setSmtpEmail]    = useState(data.smtpSenderEmail ?? "");
  const [smtpName,     setSmtpName]     = useState(data.smtpSenderName  ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [smtpSaving,   setSmtpSaving]   = useState(false);
  const [smtpSaved,    setSmtpSaved]    = useState(false);
  const [smtpError,    setSmtpError]    = useState<string | null>(null);

  // Re-sync when switching tabs
  useEffect(() => {
    setPolicyNo(data.insurancePolicyNo ?? "");
    setPolicyFy(data.insurancePolicyFy ?? FY_OPTIONS[1]);
    setIssuer(data.insuranceIssuer   ?? "");
    setSmtpEmail(data.smtpSenderEmail ?? "");
    setSmtpName(data.smtpSenderName  ?? "");
    setSmtpPassword("");
    setSaved(false); setSmtpSaved(false);
    setError(null);  setSmtpError(null);
  }, [data.id]); // reset when company changes

  async function handleSave() {
    setSaving(true); setSaved(false); setError(null);
    try {
      await companyConfigApi.update(data.id, {
        insurancePolicyNo: policyNo.trim() || undefined,
        insurancePolicyFy: policyFy.trim() || undefined,
        insuranceIssuer:   issuer.trim()   || undefined,
      });
      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSmtpSave() {
    setSmtpSaving(true); setSmtpSaved(false); setSmtpError(null);
    try {
      await companyConfigApi.update(data.id, {
        smtpSenderEmail: smtpEmail.trim() || undefined,
        smtpSenderName:  smtpName.trim()  || undefined,
        smtpAppPassword: smtpPassword === "" ? null : smtpPassword,
      });
      onSaved();
      setSmtpPassword("");
      setSmtpSaved(true);
      setTimeout(() => setSmtpSaved(false), 3000);
    } catch (e) {
      setSmtpError(e instanceof ApiError ? e.message : "Failed to save SMTP settings.");
    } finally {
      setSmtpSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Insurance Policy */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
          <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Insurance Policy</span>
          <span className="ml-auto text-xs text-gray-400">Auto-fills in every new Sales Order</span>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className={labelCls}>Policy Number</label>
            <input value={policyNo} onChange={(e) => setPolicyNo(e.target.value)}
              placeholder="e.g. 11010011240100000001" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Financial Year</label>
              <select value={policyFy} onChange={(e) => setPolicyFy(e.target.value)}
                className={cn(inputCls, "cursor-pointer")}>
                <option value="">— Select FY —</option>
                {FY_OPTIONS.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Insurer / Insurance Company</label>
              <input value={issuer} onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. New India Assurance" className={inputCls} />
            </div>
          </div>

          {policyNo && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 flex items-center gap-3">
              <Shield className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-blue-400 font-semibold">Preview — as shown in Sales Order</p>
                <p className="text-sm font-semibold text-blue-800 mt-0.5 truncate">
                  {policyNo}
                  {policyFy && <span className="font-normal text-blue-600 ml-2">(FY {policyFy})</span>}
                  {issuer    && <span className="font-normal text-blue-500 ml-2">— {issuer}</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-5 py-3">
          <p className="text-xs text-gray-400">
            {data.updatedBy
              ? `Last saved by ${data.updatedBy}${data.updatedAt
                  ? " · " + new Date(data.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : ""}`
              : "Not configured yet"}
          </p>
          <button onClick={handleSave} disabled={saving}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all shadow-sm",
              saved ? "bg-green-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60")}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
             : saved  ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
             : <><Save className="h-4 w-4" /> Save Changes</>}
          </button>
        </div>
      </div>

      {/* SMTP */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
          <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Email (SMTP) Settings</span>
          <span className="ml-auto">
            {data.smtpConfigured
              ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700"><CheckCircle2 className="h-3 w-3" /> Configured</span>
              : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700"><AlertTriangle className="h-3 w-3" /> Not configured</span>}
          </span>
        </div>

        {smtpError && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {smtpError}
            <button onClick={() => setSmtpError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Sender Email (Gmail)</label>
              <input type="email" value={smtpEmail} onChange={(e) => setSmtpEmail(e.target.value)}
                placeholder="yourmail@gmail.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sender Display Name</label>
              <input value={smtpName} onChange={(e) => setSmtpName(e.target.value)}
                placeholder="e.g. Monit Paper Agency" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Gmail App Password
              <span className="ml-1.5 text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                (leave blank to keep existing)
              </span>
            </label>
            <div className="relative">
              <input type={showPwd ? "text" : "password"} value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                className={cn(inputCls, "pr-10 font-mono")} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Google Account → Security → 2-Step Verification → App Passwords. Stored in DB, never exposed in UI.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-5 py-3">
          <p className="text-xs text-gray-400">
            {data.smtpConfigured ? `Gmail: ${data.smtpSenderEmail ?? "—"}` : "SMTP not configured — emails cannot be sent."}
          </p>
          <button onClick={handleSmtpSave} disabled={smtpSaving}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all shadow-sm",
              smtpSaved ? "bg-green-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60")}>
            {smtpSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
             : smtpSaved  ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
             : <><Save className="h-4 w-4" /> Save SMTP</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CompanySettingsPage() {
  const { reload: reloadCtx } = useCompanySettings();
  const [companies, setCompanies] = useState<CompanyConfigData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeId,  setActiveId]  = useState(1);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const result = await companyConfigApi.getAll();
      setCompanies(Array.isArray(result) ? result : [result as CompanyConfigData]);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const active = companies.find((c) => c.id === activeId) ?? companies[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">

      {/* Company tabs */}
      {companies.length > 1 && (
        <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white shadow-sm p-1">
          {companies.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={cn(
                "flex items-center gap-2 flex-1 justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeId === c.id
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              )}>
              <Building2 className="h-4 w-4 flex-shrink-0" />
              {c.companyName ?? `Company ${c.id}`}
            </button>
          ))}
        </div>
      )}

      {active && (
        <CompanyEditor
          key={active.id}
          data={active}
          onSaved={() => { fetchAll(); reloadCtx(); }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="company.read"><CompanySettingsPage /></PermGuard>;
}
