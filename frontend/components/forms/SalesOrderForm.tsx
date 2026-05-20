"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Zap, ChevronDown, Eye, ArrowLeft, Check, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import {
  customerApi, materialApi, salesmanApi, rateApi,
  CustomerSODropdown, MaterialDropdown, SORateDto, SalesmanForSODto,
  salesOrderApi, CreateSODto, CreateSOLineDto, UpdateSODto,
} from "@/lib/api-services";
import { SalesOrder } from "@/context/SalesOrderContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type SOLineForm = {
  id: string;
  lineNumber: number;
  materialId: string;
  materialInput?: string;
  materialCode?: string;
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
  deliveryTerms?: string;
  paymentTerms?: string;
  remarks?: string;
  insurancePolicyNo?: string;
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
          {formData.deliveryTerms && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400">Delivery Terms</p>
              <p className="text-xs font-semibold mt-0.5 text-gray-900">{formData.deliveryTerms}</p>
            </div>
          )}
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
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving]           = useState(false);

  // ── API data ──────────────────────────────────────────────────────────────
  const [soCustomers, setSoCustomers]     = useState<CustomerSODropdown[]>([]);
  const [materials, setMaterials]         = useState<MaterialDropdown[]>([]);
  const [salesmenList, setSalesmenList]   = useState<SalesmanForSODto[]>([]);
  const [customerRates, setCustomerRates] = useState<SORateDto[]>([]);

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
        deliveryTerms:     initialData.deliveryTerms,
        paymentTerms:      initialData.paymentTerms,
        remarks:           initialData.remarks,
        insurancePolicyNo: initialData.insurancePolicyNo ?? "",
        status:            initialData.status,
        lines: initialData.lines?.map(l => ({
          id:           l.id,
          lineNumber:   l.lineNumber,
          materialId:   l.materialId,
          materialInput: l.materialCode ?? "",
          materialCode: l.materialCode,
          gsm:  l.gsm,
          size: l.size,
          unit: l.unit ?? "KG",
          qty:      l.qty,
          weightKg: l.weightKg ?? l.orderedQty,
          rate:      l.rate,
          discount:  l.discount ?? 0,
          finalPrice: l.finalPrice ?? l.rate - (l.discount ?? 0),
          amount:     l.amount,
          isAutoFilled: false,
          status:     l.status,
        })) ?? [],
      };
    }
    return {
      customerId: "", customer: "", contactPersonId: "",
      contactPerson: "", customerPhone: "", customerEmail: "",
      salesman: "", orderDate: today,
      requiredDeliveryDate: "", deliveryAddress: "",
      deliveryPartyId: "", deliveryPartyAddress: "",
      deliveryMode: "From Stock", deliveryTerms: "", remarks: "",
      insurancePolicyNo: "",
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
      return;
    }

    // Load rates for new customer
    const rates = await rateApi.forCustomer(customer.id).catch(() => [] as SORateDto[]);
    setCustomerRates(rates);

    const contacts = customer.contacts && customer.contacts.length > 0
      ? customer.contacts.map(c => ({ ...c, id: String(c.id) }))
      : [{ id: "default", name: customer.company, phone: customer.phone ?? "", email: customer.email ?? "", designation: "", isDefault: true }];
    const first = contacts.find(c => c.isDefault) ?? contacts[0];
    const defaultDelivery = customer.deliveryAddresses?.find(a => a.isDefault) ?? customer.deliveryAddresses?.[0];
    const defaultAddr = defaultDelivery ?? (customer.billingAddress ? { address: customer.billingAddress } : undefined);

    const updatedLines = (formData.lines ?? []).map(line => {
      const rateEntry = line.materialId
        ? rates.find(r => String(r.materialId) === line.materialId)
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
      salesman: "",
      paymentTerms: customer.paymentTerms ?? "",
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
        list[index] = { ...line, materialInput: text, materialId: "", materialCode: "" };
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
    const lines: CreateSOLineDto[] = (formData.lines ?? []).map(line => ({
      lineNumber:           line.lineNumber,
      materialId:           Number(line.materialId),
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
    }));

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
      deliveryTerms:        formData.deliveryTerms || undefined,
      deliveryMode:         formData.deliveryMode || undefined,
      remarks:              formData.remarks || undefined,
      insurancePolicyNo:    formData.insurancePolicyNo || undefined,
      lines,
    };
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const hasLines    = (formData.lines?.length ?? 0) > 0;
  const hasCustomer = !!formData.customerId;

  const handlePreview = () => { if (hasCustomer && hasLines) setShowPreview(true); };

  const handleSave = async () => {
    if (!hasCustomer || !hasLines) return;
    setSaving(true);
    try {
      const dto = buildDto();
      const isUpdate = !!formData.id;
      const result = isUpdate
        ? await salesOrderApi.update(Number(formData.id), { ...dto, status: formData.status } as UpdateSODto)
        : await salesOrderApi.create(dto);
      onSuccess(result.soNumber, isUpdate);
    } catch {
      // errors are handled globally via apiFetch interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const dto = buildDto();
      const isUpdate = !!formData.id;
      const result = isUpdate
        ? await salesOrderApi.update(Number(formData.id), { ...dto, status: formData.status } as UpdateSODto)
        : await salesOrderApi.create(dto);
      setShowPreview(false);
      onSuccess(result.soNumber, isUpdate);
    } catch {
      setShowPreview(false);
    } finally {
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

  return (
    <form className="space-y-5">

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

          {/* Order Date · Required Delivery Date · Delivery Mode — single row */}
          <div className="sm:col-span-4 grid grid-cols-3 gap-3">
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

          {/* Delivery Terms · Remarks */}
          <div className="sm:col-span-2">
            <label className={labelCls}>Delivery Terms</label>
            <input type="text" name="deliveryTerms" value={formData.deliveryTerms || ""}
              onChange={handleChange} placeholder="Ex-Godown, Door Delivery, etc." className={inputCls} />
          </div>
          <div className="sm:col-span-2">
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
          <button type="button" onClick={addLine}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        </div>

        <div className="p-4">
          {(formData.lines ?? []).length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
              <p className="text-sm text-gray-400">No items yet. Click &ldquo;Add Item&rdquo; to add order lines.</p>
            </div>
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
                          <span className="text-sm font-medium text-gray-800 truncate">{line.materialCode}</span>
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
                        <input
                          type="text" list={`mats-${line.id}`}
                          value={line.materialInput ?? ""}
                          onChange={e => handleLineChange(index, "materialInput", e.target.value)}
                          placeholder="Mill / Category / GSM / Size / Packing…"
                          className={inputCls}
                        />
                        <datalist id={`mats-${line.id}`}>
                          {materials.map(m => (
                            <option key={m.id} value={m.code} />
                          ))}
                        </datalist>
                      </div>

                      {/* Qty + Weight */}
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>
                            Qty <span className="text-[10px] font-normal text-gray-400">(sheets, optional)</span>
                          </label>
                          <input
                            type="number" min={0}
                            value={line.qty ?? ""}
                            onChange={e => handleLineChange(index, "qty", e.target.value)}
                            placeholder="—" className={inputCls}
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
                            placeholder="0.00" className={inputCls}
                          />
                        </div>
                      </div>

                      {/* Rate · Discount · Final Price · Line Total */}
                      <div className="grid grid-cols-4 gap-3">
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
                            placeholder="0.00"
                            className={cn(inputCls, line.isAutoFilled && "border-green-300 bg-green-50/40")}
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
                            placeholder="0.00"
                            className={cn(inputCls, line.isAutoFilled && line.discount > 0 && "border-green-300 bg-green-50/40")}
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

                    </div>
                  </div>
                );
              })}
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

    </form>
  );
}
