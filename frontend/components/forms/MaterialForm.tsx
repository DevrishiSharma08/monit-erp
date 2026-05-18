"use client";

import { useState, FormEvent, useMemo, useEffect } from "react";
import { Material, mockMills, mockCategories } from "@/data/mockData";

interface MaterialFormProps {
  initialData?: Partial<Material>;
  onSubmit: (data: Partial<Material>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MaterialForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: MaterialFormProps) {
  const [formData, setFormData] = useState<Partial<Material>>({
    millId: initialData?.millId || "",
    categoryId: initialData?.categoryId || "",
    gsm: initialData?.gsm || 0,
    length: initialData?.length || 0,
    width: initialData?.width || 0,
    packingType: initialData?.packingType || "Sheet",
    sheetsPerPack: initialData?.sheetsPerPack || 0,
    unitType: initialData?.unitType || "KG",
    conversionFactor: initialData?.conversionFactor || 0,
    description: initialData?.description || "",
    status: initialData?.status || "Active",
  });

  // Auto-compute size from length x width
  const computedSize = useMemo(() => {
    if (formData.length && formData.width) {
      return `${formData.length}x${formData.width}`;
    }
    return "";
  }, [formData.length, formData.width]);

  // Auto-compute paperType from Mill/Category/GSM/Size/Packing
  const computedPaperType = useMemo(() => {
    const mill = mockMills.find((m) => m.id === formData.millId);
    const category = mockCategories.find((c) => c.id === formData.categoryId);

    if (mill && category && formData.gsm && computedSize && formData.packingType) {
      return `${mill.name}/${category.name}/${formData.gsm}/${computedSize}/${formData.packingType}`;
    }
    return "";
  }, [formData.millId, formData.categoryId, formData.gsm, computedSize, formData.packingType]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Get mill and category names for display
    const mill = mockMills.find((m) => m.id === formData.millId);
    const category = mockCategories.find((c) => c.id === formData.categoryId);

    const submitData: Partial<Material> = {
      ...formData,
      size: computedSize,
      paperType: computedPaperType,
      millName: mill?.name,
      categoryName: category?.name,
    };

    onSubmit(submitData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "gsm" || name === "length" || name === "width" || name === "conversionFactor" || name === "sheetsPerPack"
          ? Number(value)
          : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Mill Dropdown */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mill <span className="text-red-500">*</span>
          </label>
          <select
            name="millId"
            value={formData.millId}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Select Mill</option>
            {mockMills.map((mill) => (
              <option key={mill.id} value={mill.id}>
                {mill.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Dropdown */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            name="categoryId"
            value={formData.categoryId}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Select Category</option>
            {mockCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* GSM */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GSM <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="gsm"
            value={formData.gsm || ""}
            onChange={handleChange}
            required
            min="0"
            step="1"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 300"
          />
        </div>

        {/* Packing Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Packing Type <span className="text-red-500">*</span>
          </label>
          <select
            name="packingType"
            value={formData.packingType}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="Sheet">Sheet</option>
            <option value="Reel">Reel</option>
          </select>
        </div>

        {/* Sheets per Pack — only for Sheet packing type */}
        {formData.packingType === "Sheet" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sheets per Pack <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="sheetsPerPack"
              value={formData.sheetsPerPack || ""}
              onChange={handleChange}
              required
              min="1"
              step="1"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="e.g., 100 or 500"
            />
            <p className="mt-1 text-xs text-gray-500">How many sheets are wrapped in one pack</p>
          </div>
        )}

        {/* Length */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Length (cm) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="length"
            value={formData.length || ""}
            onChange={handleChange}
            required
            min="0"
            step="0.1"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 23"
          />
        </div>

        {/* Width */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Width (cm) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="width"
            value={formData.width || ""}
            onChange={handleChange}
            required
            min="0"
            step="0.1"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 36"
          />
        </div>

        {/* Computed Size (Read-only) */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Size (Auto-computed)
          </label>
          <input
            type="text"
            value={computedSize}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600"
            placeholder="Will be computed from Length x Width"
          />
        </div>

        {/* Unit Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit Type <span className="text-red-500">*</span>
          </label>
          <select
            name="unitType"
            value={formData.unitType}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="KG">KG</option>
            <option value="Sheet">Sheet</option>
          </select>
        </div>

        {/* Conversion Factor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Conversion Factor <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="conversionFactor"
            value={formData.conversionFactor || ""}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="e.g., 0.45 (KG per unit)"
          />
        </div>

        {/* Computed Paper Type (Read-only) */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Material Code (Auto-computed)
          </label>
          <input
            type="text"
            value={computedPaperType}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600"
            placeholder="Will be computed as Mill/Category/GSM/Size/Packing"
          />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Enter material description..."
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

