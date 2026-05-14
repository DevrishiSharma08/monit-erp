"use client";

import React, { useState, useMemo } from "react";
import {
  CustomerInquiry,
  InquiryRequirement,
  mockCustomers,
  mockMaterials,
} from "@/data/mockData";
import {
  Plus, Trash2, Paperclip, User, Phone, Calendar,
  Package, MapPin, AlertCircle, StickyNote, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox, ComboboxOption } from "@/components/ui/Combobox";
import { FileUploader, UploadedFile } from "@/components/ui/FileUploader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InquiryFormProps {
  initialData?: Partial<CustomerInquiry>;
  onSubmit: (data: Partial<CustomerInquiry>, attachments: UploadedFile[]) => void;
  isLoading?: boolean;
  isCustomerMode?: boolean;
}

// ─── Shared input classes ─────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm";

const readOnlyCls =
  "w-full rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500 shadow-sm";

const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide";

const reqMark = <span className="text-rose-500 ml-0.5 normal-case tracking-normal">*</span>;

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  color = "blue",
  action,
}: {
  icon: React.ElementType;
  title: string;
  color?: "blue" | "violet" | "green" | "amber" | "rose";
  action?: React.ReactNode;
}) {
  const colors = {
    blue:   { bg: "bg-blue-500",   light: "bg-blue-100",   border: "border-blue-200",   text: "text-blue-800"   },
    violet: { bg: "bg-violet-500", light: "bg-violet-100", border: "border-violet-200", text: "text-violet-800" },
    green:  { bg: "bg-emerald-500",light: "bg-emerald-100",border: "border-emerald-200",text: "text-emerald-800"},
    amber:  { bg: "bg-amber-500",  light: "bg-amber-100",  border: "border-amber-200",  text: "text-amber-800"  },
    rose:   { bg: "bg-rose-500",   light: "bg-rose-100",   border: "border-rose-200",   text: "text-rose-800"   },
  }[color];

  return (
    <div className={cn("flex items-center justify-between rounded-t-2xl px-4 py-2.5 border-b", colors.light, colors.border)}>
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", colors.bg)}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className={cn("text-sm font-semibold", colors.text)}>{title}</span>
      </div>
      {action}
    </div>
  );
}

// ─── Combobox option builders ─────────────────────────────────────────────────

function buildCustomerOptions(): ComboboxOption[] {
  const seen = new Set<string>();
  return mockCustomers
    .filter((c) => { if (seen.has(c.company)) return false; seen.add(c.company); return true; })
    .map((c) => ({ value: c.id, label: c.company, sub: c.name }));
}

