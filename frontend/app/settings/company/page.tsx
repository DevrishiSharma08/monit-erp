"use client";

import { PermGuard } from "@/components/PermGuard";
import { useState, useEffect, useCallback } from "react";
import { Save, Shield, Loader2, CheckCircle2, AlertTriangle, Mail, Eye, EyeOff, Building2 } from "lucide-react";
import { companyConfigApi, CompanyConfigData } from "@/lib/api-services";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

const CURRENT_YEAR = new Date().getFullYear();
const FY_OPTIONS = [-1, 0, 1, 2].map((offset) => {
  const start = CURRENT_YEAR + offset;
  return `${start}-${String(start + 1).slice(2)}`;
});

function CompanySettingsPage() {
  const { reload: reloadCtx } = useCompanySettings();
  const { user } = useAuth();
  const companyId = user?.companyId ?? 1;

  const [data,    setData]    = useState<CompanyConfigData | null>(null);
  const [loading, setLoading] = useState(true);

  // Company Details state
  const [companyName, setCompanyName] = useState("");
  const [address,     setAddress]     = useState("");
  const [gstNumber,   setGstNumber]   = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailSaved,  setDetailSaved]  = useState(false);
  const [detailError,  setDetailError]  = useState<string | null>(null);

  // Insurance state
  const [policyNo, setPolicyNo] = useState("");
  const [policyFy, setPolicyFy] = useState(FY_OPTIONS[1]);
  const [issuer,   setIssuer]   = useState("");
  const [insSaving, setInsSaving] = useState(false);
  const [insSaved,  setInsSaved]  = useState(false);
  const [insError,  setInsError]  = useState<string | null>(null);

  // SMTP state
  const [smtpEmail,    setSmtpEmail]    = useState("");
  const [smtpName,     setSmtpName]     = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showPwd,      setShowPwd]      = useState(false);
  const [smtpSaving,   setSmtpSaving]   = useState(false);
  const [smtpSaved,    setSmtpSaved]    = useState(false);
  const [smtpError,    setSmtpError]    = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await companyConfigApi.getById(companyId);
      setData(result);
      setCompanyName(result.companyName ?? "");
      setAddress(result.address ?? "");
      setGstNumber(result.gstNumber ?? "");
      setPolicyNo(result.insurancePolicyNo ?? "");
      setPolicyFy(result.insurancePolicyFy ?? FY_OPTIONS[1]);
      setIssuer(result.insuranceIssuer ?? "");
      setSmtpEmail(result.smtpSenderEmail ?? "");
      setSmtpName(result.smtpSenderName ?? "");
      setSmtpPassword("");
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleDetailSave() {
    setDetailSaving(true); setDetailSaved(false); setDetailError(null);
    try {
      await companyConfigApi.update(companyId, {
        companyName: companyName.trim() || undefined,
        address:     address.trim()     || undefined,
        gstNumber:   gstNumber.trim()   || undefined,
      });
      await fetch(); reloadCtx();
      setDetailSaved(true);
      setTimeout(() => setDetailSaved(false), 3000);
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setDetailSaving(false);
    }
  }

  async function handleInsSave() {
    setInsSaving(true); setInsSaved(false); setInsError(null);
    try {
      await companyConfigApi.update(companyId, {
        insurancePolicyNo: policyNo.trim() || undefined,
        insurancePolicyFy: policyFy.trim() || undefined,
        insuranceIssuer:   issuer.trim()   || undefined,
      });
      await fetch(); reloadCtx();
      setInsSaved(true);
      setTimeout(() => setInsSaved(false), 3000);
    } catch (e) {
      setInsError(e instanceof ApiError ? e.message : "Failed to save.");
    } finally {
      setInsSaving(false);
    }
  }

  async function handleSmtpSave() {
    setSmtpSaving(true); setSmtpSaved(false); setSmtpError(null);
    try {
      await companyConfigApi.update(companyId, {
        smtpSenderEmail: smtpEmail.trim() || undefined,
        smtpSenderName:  smtpName.trim()  || undefined,
        smtpAppPassword: smtpPassword === "" ? null : smtpPassword,
      });
      await fetch(); reloadCtx();
      setSmtpPassword("");
      setSmtpSaved(true);
      setTimeout(() => setSmtpSaved(false), 3000);
    } catch (e) {
      setSmtpError(e instanceof ApiError ? e.message : "Failed to save SMTP settings.");
    } finally {
      setSmtpSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">

      {/* Company header */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <Building2 className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{data?.companyName ?? user?.companyName ?? "Company Settings"}</p>
          <p className="text-xs text-gray-400">Settings for the currently logged-in company</p>
        </div>
      </div>

      {/* Company Details */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
          <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Company Details</span>
          <span className="ml-auto text-xs text-gray-400">Shown on invoices, challans & exports</span>
        </div>

        {detailError && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {detailError}
            <button onClick={() => setDetailError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="p-4 space-y-3">
          <div>
            <label className={labelCls}>Company Name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Monit Paper Agency" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address..."
              rows={2}
              className={cn(inputCls, "resize-none")} />
          </div>
          <div>
            <label className={labelCls}>GST Number</label>
            <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)}
              placeholder="e.g. 23AABCM1234K1Z5" className={inputCls} maxLength={15} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 px-5 py-3">
          <p className="text-xs text-gray-400">
            {data?.updatedBy
              ? `Last saved by ${data.updatedBy}${data.updatedAt
                  ? " · " + new Date(data.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : ""}`
              : "Not configured yet"}
          </p>
          <button onClick={handleDetailSave} disabled={detailSaving}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all shadow-sm",
              detailSaved ? "bg-green-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60")}>
            {detailSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
             : detailSaved  ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
             : <><Save className="h-4 w-4" /> Save Details</>}
          </button>
        </div>
      </div>

      {/* Insurance Policy */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
          <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Insurance Policy</span>
          <span className="ml-auto text-xs text-gray-400">Auto-fills in every new Sales Order</span>
        </div>

        {insError && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {insError}
            <button onClick={() => setInsError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

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
            {data?.updatedBy
              ? `Last saved by ${data.updatedBy}${data.updatedAt
                  ? " · " + new Date(data.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : ""}`
              : "Not configured yet"}
          </p>
          <button onClick={handleInsSave} disabled={insSaving}
            className={cn("flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all shadow-sm",
              insSaved ? "bg-green-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60")}>
            {insSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
             : insSaved  ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
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
            {data?.smtpConfigured
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
            {data?.smtpConfigured ? `Gmail: ${data.smtpSenderEmail ?? "—"}` : "SMTP not configured — emails cannot be sent."}
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

export default function Page() {
  return <PermGuard perm="company.read"><CompanySettingsPage /></PermGuard>;
}
