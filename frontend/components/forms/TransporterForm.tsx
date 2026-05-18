"use client";

import { useState, FormEvent } from "react";
import { Transporter } from "@/data/mockData";

interface TransporterFormProps {
  initialData?: Partial<Transporter>;
  onSubmit: (data: Partial<Transporter>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TransporterForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: TransporterFormProps) {
  const [formData, setFormData] = useState<Partial<Transporter>>({
    name: initialData?.name || "",
    tallyLedgerName: initialData?.tallyLedgerName || "",
    contactPerson: initialData?.contactPerson || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    areaCovered: initialData?.areaCovered || "",
    vehicleTypes: initialData?.vehicleTypes || "",
    numberPlate: initialData?.numberPlate || "",
    ratePerMT: initialData?.ratePerMT || 0,
    serviceRating: initialData?.serviceRating || 5,
    status: initialData?.status || "Active",
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "ratePerMT" || name === "serviceRating" ? Number(value) : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Transporter Name */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transporter Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., Fast Track Logistics Pvt Ltd"
          />
        </div>

        {/* Tally Ledger Name */}
        <div className="col-span-2">
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
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Area Covered */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Area Covered <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="areaCovered"
            value={formData.areaCovered}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., Indore, Ujjain, Dewas, Ratlam"
          />
        </div>

        {/* Vehicle Types */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vehicle Types <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="vehicleTypes"
            value={formData.vehicleTypes}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 32ft Truck, 20ft Container"
          />
        </div>

        {/* Number Plate */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number Plate(s)
          </label>
          <input
            type="text"
            name="numberPlate"
            value={formData.numberPlate || ""}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 uppercase"
            placeholder="e.g., MH14CD9999, MP09AB1234"
          />
        </div>

        {/* Rate per MT */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rate per MT (₹) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="ratePerMT"
            value={formData.ratePerMT || ""}
            onChange={handleChange}
            required
            min="0"
            step="10"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 1500"
          />
        </div>

        {/* Service Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Rating (1-5)
          </label>
          <select
            name="serviceRating"
            value={formData.serviceRating}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Good</option>
            <option value="3">3 - Average</option>
            <option value="2">2 - Below Average</option>
            <option value="1">1 - Poor</option>
          </select>
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
      <div className="flex justify-end gap-3 pt-4">
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
