"use client";

import { useState, useMemo, useEffect } from "react";
import {
  millApi, MillRow, MillUnitPickerOption,
  materialApi, MaterialDropdown,
  rateApi, RateRow, SORateDto, LastRateDto,
  customerApi, CustomerSODropdown,
  salesOrderApi, SalesOrderRow,
  instructionApi, InstructionDropdown,
  PORow, CreatePODto,
} from "@/lib/api-services";
import { SalesOrder, useSalesOrder } from "@/context/SalesOrderContext";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/Modal";
import { AlertTriangle } from "lucide-react";
import {
  Save, Package, Trash2, Zap, ShoppingCart,
  CheckCircle2, Eye, MapPin, ClipboardList, ArrowLeft, FileText, Plus, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/Combobox";

// Hardcoded MONIT_NAME / MONIT_ADDRESS removed — every "Monit" reference now
// comes from CompanySettingsContext (multi-tenant: Monit Paper Agency vs
// Monit Paper Associates, each in its own DB with its own address/GST).
// Form pulls the live config via useCompanySettings() inside the component.

const inputCls = (readOnly?: boolean) =>
  cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none",
    readOnly
      ? "border-gray-100 bg-gray-50 text-gray-500 cursor-default"
      : "border-gray-200 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
  );

const labelCls = "block text-[11px] font-medium text-gray-500 mb-1";

const CARD = "rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3";

const ITEM_COLORS = [
  { border: "border-l-indigo-400", badge: "bg-indigo-100 text-indigo-700" },
  { border: "border-l-violet-400", badge: "bg-violet-100 text-violet-700" },
  { border: "border-l-sky-400",    badge: "bg-sky-100 text-sky-700" },
  { border: "border-l-teal-400",   badge: "bg-teal-100 text-teal-700" },
  { border: "border-l-amber-400",  badge: "bg-amber-100 text-amber-700" },
  { border: "border-l-rose-400",   badge: "bg-rose-100 text-rose-700" },
];

// ─── Internal types ───────────────────────────────────────────────────────────

interface FormItem {
  tempId: string;
  lineNumber: number;
  materialId: number;
  description: string;
  gsm: number;
  size: string;
  unit: string;
  quantity: number;
  weightKg: number;
  rate: number;
  discount: number;
  finalPrice: number;
  amount: number;
  linkedSOLineId?: number;
  remark: string;
  autoRate: boolean;
}

interface FormState {
  millId: number;
  millName: string;
  millUnitId?: number;
  millUnitName?: string;
  orderDate: string;
  poType: string;
  linkedSOId?: number;
  linkedSONumber: string;
  deliveryMode: string;
  shipmentMode: "Normal" | "Blind" | "InvoiceOverride";
  blindShipment: boolean;
  // Client-requested toggle (default false): reveal the linked SO's
  // delivery party (B) instead of Customer (A) on Shipped To. Only
  // meaningful for POs "Against Sales Order" — ignored otherwise.
  showDeliveryParty: boolean;
  // Client-requested toggle (default false): print the "Customer : ..."
  // reference line at all, in ANY shipment mode including Blind/Override.
  // Off by default so Blind POs don't leak the customer's identity.
  showCustomerName: boolean;
  invoiceParty: string;
  invoicePartyId?: number;
  directCustomer: string;
  directCustomerId?: number;
  directDeliveryAddress: string;
  expectedDeliveryDate: string;
  millSONumber: string;
  paymentTerms: string;
  insurancePolicyNo: string;
  totalQuantity: number;
  totalValue: number;
  status: string;
  remarks: string;
  specialInstructions: string;
  // Backfill / backdated entry — mirrors SalesOrderForm's Backfill mode.
  isBackfilled?: boolean;
  poNumber?: string;   // user-typed original PO number, only when isBackfilled
}

interface PurchaseOrderFormProps {
  initialData?: PORow;
  sourceSO?: SalesOrder;
  onSubmit: (dto: CreatePODto, editId?: number) => Promise<void>;
  onCancel?: () => void;
  /** Existing POs from the parent page's fresh local state — used by the
   *  pre-save duplicate detector. Falls back to the context list if not
   *  supplied (older callers), but context can be stale because the PO
   *  page keeps its own local cache that isn't pushed back to context. */
  existingPos?: PORow[];
}

// ─── Rate finder ──────────────────────────────────────────────────────────────

function findRateData(
  materialId: number,
  millId: number,
  millUnitId: number | undefined,
  materials: MaterialDropdown[],
  rates: RateRow[],
  lastRates: LastRateDto[] = [],
): { rate: number; discount: number } {
  const mat = materials.find((m) => m.id === materialId);
  if (!mat) return { rate: 0, discount: 0 };

  // Rate Master now supports per-unit rates (migration 33). Resolution order
  // for the right rate row:
  //   1. exact mill + exact mill-unit match (per-unit pricing)
  //   2. exact mill + no mill-unit on row (legacy mill-wide pricing)
  // Quality + GSM-range + active flag must always match.
  const baseFilter = (r: RateRow) =>
    r.millId === millId &&
    r.qualityId === mat.qualityId &&
    r.gsmMin <= mat.gsm && r.gsmMax >= mat.gsm &&
    r.isActive;

  const row =
    (millUnitId != null
      ? rates.find((r) => baseFilter(r) && r.millUnitId === millUnitId)
      : undefined)
    ?? rates.find((r) => baseFilter(r) && r.millUnitId == null);

  if (row) return { rate: row.amount, discount: row.discount ?? 0 };

  // Fallback (below Rate Master) — this mill's most recent non-cancelled PO
  // rate for the same Mill+Quality+GSM (same dimensions Rate Master itself
  // prices by — size doesn't matter), so a repeat order doesn't need the
  // rate re-typed from scratch. Client-requested; user can still edit it.
  const last = lastRates.find((r) => r.millId === millId && r.qualityId === mat.qualityId && r.gsm === mat.gsm);
  return last ? { rate: last.rate, discount: last.discount } : { rate: 0, discount: 0 };
}

function calcFinal(rate: number, discount: number) {
  // PO discount is a FLAT ₹/KG amount (matches Rate Master + SO convention).
  // Earlier this treated `discount` as a percentage which produced negative
  // finals when the user entered values > 100. Final = list-rate − discount.
  return rate - discount;
}

// ─── Init helpers ─────────────────────────────────────────────────────────────

function initFromPO(po: PORow): { form: FormState; items: FormItem[] } {
  return {
    form: {
      millId: po.millId, millName: po.millName,
      millUnitId: po.millUnitId, millUnitName: po.millUnitName,
      orderDate: po.orderDate, poType: po.poType,
      linkedSOId: po.linkedSOId, linkedSONumber: po.linkedSONumber ?? "",
      deliveryMode: po.deliveryMode ?? "To Godown",
      shipmentMode: (po.shipmentMode ?? "Normal") as FormState["shipmentMode"],
      blindShipment: po.blindShipment,
      showDeliveryParty: po.showDeliveryParty ?? false,
      showCustomerName: po.showCustomerName ?? false,
      invoiceParty: po.invoiceParty ?? "", invoicePartyId: po.invoicePartyId,
      directCustomer: po.directCustomer ?? "", directCustomerId: po.directCustomerId,
      directDeliveryAddress: po.directDeliveryAddress ?? "",
      expectedDeliveryDate: po.expectedDeliveryDate ?? "",
      millSONumber: po.millSONumber ?? "", paymentTerms: po.paymentTerms ?? "",
      insurancePolicyNo: po.insurancePolicyNo ?? "",
      totalQuantity: po.totalQuantity, totalValue: po.totalValue,
      status: po.status, remarks: po.remarks ?? "", specialInstructions: po.specialInstructions ?? "",
    },
    items: po.items.map((item) => ({
      tempId: String(item.id), lineNumber: item.lineNumber,
      materialId: item.materialId, description: item.description ?? "",
      gsm: item.gsm ?? 0, size: item.size ?? "", unit: item.unit ?? "",
      quantity: item.quantity, weightKg: item.weightKg ?? 0,
      // Stored `rate` is the post-discount (finalPrice) value. The form's
      // Rate input shows the LIST/master rate, so reconstruct it as
      // finalPrice + discount. finalPrice stays = stored rate.
      rate:        +(item.rate + (item.discount ?? 0)).toFixed(2),
      discount:    item.discount ?? 0,
      finalPrice:  item.rate,
      amount: item.amount,
      linkedSOLineId: item.linkedSOLineId, remark: item.remark ?? "", autoRate: false,
    })),
  };
}