function buildMaterialOptions(): ComboboxOption[] {
  return mockMaterials
    .filter((m) => m.status === "Active")
    .map((m) => ({ value: m.id, label: m.paperType, sub: `${m.gsm} GSM · ${m.size} · ${m.unitType}` }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InquiryForm({
  initialData,
  onSubmit,
  isLoading = false,
  isCustomerMode = false,
}: InquiryFormProps) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<Partial<CustomerInquiry>>({
    customer:      initialData?.customer      ?? "",
    contactPerson: initialData?.contactPerson ?? "",
    phone:         initialData?.phone         ?? "",
    email:         initialData?.email         ?? "",
    inquiryDate:   initialData?.inquiryDate   ?? new Date().toISOString().split("T")[0],
    source:        initialData?.source        ?? "Phone",
    requirements:  initialData?.requirements  ?? [
      { id: "1", materialId: "", quantity: 0, unit: "Sheet", requiredDeliveryDate: "", deliveryLocation: "", urgency: "Normal" },
    ],
    priority: initialData?.priority ?? "Medium",
    status:   initialData?.status   ?? "Draft",
    notes:    initialData?.notes    ?? "",
    salesman: initialData?.salesman ?? "Current User",
  });

  const [customerInput, setCustomerInput] = useState(initialData?.customer ?? "");
  const [materialInputs, setMaterialInputs] = useState<string[]>(
    (initialData?.requirements ?? [{ materialId: "" }]).map((r) => {
      if (!r.materialId) return "";
      return mockMaterials.find((m) => m.id === r.materialId)?.paperType ?? "";
    })
  );
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  const customerOptions = useMemo(buildCustomerOptions, []);
  const materialOptions = useMemo(buildMaterialOptions, []);

  const selectedCustomer = useMemo(
    () => mockCustomers.find((c) => c.company === formData.customer || c.name === formData.customer),
    [formData.customer]
  );
  const customerAddresses = selectedCustomer?.deliveryAddresses ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = (inputVal: string, opt?: ComboboxOption) => {
    setCustomerInput(inputVal);
    if (opt) {
      const customer = mockCustomers.find((c) => c.id === opt.value);
      setFormData((prev) => ({
        ...prev,
        customer: inputVal,
        contactPerson: customer?.name  ?? "",
        phone:         customer?.phone ?? "",
        email:         customer?.email ?? "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        customer: inputVal,
        ...(inputVal === "" ? { contactPerson: "", phone: "", email: "" } : {}),
      }));
    }
  };

  const handleMaterialChange = (index: number, inputVal: string, opt?: ComboboxOption) => {
    setMaterialInputs((prev) => { const n = [...prev]; n[index] = inputVal; return n; });
    const list = [...(formData.requirements ?? [])];
    if (opt) {
      const material = mockMaterials.find((m) => m.id === opt.value);
      if (material) {
        list[index] = {
          ...list[index],
          materialId: material.id, materialCode: material.paperType,
          gsm: material.gsm, size: material.size, packingType: material.packingType, unit: material.unitType,
        };
      }
    } else {
      list[index] = { ...list[index], materialId: "", materialCode: inputVal, gsm: undefined, size: undefined, packingType: undefined, unit: list[index].unit || "Sheet" };
    }
    setFormData((prev) => ({ ...prev, requirements: list }));
  };

  const handleRequirementChange = (index: number, field: keyof InquiryRequirement, value: string | number) => {
    const list = [...(formData.requirements ?? [])];
    list[index] = { ...list[index], [field]: field === "quantity" ? Number(value) : value };
    setFormData((prev) => ({ ...prev, requirements: list }));
  };

  const addRequirement = () => {
    setMaterialInputs((prev) => [...prev, ""]);
    setFormData((prev) => ({
      ...prev,
      requirements: [
        ...(prev.requirements ?? []),
        { id: String(Date.now()), materialId: "", quantity: 0, unit: "Sheet", requiredDeliveryDate: "", deliveryLocation: "", urgency: "Normal" },
      ],
    }));
  };

  const removeRequirement = (index: number) => {
    setMaterialInputs((prev) => prev.filter((_, i) => i !== index));
    setFormData((prev) => ({ ...prev, requirements: (prev.requirements ?? []).filter((_, i) => i !== index) }));
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onSubmit(formData, attachments);
  };

  const reqs = formData.requirements ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* ── Section 1: Customer Info ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
        {/* Customer field */}
        {isCustomerMode ? (
          <div>
            <label className={labelCls}>Company</label>
            <input type="text" value={formData.customer} readOnly className={readOnlyCls} />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Customer <span className="text-rose-500">*</span>
            </label>
            <Combobox
              options={customerOptions}
              inputValue={customerInput}
              onChange={handleCustomerChange}
              placeholder="Search customer or type a new name…"
              customHint="Add as new customer"
              required
            />
          </div>
        )}

        {/* Contact + Phone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><User className="h-3 w-3" /> Contact Person</span>
            </label>
            <input
              type="text" name="contactPerson" value={formData.contactPerson}
              onChange={handleChange}
              placeholder={isCustomerMode ? "" : "Auto-filled or type manually"}
              className={isCustomerMode ? readOnlyCls : inputCls}
              readOnly={isCustomerMode}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phone</span>
            </label>
            <input
              type="text" name="phone" value={formData.phone}
              onChange={handleChange}
              placeholder={isCustomerMode ? "" : "Auto-filled or type manually"}
              className={isCustomerMode ? readOnlyCls : inputCls}
              readOnly={isCustomerMode}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Inquiry Details ────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <SectionHeader icon={AlertCircle} title="Inquiry Details" color="violet" />
        <div className="p-4 bg-white">
          <div className={cn("grid gap-3", isCustomerMode ? "grid-cols-3" : "grid-cols-4")}>
            <div>
              <label className={labelCls}>
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Date {reqMark}</span>
              </label>
              <input type="date" name="inquiryDate" value={formData.inquiryDate} onChange={handleChange} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Source {reqMark}</label>
              <select name="source" value={formData.source} onChange={handleChange} required className={inputCls}>
                <option value="Phone">Phone</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Visit">Visit</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className={inputCls}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            {!isCustomerMode && (
              <div>
                <label className={labelCls}>Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className={inputCls}>
                  <option value="Draft">Draft</option>
                  <option value="Stock Checked">Stock Checked</option>
                  <option value="Waiting Mill Confirmation">Waiting Mill Confirmation</option>
                  <option value="Mill Confirmed">Mill Confirmed</option>
                  <option value="Customer Confirmed">Customer Confirmed</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mt-3">
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><StickyNote className="h-3 w-3" /> Notes</span>
            </label>
            <textarea
              name="notes" value={formData.notes} onChange={handleChange} rows={2}
              placeholder="Additional notes or special instructions…"
              className={inputCls + " resize-none"}
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Requirements ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <SectionHeader
          icon={Package}
          title={`Requirements (${reqs.length})`}
          color="green"
          action={
            <button
              type="button"
              onClick={addRequirement}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Add Line
            </button>
          }
        />

        <div className="divide-y divide-gray-50 bg-gray-50/60">
          {reqs.map((req, index) => (
            <div key={req.id} className="p-4">
              {/* Row header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Item {index + 1}
                    {req.materialCode && req.gsm && (
                      <span className="ml-2 font-normal text-gray-400 normal-case tracking-normal">
                        · {req.gsm} GSM · {req.size}
                      </span>
                    )}
                  </span>
                </div>
                {reqs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm space-y-3">
                {/* Row 1: Material + Qty + Unit + Urgency */}
                <div className="grid grid-cols-12 gap-3">
                  {/* Material — 6 cols */}
                  <div className="col-span-6">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Material {reqMark}</span>
                      {!req.materialId && materialInputs[index] && (
                        <span className="ml-1.5 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 normal-case tracking-normal">
                          Custom
                        </span>
                      )}
                    </label>
                    <Combobox
                      options={materialOptions}
                      inputValue={materialInputs[index] ?? ""}
                      onChange={(val, opt) => handleMaterialChange(index, val, opt)}
                      placeholder="Search inventory or describe…"
                      customHint="Use custom description"
                      required
                    />
                  </div>

                  {/* Qty — 2 cols */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Qty {reqMark}
                    </label>
                    <input
                      type="number" value={req.quantity || ""} min="0" placeholder="0" required
                      onChange={(e) => handleRequirementChange(index, "quantity", e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  {/* Unit — 2 cols */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Unit
                    </label>
                    {req.materialId ? (
                      <input type="text" value={req.unit || ""} readOnly className={readOnlyCls} />
                    ) : (
                      <select
                        value={req.unit || "Sheet"}
                        onChange={(e) => handleRequirementChange(index, "unit", e.target.value)}
                        className={inputCls}
                      >
                        <option value="Sheet">Sheet</option>
                        <option value="KG">KG</option>
                      </select>
                    )}
                  </div>

                  {/* Urgency — 2 cols */}
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Urgency
                    </label>
                    <select
                      value={req.urgency}
                      onChange={(e) => handleRequirementChange(index, "urgency", e.target.value)}
                      className={inputCls}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Required By + Delivery Location */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Required By {reqMark}</span>
                    </label>
                    <input
                      type="date" value={req.requiredDeliveryDate} required
                      onChange={(e) => handleRequirementChange(index, "requiredDeliveryDate", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Delivery Location {reqMark}</span>
                    </label>
                    {customerAddresses.length > 0 ? (
                      <select
                        value={req.deliveryLocation} required
                        onChange={(e) => handleRequirementChange(index, "deliveryLocation", e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select Address</option>
                        {customerAddresses.map((addr) => (
                          <option key={addr.id} value={addr.label}>
                            {addr.label}{addr.city ? ` — ${addr.city}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text" value={req.deliveryLocation} required
                        onChange={(e) => handleRequirementChange(index, "deliveryLocation", e.target.value)}
                        placeholder="Enter delivery address"
                        className={inputCls}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4: Attachments ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <SectionHeader icon={Paperclip} title="Attachments (optional)" color="amber" />
        <div className="p-4 bg-white">
          <FileUploader
            files={attachments}
            onChange={setAttachments}
            maxFiles={8}
            maxSizeMB={20}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
        </div>
      </div>

      {/* ── Form Actions ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="submit" disabled={isLoading}
          className="rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm shadow-blue-200"
        >
          {isLoading ? "Saving…" : isCustomerMode ? "Submit Inquiry" : formData.status === "Draft" ? "Save Draft" : "Save"}
        </button>

        {!isCustomerMode && formData.status === "Stock Checked" && (
          <button type="button" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
            Send to Mill
          </button>
        )}
        {!isCustomerMode && formData.status === "Mill Confirmed" && (
          <button type="button" className="rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors">
            Convert to SO
          </button>
        )}

        {attachments.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600">
            <Paperclip className="h-3.5 w-3.5" />
            {attachments.length} file{attachments.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </form>
  );
}
