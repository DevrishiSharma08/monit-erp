"use client";

import { useState, FormEvent } from "react";
import { Mill } from "@/data/mockData";

interface MillFormProps {
  initialData?: Partial<Mill>;
  onSubmit: (data: Partial<Mill>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MillForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: MillFormProps) {
  const [formData, setFormData] = useState<Partial<Mill>>({
    name: initialData?.name || "",
    shortCode: initialData?.shortCode || "",
    tallyLedgerName: initialData?.tallyLedgerName || "",
    contactPerson: initialData?.contactPerson || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    gst: initialData?.gst || "",
    location: initialData?.location || "",
    region: initialData?.region || "",
    leadTimeDays: initialData?.leadTimeDays || 0,
    creditDays: initialData?.creditDays || 0,
    defaultFreightType: initialData?.defaultFreightType || "To Pay",
    specialization: initialData?.specialization || [],
    paymentTerms: initialData?.paymentTerms || "",
    status: initialData?.status || "Active",
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "leadTimeDays" || name === "creditDays" ? Number(value) : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        {/* Mill Name */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mill Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., ITC Paperboards"
          />
        </div>

        {/* Short Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Short Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="shortCode"
            value={formData.shortCode}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., ITC"
          />
        </div>

        {/* Tally Ledger Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tally Ledger Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="tallyLedgerName"
            value={formData.tallyLedgerName}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Exact name from Tally"
          />
        </div>

        {/* Contact Person */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contact Person <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* GST Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GST Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="gst"
            value={formData.gst}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Location */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location (Full Address) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., Bhadrachalam, Telangana - 507118"
          />
        </div>

        {/* Region */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Region / State <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="region"
            value={formData.region}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., Telangana"
          />
        </div>

        {/* Lead Time Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lead Time (Days) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="leadTimeDays"
            value={formData.leadTimeDays || ""}
            onChange={handleChange}
            required
            min="0"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 15"
          />
        </div>

        {/* Credit Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credit Days <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="creditDays"
            value={formData.creditDays || ""}
            onChange={handleChange}
            required
            min="0"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 30"
          />
        </div>

        {/* Default Freight Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Freight Type <span className="text-red-500">*</span>
          </label>
          <select
            name="defaultFreightType"
            value={formData.defaultFreightType}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="To Pay">To Pay</option>
            <option value="Paid">Paid</option>
            <option value="Included">Included</option>
          </select>
        </div>

        {/* Payment Terms */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Terms
          </label>
          <input
            type="text"
            name="paymentTerms"
            value={formData.paymentTerms}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 30 Days from delivery"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : initialData?.id ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
