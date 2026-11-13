"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Zap, ChevronDown, Eye, ArrowLeft, Check, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { lineWeightKg } from "@/lib/weight";
import { Combobox } from "@/components/ui/Combobox";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import {
  customerApi, materialApi, salesmanApi, rateApi,
  CustomerSODropdown, MaterialDropdown, SORateDto, LastRateDto, SalesmanForSODto,
  salesOrderApi, CreateSODto, CreateSOLineDto, UpdateSODto,
  soLineDisplayCode,
} from "@/lib/api-services";
import { SalesOrder, useSalesOrder } from "@/context/SalesOrderContext";
import { useToast } from "@/context/ToastContext";
import { Modal } from "@/components/Modal";
import { AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SOLineForm = {
  id: string;
  lineNumber: number;
  materialId: string;
  materialInput?: string;
  materialCode?: string;
  brandName?: string;
  gsm?: number;
  size?: string;
  unit: string;
  qty?: number;
  weightKg?: number;
  rate: number;
  discount: number;
  finalPrice: number;
  amount: number;
  isAutoFilled: boolean;
  status: string;
  remarks?: string;
};

type FormState = {
  id?: string;
  soNumber?: string;
  customerId?: string;
  customer?: string;
  contactPersonId?: string;
  contactPerson?: string;
  customerPhone?: string;
  customerEmail?: string;
  salesman?: string;
  orderDate?: string;
  requiredDeliveryDate?: string;
  deliveryAddress?: string;
  deliveryPartyId?: string;
  deliveryPartyAddress?: string;
  deliveryMode?: string;
  paymentTerms?: string;
  remarks?: string;
  insurancePolicyNo?: string;
  showBrandInItemCode?: boolean;
  // Backfill mode — user is entering a historical SO from their pre-system
  // register. When true, soNumber + orderDate are USER-supplied and the auto
  // SO-number sequence is NOT advanced.
  isBackfilled?: boolean;
  status?: string;
  lines?: SOLineForm[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = cn(
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm",
  "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-400 transition-colors"
);
const readonlyCls =
  "w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600";
const labelCls = "block text-xs font-medium text-gray-500 mb-1";

const ITEM_COLORS = [
  { border: "border-l-indigo-400", badge: "bg-indigo-100 text-indigo-700" },
  { border: "border-l-violet-400", badge: "bg-violet-100 text-violet-700" },
  { border: "border-l-sky-400",    badge: "bg-sky-100 text-sky-700" },
  { border: "border-l-teal-400",   badge: "bg-teal-100 text-teal-700" },
  { border: "border-l-amber-400",  badge: "bg-amber-100 text-amber-700" },
  { border: "border-l-rose-400",   badge: "bg-rose-100 text-rose-700" },
];

// ─── Inline Preview ───────────────────────────────────────────────────────────

function SOPreview({
  formData, lines, totalAmount, deliveryPartyName, onBack, onConfirm, isLoading,
}: {
  formData: FormState;
  lines: SOLineForm[];
  totalAmount: number;
  deliveryPartyName?: string | null;
  onBack: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  const effectiveAddr = formData.deliveryPartyAddress || formData.deliveryAddress;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Eye className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-bold text-gray-900">Order Preview</p>
            <p className="text-xs text-gray-500">Review details before saving</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ArrowLeft className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" onClick={onConfirm} disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> {isLoading ? "Saving…" : "Save SO"}
          </button>
        </div>
      </div>

      {/* Order Info */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Details</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Customer",      value: formData.customer },
            { label: "Contact",       value: formData.contactPerson },
            { label: "Phone",         value: formData.customerPhone || "—" },
            { label: "Email",         value: formData.customerEmail || "—" },
            { label: "Salesman",      value: formData.salesman || "—" },
            { label: "Order Date",    value: formData.orderDate },
            { label: "Req. Delivery", value: formData.requiredDeliveryDate },
            { label: "Delivery Mode", value: formData.deliveryMode },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-xs font-semibold mt-0.5 text-gray-900">{value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Delivery</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-400">Delivery Party</p>
            <p className="text-xs font-semibold mt-0.5 text-gray-900">{deliveryPartyName || formData.customer || "—"}</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-400">Delivery Address</p>
            <p className="text-xs font-semibold mt-0.5 text-gray-900">{effectiveAddr || "—"}</p>
          </div>
          {formData.remarks && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400">Remarks</p>
              <p className="text-xs font-semibold mt-0.5 text-gray-900">{formData.remarks}</p>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Lines</p>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Item</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Qty</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Weight (KG)</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Disc.</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Final ₹/KG</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <tr key={line.id} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-gray-400">{line.lineNumber}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-900">{line.materialCode || "—"}</p>
                    {line.gsm && <p className="text-gray-400">{line.gsm}g · {line.size}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500">
                    {line.qty !== undefined ? line.qty.toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                    {line.weightKg !== undefined ? line.weightKg.toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">₹{line.rate}</td>
                  <td className="px-3 py-2.5 text-right text-red-500">
                    {line.discount > 0 ? `−₹${line.discount}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-green-700">
                    ₹{line.finalPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                    ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={7} className="px-3 py-2.5 text-right text-xs font-semibold text-blue-700">
                  Order Total
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-black text-blue-800">
                  ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SalesOrderFormProps {
  initialData?: SalesOrder;
  onSuccess:    (soNumber: string, isUpdate: boolean) => void;
  onCancel:     () => void;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function SalesOrderForm({ initialData, onSuccess, onCancel }: SalesOrderFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const { config: companyConfig, allConfigs } = useCompanySettings();
  const { error: showError } = useToast();
  // Existing SOs from context — used by the pre-save duplicate check to
  // warn the user when the same (customer, material) combination already
  // has an active SO recorded.
  const { salesOrders } = useSalesOrder();
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving]           = useState(false);
  // Duplicate-warning modal state — rich info so the modal can render
  // full SO details inline. User can Continue (proceed with save) or
  // Cancel (stay on the form with all fields preserved — no data loss).
  const [dupes, setDupes] = useState<Array<{
    so: SalesOrder;
    matchedMaterials: string[];
  }> | null>(null);

  // ── API data ──────────────────────────────────────────────────────────────
  const [soCustomers, setSoCustomers]     = useState<CustomerSODropdown[]>([]);
  const [materials, setMaterials]         = useState<MaterialDropdown[]>([]);
  const [salesmenList, setSalesmenList]   = useState<SalesmanForSODto[]>([]);
  const [customerRates, setCustomerRates] = useState<SORateDto[]>([]);
  // Fallback tier below Rate Master — this customer's most recent
  // non-cancelled SO rate per item, used only when Rate Master has no entry
  // for the picked item (client-requested: repeat orders shouldn't need the
  // rate re-typed from scratch).
  const [lastSoRates, setLastSoRates] = useState<LastRateDto[]>([]);
  // Combobox is fully-controlled — its displayed value must come from the
  // parent every render. While the user is actively typing (no confirmed
  // option picked yet), show what they typed here instead of re-deriving
  // from line.materialInput, which would collapse mid-type. One entry per
  // line (keyed by line.id). Null = "show the confirmed value" (default).
  // Replaces the old <input list>/<datalist> combo, which got stuck once
  // its value exactly matched an option — the browser hid every other
  // suggestion until the field was cleared out completely (client-reported).
  const [itemCodeQuery, setItemCodeQuery] = useState<Record<string, string | null>>({});

  useEffect(() => {
    Promise.all([
      customerApi.forSO(),
      materialApi.dropdown(),
      salesmanApi.forSO(),
    ]).then(([customers, mats, sms]) => {
      setSoCustomers(customers);
      setMaterials(mats);
      setSalesmenList(sms);
    }).catch(() => {});
  }, []);

  // Load rates when editing an existing SO
  useEffect(() => {
    if (initialData?.customerId) {
      rateApi.forCustomer(Number(initialData.customerId))
        .then(setCustomerRates)
        .catch(() => {});
      rateApi.lastSoForCustomer(Number(initialData.customerId))
        .then(setLastSoRates)
        .catch(() => {});
    }
  }, [initialData?.customerId]);

  // ── Form state ────────────────────────────────────────────────────────────

  const [formData, setFormData] = useState<FormState>(() => {
    if (initialData?.id) {
      const firstLine = initialData.lines?.[0];
      return {
        id:           initialData.id,
        soNumber:     initialData.soNumber,
        customerId:   initialData.customerId ?? "",
        customer:     initialData.customer,
        contactPersonId: initialData.contactPersonId ?? "",
        contactPerson:   initialData.contactPerson,
        customerPhone:   initialData.customerPhone ?? "",
        customerEmail:   initialData.customerEmail ?? "",
        salesman:        initialData.salesman,
        orderDate:       initialData.orderDate,
        requiredDeliveryDate: initialData.requiredDeliveryDate ?? firstLine?.requiredDeliveryDate ?? "",
        deliveryAddress: firstLine?.deliveryAddress ?? "",
        deliveryPartyId:      initialData.deliveryPartyId ?? initialData.customerId ?? "",
        deliveryPartyAddress: initialData.deliveryPartyAddress ?? firstLine?.deliveryAddress ?? "",
        deliveryMode:  initialData.deliveryMode,
        paymentTerms:      initialData.paymentTerms,
        remarks:           initialData.remarks,
        insurancePolicyNo: initialData.insurancePolicyNo ?? "",
        showBrandInItemCode: initialData.showBrandInItemCode ?? false,
        isBackfilled:      initialData.isBackfilled ?? false,
        status:            initialData.status,
        lines: initialData.lines?.map(l => ({
          id:           l.id,
          lineNumber:   l.lineNumber,
          materialId:   l.materialId,
          materialInput: l.materialCode ?? "",
          materialCode: l.materialCode,
          brandName:    l.brandName,
          gsm:  l.gsm,
          size: l.size,
          unit: l.unit ?? "KG",
          qty:      l.qty,
          // Backend never sends a distinct WeightKg field for SO lines —
          // weight-only-entered lines (no sheets) store the real kg value
          // in orderedQty instead. Trusting l.weightKg directly left the
          // Weight input blank/0.00 on edit for any such line even though
          // View mode (which uses this same fallback chain) showed the
          // correct figure — a live client-reported bug. lineWeightKg()
          // is the same "never trust a bare weight field" helper used
          // everywhere else (SO PDF, Delivery Challan).
          weightKg: lineWeightKg(l),
          rate:      l.rate,
          discount:  l.discount ?? 0,
          finalPrice: l.finalPrice ?? l.rate - (l.discount ?? 0),
          amount:     l.amount,
          isAutoFilled: false,
          status:     l.status,
          remarks:    l.remarks,
        })) ?? [],
      };
    }
    return {
      customerId: "", customer: "", contactPersonId: "",
      contactPerson: "", customerPhone: "", customerEmail: "",
      salesman: "", orderDate: today,
      requiredDeliveryDate: "", deliveryAddress: "",
      deliveryPartyId: "", deliveryPartyAddress: "",
      deliveryMode: "From Stock", remarks: "",
      insurancePolicyNo: "",
      showBrandInItemCode: false,
      status: "Approval Pending",
      lines: [],
    };
  });


  // Auto-populate insurance policy for new SOs once allConfigs loads
  useEffect(() => {
    if (!initialData?.id && !formData.insurancePolicyNo) {
      const first = allConfigs.find((c) => c.insurancePolicyNo);
      if (first?.insurancePolicyNo) {
        setFormData((prev) => ({ ...prev, insurancePolicyNo: first.insurancePolicyNo! }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allConfigs]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedCustomer = useMemo(
    () => soCustomers.find(c => String(c.id) === formData.customerId),
    [soCustomers, formData.customerId],
  );

  const customerContacts = useMemo(() => {
    if (!selectedCustomer) return [];
    if (selectedCustomer.contacts && selectedCustomer.contacts.length > 0)
      return selectedCustomer.contacts.map(c => ({ ...c, id: String(c.id) }));
    return [{
      id: "default", name: selectedCustomer.company,
      phone: selectedCustomer.phone ?? "", email: selectedCustomer.email ?? "", designation: "",
    }];
  }, [selectedCustomer]);

  const deliveryPartyCustomer = useMemo(
    () => formData.deliveryPartyId ? soCustomers.find(c => String(c.id) === formData.deliveryPartyId) : null,
    [soCustomers, formData.deliveryPartyId],
  );

  const deliveryPartyName = deliveryPartyCustomer?.company ?? null;

  const totalAmount = useMemo(
    () => (formData.lines ?? []).reduce((s, l) => s + l.amount, 0),
    [formData.lines],
  );

  const totalWeightKg = useMemo(
    () => (formData.lines ?? []).reduce((s, l) => s + (l.weightKg ?? 0), 0),
    [formData.lines],
  );

  // ── Customer change ───────────────────────────────────────────────────────

  const handleCustomerChange = async (customerId: string) => {
    const customer = soCustomers.find(c => String(c.id) === customerId);
    if (!customer) {
      setFormData(prev => ({
        ...prev,
        customerId: "", customer: "", contactPersonId: "",
        contactPerson: "", customerPhone: "", customerEmail: "",
        salesman: "", deliveryAddress: "",
      }));
      setCustomerRates([]);
      setLastSoRates([]);
      return;
    }

    // Load rates and last salesman for new customer in parallel
    const [ratesRaw, lastRatesRaw, lastSOs] = await Promise.all([
      rateApi.forCustomer(customer.id).catch(() => [] as SORateDto[]),
      rateApi.lastSoForCustomer(customer.id).catch(() => [] as LastRateDto[]),
      salesOrderApi.list({ customerId: customer.id, pageSize: 1 }).catch(() => null),
    ]);
    const rates: SORateDto[] = ratesRaw;
    const lastRates: LastRateDto[] = lastRatesRaw;
    setCustomerRates(rates);
    setLastSoRates(lastRates);
    const lastSalesman = lastSOs?.items?.[0]?.salesman ?? "";

    const contacts = customer.contacts && customer.contacts.length > 0
      ? customer.contacts.map(c => ({ ...c, id: String(c.id) }))
      : [{ id: "default", name: customer.company, phone: customer.phone ?? "", email: customer.email ?? "", designation: "", isDefault: true }];
    const first = contacts.find(c => c.isDefault) ?? contacts[0];
    const defaultDelivery = customer.deliveryAddresses?.find(a => a.isDefault) ?? customer.deliveryAddresses?.[0];
    const defaultAddr = defaultDelivery ?? (customer.billingAddress ? { address: customer.billingAddress } : undefined);

    const updatedLines = (formData.lines ?? []).map(line => {
      const lineMat = line.materialId ? materials.find(m => String(m.id) === line.materialId) : undefined;
      const rateEntry = line.materialId
        ? rates.find(r => String(r.materialId) === line.materialId)
          ?? (lineMat ? lastRates.find(r => r.millId === lineMat.millId && r.qualityId === lineMat.qualityId && r.gsm === lineMat.gsm) : undefined)
        : undefined;
      const rate       = rateEntry?.rate ?? line.rate;
      const discount   = rateEntry?.discount ?? line.discount ?? 0;
      const finalPrice = rate - discount;
      const amount     = (line.weightKg ?? 0) * finalPrice;
      return { ...line, rate, discount, finalPrice, amount, isAutoFilled: !!rateEntry };
    });

    setFormData(prev => ({
      ...prev,
      customerId, customer: customer.company,
      contactPersonId: first.id, contactPerson: first.name,
      customerPhone: first.phone ?? "",
      customerEmail: (first as any).email ?? "",
      salesman: lastSalesman,
      // Payment terms = customer's CreditDays (Customer Master no longer
       // exposes a separate paymentTerms field — single source of truth
       // per client UAT). e.g. 30 → "30 Days". Falls back to empty when
       // the customer has no credit days configured.
       paymentTerms: customer.creditDays > 0 ? `${customer.creditDays} Days` : "",
      deliveryAddress: defaultAddr?.address ?? "",
      deliveryPartyId: customerId,
      deliveryPartyAddress: defaultAddr?.address ?? "",
      lines: updatedLines,
    }));
  };

  // ── Contact change ────────────────────────────────────────────────────────

  const handleContactChange = (contactId: string) => {
    const contact = customerContacts.find(c => c.id === contactId);
    if (!contact) return;
    setFormData(prev => ({
      ...prev,
      contactPersonId: contactId, contactPerson: contact.name,
      customerPhone: contact.phone ?? "",
      customerEmail: (contact as any).email ?? "",
    }));
  };

  // ── Delivery party change ─────────────────────────────────────────────────

  const handleDeliveryPartyChange = (partyId: string) => {
    const party = soCustomers.find(c => String(c.id) === partyId);
    if (!party) {
      setFormData(prev => ({ ...prev, deliveryPartyId: "", deliveryPartyAddress: "" }));
      return;
    }
    const defaultDelivery = party.deliveryAddresses?.find(a => a.isDefault) ?? party.deliveryAddresses?.[0];
    const fallbackAddr    = defaultDelivery?.address ?? party.billingAddress ?? "";
    setFormData(prev => ({
      ...prev,
      deliveryPartyId: partyId,
      deliveryPartyAddress: fallbackAddr,
    }));
  };

  // Number inputs otherwise let an accidental scroll-wheel pass over the
  // field increment/decrement it (client-reported: values silently changed
  // while scrolling the page). Blurring on wheel hands the scroll straight
  // back to the page instead of the input.
  const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();

  // ── Generic field change ──────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── Line operations ───────────────────────────────────────────────────────

  const addLine = () => {
    const newLine: SOLineForm = {
      id: `line_${Date.now()}`,
      lineNumber: (formData.lines?.length ?? 0) + 1,
      materialId: "", materialInput: "", unit: "KG",
      qty: undefined, weightKg: undefined,
      rate: 0, discount: 0, finalPrice: 0, amount: 0,
      isAutoFilled: false, status: "Pending Allocation",
    };
    setFormData(prev => ({ ...prev, lines: [...(prev.lines ?? []), newLine] }));
  };

  const removeLine = (index: number) => {
    const list = (formData.lines ?? []).filter((_, i) => i !== index);
    list.forEach((l, i) => { l.lineNumber = i + 1; });
    setFormData(prev => ({ ...prev, lines: list }));
  };

  const handleLineChange = (index: number, field: string, rawValue: string | number) => {
    const list = [...(formData.lines ?? [])] as SOLineForm[];
    const line = list[index];

    if (field === "materialInput") {
      const text     = String(rawValue);
      const material = materials.find(m => m.code === text);
      if (material) {
        const rateEntry = formData.customerId
          ? customerRates.find(r => r.materialId === material.id)
            ?? lastSoRates.find(r => r.millId === material.millId && r.qualityId === material.qualityId && r.gsm === material.gsm)
          : undefined;
        const rate       = rateEntry?.rate ?? 0;
        const discount   = rateEntry?.discount ?? 0;
        const finalPrice = rate - discount;
        const amount     = (line.weightKg ?? 0) * finalPrice;
        list[index] = {
          ...line,
          materialInput: text, materialId: String(material.id), materialCode: material.code,
          gsm: material.gsm, size: material.sizeLabel, unit: "KG",
          rate, discount, finalPrice, amount, isAutoFilled: !!rateEntry,
        };
      } else {
        // Free-text custom item code. Mirror the typed text into materialCode
        // (otherwise grid/PDF/email render "null") and parse size + GSM out of
        // the last two segments so the line stays internally consistent — same
        // logic the PO form uses.
        const parts = text.split("/").map((p) => p.trim()).filter(Boolean);
        const last  = parts[parts.length - 1] ?? "";
        const prev  = parts[parts.length - 2] ?? "";
        const sizeLike = /^\d+(\.\d+)?([xX×]\d+(\.\d+)?)?$/.test(last);
        const gsmLike  = /^\d+$/.test(prev);
        list[index] = {
          ...line,
          materialInput: text,
          materialId:    "",
          materialCode:  text,
          size:          sizeLike ? last : line.size,
          gsm:           gsmLike  ? Number(prev) : line.gsm,
        };
      }
    } else if (field === "weightKg") {
      const wt = rawValue === "" ? undefined : Number(rawValue);
      const amount = (wt ?? 0) * line.finalPrice;
      let approxQty = line.qty;
      if (wt !== undefined && line.materialId) {
        const material = materials.find(m => String(m.id) === line.materialId);
        if (material?.weightPerSheet && material.weightPerSheet > 0)
          approxQty = Math.round(wt / material.weightPerSheet);
      }
      list[index] = { ...line, weightKg: wt, qty: approxQty, amount };
    } else if (field === "qty") {
      const q = rawValue === "" ? undefined : Number(rawValue);
      if (q !== undefined && line.materialId) {
        const material = materials.find(m => String(m.id) === line.materialId);
        if (material?.weightPerSheet) {
          const wt     = Math.round(q * material.weightPerSheet);
          const amount = wt * line.finalPrice;
          list[index]  = { ...line, qty: q, weightKg: wt, amount };
        } else {
          list[index] = { ...line, qty: q };
        }
      } else {
        list[index] = { ...line, qty: q };
      }
    } else if (field === "rate") {
      const rate       = Number(rawValue);
      const finalPrice = rate - line.discount;
      const amount     = (line.weightKg ?? 0) * finalPrice;
      list[index] = { ...line, rate, finalPrice, amount, isAutoFilled: false };
    } else if (field === "discount") {
      const discount   = Number(rawValue);
      const finalPrice = line.rate - discount;
      const amount     = (line.weightKg ?? 0) * finalPrice;
      list[index] = { ...line, discount, finalPrice, amount };
    } else {
      list[index] = { ...line, [field]: rawValue };
    }

    setFormData(prev => ({ ...prev, lines: list }));
  };

  // ── Build API payload ─────────────────────────────────────────────────────

  const buildDto = (): CreateSODto => {
    const effectiveAddr = formData.deliveryPartyAddress || formData.deliveryAddress || "";
    const lines: CreateSOLineDto[] = (formData.lines ?? []).map(line => {
      // materialId empty / 0 = free-text custom item (no matching master). Send
      // null so backend stores NULL instead of hitting the FK constraint on Id=0.
      const matId = Number(line.materialId);
      // line.id is the real DB id (numeric string) for an existing line, or
      // a synthetic "line_<timestamp>" for one just added in this session —
      // only forward it when it's genuinely numeric so the backend can
      // update that exact row in place instead of creating a new one.
      const existingId = /^\d+$/.test(line.id) ? Number(line.id) : undefined;
      return {
      id:                   existingId,
      lineNumber:           line.lineNumber,
      materialId:           matId > 0 ? matId : null,
      materialCode:         line.materialCode,
      gsm:                  line.gsm,
      size:                 line.size,
      unit:                 line.unit,
      orderedQty:           line.weightKg ?? line.qty ?? 0,
      qty:                  line.qty,
      rate:                 line.rate,
      discount:             line.discount,
      finalPrice:           line.finalPrice,
      amount:               line.amount,
      deliveryAddress:      effectiveAddr,
      requiredDeliveryDate: formData.requiredDeliveryDate || undefined,
      remarks:              line.remarks || undefined,
      };
    });

    return {
      customerId:           Number(formData.customerId),
      contactPersonId:      formData.contactPersonId && formData.contactPersonId !== "default"
                              ? Number(formData.contactPersonId)
                              : undefined,
      salesmanName:         formData.salesman || undefined,
      deliveryPartyId:      formData.deliveryPartyId ? Number(formData.deliveryPartyId) : undefined,
      orderDate:            formData.orderDate ?? new Date().toISOString().split("T")[0],
      requiredDeliveryDate: formData.requiredDeliveryDate || undefined,
      paymentTerms:         formData.paymentTerms || undefined,
      // deliveryTerms field removed per UAT — no longer sent.
      deliveryMode:         formData.deliveryMode || undefined,
      remarks:              formData.remarks || undefined,
      insurancePolicyNo:    formData.insurancePolicyNo || undefined,
      showBrandInItemCode:  !!formData.showBrandInItemCode,
      // Backfill mode: forward the flag + user-typed SO number so backend
      // skips the auto-sequence and stores the historical record as-is.
      isBackfilled:         !!formData.isBackfilled,
      soNumber:             formData.isBackfilled ? (formData.soNumber || "").trim() : undefined,
      lines,
    };
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const hasLines    = (formData.lines?.length ?? 0) > 0;
  const hasCustomer = !!formData.customerId;

  const handlePreview = () => { if (hasCustomer && hasLines) setShowPreview(true); };

  // Pre-save duplicate detector — returns SO rows + the codes that overlap
  // with the current form, so the warning modal can show full details
  // inline. Ignores the SO being edited + terminal states.
  const findDuplicateSos = () => {
    const editingId = formData.id;
    const customerId = String(formData.customerId ?? "");
    if (!customerId) return [];
    const formMatIds = new Set(
      (formData.lines ?? [])
        .map((l) => String(l.materialId ?? ""))
        .filter((id) => id && id !== "0"),
    );
    if (formMatIds.size === 0) return [];

    const matches: Array<{ so: SalesOrder; matchedMaterials: string[] }> = [];
    for (const so of salesOrders) {
      if (so.id === editingId) continue;
      if (String(so.customerId) !== customerId) continue;
      if (["Cancelled", "Closed"].includes(so.status)) continue;
      const overlap = (so.lines ?? []).filter((l) => formMatIds.has(String(l.materialId)));
      if (overlap.length === 0) continue;
      matches.push({
        so,
        matchedMaterials: overlap
          .map((l) => l.materialCode?.trim() || `Material #${l.materialId}`)
          .filter((v, idx, arr) => arr.indexOf(v) === idx),
      });
    }
    return matches;
  };

  const handleSave = async () => {
    if (!hasCustomer || !hasLines) return;
    const matches = findDuplicateSos();
    if (matches.length > 0) { setDupes(matches); return; }
    await doSave();
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const dto = buildDto();
      const isUpdate = !!formData.id;
      const result = isUpdate
        ? await salesOrderApi.update(Number(formData.id), { ...dto, status: formData.status } as UpdateSODto)
        : await salesOrderApi.create(dto);
      onSuccess(result.soNumber, isUpdate);
    } catch (e) {
      // Caught (and shown) here explicitly rather than left unhandled —
      // an unhandled rejection also trips Next.js's dev-mode error overlay
      // (looks like the app crashed), on top of whatever the global
      // ToastContext listener shows. Catching it and calling the toast
      // ourselves gives just the one clean, centered message.
      showError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    // Same duplicate guard as the direct-save path — the preview screen
    // shouldn't bypass the check.
    const matches = findDuplicateSos();
    if (matches.length > 0) { setDupes(matches); return; }
    setSaving(true);
    try {
      const dto = buildDto();
      const isUpdate = !!formData.id;
      const result = isUpdate
        ? await salesOrderApi.update(Number(formData.id), { ...dto, status: formData.status } as UpdateSODto)
        : await salesOrderApi.create(dto);
      onSuccess(result.soNumber, isUpdate);
    } catch (e) {
      // See doSave() above for why this is caught explicitly.
      showError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      // Preview closes either way so the user isn't left staring at a stale draft.
      setShowPreview(false);
      setSaving(false);
    }
  };

  // ── Show preview instead of form ──────────────────────────────────────────

  if (showPreview) {
    return (
      <SOPreview
        formData={formData}
        lines={formData.lines ?? []}
        totalAmount={totalAmount}
        deliveryPartyName={deliveryPartyName}
        onBack={() => setShowPreview(false)}
        onConfirm={handleConfirmSave}
        isLoading={saving}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  // Backfill mode is only meaningful when CREATING a fresh SO. Editing an
  // existing SO must not flip its IsBackfilled state — keep the strip hidden.
  const isEditMode = !!initialData?.id;

  return (
    <form className="space-y-5">

      {/* ── Linked-PO reminder — a PO raised against this SO is fully
          independent afterward (editing the SO never updates it), so flag
          it as a reminder to check the other side too. Client-asked
          2026-09-11. ────────────────────────────────────────────────────── */}
      {isEditMode && (initialData?.linkedPoCount ?? 0) > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-800">
            🔗 This SO has {initialData!.linkedPoCount} Purchase Order{initialData!.linkedPoCount === 1 ? "" : "s"} raised against it
          </p>
          <p className="mt-0.5 text-xs text-blue-700">
            Changing quantities, rates, or delivery details here won't update the linked PO(s) — check whether they need the same change.
          </p>
        </div>
      )}

      {/* ── Backfill / backdated SO strip — only on create ──────────────────── */}
      {!isEditMode && (
        <div className={cn(
          "rounded-xl border px-4 py-3 transition-colors",
          formData.isBackfilled
            ? "border-amber-300 bg-amber-50"
            : "border-gray-200 bg-white"
        )}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!formData.isBackfilled}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                isBackfilled: e.target.checked,
                // Clear typed SO number if toggling off
                soNumber: e.target.checked ? prev.soNumber : undefined,
              }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">📋 Backfill old / historical SO</span>
                {formData.isBackfilled && (
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">Backfill mode</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {formData.isBackfilled
                  ? "Enter the SO number from your manual register and pick the original order date. Auto-numbering is paused for this entry."
                  : "Tick this to record an old order from your manual register with its original SO number and date."}
              </p>
            </div>
          </label>
          {formData.isBackfilled && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Original SO Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.soNumber ?? ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, soNumber: e.target.value }))}
                  placeholder="e.g. SO/2024/05/038"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Original Order Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formData.orderDate || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                  max={today}
                  className={inputCls}
                  required
                />
                <p className="mt-0.5 text-[10px] text-gray-400">Must be a past date.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 1: Customer & Order Details ──────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-2.5">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">1</span>
          <span className="text-sm font-semibold text-gray-700">Customer &amp; Order Details</span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">

          {/* Customer */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Customer <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={formData.customerId || ""}
                onChange={e => handleCustomerChange(e.target.value)}
                className={cn(inputCls, "appearance-none pr-8")}
              >
                <option value="">— Select customer —</option>
                {soCustomers.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.company}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            {selectedCustomer && (
              <p className="mt-1 text-[11px] text-gray-400">
                GST: {selectedCustomer.gstNo || "—"} · {selectedCustomer.creditDays}d credit / ₹{selectedCustomer.creditLimit?.toLocaleString("en-IN")}
              </p>
            )}
          </div>

          {/* Contact Person */}
          <div>
            <label className={labelCls}>Contact Person</label>
            <div className="relative">
              <select
                value={formData.contactPersonId || ""}
                onChange={e => handleContactChange(e.target.value)}
                disabled={!selectedCustomer}
                className={cn(inputCls, "appearance-none pr-8", !selectedCustomer && "bg-gray-50 text-gray-400")}
              >
                <option value="">— Select contact —</option>
                {customerContacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{(c as any).designation ? ` · ${(c as any).designation}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={labelCls}>Phone</label>
            <input type="text" value={formData.customerPhone || ""} readOnly
              placeholder="Auto-filled" className={readonlyCls} />
          </div>

          {/* Email */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Email</label>
            <input type="text" value={formData.customerEmail || ""} readOnly
              placeholder="Auto-filled from contact" className={readonlyCls} />
          </div>

          {/* Salesman */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Salesman</label>
            <div className="relative">
              <select name="salesman" value={formData.salesman || ""} onChange={handleChange}
                className={cn(inputCls, "appearance-none pr-8")}>
                <option value="">— Select salesman —</option>
                {salesmenList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Order Date · Required Delivery Date · Delivery Mode — single
              row on tablet+, stacks on mobile so each date picker stays
              tap-friendly. */}
          <div className="sm:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Order Date <span className="text-red-500">*</span></label>
              <input type="date" name="orderDate" value={formData.orderDate || today}
                onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Required Delivery Date <span className="text-red-500">*</span></label>
              <input type="date" name="requiredDeliveryDate" value={formData.requiredDeliveryDate || ""}
                onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Delivery Mode <span className="text-red-500">*</span></label>
              <select name="deliveryMode" value={formData.deliveryMode || "From Stock"}
                onChange={handleChange} className={inputCls}>
                <option value="From Stock">From Stock</option>
                <option value="Direct Mill Delivery">Direct Mill Delivery</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>

          {/* Delivery Party + Location */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Delivery Party <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={formData.deliveryPartyId || ""}
                onChange={e => handleDeliveryPartyChange(e.target.value)}
                className={cn(inputCls, "appearance-none pr-8")}
              >
                <option value="">— Select party —</option>
                {soCustomers.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.company}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Delivery Location <span className="text-red-500">*</span></label>
            {(deliveryPartyCustomer?.deliveryAddresses?.length ?? 0) > 0 ? (
              <div className="relative">
                <select
                  value={formData.deliveryPartyAddress || ""}
                  onChange={e => setFormData(prev => ({ ...prev, deliveryPartyAddress: e.target.value }))}
                  className={cn(inputCls, "appearance-none pr-8")}
                >
                  <option value="">— Select location —</option>
                  {deliveryPartyCustomer!.deliveryAddresses.map(da => (
                    <option key={da.id} value={da.address}>{da.label ? `${da.label} · ${da.address}` : da.address}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            ) : (
              <input type="text" value={formData.deliveryPartyAddress || ""}
                onChange={e => setFormData(prev => ({ ...prev, deliveryPartyAddress: e.target.value }))}
                placeholder="Enter delivery location" className={inputCls} />
            )}
          </div>

          {/* Remarks — Delivery Terms field was removed per client request
              (the SO PDF / email / print no longer carry it either). */}
          <div className="sm:col-span-4">
            <label className={labelCls}>Remarks</label>
            <input type="text" name="remarks" value={formData.remarks || ""}
              onChange={handleChange} placeholder="Notes or special instructions" className={inputCls} />
          </div>

          {/* Insurance Policy No. — dropdown from all companies */}
          <div className="sm:col-span-2">
            <label className={labelCls + " flex items-center gap-1.5"}>
              <Shield className="h-3 w-3 text-blue-400" />
              Insurance Policy No.
            </label>
            {allConfigs.filter((c) => c.insurancePolicyNo).length > 1 ? (
              <select
                name="insurancePolicyNo"
                value={formData.insurancePolicyNo || ""}
                onChange={handleChange}
                className={cn(inputCls, "cursor-pointer")}>
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
                value={formData.insurancePolicyNo || companyConfig.insurancePolicyNo || ""}
                placeholder="Set in Company Settings"
                className={readonlyCls}
              />
            )}
          </div>

        </div>
      </div>

      {/* ── Section 2: Order Items ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">2</span>
            <span className="text-sm font-semibold text-gray-700">Order Items</span>
            {(formData.lines?.length ?? 0) > 0 && (
              <span className="text-xs text-gray-400">
                — rates &amp; discounts from <span className="font-medium text-green-600">Rate Master</span> (editable)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Brand-in-code toggle — off by default; user flips it for the
                rare special case when the customer asked to see the brand
                inside each item code on this SO. */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none"
              title="Insert brand name into each item code on this SO (for display + PDF/email). Default off — codes stay short.">
              <input
                type="checkbox"
                checked={!!formData.showBrandInItemCode}
                onChange={(e) => setFormData(prev => ({ ...prev, showBrandInItemCode: e.target.checked }))}
                className="h-3.5 w-3.5 accent-blue-500 cursor-pointer"
              />
              <span className="text-xs text-gray-600">Show brand in code</span>
            </label>
            {/* Top-bar Add Item button removed per client UAT — the primary
                add button now sits BELOW the items list so it stays in
                reach as the user keeps adding rows (no scroll-up needed). */}
          </div>
        </div>

        <div className="p-4">
          {(formData.lines ?? []).length === 0 ? (
            <button
              type="button"
              onClick={addLine}
              className="w-full rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/30 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
              <Plus className="mx-auto h-5 w-5 text-blue-500" />
              <p className="mt-1.5 text-sm font-medium text-blue-600">Add first item</p>
              <p className="text-[11px] text-gray-400">Click to start adding order lines</p>
            </button>
          ) : (
            <div className="space-y-3">
              {(formData.lines ?? []).map((line, index) => {
                const color = ITEM_COLORS[index % ITEM_COLORS.length];
                return (
                  <div key={line.id} className={`rounded-lg border border-gray-200 border-l-4 ${color.border} bg-white shadow-sm`}>

                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${color.badge}`}>
                          Item {line.lineNumber}
                        </span>
                        {line.materialCode && (
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {soLineDisplayCode(line, formData.showBrandInItemCode)}
                          </span>
                        )}
                        {line.gsm && (
                          <span className="text-xs text-gray-400 flex-shrink-0">{line.gsm}g · {line.size}</span>
                        )}
                      </div>
                      {(formData.lines ?? []).length > 1 && (
                        <button type="button" onClick={() => removeLine(index)}
                          className="ml-2 flex-shrink-0 rounded-lg p-1 text-red-300 hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="p-3 space-y-3">

                      {/* Item Code */}
                      <div>
                        <label className={labelCls}>Item Code <span className="text-red-500">*</span></label>
                        <Combobox
                          options={materials.map(m => ({
                            value: String(m.id),
                            label: m.code,
                            sub: m.gsm ? `${m.gsm}g` : undefined,
                          }))}
                          inputValue={itemCodeQuery[line.id] ?? line.materialInput ?? ""}
                          onChange={(text, opt) => {
                            setItemCodeQuery(prev => ({ ...prev, [line.id]: opt ? null : text }));
                            handleLineChange(index, "materialInput", opt ? opt.label : text);
                          }}
                          placeholder="Mill / Category / GSM / Size / Packing…"
                        />
                      </div>

                      {/* Qty + Weight — 2 per row on mobile, 4 on tablet+ */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>
                            Qty <span className="text-[10px] font-normal text-gray-400">(sheets, optional)</span>
                          </label>
                          <input
                            type="number" min={0}
                            value={line.qty ?? ""}
                            onChange={e => handleLineChange(index, "qty", e.target.value)}
                            onWheel={blurOnWheel}
                            placeholder="—" className={cn(inputCls, "no-spinner")}
                          />
                          {line.qty !== undefined && line.weightKg !== undefined && (
                            <p className="mt-0.5 text-[10px] text-green-600">↳ {line.weightKg} KG auto-calc</p>
                          )}
                        </div>
                        <div>
                          <label className={labelCls}>Weight (KG) <span className="text-red-500">*</span></label>
                          <input
                            type="number" min={0} step="0.01"
                            value={line.weightKg ?? ""}
                            onChange={e => handleLineChange(index, "weightKg", e.target.value)}
                            onWheel={blurOnWheel}
                            placeholder="0.00" className={cn(inputCls, "no-spinner")}
                          />
                        </div>
                      </div>

                      {/* Rate · Discount · Final Price · Line Total — stack
                          to 2-per-row on mobile so amount fields stay tappable. */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={cn(labelCls, "mb-0")}>Rate (₹/KG) <span className="text-red-500">*</span></label>
                            {line.isAutoFilled && (
                              <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-600">
                                <Zap className="h-2.5 w-2.5" /> Master
                              </span>
                            )}
                          </div>
                          <input
                            type="number" min={0} step="0.01"
                            value={line.rate || ""}
                            onChange={e => handleLineChange(index, "rate", e.target.value)}
                            onWheel={blurOnWheel}
                            placeholder="0.00"
                            className={cn(inputCls, "no-spinner", line.isAutoFilled && "border-green-300 bg-green-50/40")}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className={cn(labelCls, "mb-0")}>Discount (₹/KG)</label>
                            {line.isAutoFilled && line.discount > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-600">
                                <Zap className="h-2.5 w-2.5" /> Master
                              </span>
                            )}
                          </div>
                          <input
                            type="number" min={0} step="0.01"
                            value={line.discount || ""}
                            onChange={e => handleLineChange(index, "discount", e.target.value)}
                            onWheel={blurOnWheel}
                            placeholder="0.00"
                            className={cn(inputCls, "no-spinner", line.isAutoFilled && line.discount > 0 && "border-green-300 bg-green-50/40")}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Final Price (₹/KG)</label>
                          <div className={cn(readonlyCls, "font-semibold text-gray-900")}>
                            ₹{line.finalPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Line Total</label>
                          <div className={cn(readonlyCls, "font-bold text-gray-900")}>
                            ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Item Remark */}
                      <div>
                        <label className={labelCls}>Item Remark</label>
                        <input
                          type="text"
                          value={line.remarks ?? ""}
                          onChange={e => handleLineChange(index, "remarks", e.target.value)}
                          placeholder="Optional note for this item…"
                          className={inputCls}
                        />
                      </div>

                    </div>
                  </div>
                );
              })}
              {/* Bottom-of-list Add Item button — primary add control. As
                  the user appends rows, this button keeps moving down with
                  them so it never leaves the viewport when adding 8-10
                  items (client UAT feedback). */}
              <button
                type="button"
                onClick={addLine}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 py-3 text-sm font-semibold text-blue-600 transition-colors hover:border-blue-400 hover:bg-blue-50">
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        {hasLines ? (
          <div>
            <p className="text-[11px] font-medium text-gray-400">
              Order Total · {formData.lines?.length} item{(formData.lines?.length ?? 0) !== 1 ? "s" : ""}
            </p>
            <div className="flex items-baseline gap-3">
              <p className="text-xl font-black text-gray-900">
                ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              {totalWeightKg > 0 && (
                <span className="text-sm font-semibold text-gray-500">
                  {totalWeightKg.toLocaleString("en-IN")} KG
                </span>
              )}
            </div>
          </div>
        ) : <div />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={saving || !hasCustomer || !hasLines}
            className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasCustomer || !hasLines}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : initialData?.id ? "Update SO" : "Save SO"}
          </button>
        </div>
      </div>

      {/* Duplicate-SO warning — full details inline so user can decide
          without leaving the form (which would lose entered data). Each
          match card shows: SO number + status, customer, overlapping
          materials, value + date. Continue → save; Cancel → back to the
          form with all fields preserved. */}
      <Modal
        isOpen={dupes !== null}
        onClose={() => setDupes(null)}
        title="Duplicate SO detected"
        subtitle="Same customer + material combination already exists on these sales orders."
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
              onClick={async () => {
                setDupes(null);
                if (showPreview) {
                  setSaving(true);
                  try {
                    const dto = buildDto();
                    const isUpdate = !!formData.id;
                    const result = isUpdate
                      ? await salesOrderApi.update(Number(formData.id), { ...dto, status: formData.status } as UpdateSODto)
                      : await salesOrderApi.create(dto);
                    onSuccess(result.soNumber, isUpdate);
                  } catch (e) {
                    // See doSave() above for why this is caught explicitly.
                    showError(e instanceof Error ? e.message : "Save failed.");
                  } finally {
                    setShowPreview(false);
                    setSaving(false);
                  }
                } else {
                  await doSave();
                }
              }}
              disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Continue & Save Anyway"}
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

          {(dupes ?? []).map(({ so, matchedMaterials }) => (
            <div key={so.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-blue-700">{so.soNumber}</span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  {so.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <span className="text-gray-400">Customer:</span>{" "}
                  <span className="font-medium text-gray-800">{so.customer}</span>
                </div>
                <div>
                  <span className="text-gray-400">Salesman:</span>{" "}
                  <span className="font-medium text-gray-800">{so.salesman || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-400">Order Date:</span>{" "}
                  <span className="font-medium text-gray-800">{so.orderDate}</span>
                </div>
                <div>
                  <span className="text-gray-400">Value:</span>{" "}
                  <span className="font-semibold text-emerald-700">
                    ₹{(so.totalValue ?? 0).toLocaleString("en-IN")}
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

    </form>
  );
}
