"use client";

import { useState, useMemo, useEffect } from "react";
import {
  millApi, MillRow,
  materialApi, MaterialDropdown,
  rateApi, RateRow,
  customerApi, CustomerSODropdown,
  salesOrderApi, SalesOrderRow,
  instructionApi, InstructionDropdown,
  PORow, CreatePODto,
} from "@/lib/api-services";
import { SalesOrder } from "@/context/SalesOrderContext";
import {
  Save, Package, Trash2, Zap, ShoppingCart,
  CheckCircle2, Eye, MapPin, ClipboardList, ArrowLeft, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONIT_NAME    = "Monit Paper Agency";
const MONIT_ADDRESS = "Monit Paper Agency, Plot 45, Industrial Area, Lasudia, Indore - 452001 (MP)";

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
  orderDate: string;
  poType: string;
  linkedSOId?: number;
  linkedSONumber: string;
  deliveryMode: string;
  shipmentMode: "Normal" | "Blind" | "InvoiceOverride";
  blindShipment: boolean;
  invoiceParty: string;
  invoicePartyId?: number;
  directCustomer: string;
  directCustomerId?: number;
  directDeliveryAddress: string;
  expectedDeliveryDate: string;
  millSONumber: string;
  paymentTerms: string;
  totalQuantity: number;
  totalValue: number;
  status: string;
  remarks: string;
  specialInstructions: string;
}

interface PurchaseOrderFormProps {
  initialData?: PORow;
  sourceSO?: SalesOrder;
  onSubmit: (dto: CreatePODto, editId?: number) => Promise<void>;
  onCancel?: () => void;
}

// ─── Rate finder ──────────────────────────────────────────────────────────────

function findRateData(materialId: number, materials: MaterialDropdown[], rates: RateRow[]): { rate: number; discount: number } {
  const mat = materials.find((m) => m.id === materialId);
  if (!mat) return { rate: 0, discount: 0 };
  const row = rates.find(
    (r) => r.qualityId === mat.qualityId && r.gsmMin <= mat.gsm && r.gsmMax >= mat.gsm && r.isActive
  );
  return { rate: row?.amount ?? 0, discount: row?.discount ?? 0 };
}

function calcFinal(rate: number, discount: number) {
  return rate * (1 - discount / 100);
}

// ─── Init helpers ─────────────────────────────────────────────────────────────

