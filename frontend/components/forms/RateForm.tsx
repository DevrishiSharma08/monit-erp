"use client";

import { useState, FormEvent } from "react";
import {
  SalesRate, PurchaseRate,
  mockCustomers, mockMills, mockMaterials,
} from "@/data/mockData";
import { IndianRupee } from "lucide-react";

type RateData = Partial<SalesRate> | Partial<PurchaseRate>;

interface RateFormProps {
  type: "sales" | "purchase";
  initialData?: RateData;
  onSubmit: (data: RateData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RateForm({ type, initialData, onSubmit, onCancel, isLoading = false }: RateFormProps) {
  const isSales = type === "sales";

  const [formData, setFormData] = useState<RateData>({
    ...(isSales
      ? { customerId: (initialData as Partial<SalesRate>)?.customerId || "" }
      : { millId: (initialData as Partial<PurchaseRate>)?.millId || "" }),
    materialId: initialData?.materialId || "",
    materialCode: initialData?.materialCode || "",
    rate: initialData?.rate || 0,
    unit: initialData?.unit || "KG",
    effectiveFrom: initialData?.effectiveFrom || "",
    notes: initialData?.notes || "",
    status: initialData?.status || "Active",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "materialId") {
      const material = mockMaterials.find((m) => m.id === value);
      setFormData((prev) => ({
        ...prev,
        materialId: value,
        materialCode: material?.paperType || "",
        unit: (material?.unitType as "KG" | "Sheet") || "KG",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: name === "rate" ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const data = { ...formData };

    if (isSales) {
      const customer = mockCustomers.find((c) => c.id === (data as Partial<SalesRate>).customerId);
      (data as Partial<SalesRate>).customerName = customer?.company || customer?.name;
    } else {
      const mill = mockMills.find((m) => m.id === (data as Partial<PurchaseRate>).millId);
      (data as Partial<PurchaseRate>).millName = mill?.name;
    }

    onSubmit(data);
  };

  const activeCustomers = mockCustomers.filter((c) => c.status === "Active");
  const activeMills = mockMills.filter((m) => m.status === "Active");
  const activeMaterials = mockMaterials.filter((m) => m.status === "Active");

  const selectedMaterial = mockMaterials.find((m) => m.id === formData.materialId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        {/* Customer or Mill selector */}
        {isSales ? (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              name="customerId"
              value={(formData as Partial<SalesRate>).customerId || ""}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Select Customer</option>
              {activeCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mill <span className="text-red-500">*</span>
            </label>
            <select
              name="millId"
              value={(formData as Partial<PurchaseRate>).millId || ""}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Select Mill</option>
              {activeMills.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Material */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Material <span className="text-red-500">*</span>
          </label>
          <select
            name="materialId"
            value={formData.materialId || ""}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Select Material</option>
            {activeMaterials.map((m) => (
              <option key={m.id} value={m.id}>{m.paperType}</option>
            ))}
          </select>
          {selectedMaterial && (
            <p className="mt-1 text-[11px] text-gray-500">
              {selectedMaterial.millName} · {selectedMaterial.categoryName} · {selectedMaterial.gsm} GSM · {selectedMaterial.size}
            </p>
          )}
        </div>

        {/* Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rate (₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-600" />
            <input
              type="number"
              name="rate"
              value={formData.rate || ""}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-lg border-2 border-green-300 bg-green-50 pl-8 pr-3 py-2 text-sm font-medium text-gray-800 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-300"
            />
          </div>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <select
            name="unit"
            value={formData.unit || "KG"}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="KG">per KG</option>
            <option value="Sheet">per Sheet</option>
          </select>
        </div>

        {/* Effective From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
          <input
            type="date"
            name="effectiveFrom"
            value={formData.effectiveFrom || ""}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={formData.status || "Active"}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <input
            type="text"
            name="notes"
            value={formData.notes || ""}
            onChange={handleChange}
            placeholder="Optional remark (e.g., negotiated rate, special discount)"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
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
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : (initialData as any)?.id ? "Update Rate" : "Save Rate"}
        </button>
      </div>
    </form>
  );
}