function initFromSO(so: SalesOrder): { form: Partial<FormState>; items: FormItem[] } {
  return {
    form: {
      poType: "Against Sales Order",
      linkedSOId: parseInt(so.id), linkedSONumber: so.soNumber,
      directCustomer: so.customer, directCustomerId: parseInt(so.customerId),
      directDeliveryAddress: so.lines[0]?.deliveryAddress ?? "",
      deliveryMode: "Direct To Customer", shipmentMode: "Normal", blindShipment: false,
      showDeliveryParty: false, showCustomerName: false,
      paymentTerms: so.paymentTerms, insurancePolicyNo: so.insurancePolicyNo ?? "", status: "Approval Pending",
    },
    items: so.lines.map((line, i) => ({
      tempId: `soitem_${line.id}`, lineNumber: i + 1,
      materialId: parseInt(line.materialId), description: line.materialCode,
      gsm: line.gsm ?? 0, size: line.size ?? "", unit: line.unit ?? "",
      quantity: line.qty ?? line.orderedQty,          // sheets if present, else KG
      weightKg: line.weightKg ?? line.orderedQty,     // always KG
      rate: 0, discount: 0, finalPrice: 0, amount: 0,
      linkedSOLineId: parseInt(line.id), remark: "", autoRate: false,
    })),
  };
}

const BLANK_FORM = (): FormState => ({
  millId: 0, millName: "", millUnitId: undefined, millUnitName: undefined,
  orderDate: new Date().toISOString().split("T")[0],
  poType: "For Stock", linkedSOId: undefined, linkedSONumber: "",
  deliveryMode: "To Godown", shipmentMode: "Normal", blindShipment: false,
  showDeliveryParty: false, showCustomerName: false,
  invoiceParty: "", invoicePartyId: undefined,
  // directDeliveryAddress starts blank — the form effect fills it from
  // CompanySettingsContext once the config loads (so multi-tenant /
  // user-edited address is honoured instead of a hardcoded string).
  directCustomer: "", directCustomerId: undefined, directDeliveryAddress: "",
  expectedDeliveryDate: "", millSONumber: "", paymentTerms: "", insurancePolicyNo: "",
  totalQuantity: 0, totalValue: 0, status: "Approval Pending", remarks: "", specialInstructions: "",
  isBackfilled: false, poNumber: undefined,
});

// ─── Preview ──────────────────────────────────────────────────────────────────