function initFromPO(po: PORow): { form: FormState; items: FormItem[] } {
  return {
    form: {
      millId: po.millId, millName: po.millName,
      orderDate: po.orderDate, poType: po.poType,
      linkedSOId: po.linkedSOId, linkedSONumber: po.linkedSONumber ?? "",
      deliveryMode: po.deliveryMode ?? "To Godown",
      shipmentMode: (po.shipmentMode ?? "Normal") as FormState["shipmentMode"],
      blindShipment: po.blindShipment,
      invoiceParty: po.invoiceParty ?? "", invoicePartyId: po.invoicePartyId,
      directCustomer: po.directCustomer ?? "", directCustomerId: po.directCustomerId,
      directDeliveryAddress: po.directDeliveryAddress ?? "",
      expectedDeliveryDate: po.expectedDeliveryDate ?? "",
      millSONumber: po.millSONumber ?? "", paymentTerms: po.paymentTerms ?? "",
      totalQuantity: po.totalQuantity, totalValue: po.totalValue,
      status: po.status, remarks: po.remarks ?? "", specialInstructions: po.specialInstructions ?? "",
    },
    items: po.items.map((item) => ({
      tempId: String(item.id), lineNumber: item.lineNumber,
      materialId: item.materialId, description: item.description ?? "",
      gsm: item.gsm ?? 0, size: item.size ?? "", unit: item.unit ?? "",
      quantity: item.quantity, weightKg: item.weightKg ?? 0,
      rate: item.rate, discount: item.discount ?? 0, finalPrice: item.rate,
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
      paymentTerms: so.paymentTerms, status: "Approval Pending",
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
  millId: 0, millName: "", orderDate: new Date().toISOString().split("T")[0],
  poType: "For Stock", linkedSOId: undefined, linkedSONumber: "",
  deliveryMode: "To Godown", shipmentMode: "Normal", blindShipment: false,
  invoiceParty: "", invoicePartyId: undefined,
  directCustomer: "", directCustomerId: undefined, directDeliveryAddress: MONIT_ADDRESS,
  expectedDeliveryDate: "", millSONumber: "", paymentTerms: "",
  totalQuantity: 0, totalValue: 0, status: "Approval Pending", remarks: "", specialInstructions: "",
});

// ─── Preview ──────────────────────────────────────────────────────────────────

function POFormPreview({ form, items, onBack, onSave, isLoading }: {
  form: FormState;
  items: FormItem[];
  onBack: () => void;
  onSave: () => Promise<void>;
  isLoading: boolean;
}) {
  const mode    = form.shipmentMode;
  const billTo  = mode === "Blind" ? MONIT_NAME : mode === "InvoiceOverride" ? form.invoiceParty : form.directCustomer;
  const shipTo  = mode === "Blind" ? MONIT_ADDRESS : form.directDeliveryAddress;

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
            { label: "Mill SO No.",       value: form.millSONumber || "—" },
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
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Wt (KG)</th>
                <th className="px-2 py-2">Unit</th>
                <th className="px-2 py-2">Rate (₹)</th>
                <th className="px-2 py-2">Disc%</th>
                <th className="px-2 py-2">Final (₹)</th>
                <th className="px-2 py-2">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => (
                <tr key={item.tempId} className="hover:bg-gray-50/60 text-right">
                  <td className="px-2 py-2 text-left text-gray-400">{idx + 1}</td>
                  <td className="px-2 py-2 text-left">
                    <span className="font-medium text-gray-800">{item.description || "—"}</span>
                    {item.remark && <span className="ml-1.5 text-[10px] text-amber-600 italic">({item.remark})</span>}
                  </td>
                  <td className="px-2 py-2 text-gray-600">{item.gsm || "—"}</td>
                  <td className="px-2 py-2 text-gray-600">{item.size || "—"}</td>
                  <td className="px-2 py-2 font-medium text-gray-800">{item.quantity.toLocaleString("en-IN")}</td>
                  <td className="px-2 py-2 text-gray-600">{item.weightKg > 0 ? item.weightKg.toLocaleString("en-IN") : "—"}</td>
                  <td className="px-2 py-2 text-gray-500">{item.unit || "—"}</td>
                  <td className="px-2 py-2 text-gray-600">{item.rate > 0 ? item.rate.toLocaleString("en-IN") : "—"}</td>
                  <td className="px-2 py-2 text-gray-500">{item.discount > 0 ? `${item.discount}%` : "—"}</td>
                  <td className="px-2 py-2 font-semibold text-blue-700">{item.finalPrice > 0 ? item.finalPrice.toFixed(2) : "—"}</td>
                  <td className="px-2 py-2 font-bold text-gray-900">
                    {item.amount > 0 ? `₹${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200 text-right font-bold">
                <td colSpan={4} className="px-2 py-2.5 text-left text-xs text-blue-700">Total</td>
                <td className="px-2 py-2.5 text-xs text-blue-800">{totalQty.toLocaleString("en-IN")}</td>
                <td className="px-2 py-2.5 text-xs text-blue-800">{totalWt > 0 ? totalWt.toLocaleString("en-IN") : "—"}</td>
                <td colSpan={4} />
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

export function PurchaseOrderForm({ initialData, sourceSO, onSubmit }: PurchaseOrderFormProps) {
  const isEdit = !!initialData?.id;

  const [mills, setMills]                   = useState<MillRow[]>([]);
  const [allMaterials, setAllMaterials]     = useState<MaterialDropdown[]>([]);
  const [millMaterials, setMillMaterials]   = useState<MaterialDropdown[]>([]);
  const [purchaseRates, setPurchaseRates]   = useState<RateRow[]>([]);
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

  // ── Load masters ──────────────────────────────────────────────────────────
  useEffect(() => {
    millApi.list().then((r) => setMills(r.items.filter((m) => m.isActive))).catch(() => {});
    materialApi.dropdown().then(setAllMaterials).catch(() => {});
    customerApi.forSO().then(setSoCustomers).catch(() => {});
    if (!sourceSO) {
      salesOrderApi.list({ pageSize: 200 }).then((r) => setAvailableSOs(r.items)).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mill change → rates, materials, instructions ──────────────────────────
  useEffect(() => {
    if (!form.millId) { setPurchaseRates([]); setMillMaterials([]); setInstructions([]); return; }
    rateApi.list({ rateType: "Purchase", millId: form.millId }).then((r) => setPurchaseRates(r.items)).catch(() => {});
    materialApi.dropdown(form.millId).then(setMillMaterials).catch(() => {});
    instructionApi.byMill(form.millId).then(setInstructions).catch(() => {});
  }, [form.millId]);

  // ── Auto-apply rates when rates + materials load ───────────────────────────
  useEffect(() => {
    if (!purchaseRates.length || !allMaterials.length) return;
    setItems((prev) =>
      prev.map((item) => {
        if (!item.materialId) return item;
        if (item.autoRate === false && item.rate > 0) return item; // user manually set rate
        const { rate, discount } = findRateData(item.materialId, allMaterials, purchaseRates);
        if (!rate) return item;
        const fp = calcFinal(rate, discount);
        return { ...item, rate, discount, finalPrice: fp, amount: item.weightKg * fp, autoRate: true };
      })
    );
  }, [purchaseRates, allMaterials]); // eslint-disable-line react-hooks/exhaustive-deps

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
    millId: form.millId, orderDate: form.orderDate, poType: form.poType,
    linkedSOId: form.linkedSOId, deliveryMode: form.deliveryMode || undefined,
    shipmentMode: form.shipmentMode, blindShipment: form.blindShipment,
    invoiceParty: form.invoiceParty || undefined, invoicePartyId: form.invoicePartyId,
    directCustomerId: form.directCustomerId,
    directDeliveryAddress: form.directDeliveryAddress || undefined,
    expectedDeliveryDate: form.expectedDeliveryDate || undefined,
    millSONumber: form.millSONumber || undefined,
    paymentTerms: form.paymentTerms || undefined,
    totalQuantity: form.totalQuantity, totalValue: form.totalValue,
    gstPercentage: 18, remarks: form.remarks || undefined,
    specialInstructions: form.specialInstructions || undefined,
    items: items.map((item, i) => ({
      lineNumber: i + 1, materialId: item.materialId,
      description: item.description || undefined,
      gsm: item.gsm || undefined, size: item.size || undefined, unit: item.unit || undefined,
      quantity: item.quantity, weightKg: item.weightKg || undefined,
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
      directDeliveryAddress: type === "For Stock" ? MONIT_ADDRESS : "",
      linkedSOId: type === "For Stock" ? undefined : prev.linkedSOId,
      linkedSONumber: type === "For Stock" ? "" : prev.linkedSONumber,
    }));
    setItems([]);
  };

  const handleMillChange = (millIdStr: string) => {
    const mill = mills.find((m) => m.id === parseInt(millIdStr));
    setForm((prev) => ({
      ...prev, millId: mill?.id ?? 0, millName: mill?.name ?? "",
      paymentTerms: mill?.paymentTerms ?? prev.paymentTerms,
    }));
  };

  const handleSOChange = (soIdStr: string) => {
    if (!soIdStr) {
      setForm((prev) => ({ ...prev, linkedSOId: undefined, linkedSONumber: "", directCustomer: "", directDeliveryAddress: "" }));
      setItems([]);
      return;
    }
    const so = availableSOs.find((s) => s.id === parseInt(soIdStr));
    if (!so) return;
    const newItems: FormItem[] = so.lines.map((line, i) => {
      const { rate, discount } = findRateData(line.materialId, allMaterials, purchaseRates);
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
      deliveryMode: "Direct To Customer",
    }));
  };

  const handleShipmentModeChange = (mode: "Normal" | "Blind" | "InvoiceOverride") => {
    setForm((prev) => {
      let addr = prev.directDeliveryAddress;
      if (mode === "Blind") {
        addr = MONIT_ADDRESS;
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
          const { rate, discount } = findRateData(matId, allMaterials, purchaseRates);
          const fp = calcFinal(rate, discount);
          updated[index] = {
            ...updated[index], materialId: mat.id, description: mat.code,
            gsm: mat.gsm, size: mat.sizeLabel, unit: mat.packingType,
            rate, discount, finalPrice: fp, amount: updated[index].weightKg * fp, autoRate: rate > 0,
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

  const handleSave = async () => {
    if (!form.millId || items.length === 0) return;
    setIsLoading(true);
    try { await onSubmit(buildDTO(), initialData?.id); }
    finally { setIsLoading(false); }
  };

  const handleSaveFromPreview = async () => {
    setIsLoading(true);
    try { await onSubmit(buildDTO(), initialData?.id); }
    finally { setIsLoading(false); }
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

      {/* ══ Card 1: PO Details ════════════════════════════════════════════════ */}
      <div className={CARD}>
        <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500">
            <ClipboardList className="h-3.5 w-3.5 text-white" />
          </div>
          <p className="text-sm font-semibold text-gray-700">PO Details</p>
        </div>

        {/* Row 1: Mill | PO Date | PO Type */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Mill <span className="text-red-400">*</span></label>
            <select value={form.millId ? String(form.millId) : ""} onChange={(e) => handleMillChange(e.target.value)} className={inputCls()} required>
              <option value="">Select Mill</option>
              {mills.map((m) => <option key={m.id} value={String(m.id)}>{m.name} ({m.code})</option>)}
            </select>
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

        {/* Row 2: Mill SO# | Expected Delivery | Payment Terms */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Mill SO No.</label>
            <input type="text" value={form.millSONumber} onChange={(e) => setForm((p) => ({ ...p, millSONumber: e.target.value }))} placeholder="Assigned by mill" className={inputCls()} />
          </div>
          <div>
            <label className={labelCls}>Expected Delivery <span className="text-red-400">*</span></label>
            <input type="date" value={form.expectedDeliveryDate} onChange={(e) => setForm((p) => ({ ...p, expectedDeliveryDate: e.target.value }))} className={inputCls()} required />
          </div>
          <div>
            <label className={labelCls}>Payment Terms</label>
            <input type="text" value={form.paymentTerms} onChange={(e) => setForm((p) => ({ ...p, paymentTerms: e.target.value }))} className={inputCls()} placeholder={selectedMill ? "Auto from mill" : "Select mill first"} />
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
                      <input type="text" value={MONIT_NAME} readOnly className={inputCls(true)} />
                    </div>
                    <div>
                      <label className={labelCls}>Ship To (Mill sends here)</label>
                      <input type="text" value={MONIT_ADDRESS} readOnly className={inputCls(true)} />
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
              value={form.directDeliveryAddress || MONIT_ADDRESS}
              onChange={(e) => setForm((p) => ({ ...p, directDeliveryAddress: e.target.value }))}
              className={inputCls()}
              placeholder={MONIT_ADDRESS}
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
          {isForStock && (
            <button type="button" onClick={addItem}
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors">
              + Add Item
            </button>
          )}
        </div>

        {totalItems === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-6 text-center">
            <Package className="h-6 w-6 mx-auto mb-1.5 text-gray-300" />
            <p className="text-xs text-gray-400">
              {isAgainstSO ? "Select a Sales Order above — items will auto-fill" : "Click \"+ Add Item\" to begin"}
            </p>
          </div>
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

                {/* Row 1: Material | GSM | Size | Unit */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <label className={labelCls}>Material</label>
                    {fromSO ? (
                      <input type="text" value={item.description || "—"} readOnly className={inputCls(true)} />
                    ) : (
                      <select value={item.materialId ? String(item.materialId) : ""} onChange={(e) => handleItemChange(idx, "materialId", e.target.value)} className={inputCls()} required>
                        <option value="">Select Material</option>
                        {(millMaterials.length ? millMaterials : allMaterials).map((m) => (
                          <option key={m.id} value={String(m.id)}>{m.code}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>GSM</label>
                    <input type="text" value={item.gsm || ""} readOnly className={inputCls(true)} />
                  </div>
                  <div className="col-span-3">
                    <label className={labelCls}>Size</label>
                    <input type="text" value={item.size || ""} readOnly className={inputCls(true)} />
                  </div>
                  <div className="col-span-1">
                    <label className={labelCls}>Unit</label>
                    <input type="text" value={item.unit || ""} readOnly className={cn(inputCls(true), "px-1 text-center text-[11px]")} />
                  </div>
                </div>

                {/* Row 2: Qty | Wt(KG) | Rate | Disc% | Final | Amount */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-2">
                    <label className={labelCls}>Qty <span className="text-red-400">*</span></label>
                    <input type="number" value={item.quantity || ""} min="0" required
                      onChange={(e) => handleItemQtyChange(idx, parseFloat(e.target.value) || 0)}
                      className={inputCls()} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Wt (KG)</label>
                    <input type="number" value={item.weightKg || ""} min="0"
                      onChange={(e) => handleItemWeightChange(idx, parseFloat(e.target.value) || 0)}
                      className={inputCls()} />
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
                      placeholder="₹"
                      className={inputCls()} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Disc %</label>
                    <input type="number" value={item.discount || ""} min="0" max="100" step="0.01"
                      onChange={(e) => handleItemDiscountChange(idx, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className={inputCls()} />
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
    </div>
  );
}
