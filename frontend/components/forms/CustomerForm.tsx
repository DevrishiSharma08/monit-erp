"use client";

import { useState, FormEvent } from "react";
import { Customer, Consignee, DeliveryAddress, mockSalesmen } from "@/data/mockData";
import { Plus, Trash2 } from "lucide-react";

interface CustomerFormProps {
  initialData?: Partial<Customer>;
  onSubmit: (data: Partial<Customer>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CustomerForm({ initialData, onSubmit, onCancel, isLoading = false }: CustomerFormProps) {
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: initialData?.name || "",
    company: initialData?.company || "",
    tallyLedgerName: initialData?.tallyLedgerName || "",
    gst: initialData?.gst || "",
    pan: initialData?.pan || "",
    state: initialData?.state || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    creditLimit: initialData?.creditLimit || 0,
    creditDays: initialData?.creditDays || 0,
    outstanding: initialData?.outstanding || 0,
    salesman: initialData?.salesman || "",
    status: initialData?.status || "Active",
    consignees: initialData?.consignees || [],
    deliveryAddresses: initialData?.deliveryAddresses || [],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "creditLimit" || name === "creditDays" || name === "outstanding" ? Number(value) : value,
    }));
  };

  // --- Contact Persons ---
  const addContact = () => {
    const newItem: Consignee = { id: `new-${Date.now()}`, name: "", contactPerson: "", phone: "" };
    setFormData((prev) => ({ ...prev, consignees: [...(prev.consignees || []), newItem] }));
  };

  const updateContact = (idx: number, field: keyof Consignee, value: string) => {
    setFormData((prev) => {
      const list = [...(prev.consignees || [])];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, consignees: list };
    });
  };

  const removeContact = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      consignees: (prev.consignees || []).filter((_, i) => i !== idx),
    }));
  };

  // --- Delivery Addresses ---
  const addAddress = () => {
    const newItem: DeliveryAddress = {
      id: `new-${Date.now()}`, label: "", address: "", city: "", state: "MP",
      pincode: "", contactPerson: "", phone: "",
      isDefault: (formData.deliveryAddresses || []).length === 0,
    };
    setFormData((prev) => ({ ...prev, deliveryAddresses: [...(prev.deliveryAddresses || []), newItem] }));
  };

  const updateAddress = (idx: number, field: keyof DeliveryAddress, value: string | boolean) => {
    setFormData((prev) => {
      let list = [...(prev.deliveryAddresses || [])];
      if (field === "isDefault" && value === true) {
        list = list.map((a) => ({ ...a, isDefault: false }));
      }
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, deliveryAddresses: list };
    });
  };

  const removeAddress = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      deliveryAddresses: (prev.deliveryAddresses || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400";
  const subInputCls = "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-500">*</span></label>
          <input type="text" name="company" value={formData.company} onChange={handleChange} required
            placeholder="e.g., ABC Printers Pvt Ltd" className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tally Ledger Name <span className="text-red-500">*</span></label>
          <input type="text" name="tallyLedgerName" value={formData.tallyLedgerName} onChange={handleChange} required
            placeholder="Exact name from Tally" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GST Number <span className="text-red-500">*</span></label>
          <input type="text" name="gst" value={formData.gst} onChange={handleChange} required maxLength={15}
            placeholder="23ABCDE1234F1Z5" className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number <span className="text-red-500">*</span></label>
          <input type="text" name="pan" value={formData.pan} onChange={handleChange} required maxLength={10}
            placeholder="ABCDE1234F" className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
          <input type="text" name="state" value={formData.state} onChange={handleChange} required
            placeholder="e.g., Madhya Pradesh" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Salesman <span className="text-red-500">*</span></label>
          <select name="salesman" value={formData.salesman} onChange={handleChange} required className={inputCls}>
            <option value="">Select Salesman</option>
            {mockSalesmen.filter((s) => s.status === "Active").map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹) <span className="text-red-500">*</span></label>
          <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange} required min="0" step="1000"
            placeholder="e.g., 5000000" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Credit Days <span className="text-red-500">*</span></label>
          <input type="number" name="creditDays" value={formData.creditDays} onChange={handleChange} required min="0"
            placeholder="e.g., 30" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className={inputCls}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Contact Persons */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Contact Persons
            {(formData.consignees || []).length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                {formData.consignees?.length}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={addContact}
            className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add Contact
          </button>
        </div>

        {(formData.consignees || []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
            No contacts added. Click &ldquo;Add Contact&rdquo; to add.
          </p>
        ) : (
          <div className="space-y-2">
            {(formData.consignees || []).map((c, idx) => (
              <div key={c.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Contact {idx + 1}</span>
                  <button type="button" onClick={() => removeContact(idx)}
                    className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
                    <input type="text" value={c.name} onChange={(e) => updateContact(idx, "name", e.target.value)}
                      placeholder="Full name" className={subInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                    <input type="text" value={c.contactPerson} onChange={(e) => updateContact(idx, "contactPerson", e.target.value)}
                      placeholder="e.g., Manager" className={subInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input type="text" value={c.phone} onChange={(e) => updateContact(idx, "phone", e.target.value)}
                      placeholder="+91 98765 43210" className={subInputCls} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Addresses */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Delivery Addresses
            {(formData.deliveryAddresses || []).length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                {formData.deliveryAddresses?.length}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={addAddress}
            className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add Address
          </button>
        </div>

        {(formData.deliveryAddresses || []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
            No addresses added. Click &ldquo;Add Address&rdquo; to add.
          </p>
        ) : (
          <div className="space-y-2">
            {(formData.deliveryAddresses || []).map((a, idx) => (
              <div key={a.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Address {idx + 1}</span>
                    {a.isDefault && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!a.isDefault && (
                      <button type="button" onClick={() => updateAddress(idx, "isDefault", true)}
                        className="text-xs text-blue-500 hover:underline">Set default</button>
                    )}
                    <button type="button" onClick={() => removeAddress(idx)}
                      className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label <span className="text-red-500">*</span></label>
                    <input type="text" value={a.label} onChange={(e) => updateAddress(idx, "label", e.target.value)}
                      placeholder="e.g., Main Factory, Warehouse" className={subInputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Address</label>
                    <input type="text" value={a.address} onChange={(e) => updateAddress(idx, "address", e.target.value)}
                      placeholder="Street / Plot / Survey No." className={subInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                    <input type="text" value={a.city} onChange={(e) => updateAddress(idx, "city", e.target.value)}
                      placeholder="Indore" className={subInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                    <input type="text" value={a.pincode} onChange={(e) => updateAddress(idx, "pincode", e.target.value)}
                      placeholder="452001" className={subInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person</label>
                    <input type="text" value={a.contactPerson} onChange={(e) => updateAddress(idx, "contactPerson", e.target.value)}
                      placeholder="Name" className={subInputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input type="text" value={a.phone} onChange={(e) => updateAddress(idx, "phone", e.target.value)}
                      placeholder="+91 98765 43210" className={subInputCls} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} disabled={isLoading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={isLoading}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
          {isLoading ? "Saving..." : initialData?.id ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