function POFormPreview({ form, items, onBack, onSave, isLoading }: {
  form: FormState;
  items: FormItem[];
  onBack: () => void;
  onSave: () => Promise<void>;
  isLoading: boolean;
}) {
  const { config: companyConfig } = useCompanySettings();
  const monitName = companyConfig.companyName ?? "";
  const monitAddr = companyConfig.address ?? "";
  const mode    = form.shipmentMode;
  const billTo  = mode === "Blind" ? monitName : mode === "InvoiceOverride" ? form.invoiceParty : form.directCustomer;
  const shipTo  = mode === "Blind" ? monitAddr : form.directDeliveryAddress;

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalWt  = items.reduce((s, i) => s + i.weightKg, 0);
  const totalVal = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-blue-200 uppercase tracking-wide">Purchase Order</p>
            <p className="text-lg font-black text-white">DRAFT</p>
          </div>
          <div className="text-right text-xs text-blue-200 space-y-0.5">
            <p>Date: {form.orderDate}</p>
            <p>Mill: {form.millName}</p>
            {form.linkedSONumber && <p>SO Ref: {form.linkedSONumber}</p>}
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Bill To</p>
            <p className="text-sm font-semibold text-gray-800">{billTo || "—"}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Ship To</p>
            <p className="text-xs text-gray-700 leading-relaxed">{shipTo || "—"}</p>
          </div>
        </div>

        {/* PO Meta */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 bg-gray-50">
          {[
            { label: "Payment Terms",     value: form.paymentTerms || "—" },
            { label: "Expected Delivery", value: form.expectedDeliveryDate || "—" },
            { label: "Order ID",          value: form.millSONumber || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Items table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-right">
                <th className="px-2 py-2 text-left w-7">#</th>
                <th className="px-2 py-2 text-left">Material</th>
                <th className="px-2 py-2">GSM</th>
                <th className="px-2 py-2">Size</th>
                <th className="px-2 py-2">Weight (kg)</th>
                <th className="px-2 py-2">Rate (₹)</th>
                <th className="px-2 py-2">Disc (₹/KG)</th>
                <th className="px-2 py-2">Final (₹)</th>
                <th className="px-2 py-2">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => {
                const wt = item.weightKg > 0 ? item.weightKg : item.quantity;
                const sheetsHint = item.weightKg > 0 && item.quantity > 0 && item.quantity !== item.weightKg
                  ? item.quantity : null;
                return (
                <tr key={item.tempId} className="hover:bg-gray-50/60 text-right">
                  <td className="px-2 py-2 text-left text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-2 text-left">
                    <span className="font-medium text-gray-800">{item.description || "—"}</span>
                    {item.remark && <span className="ml-1.5 text-[10px] text-amber-600 italic">({item.remark})</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-600">{item.gsm || "—"}</td>
                  <td className="px-2 py-2 text-gray-600">{item.size || "—"}</td>
                  <td className="px-2 py-2 font-semibold text-gray-900">
                    {wt > 0 ? wt.toLocaleString("en-IN") : "—"}
                    {sheetsHint && <div className="text-[10px] font-normal text-gray-400">{sheetsHint.toLocaleString("en-IN")} sheets</div>}
                  </td>
                  <td className="px-2 py-2 text-gray-600">{item.rate > 0 ? item.rate.toLocaleString("en-IN") : "—"}</td>
                  <td className="px-2 py-2 text-gray-500">{item.discount > 0 ? `₹${item.discount.toLocaleString("en-IN")}` : "—"}</td>
                  <td className="px-2 py-2 font-semibold text-blue-700">{item.finalPrice > 0 ? item.finalPrice.toFixed(2) : "—"}</td>
                  <td className="px-2 py-2 font-bold text-gray-900">
                    {item.amount > 0 ? `₹${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200 text-right font-bold">
                <td colSpan={4} className="px-2 py-2.5 text-left text-xs text-blue-700">Total</td>
                <td className="px-2 py-2.5 text-xs text-blue-800">{(totalWt > 0 ? totalWt : totalQty).toLocaleString("en-IN")} kg</td>
                <td colSpan={3} />
                <td className="px-2 py-2.5 text-sm font-black text-blue-900">
                  ₹{totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {form.specialInstructions && (() => {
          const instrLines = form.specialInstructions.split("\n").filter((l) => l.trim());
          return (
            <div className="border-t border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-amber-500 font-medium mb-2">Special Instructions</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {instrLines.map((line, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <span className="text-[10px] text-amber-400 flex-shrink-0 mt-0.5">{i + 1}.</span>
                    <span className="leading-snug">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {form.remarks && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 print:hidden">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Internal Remarks</p>
            <p className="text-xs text-gray-600 leading-relaxed">{form.remarks}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-[11px] text-gray-400">
            {items.length} item{items.length !== 1 ? "s" : ""} · {form.millName}
            {totalWt > 0 && ` · ${totalWt.toLocaleString("en-IN")} KG`}
          </p>
          <p className="text-xl font-black text-gray-900">₹{totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Edit PO
          </button>
          <button type="button" onClick={onSave} disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            <Save className="h-4 w-4" />
            {isLoading ? "Saving…" : "Save PO"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function PurchaseOrderForm({ initialData, sourceSO, onSubmit, existingPos }: PurchaseOrderFormProps) {
  const isEdit = !!initialData?.id;

  // Company config drives every "Monit" name + address inside this form
  // (Bill From / Bill To when Blind, default godown Delivery Address, etc).
  // Single source of truth — same string the SO/PO PDFs use.
  const { config: companyConfig, allConfigs } = useCompanySettings();
  const { error: showError } = useToast();
  const monitName = companyConfig.companyName ?? "";
  const monitAddr = companyConfig.address ?? "";

  const [mills, setMills]                   = useState<MillRow[]>([]);
  // Flat per-unit list — used by the merged Mill+Unit picker so the user
  // selects "ITC Paperboards — Bhadrachalam" directly instead of mill then
  // unit in two steps.
  const [unitOptions, setUnitOptions]       = useState<MillUnitPickerOption[]>([]);
  const [allMaterials, setAllMaterials]     = useState<MaterialDropdown[]>([]);
  const [millMaterials, setMillMaterials]   = useState<MaterialDropdown[]>([]);
  const [purchaseRates, setPurchaseRates]   = useState<RateRow[]>([]);
  // Fallback tier below Rate Master — this mill's most recent non-cancelled
  // PO rate per item, used only when Rate Master has no entry for the
  // picked item.
  const [lastPoRates, setLastPoRates]       = useState<LastRateDto[]>([]);
  const [soCustomers, setSoCustomers]       = useState<CustomerSODropdown[]>([]);
  const [availableSOs, setAvailableSOs]     = useState<SalesOrderRow[]>([]);
  const [instructions, setInstructions]     = useState<InstructionDropdown[]>([]);
  const [selectedInvoiceCustomer, setSelectedInvoiceCustomer] = useState<CustomerSODropdown | null>(null);
  const [invoiceDeliveryId, setInvoiceDeliveryId] = useState<number | undefined>();

  const [form, setForm] = useState<FormState>(() => {
    if (initialData) return initFromPO(initialData).form;
    if (sourceSO) {
      const { form: soForm } = initFromSO(sourceSO);
      return { ...BLANK_FORM(), poType: "Against Sales Order", deliveryMode: "Direct To Customer", ...soForm };
    }
    return BLANK_FORM();
  });

  const [items, setItems] = useState<FormItem[]>(() => {
    if (initialData) return initFromPO(initialData).items;
    if (sourceSO)    return initFromSO(sourceSO).items;
    return [];
  });

  const [isLoading, setIsLoading]         = useState(false);
  const [showPreview, setShowPreview]     = useState(false);
  // Combobox is a fully-controlled text input — its displayed value must
  // come from the parent every render. While the user is actively typing
  // (no confirmed option picked yet), show what they typed here instead of
  // re-deriving from form.millId/millUnitId, which would collapse back to
  // the last confirmed label (or blank) on every keystroke and make typing
  // look broken. Null = "show the confirmed selection's label" (default).
  const [millUnitQuery, setMillUnitQuery] = useState<string | null>(null);
  // Same "typing state separate from confirmed value" pattern as
  // millUnitQuery, one per item row (keyed by tempId) — the native
  // <input list>/<datalist> combo this replaced got stuck once its value
  // exactly matched an option: the browser hid every other suggestion
  // until the field was cleared out completely (client-reported).
  const [itemCodeQuery, setItemCodeQuery] = useState<Record<string, string | null>>({});
  // Pre-save duplicate check reads from `existingPos` prop (caller's
  // fresh list) — context isn't synced when the PO page saves locally,
  // so this avoids stale data. SO context still used to resolve
  // customer via linkedSOId fallback.
  const { salesOrders } = useSalesOrder();
  // Rich duplicate info — the modal shows full PO details inline so the
  // user can decide without leaving the form (which would lose entered
  // data). `matchedMaterials` lists the codes that overlap with the
  // current form so the user knows EXACTLY what's duplicated.
  const [dupes, setDupes] = useState<Array<{
    po: PORow;
    customerName: string;
    matchedMaterials: string[];
  }> | null>(null);

  // ── Load masters ──────────────────────────────────────────────────────────
  useEffect(() => {
    millApi.list().then((r) => setMills(r.items.filter((m) => m.isActive))).catch(() => {});
    // Flat per-unit list for the merged Mill+Unit picker.
    millApi.unitPicker().then(setUnitOptions).catch(() => {});
    materialApi.dropdown().then(setAllMaterials).catch(() => {});
    customerApi.forSO().then(setSoCustomers).catch(() => {});
    if (!sourceSO) {
      salesOrderApi.list({ pageSize: 200 }).then((r) => setAvailableSOs(r.items)).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate insurance policy for new POs once allConfigs loads (mirrors SalesOrderForm).
  useEffect(() => {
    if (!initialData?.id && !form.insurancePolicyNo) {
      const first = allConfigs.find((c) => c.insurancePolicyNo);
      if (first?.insurancePolicyNo) {
        setForm((prev) => ({ ...prev, insurancePolicyNo: first.insurancePolicyNo! }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allConfigs]);

  // ── Mill change → rates, materials, instructions ─────────────────────────
  // Unit list no longer fetched here — the merged Mill/Unit picker already
  // has every unit pre-loaded via /mills/unit-picker.
  useEffect(() => {
    if (!form.millId) { setPurchaseRates([]); setLastPoRates([]); setMillMaterials([]); setInstructions([]); return; }
    rateApi.list({ rateType: "Purchase", millId: form.millId }).then((r) => setPurchaseRates(r.items)).catch(() => {});
    rateApi.lastPoForMill(form.millId).then(setLastPoRates).catch(() => {});
    materialApi.dropdown(form.millId).then(setMillMaterials).catch(() => {});
    instructionApi.byMill(form.millId).then(setInstructions).catch(() => {});
  }, [form.millId]);

  // ── Auto-apply rates when rates + materials load ───────────────────────────
  useEffect(() => {
    if ((!purchaseRates.length && !lastPoRates.length) || !allMaterials.length) return;
    setItems((prev) =>
      prev.map((item) => {
        if (!item.materialId) return item;
        if (item.autoRate === false && item.rate > 0) return item; // user manually set rate
        const { rate, discount } = findRateData(item.materialId, form.millId, form.millUnitId, allMaterials, purchaseRates, lastPoRates);
        if (!rate) return item;
        const fp = calcFinal(rate, discount);
        return { ...item, rate, discount, finalPrice: fp, amount: item.weightKg * fp, autoRate: true };
      })
    );
  }, [purchaseRates, lastPoRates, allMaterials, form.millId, form.millUnitId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Totals ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const qty = items.reduce((s, i) => s + (i.weightKg > 0 ? i.weightKg : i.quantity), 0);
    const val = items.reduce((s, i) => s + i.amount, 0);
    setForm((prev) => ({ ...prev, totalQuantity: qty, totalValue: val }));
  }, [items]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isForStock  = form.poType === "For Stock";
  const isAgainstSO = form.poType === "Against Sales Order";
  const selectedMill      = useMemo(() => mills.find((m) => m.id === form.millId), [mills, form.millId]);
  const linkedSODetails   = useMemo(() => availableSOs.find((s) => s.id === form.linkedSOId), [availableSOs, form.linkedSOId]);
  const displaySOCustomer = sourceSO?.customer ?? linkedSODetails?.customer ?? form.directCustomer;
  const displaySOContact  = sourceSO?.contactPerson ?? linkedSODetails?.contactPerson ?? "";
  const hasSORef          = !!(form.linkedSOId || sourceSO);
  // Only meaningful when the linked SO actually has a separate delivery
  // party (B) recorded — otherwise there's nothing for the toggle to reveal.
  const soDeliveryParty        = sourceSO?.deliveryParty ?? linkedSODetails?.deliveryParty ?? "";
  const soDeliveryPartyAddress = sourceSO?.deliveryPartyAddress ?? linkedSODetails?.deliveryPartyAddress ?? "";

  // Flatten all instruction groups into individual lines for per-line checkbox selection
  const allInstrLines = instructions.flatMap((instr) => instr.lines.filter((l) => l.trim()));
  const selectedLines = new Set(form.specialInstructions.split("\n").map((l) => l.trim()).filter(Boolean));
  const checkedCount    = allInstrLines.filter((l) => selectedLines.has(l)).length;
  const allInstrChecked = allInstrLines.length > 0 && allInstrLines.every((l) => selectedLines.has(l));
  const totalVal     = form.totalValue;
  const totalItems   = items.length;
  const totalWtKg    = items.reduce((s, i) => s + i.weightKg, 0);

  // ── DTO ───────────────────────────────────────────────────────────────────
  const buildDTO = (): CreatePODto => ({
    millId: form.millId, millUnitId: form.millUnitId ?? undefined,
    orderDate: form.orderDate, poType: form.poType,
    linkedSOId: form.linkedSOId, deliveryMode: form.deliveryMode || undefined,
    shipmentMode: form.shipmentMode, blindShipment: form.blindShipment,
    showDeliveryParty: form.showDeliveryParty,
    showCustomerName: form.showCustomerName,
    invoiceParty: form.invoiceParty || undefined, invoicePartyId: form.invoicePartyId,
    directCustomerId: form.directCustomerId,
    directDeliveryAddress: form.directDeliveryAddress || undefined,
    expectedDeliveryDate: form.expectedDeliveryDate || undefined,
    millSONumber: form.millSONumber || undefined,
    paymentTerms: form.paymentTerms || undefined,
    insurancePolicyNo: form.insurancePolicyNo || undefined,
    totalQuantity: form.totalQuantity, totalValue: form.totalValue,
    gstPercentage: 18, remarks: form.remarks || undefined,
    specialInstructions: form.specialInstructions || undefined,
    isBackfilled: !!form.isBackfilled,
    poNumber: form.isBackfilled ? (form.poNumber || "").trim() : undefined,
    items: items.map((item, i) => ({
      // materialId 0 = free-text custom item (no matching master); send null so
      // the backend stores NULL instead of hitting the FK constraint on Id=0.
      lineNumber: i + 1, materialId: item.materialId > 0 ? item.materialId : null,
      description: item.description || undefined,
      gsm: item.gsm || undefined, size: item.size || undefined, unit: item.unit || undefined,
      quantity: item.quantity, weightKg: item.weightKg || undefined,
      // PO line stores Rate = post-discount (finalPrice), Discount = flat
      // ₹/KG knock-off. Existing data follows this convention; displays
      // recover the list/master rate as `rate + discount` (single formula
      // across the codebase to keep semantics consistent).
      rate: item.finalPrice, discount: item.discount || undefined, amount: item.amount,
      linkedSOLineId: item.linkedSOLineId, remark: item.remark || undefined,
    })),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTypeChange = (type: string) => {
    setForm((prev) => ({
      ...prev, poType: type,
      deliveryMode: type === "For Stock" ? "To Godown" : "Direct To Customer",
      shipmentMode: "Normal", blindShipment: false,
      invoiceParty: "", invoicePartyId: undefined,
      directCustomer: type === "For Stock" ? "" : prev.directCustomer,
      directDeliveryAddress: type === "For Stock" ? monitAddr : "",
      linkedSOId: type === "For Stock" ? undefined : prev.linkedSOId,
      linkedSONumber: type === "For Stock" ? "" : prev.linkedSONumber,
      showDeliveryParty: type === "For Stock" ? false : prev.showDeliveryParty,
      showCustomerName: type === "For Stock" ? false : prev.showCustomerName,
    }));
    setItems([]);
  };

  // handleMillChange + millUnits state removed — replaced by the single
  // Combobox-based Mill/Unit picker (unitOptions from /mills/unit-picker)
  // which sets millId / millUnitId / paymentTerms in one step.

  const handleSOChange = (soIdStr: string) => {
    if (!soIdStr) {
      setForm((prev) => ({ ...prev, linkedSOId: undefined, linkedSONumber: "", directCustomer: "", directDeliveryAddress: "", showDeliveryParty: false, showCustomerName: false }));
      setItems([]);
      return;
    }
    const so = availableSOs.find((s) => s.id === parseInt(soIdStr));
    if (!so) return;
    const newItems: FormItem[] = so.lines.map((line, i) => {
      const { rate, discount } = findRateData(line.materialId, form.millId, form.millUnitId, allMaterials, purchaseRates, lastPoRates);
      const fp  = calcFinal(rate, discount);
      const qty = line.qty ?? line.orderedQty;
      const wt  = (line as any).weightKg ?? line.orderedQty;
      return {
        tempId: `soitem_${line.id}`, lineNumber: i + 1,
        materialId: line.materialId, description: line.materialCode,
        gsm: line.gsm ?? 0, size: line.size ?? "", unit: line.unit ?? "",
        quantity: qty, weightKg: wt,
        rate, discount, finalPrice: fp, amount: wt * fp,
        linkedSOLineId: line.id, remark: "", autoRate: rate > 0,
      };
    });
    setItems(newItems);
    setForm((prev) => ({
      ...prev, linkedSOId: so.id, linkedSONumber: so.soNumber,
      directCustomer: so.customer, directDeliveryAddress: so.lines[0]?.deliveryAddress ?? "",
      deliveryMode: "Direct To Customer", showDeliveryParty: false, showCustomerName: false,
    }));
  };

  const handleShipmentModeChange = (mode: "Normal" | "Blind" | "InvoiceOverride") => {
    setForm((prev) => {
      let addr = prev.directDeliveryAddress;
      if (mode === "Blind") {
        addr = monitAddr;
      } else if (prev.shipmentMode === "Blind") {
        addr = sourceSO?.lines[0]?.deliveryAddress ?? linkedSODetails?.lines[0]?.deliveryAddress ?? "";
      } else if (mode === "Normal" && prev.shipmentMode === "InvoiceOverride") {
        addr = sourceSO?.lines[0]?.deliveryAddress ?? linkedSODetails?.lines[0]?.deliveryAddress ?? prev.directDeliveryAddress;
      }
      return {
        ...prev, shipmentMode: mode, blindShipment: mode === "Blind",
        directDeliveryAddress: addr,
        invoiceParty: mode !== "InvoiceOverride" ? "" : prev.invoiceParty,
        invoicePartyId: mode !== "InvoiceOverride" ? undefined : prev.invoicePartyId,
        // Delivery-party toggle only has any effect in Normal mode (Blind
        // always forces Monit; Custom Invoice follows the Invoice Party
        // instead) — reset it so a stale "on" from a previous Normal
        // session doesn't silently carry over if the user switches back.
        showDeliveryParty: mode === "Normal" ? prev.showDeliveryParty : false,
      };
    });
    if (mode !== "InvoiceOverride") { setSelectedInvoiceCustomer(null); setInvoiceDeliveryId(undefined); }
  };

  const handleInvoicePartyChange = (idStr: string) => {
    if (!idStr) {
      setForm((prev) => ({ ...prev, invoiceParty: "", invoicePartyId: undefined, directDeliveryAddress: "" }));
      setSelectedInvoiceCustomer(null); setInvoiceDeliveryId(undefined);
      return;
    }
    const c = soCustomers.find((x) => x.id === parseInt(idStr));
    if (!c) return;
    const def = c.deliveryAddresses.find((a) => a.isDefault) ?? c.deliveryAddresses[0];
    setForm((prev) => ({
      ...prev, invoiceParty: c.company, invoicePartyId: c.id,
      directDeliveryAddress: def?.address ?? c.billingAddress ?? "",
    }));
    setSelectedInvoiceCustomer(c);
    setInvoiceDeliveryId(def?.id);
  };

  const handleInvoiceDeliveryChange = (idStr: string) => {
    const addr = selectedInvoiceCustomer?.deliveryAddresses.find((a) => a.id === parseInt(idStr));
    setForm((prev) => ({ ...prev, directDeliveryAddress: addr?.address ?? "" }));
    setInvoiceDeliveryId(parseInt(idStr));
  };

  // Number inputs otherwise let an accidental scroll-wheel pass over the
  // field increment/decrement it (client-reported: values silently changed
  // while scrolling the page). Blurring on wheel hands the scroll straight
  // back to the page instead of the input.
  const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();

  const handleItemQtyChange = (index: number, qty: number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: qty };
      return updated;
    });
  };

  const handleItemRateChange = (index: number, rate: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const fp = calcFinal(rate, item.discount);
      updated[index] = { ...item, rate, finalPrice: fp, amount: item.weightKg * fp, autoRate: false };
      return updated;
    });
  };

  const handleItemDiscountChange = (index: number, discount: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const fp = calcFinal(item.rate, discount);
      updated[index] = { ...item, discount, finalPrice: fp, amount: item.weightKg * fp };
      return updated;
    });
  };

  const handleItemWeightChange = (index: number, weight: number) => {
    setItems((prev) => {
      const u = [...prev];
      const item = u[index];
      u[index] = { ...item, weightKg: weight, amount: weight * item.finalPrice };
      return u;
    });
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === "materialId") {
        const matId = Number(value);
        const mat = millMaterials.find((m) => m.id === matId) ?? allMaterials.find((m) => m.id === matId);
        if (mat) {
          const { rate, discount } = findRateData(matId, form.millId, form.millUnitId, allMaterials, purchaseRates, lastPoRates);
          const fp = calcFinal(rate, discount);
          updated[index] = {
            ...updated[index], materialId: mat.id, description: mat.code,
            gsm: mat.gsm, size: mat.sizeLabel, unit: mat.packingType,
            rate, discount, finalPrice: fp, amount: updated[index].weightKg * fp, autoRate: rate > 0,
          };
        }
      } else if (field === "description") {
        // Item-Code field — free-text + datalist autocomplete (mirrors SO behaviour).
        // If the typed text exactly matches a known material code, hydrate the
        // line (GSM, size, unit, rate). Otherwise keep the text as a custom
        // description and clear materialId so the row is treated as a free entry.
        const text = String(value);
        const mat  = (millMaterials.find((m) => m.code === text) ?? allMaterials.find((m) => m.code === text));
        if (mat) {
          const { rate, discount } = findRateData(mat.id, form.millId, form.millUnitId, allMaterials, purchaseRates, lastPoRates);
          const fp = calcFinal(rate, discount);
          updated[index] = {
            ...updated[index], materialId: mat.id, description: mat.code,
            gsm: mat.gsm, size: mat.sizeLabel, unit: mat.packingType,
            rate, discount, finalPrice: fp, amount: updated[index].weightKg * fp, autoRate: rate > 0,
          };
        } else {
          // Free-text custom code. The code is composed as
          // Mill/Quality[/Brand]/GSM/Size — so the LAST segment is the size and
          // the second-to-last is the GSM. Parse them out and mirror into the
          // Size / GSM columns so the row stays internally consistent.
          const parts = text.split("/").map((p) => p.trim()).filter(Boolean);
          const last  = parts[parts.length - 1] ?? "";
          const prev  = parts[parts.length - 2] ?? "";
          const sizeLike = /^\d+(\.\d+)?([xX×]\d+(\.\d+)?)?$/.test(last);
          const gsmLike  = /^\d+$/.test(prev);
          updated[index] = {
            ...updated[index],
            description: text,
            materialId:  0,
            autoRate:    false,
            size:        sizeLike ? last : updated[index].size,
            gsm:         gsmLike  ? Number(prev) : updated[index].gsm,
          };
        }
      } else if (field === "quantity") {
        const qty = Number(value);
        updated[index] = { ...updated[index], quantity: qty };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { tempId: `item_${Date.now()}`, lineNumber: prev.length + 1, materialId: 0, description: "",
        gsm: 0, size: "", unit: "", quantity: 0, weightKg: 0, rate: 0, discount: 0, finalPrice: 0,
        amount: 0, remark: "", autoRate: false },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, lineNumber: i + 1 })));
  };

  const handleToggleAllInstructions = () => {
    if (allInstrChecked) {
      // Deselect all: remove every instruction line
      const current = form.specialInstructions
        .split("\n")
        .filter((l) => !allInstrLines.includes(l.trim()))
        .join("\n")
        .trim();
      setForm((prev) => ({ ...prev, specialInstructions: current }));
    } else {
      // Select all: add any missing lines
      const existing = new Set(form.specialInstructions.split("\n").map((l) => l.trim()).filter(Boolean));
      const toAdd    = allInstrLines.filter((l) => !existing.has(l));
      const combined = [...existing, ...toAdd].join("\n");
      setForm((prev) => ({ ...prev, specialInstructions: combined }));
    }
  };

  // Pre-save duplicate detector — returns PO numbers (if any) that share
  // the same (MillUnit, Customer, Material) composite with the current
  // form. Prefer `existingPos` (caller's fresh list — keeps POs saved
  // during the session) over the context (which is loaded once on mount
  // and doesn't refresh after saves). Customer resolution mirrors
  // PDF/email logic: direct customer first, linked-SO customer as
  // fallback. Skips the PO being edited + terminal statuses
  // (Completed / Cancelled) since those can't block new orders.
  // Returns rich duplicate info (the matching POs + the codes that overlap)
  // so the warning modal can render full details inline. Empty array means
  // no duplicate found.
  const findDuplicatePos = () => {
    const editingId = initialData?.id;
    const formUnitId  = form.millUnitId ?? null;
    const formMillId  = form.millId ?? null;
    const formCustomerId = form.directCustomerId
      ?? (form.linkedSOId
          ? Number(salesOrders.find((s) => Number(s.id) === form.linkedSOId)?.customerId ?? 0) || null
          : null);
    if (formCustomerId == null) return [];   // stock PO — can't dedupe
    const formMatIds = new Set(
      items.map((i) => i.materialId).filter((id) => id && id > 0),
    );
    if (formMatIds.size === 0) return [];

    const source: PORow[] = existingPos ?? [];
    const matches: Array<{ po: PORow; customerName: string; matchedMaterials: string[] }> = [];

    for (const po of source) {
      if (editingId && po.id === editingId) continue;
      if (["Completed", "Cancelled"].includes(po.status)) continue;
      const poUnitId = po.millUnitId ?? null;
      const poMillId = po.millId ?? null;
      const unitMatch = (formUnitId != null && formUnitId === poUnitId)
                     || (formUnitId == null && poUnitId == null
                         && formMillId === poMillId);
      if (!unitMatch) continue;
      const poCustomerId = po.directCustomerId
        ?? (po.linkedSOId
            ? Number(salesOrders.find((s) => Number(s.id) === po.linkedSOId)?.customerId ?? 0) || undefined
            : undefined);
      if (poCustomerId !== formCustomerId) continue;

      const overlapItems = (po.items ?? []).filter((i) => i.materialId != null && formMatIds.has(i.materialId));
      if (overlapItems.length === 0) continue;

      const customerName = po.directCustomer
        ?? (po.linkedSOId
            ? salesOrders.find((s) => Number(s.id) === po.linkedSOId)?.customer
            : "")
        ?? "—";
      matches.push({
        po,
        customerName,
        matchedMaterials: overlapItems
          .map((i) => i.description?.trim() || `Material #${i.materialId}`)
          .filter((v, idx, arr) => arr.indexOf(v) === idx),  // dedupe
      });
    }
    return matches;
  };

  const handleSave = async () => {
    if (!form.millId || items.length === 0) return;
    const matches = findDuplicatePos();
    if (matches.length > 0) { setDupes(matches); return; }
    await doSave();
  };

  const handleSaveFromPreview = async () => {
    const matches = findDuplicatePos();
    if (matches.length > 0) { setDupes(matches); return; }
    await doSave();
  };

  const doSave = async () => {
    setIsLoading(true);
    try {
      await onSubmit(buildDTO(), initialData?.id);
    } catch (e) {
      // Caught (and shown) here explicitly rather than left unhandled —
      // an unhandled rejection also trips Next.js's dev-mode error overlay
      // (looks like the app crashed), on top of whatever the global
      // ToastContext listener shows. Catching it and calling the toast
      // ourselves gives just the one clean, centered message.
      showError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  if (showPreview) {
    return (
      <POFormPreview
        form={form} items={items}
        onBack={() => setShowPreview(false)}
        onSave={handleSaveFromPreview}
        isLoading={isLoading}
      />
    );
  }

  // ── Shipment mode buttons (reused in card) ────────────────────────────────
  const shipmentModes = [
    { value: "Normal"          as const, label: "Normal",         desc: "Direct to customer" },
    { value: "Blind"           as const, label: "Blind",          desc: "Mill sees Monit only" },
    { value: "InvoiceOverride" as const, label: "Custom Invoice", desc: "Different billing party" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Already-sent-to-mill warning — editing doesn't lock much (see
          GuardMaterialSpecChangeAsync backend-side for the actual Material/
          GSM/Size/Quantity guard) and never auto-resends the PDF/email, so
          this is a heads-up rather than a block. Client-asked 2026-09-11. ── */}
      {isEdit && initialData && initialData.status !== "Approval Pending" && initialData.status !== "Cancelled" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">⚠️ This PO has already been sent to mill (Status: {initialData.status})</p>
          <p className="mt-0.5 text-xs text-amber-700">
            Material/GSM/Size/Quantity can't be changed once the mill reports any progress. Everything else saves normally, but the mill
            won't automatically see the update — use "Send to Mill" again after saving if they need to know.
          </p>
        </div>
      )}

      {/* ── Linked-SO reminder — editing this PO never touches its source
          SO (they're fully independent after creation), so flag it as a
          reminder to check the other side too. Client-asked 2026-09-11. ── */}
      {isEdit && initialData?.linkedSONumber && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-800">
            🔗 This PO is linked to Sales Order <span className="font-mono">{initialData.linkedSONumber}</span>
          </p>
          <p className="mt-0.5 text-xs text-blue-700">
            Changing quantities, rates, or delivery details here won't update the SO — check whether it needs the same change.
          </p>
        </div>
      )}

      {/* ── Backfill / backdated PO strip — only on create, mirrors
          SalesOrderForm's Backfill mode exactly ──────────────────────────── */}
      {!isEdit && (
        <div className={cn(
          "rounded-xl border px-4 py-3 transition-colors",
          form.isBackfilled
            ? "border-amber-300 bg-amber-50"
            : "border-gray-200 bg-white"
        )}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.isBackfilled}
              onChange={(e) => setForm((prev) => ({
                ...prev,
                isBackfilled: e.target.checked,
                // Clear typed PO number if toggling off
                poNumber: e.target.checked ? prev.poNumber : undefined,
              }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">📋 Backfill old / historical PO</span>
                {form.isBackfilled && (
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">Backfill mode</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {form.isBackfilled
                  ? "Enter the PO number from your manual register and pick the original order date. Auto-numbering is paused for this entry."
                  : "Tick this to record an old order from your manual register with its original PO number and date."}
              </p>
            </div>
          </label>
          {form.isBackfilled && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Original PO Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.poNumber ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, poNumber: e.target.value }))}
                  placeholder="e.g. PO/2024/05/038"
                  className={inputCls()}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Original Order Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.orderDate || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))}
                  max={new Date().toISOString().split("T")[0]}
                  className={inputCls()}
                  required
                />
                <p className="mt-0.5 text-[10px] text-gray-400">Must be a past date.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Card 1: PO Details ════════════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500">
            <ClipboardList className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-sm font-semibold text-gray-700">PO Details</p>
        </div>

        {/* Row 1: Mill Unit picker | PO Date | PO Type — single combined
            picker per client UAT. Each option is a mill UNIT (e.g.
            "ITC Paperboards — Bhadrachalam") so the user picks the unit
            directly instead of mill then unit in two dropdowns. Mills with
            no units appear once as a fallback row with just the mill name. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Mill / Unit <span className="text-red-400">*</span></label>
            <Combobox
              options={unitOptions.map(o => ({
                value: `${o.millId}:${o.unitId ?? 0}`,
                label: o.displayName,
                sub:   o.millCode,
              }))}
              inputValue={
                millUnitQuery !== null
                  ? millUnitQuery
                  : form.millUnitId
                  ? (unitOptions.find(o => o.millId === form.millId && o.unitId === form.millUnitId)?.displayName ?? `${form.millName} — ${form.millUnitName ?? ""}`.trim())
                  : (form.millId ? (unitOptions.find(o => o.millId === form.millId && !o.unitId)?.displayName ?? form.millName) : "")
              }
              placeholder="Search mill / unit…"
              allowCustom={false}
              onChange={(text, opt) => {
                if (!opt) {
                  // Still typing / cleared — keep showing what was typed so
                  // the box doesn't look broken; mill-change effect will
                  // also clear rates / materials once millId actually clears.
                  setMillUnitQuery(text);
                  setForm(prev => ({ ...prev, millId: 0, millName: "", millUnitId: undefined, millUnitName: undefined }));
                  return;
                }
                const [millIdStr, unitIdStr] = opt.value.split(":");
                const picked = unitOptions.find(u =>
                  u.millId === Number(millIdStr) &&
                  (u.unitId ?? 0) === Number(unitIdStr));
                if (!picked) return;
                setMillUnitQuery(null);
                setForm(prev => ({
                  ...prev,
                  millId:       picked.millId,
                  millName:     picked.millName,
                  millUnitId:   picked.unitId,
                  millUnitName: picked.unitName,
                  paymentTerms: picked.paymentTerms ?? prev.paymentTerms,
                }));
              }}
            />
          </div>
          <div>
            <label className={labelCls}>PO Date <span className="text-red-400">*</span></label>
            <input type="date" value={form.orderDate} onChange={(e) => setForm((p) => ({ ...p, orderDate: e.target.value }))} className={inputCls()} required />
          </div>
          <div>
            <label className={labelCls}>PO Type</label>
            <select value={form.poType} onChange={(e) => handleTypeChange(e.target.value)} className={inputCls()} disabled={!!sourceSO}>
              <option value="For Stock">For Stock</option>
              <option value="Against Sales Order">Against Sales Order</option>
            </select>
          </div>
        </div>

        {/* Row 2: Mill SO# | Expected Delivery | Payment Terms | Insurance —
            stacks on mobile so each input stays a full-width tap target. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Order ID</label>
            <input type="text" value={form.millSONumber} onChange={(e) => setForm((p) => ({ ...p, millSONumber: e.target.value }))} placeholder="Mill's order ID" className={inputCls()} />
          </div>
          <div>
            <label className={labelCls}>Expected Delivery <span className="text-red-400">*</span></label>
            <input type="date" value={form.expectedDeliveryDate} onChange={(e) => setForm((p) => ({ ...p, expectedDeliveryDate: e.target.value }))} className={inputCls()} required />
          </div>
          <div>
            <label className={labelCls}>Payment Terms</label>
            <input type="text" value={form.paymentTerms} onChange={(e) => setForm((p) => ({ ...p, paymentTerms: e.target.value }))} className={inputCls()} placeholder={selectedMill ? "Auto from mill" : "Select mill first"} />
          </div>
          <div>
            <label className={labelCls + " flex items-center gap-1.5"}>
              <Shield className="h-3 w-3 text-blue-400" />
              Insurance Policy No.
            </label>
            {allConfigs.filter((c) => c.insurancePolicyNo).length > 1 ? (
              <select
                value={form.insurancePolicyNo || ""}
                onChange={(e) => setForm((p) => ({ ...p, insurancePolicyNo: e.target.value }))}
                className={cn(inputCls(), "cursor-pointer")}>
                <option value="">— Select policy —</option>
                {allConfigs
                  .filter((c) => c.insurancePolicyNo)
                  .map((c) => (
                    <option key={c.id} value={c.insurancePolicyNo!}>
                      {c.insurancePolicyNo} — {c.companyName ?? `Company ${c.id}`}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                readOnly
                value={form.insurancePolicyNo || companyConfig.insurancePolicyNo || ""}
                placeholder="Set in Company Settings"
                className={inputCls(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ══ Card 2a: SO Reference & Delivery (Against SO) ═════════════════════ */}
      {isAgainstSO && (
        <div className={CARD}>
          <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500">
              <ShoppingCart className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Sales Order & Delivery</p>
          </div>

          {/* SO reference */}
          {sourceSO ? (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-indigo-800">{sourceSO.soNumber}</span>
              <span className="text-sm text-indigo-600">· {sourceSO.customer}</span>
              <span className="ml-auto text-xs text-indigo-400 border-l border-indigo-200 pl-2">{sourceSO.lines.length} items</span>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Sales Order <span className="text-red-400">*</span></label>
              <select value={form.linkedSOId ? String(form.linkedSOId) : ""} onChange={(e) => handleSOChange(e.target.value)} className={inputCls()}>
                <option value="">— Select Sales Order —</option>
                {availableSOs.map((so) => (
                  <option key={so.id} value={String(so.id)}>{so.soNumber} · {so.customer} · {so.lines.length} item{so.lines.length !== 1 ? "s" : ""}</option>
                ))}
              </select>
            </div>
          )}

          {/* Customer + Contact */}
          {hasSORef && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Customer</label>
                <input type="text" value={displaySOCustomer} readOnly className={inputCls(true)} />
              </div>
              <div>
                <label className={labelCls}>Contact</label>
                <input type="text" value={displaySOContact || "—"} readOnly className={inputCls(true)} />
              </div>
            </div>
          )}

          {/* Customer-name toggle — shown whenever this PO is linked to an
              SO. Off by default: the mill sees NO customer-identity line at
              all (client-reported: it used to always print, which leaked
              the customer's name on Blind-shipment POs). Applies the same
              way regardless of shipment mode, including Blind/Override —
              Billed To/Shipped To are unaffected either way. */}
          {hasSORef && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showCustomerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, showCustomerName: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                />
                <span className="text-xs">
                  <span className="font-semibold text-gray-700">Show customer name to mill</span>
                  <span className="block text-gray-500">
                    Check this to print "Customer : {displaySOCustomer}" on the PO. Leave unchecked to hide the customer's identity from the mill entirely — recommended for Blind shipments.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Delivery party toggle — only shown when this SO actually has a
              separate delivery party (B) recorded, AND shipment mode is
              Normal. Hidden for Blind (Shipped To is always forced to Monit
              there, so this toggle has no effect) and for Custom Invoice
              (Shipped To follows the manually-picked Invoice Party instead).
              Off by default: the mill keeps seeing only Customer (A)
              exactly as before, unless the user explicitly opts in here. */}
          {hasSORef && soDeliveryParty && form.shipmentMode === "Normal" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showDeliveryParty}
                  onChange={(e) => setForm((prev) => ({ ...prev, showDeliveryParty: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
                />
                <span className="text-xs">
                  <span className="font-semibold text-amber-800">Show delivery party to mill</span>
                  <span className="block text-amber-600">
                    This SO's material is to be delivered to <strong>{soDeliveryParty}</strong>
                    {soDeliveryPartyAddress ? ` (${soDeliveryPartyAddress})` : ""} instead of {displaySOCustomer}.
                    Check this to show the delivery party's name &amp; address on the PO — otherwise the mill sees only the customer, as usual.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Shipment mode + Delivery (one row, two cols) */}
          {hasSORef && (
            <div className="grid grid-cols-2 gap-3 items-start">
              {/* Left: shipment mode buttons */}
              <div>
                <label className={labelCls}>Shipment Mode</label>
                <div className="flex flex-col gap-1.5">
                  {shipmentModes.map(({ value, label, desc }) => {
                    const active = form.shipmentMode === value;
                    const activeStyle =
                      value === "Blind"           ? "border-orange-300 bg-orange-50 ring-1 ring-orange-400" :
                      value === "InvoiceOverride" ? "border-purple-300 bg-purple-50 ring-1 ring-purple-400" :
                                                    "border-blue-300 bg-blue-50 ring-1 ring-blue-400";
                    const activeText =
                      value === "Blind"           ? "text-orange-700" :
                      value === "InvoiceOverride" ? "text-purple-700" :
                                                    "text-blue-700";
                    return (
                      <button key={value} type="button" onClick={() => handleShipmentModeChange(value)}
                        className={cn("rounded-lg border px-3 py-2 text-left transition-all", active ? activeStyle : "border-gray-200 bg-white hover:border-gray-300")}
                      >
                        <div className={cn("text-xs font-semibold", active ? activeText : "text-gray-700")}>{label}</div>
                        <div className="text-[10px] text-gray-400 leading-tight">{desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: delivery field(s) based on mode */}
              <div className="space-y-2">
                {form.shipmentMode === "Normal" && (
                  <>
                    <label className={labelCls}>Delivery Address</label>
                    <textarea
                      value={form.directDeliveryAddress}
                      onChange={(e) => setForm((p) => ({ ...p, directDeliveryAddress: e.target.value }))}
                      className={cn(inputCls(), "resize-none")} rows={4}
                      placeholder="Delivery address"
                    />
                  </>
                )}
                {form.shipmentMode === "Blind" && (
                  <>
                    <div>
                      <label className={labelCls}>Bill To (Mill sees)</label>
                      <input type="text" value={monitName} readOnly className={inputCls(true)} />
                    </div>
                    <div>
                      <label className={labelCls}>Ship To (Mill sends here)</label>
                      <input type="text" value={monitAddr} readOnly className={inputCls(true)} />
                    </div>
                  </>
                )}
                {form.shipmentMode === "InvoiceOverride" && (
                  <>
                    <div>
                      <label className={labelCls}>Invoice Party <span className="text-red-400">*</span></label>
                      <select
                        value={form.invoicePartyId ? String(form.invoicePartyId) : ""}
                        onChange={(e) => handleInvoicePartyChange(e.target.value)}
                        className={inputCls()} required
                      >
                        <option value="">— Select Party —</option>
                        {soCustomers.map((c) => <option key={c.id} value={String(c.id)}>{c.company}</option>)}
                      </select>
                    </div>
                    {selectedInvoiceCustomer && (
                      <div>
                        <label className={labelCls}>Delivery Address</label>
                        {selectedInvoiceCustomer.deliveryAddresses.length > 0 ? (
                          <select value={invoiceDeliveryId ? String(invoiceDeliveryId) : ""} onChange={(e) => handleInvoiceDeliveryChange(e.target.value)} className={inputCls()}>
                            {selectedInvoiceCustomer.deliveryAddresses.map((a) => (
                              <option key={a.id} value={String(a.id)}>{a.label ? `${a.label} · ${a.address}` : a.address}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={form.directDeliveryAddress} onChange={(e) => setForm((p) => ({ ...p, directDeliveryAddress: e.target.value }))} className={inputCls()} placeholder="Delivery address" />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Card 2b: Delivery (For Stock) ════════════════════════════════════ */}
      {isForStock && (
        <div className={CARD}>
          <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500">
              <MapPin className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Delivery</p>
          </div>
          <div>
            <label className={labelCls}>Delivery Address (Godown)</label>
            <input type="text"
              value={form.directDeliveryAddress || monitAddr}
              onChange={(e) => setForm((p) => ({ ...p, directDeliveryAddress: e.target.value }))}
              className={inputCls()}
              placeholder={monitAddr}
            />
          </div>
        </div>
      )}

      {/* ══ Card 3: Items ════════════════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between pb-1 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500">
              <Package className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              Items
              {totalItems > 0 && (
                <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{totalItems}</span>
              )}
            </p>
          </div>
          {/* Top-bar Add Item button removed per client UAT — the primary
              add button now sits BELOW the items list so the user doesn't
              have to scroll back up after adding 8-10 rows. */}
        </div>

        {totalItems === 0 && (
          isForStock ? (
            <button
              type="button"
              onClick={addItem}
              className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
              <Plus className="mx-auto h-5 w-5 text-blue-500" />
              <p className="mt-1.5 text-sm font-semibold text-blue-600">Add first item</p>
              <p className="text-[11px] text-gray-400">Click to start adding PO lines</p>
            </button>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-6 text-center">
              <Package className="h-6 w-6 mx-auto mb-1.5 text-gray-300" />
              <p className="text-xs text-gray-400">Select a Sales Order above — items will auto-fill</p>
            </div>
          )
        )}

        <div className="space-y-3">
          {items.map((item, idx) => {
            const color  = ITEM_COLORS[idx % ITEM_COLORS.length];
            const fromSO = !!item.linkedSOLineId;

            return (
              <div key={item.tempId} className={cn("rounded-xl border border-gray-100 border-l-4 bg-white p-3 space-y-2", color.border)}>
                {/* Item header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={cn("flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", color.badge)}>#{item.lineNumber}</span>
                    {fromSO && form.linkedSONumber && (
                      <span className="flex-shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">{form.linkedSONumber}</span>
                    )}
                    {item.description && <span className="text-xs font-semibold text-gray-700 truncate">{item.description}</span>}
                  </div>
                  {(!fromSO || isForStock) && (
                    <button type="button" onClick={() => removeItem(idx)}
                      className="flex-shrink-0 rounded-md p-1 text-gray-300 hover:bg-rose-50 hover:text-rose-500 transition-colors ml-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Row 1: Material | GSM | Size | Unit — all three editable
                    (client UAT, supersedes the earlier lock): if a mistake
                    was made in item/quality/GSM/size, the user can correct
                    it directly instead of only via the composite Item Code.
                    Safety now lives on the backend — GuardMaterialSpecChangeAsync
                    rejects the save once the mill has reported any progress
                    (status past "Order Placed") against the original spec. */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <label className={labelCls}>Material</label>
                    <Combobox
                      options={(millMaterials.length ? millMaterials : allMaterials).map((m) => ({
                        value: String(m.id),
                        label: m.code,
                        sub: m.gsm ? `${m.gsm}g` : undefined,
                      }))}
                      inputValue={itemCodeQuery[item.tempId] ?? item.description ?? ""}
                      onChange={(text, opt) => {
                        setItemCodeQuery((prev) => ({ ...prev, [item.tempId]: opt ? null : text }));
                        handleItemChange(idx, "description", opt ? opt.label : text);
                      }}
                      placeholder="Mill / Quality / GSM / Size — type or pick"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>GSM</label>
                    <input type="number" min={0} value={item.gsm || ""}
                      onChange={(e) => handleItemChange(idx, "gsm", Number(e.target.value))}
                      onWheel={blurOnWheel}
                      className={cn(inputCls(), "no-spinner")} />
                  </div>
                  <div className="col-span-3">
                    <label className={labelCls}>Size</label>
                    <input type="text" value={item.size || ""}
                      onChange={(e) => handleItemChange(idx, "size", e.target.value)}
                      className={inputCls()} />
                  </div>
                  <div className="col-span-1">
                    <label className={labelCls}>Unit</label>
                    <input type="text" value={item.unit || ""} readOnly className={cn(inputCls(true), "px-1 text-center text-[11px]")} />
                  </div>
                </div>

                {/* Row 2: Qty | Wt(KG) | Rate | Disc (₹/KG) | Final | Amount */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-2">
                    {/* Qty (sheet count) — optional. Weight in KG is the
                        primary quantity that drives Amount + downstream flow. */}
                    <label className={labelCls}>Qty</label>
                    <input type="number" value={item.quantity || ""} min="0"
                      onChange={(e) => handleItemQtyChange(idx, parseFloat(e.target.value) || 0)}
                      onWheel={blurOnWheel}
                      placeholder="sheets (optional)"
                      className={cn(inputCls(), "no-spinner")} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Wt (KG) <span className="text-red-400">*</span></label>
                    <input type="number" value={item.weightKg || ""} min="0" required
                      onChange={(e) => handleItemWeightChange(idx, parseFloat(e.target.value) || 0)}
                      onWheel={blurOnWheel}
                      className={cn(inputCls(), "no-spinner")} />
                  </div>
                  <div className="col-span-2">
                    <label className={cn(labelCls, "flex items-center gap-1")}>
                      Rate
                      {item.autoRate && item.rate > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1 text-[9px] font-bold text-green-700">
                          <Zap className="h-2.5 w-2.5" /> Auto
                        </span>
                      )}
                    </label>
                    <input type="number" value={item.rate || ""} min="0" step="0.01"
                      onChange={(e) => handleItemRateChange(idx, parseFloat(e.target.value) || 0)}
                      onWheel={blurOnWheel}
                      placeholder="₹"
                      className={cn(inputCls(), "no-spinner")} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Disc (₹/KG)</label>
                    <input type="number" value={item.discount || ""} min="0" step="0.01"
                      onChange={(e) => handleItemDiscountChange(idx, parseFloat(e.target.value) || 0)}
                      onWheel={blurOnWheel}
                      placeholder="₹/KG off list"
                      className={cn(inputCls(), "no-spinner")} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Final (₹)</label>
                    <div className={cn("rounded-lg border px-3 py-2 text-sm font-medium",
                      item.finalPrice > 0 ? "border-blue-100 bg-blue-50 text-blue-700" : "border-gray-100 bg-gray-50 text-gray-400"
                    )}>
                      {item.finalPrice > 0 ? item.finalPrice.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Amount</label>
                    <div className={cn("rounded-lg border px-3 py-2 text-sm font-bold",
                      item.amount > 0 ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-gray-100 bg-gray-50 text-gray-400"
                    )}>
                      {item.amount > 0 ? `₹${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                    </div>
                  </div>
                </div>

                {/* Row 3: Remark */}
                <div>
                  <label className={labelCls}>Remark</label>
                  <input type="text" value={item.remark}
                    onChange={(e) => handleItemChange(idx, "remark", e.target.value)}
                    placeholder="Optional note for this line"
                    className={inputCls()} />
                </div>
              </div>
            );
          })}
          {/* Bottom-of-list Add Item button — primary add control, only
              available for "For Stock" POs (against-SO POs auto-mirror the
              SO's lines). Lives below the list so the button keeps moving
              down with the user as rows are appended (client UAT). */}
          {isForStock && totalItems > 0 && (
            <button
              type="button"
              onClick={addItem}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 py-3 text-sm font-semibold text-blue-600 transition-colors hover:border-blue-400 hover:bg-blue-50">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* ══ Card 4: Instructions + Remarks ════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center justify-between pb-1 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500">
              <FileText className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Special Instructions for Mill</p>
          </div>
          {allInstrLines.length > 0 && (
            <div className="flex items-center gap-2">
              {checkedCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{checkedCount} selected</span>
              )}
              <button type="button" onClick={handleToggleAllInstructions}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                {allInstrChecked ? "Deselect All" : "Select All"}
              </button>
            </div>
          )}
        </div>

        {/* Per-line instruction checkboxes */}
        {allInstrLines.length > 0 ? (
          <div
            className="rounded-lg border border-gray-100 bg-white"
            style={{ maxHeight: "200px", overflowY: "auto" }}
          >
            <div className="grid grid-cols-2 gap-x-2 gap-y-0 p-1">
              {allInstrLines.map((line, idx) => {
                const checked = selectedLines.has(line);
                return (
                  <label key={idx} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors", checked ? "bg-blue-50" : "hover:bg-gray-100")}>
                    <span className="text-[10px] text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setForm((prev) => {
                          const lines = prev.specialInstructions.split("\n").map((l) => l.trim()).filter(Boolean);
                          const next  = checked
                            ? lines.filter((l) => l !== line)
                            : [...lines, line];
                          return { ...prev, specialInstructions: next.join("\n") };
                        });
                      }}
                      className="h-3.5 w-3.5 flex-shrink-0 accent-blue-500 cursor-pointer"
                    />
                    <span className={cn("text-xs leading-snug", checked ? "text-blue-700 font-medium" : "text-gray-600")}>
                      {line}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 px-1">{form.millId ? "No instructions configured for this mill." : "Select a mill to load instructions."}</p>
        )}

        {/* Internal Remarks */}
        <div className="border-t border-gray-200 pt-2">
          <label className={labelCls}>Internal Remarks (not printed on PO)</label>
          <textarea value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
            className={cn(inputCls(), "resize-none")} rows={2} placeholder="Internal notes" />
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        {totalItems > 0 ? (
          <div>
            <p className="text-[11px] font-medium text-gray-400">
              {totalItems} item{totalItems !== 1 ? "s" : ""} · {form.millName || "—"}
              {totalWtKg > 0 && ` · ${totalWtKg.toLocaleString("en-IN")} KG`}
            </p>
            <p className="text-xl font-black text-gray-900">₹{totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
        ) : <div />}
        <div className="flex gap-2">
          {!isEdit && (
            <button type="button" onClick={() => setShowPreview(true)}
              disabled={!form.millId || totalItems === 0}
              className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Eye className="h-4 w-4" /> Preview
            </button>
          )}
          <button type="button" onClick={handleSave}
            disabled={isLoading || !form.millId || totalItems === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4" />
            {isLoading ? "Saving…" : isEdit ? "Update PO" : "Save PO"}
          </button>
        </div>
      </div>

      {/* Duplicate-PO warning — full details inline so the user can decide
          without leaving the form (which would lose their entered data).
          Each match card shows: PO number + status, customer, mill unit,
          overlapping materials, value + date. Continue → save; Cancel →
          back to the form with all fields preserved. */}
      <Modal
        isOpen={dupes !== null}
        onClose={() => setDupes(null)}
        title="Duplicate PO detected"
        subtitle="Same Mill Unit + Customer + Material combination already exists on these POs."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDupes(null)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel — go back to the form
            </button>
            <button
              type="button"
              onClick={async () => { setDupes(null); await doSave(); }}
              disabled={isLoading}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              {isLoading ? "Saving…" : "Continue & Save Anyway"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Form data is preserved — click <strong>Cancel</strong> to review
              your entries, or <strong>Continue</strong> to save anyway.
            </p>
          </div>

          {(dupes ?? []).map(({ po, customerName, matchedMaterials }) => (
            <div key={po.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-violet-700">{po.poNumber}</span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {po.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <span className="text-gray-400">Mill Unit:</span>{" "}
                  <span className="font-medium text-gray-800">
                    {po.millUnitName?.trim() || po.millName || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Customer:</span>{" "}
                  <span className="font-medium text-gray-800">{customerName}</span>
                </div>
                <div>
                  <span className="text-gray-400">PO Date:</span>{" "}
                  <span className="font-medium text-gray-800">{po.orderDate}</span>
                </div>
                <div>
                  <span className="text-gray-400">Value:</span>{" "}
                  <span className="font-semibold text-emerald-700">
                    ₹{(po.totalValue ?? 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="col-span-2 mt-1 pt-1.5 border-t border-gray-100">
                  <span className="text-gray-400">Overlapping items:</span>{" "}
                  <span className="font-medium text-orange-700">
                    {matchedMaterials.join(", ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
