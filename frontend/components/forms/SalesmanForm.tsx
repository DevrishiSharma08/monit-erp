"use client";

import { useState, FormEvent } from "react";
import { Salesman, mockMills, mockCategories } from "@/data/mockData";
import { Plus, Trash2 } from "lucide-react";

interface SalesmanFormProps {
  initialData?: Partial<Salesman>;
  onSubmit: (data: Partial<Salesman>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface TargetLine {
  id: string;
  type: "quantity" | "product" | "mill";
  millId?: string;
  categoryId?: string;
  targetQty: number;
  unit: "KG" | "Sheet";
}

export function SalesmanForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: SalesmanFormProps) {
  const [formData, setFormData] = useState<Partial<Salesman>>({
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    territory: initialData?.territory || "",
    monthlyTarget: initialData?.monthlyTarget || 0,
    status: initialData?.status || "Active",
  });

  const [targets, setTargets] = useState<TargetLine[]>([
    { id: "1", type: "quantity", targetQty: 0, unit: "KG" },
  ]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Summarize total target qty for backward compat
    const totalQty = targets.reduce((sum, t) => sum + t.targetQty, 0);
    onSubmit({ ...formData, monthlyTarget: totalQty });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addTarget = () => {
    setTargets((prev) => [
      ...prev,
      { id: String(Date.now()), type: "quantity", targetQty: 0, unit: "KG" },
    ]);
  };

  const removeTarget = (id: string) => {
    setTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTarget = (id: string, field: keyof TargetLine, value: any) => {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const targetColors = [
    "border-l-indigo-400 bg-indigo-50/30",
    "border-l-teal-400 bg-teal-50/30",
    "border-l-amber-400 bg-amber-50/30",
    "border-l-rose-400 bg-rose-50/30",
    "border-l-sky-400 bg-sky-50/30",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

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
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

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
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Territory / Area <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="territory"
            value={formData.territory}
            onChange={handleChange}
            required
            placeholder="e.g., Indore City, Pithampur Industrial Area"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

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

      {/* Monthly Targets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Monthly Targets (Quantity Based)
          </h3>
          <button
            type="button"
            onClick={addTarget}
            className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Target
          </button>
        </div>

        <div className="space-y-2">
          {targets.map((target, idx) => {
            const color = targetColors[idx % targetColors.length];
            return (
              <div
                key={target.id}
                className={`rounded-lg border border-gray-200 border-l-4 ${color} p-3`}
              >
                <div className="grid grid-cols-12 gap-3 items-end">
                  {/* Target Type */}
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Target Type
                    </label>
                    <select
                      value={target.type}
                      onChange={(e) => updateTarget(target.id, "type", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="quantity">Overall Quantity</option>
                      <option value="product">By Product Category</option>
                      <option value="mill">By Mill</option>
                    </select>
                  </div>

                  {/* Mill (conditional) */}
                  {target.type === "mill" && (
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Mill
                      </label>
                      <select
                        value={target.millId || ""}
                        onChange={(e) => updateTarget(target.id, "millId", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select Mill</option>
                        {mockMills.filter((m) => m.status === "Active").map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Category (conditional) */}
                  {target.type === "product" && (
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Product Category
                      </label>
                      <select
                        value={target.categoryId || ""}
                        onChange={(e) => updateTarget(target.id, "categoryId", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select Category</option>
                        {mockCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Spacer for "quantity" type */}
                  {target.type === "quantity" && <div className="col-span-3" />}

                  {/* Target Qty */}
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Target Quantity
                    </label>
                    <input
                      type="number"
                      value={target.targetQty || ""}
                      onChange={(e) => updateTarget(target.id, "targetQty", parseFloat(e.target.value) || 0)}
                      min="0"
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="e.g., 50000"
                    />
                  </div>

                  {/* Unit */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Unit
                    </label>
                    <select
                      value={target.unit}
                      onChange={(e) => updateTarget(target.id, "unit", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="KG">KG</option>
                      <option value="Sheet">Sheets</option>
                    </select>
                  </div>

                  {/* Remove */}
                  <div className="col-span-1 flex justify-end">
                    {targets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTarget(target.id)}
                        className="rounded-lg bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total summary */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-sm text-gray-600">
          Total target lines: <span className="font-semibold text-gray-900">{targets.length}</span>
          {" · "}
          Combined qty: <span className="font-semibold text-gray-900">
            {targets.reduce((s, t) => s + t.targetQty, 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Actions */}
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
