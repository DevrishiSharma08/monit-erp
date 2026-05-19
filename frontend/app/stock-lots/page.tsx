"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  stockLotApi, StockLotRow, StockLotDetailRow, UpdateStockLotDto,
  warehouseApi, WarehouseDropdown, WarehouseBinDto,
} from "@/lib/api-services";
import {
  Package, PackageCheck, PackageMinus, AlertTriangle, X,
  MoreVertical, Eye, Pencil, Trash2, Printer, CheckCircle2,
  MapPin, Loader2, RefreshCw, Plus, Minus, Warehouse,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { createPortal } from "react-dom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
  if (status === "Available")  return "bg-green-100 text-green-700 border-green-200";
  if (status === "Exhausted")  return "bg-gray-100 text-gray-500 border-gray-200";
  return "bg-orange-100 text-orange-700 border-orange-200"; // Partially/Fully Allocated, Blocked
}

function getQualityColor(grade: string) {
  if (grade === "A Grade") return "bg-green-50 text-green-700 border-green-200";
  if (grade === "B Grade") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (grade === "Damaged")  return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function printStockLot(lot: StockLotDetailRow) {
  const hasChain = !!(lot.customerName || lot.poNumber || lot.loadPlanNumber || lot.grnNumber);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Stock Lot — ${lot.lotNumber}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
    body{padding:28px;font-size:12px;color:#111}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:14px;margin-bottom:20px}
    .co{font-size:20px;font-weight:700;color:#1d4ed8}.co-sub{font-size:10px;color:#6b7280;margin-top:2px}
    .gt{text-align:right}.gt h2{font-size:16px;font-weight:700}.gt .num{font-size:15px;font-weight:700;color:#1d4ed8;margin-top:3px}
    .badge{display:inline-block;margin-top:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;background:#dcfce7;color:#15803d}
    .sec{margin-bottom:16px}.sec-t{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
    .f{background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:7px 9px}
    .fl{font-size:9px;color:#9ca3af;margin-bottom:2px}.fv{font-size:12px;font-weight:600;color:#111}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th{background:#f1f5f9;text-align:left;padding:7px 9px;font-size:10px;font-weight:600;color:#374151;border:1px solid #e2e8f0}
    td{padding:7px 9px;border:1px solid #e2e8f0;font-size:11px}
    .chain{background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:8px 12px;font-family:monospace;font-size:11px}
    .footer{margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;text-align:center;border-top:1px solid #e5e7eb;padding-top:16px}
    .sign{border-top:1px dashed #9ca3af;padding-top:5px;margin-top:28px;font-size:10px;color:#6b7280}
    @media print{body{padding:16px}}
  </style></head><body>
  <div class="hdr">
    <div><div class="co">MONIT PAPER AGENCY</div>
    <div class="co-sub">Paper Trading · Indore, Madhya Pradesh</div>
    <div class="co-sub">GST: 23XXXXX0000X1Z5 · Ph: +91-XXXXXXXXXX</div></div>
    <div class="gt"><h2>STOCK LOCATION RECORD</h2><div class="num">${lot.lotNumber}</div>
      <span class="badge">${lot.status}</span></div>
  </div>
  ${hasChain ? `<div class="sec"><div class="sec-t">Flow Chain</div>
    <div class="chain">${lot.customerName ? `${lot.customerName} → ` : ""}${lot.linkedSoNumber ? `SO: ${lot.linkedSoNumber} → ` : ""}${lot.poNumber ? `PO: ${lot.poNumber} → ` : ""}${lot.loadPlanNumber ? `TLP: ${lot.loadPlanNumber} → ` : ""}GRN: ${lot.grnNumber} → LOT: ${lot.lotNumber}</div>
  </div>` : ""}
  <div class="sec"><div class="sec-t">Lot Details</div>
    <div class="g3">
      <div class="f"><div class="fl">Lot Number</div><div class="fv" style="font-family:monospace">${lot.lotNumber}</div></div>
      <div class="f"><div class="fl">Received Date</div><div class="fv">${lot.grnDate}</div></div>
      <div class="f"><div class="fl">GRN #</div><div class="fv">${lot.grnNumber}</div></div>
      <div class="f"><div class="fl">FIFO Seq</div><div class="fv">#${lot.fifoSequence}</div></div>
      <div class="f"><div class="fl">Warehouse</div><div class="fv">${lot.warehouseName || "—"}</div></div>
      <div class="f"><div class="fl">Bin Location</div><div class="fv" style="font-family:monospace">${lot.binLocation || "—"}</div></div>
    </div>
  </div>
  <div class="sec"><div class="sec-t">Material</div>
    <div class="g3">
      <div class="f"><div class="fl">Paper</div><div class="fv">${lot.paper}</div></div>
      <div class="f"><div class="fl">GSM</div><div class="fv">${lot.gsm} GSM</div></div>
      <div class="f"><div class="fl">Size</div><div class="fv">${lot.size || "—"}</div></div>
      <div class="f"><div class="fl">Mill</div><div class="fv">${lot.millName}</div></div>
      <div class="f"><div class="fl">Quality</div><div class="fv">${lot.qualityGrade || "—"}</div></div>
      <div class="f"><div class="fl">Condition</div><div class="fv">${lot.condition || "—"}</div></div>
    </div>
  </div>
  <div class="sec"><div class="sec-t">Quantity Summary</div>
    <table><thead><tr><th>Opening Qty</th><th>Current Qty</th><th>Allocated</th><th>Available</th><th>Cost/Unit</th><th>Total Value</th></tr></thead>
    <tbody><tr>
      <td>${lot.openingQty.toLocaleString()}</td>
      <td style="font-weight:700">${lot.currentQty.toLocaleString()}</td>
      <td style="color:${lot.allocatedQty > 0 ? "#d97706" : "#9ca3af"}">${lot.allocatedQty > 0 ? lot.allocatedQty.toLocaleString() : "—"}</td>
      <td style="color:#15803d;font-weight:700">${lot.availableQty.toLocaleString()}</td>
      <td>${lot.costPerUnit ? "₹" + lot.costPerUnit.toLocaleString() : "—"}</td>
      <td style="font-weight:700">${lot.totalCost ? "₹" + lot.totalCost.toLocaleString() : "—"}</td>
    </tr></tbody></table>
  </div>
  ${lot.grnQcResult || lot.grnVehicleNumber || lot.tlpTransporter ? `<div class="sec"><div class="sec-t">GRN & Transport</div>
    <div class="g3">
      <div class="f"><div class="fl">GRN Date</div><div class="fv">${lot.grnDate}</div></div>
      <div class="f"><div class="fl">QC Result</div><div class="fv">${lot.grnQcResult || "—"}</div></div>
      <div class="f"><div class="fl">Condition</div><div class="fv">${lot.grnCondition || "—"}</div></div>
      <div class="f"><div class="fl">LR Number</div><div class="fv">${lot.grnLrNumber || "—"}</div></div>
      <div class="f"><div class="fl">Transporter</div><div class="fv">${lot.tlpTransporter || "—"}</div></div>
      <div class="f"><div class="fl">Vehicle #</div><div class="fv">${lot.grnVehicleNumber || "—"}</div></div>
    </div>
  </div>` : ""}
  <div class="footer">
    <div><div class="sign">Store Manager</div></div>
    <div><div class="sign">QC Verified By</div></div>
    <div><div class="sign">Authorised Signatory</div></div>
  </div>
  <div style="margin-top:20px;font-size:9px;color:#9ca3af;text-align:center">
    System-generated document · Printed ${new Date().toLocaleDateString("en-IN")} · ${lot.lotNumber}
  </div>
</body></html>`;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewStockLotModal({
  lotId,
  onEdit,
  onDelete,
  onClose,
}: {
  lotId: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [lot, setLot] = useState<StockLotDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    stockLotApi.getById(lotId).then(setLot).catch(console.error).finally(() => setLoading(false));
  }, [lotId]);

  if (loading) return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>, document.body
  );
  if (!lot) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-mono">{lot.lotNumber}</h2>
              <p className="text-xs text-gray-500">{lot.paper} · {lot.gsm}g · {lot.size} · {lot.millName}</p>
            </div>
            <span className={`ml-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(lot.status)}`}>{lot.status}</span>
            {lot.qualityGrade && (
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getQualityColor(lot.qualityGrade)}`}>{lot.qualityGrade}</span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5 space-y-4">

          {/* Flow Chain */}
          {(lot.customerName || lot.linkedSoNumber || lot.poNumber || lot.loadPlanNumber) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 mb-2">Flow Chain</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {lot.customerName && (
                  <>
                    <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{lot.customerName}</span>
                    <span className="text-blue-300">→</span>
                  </>
                )}
                {lot.linkedSoNumber && (
                  <>
                    <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">SO: {lot.linkedSoNumber}</span>
                    <span className="text-blue-300">→</span>
                  </>
                )}
                {lot.poNumber && (
                  <>
                    <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">PO: {lot.poNumber}</span>
                    <span className="text-blue-300">→</span>
                  </>
                )}
                {lot.loadPlanNumber && (
                  <>
                    <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">TLP: {lot.loadPlanNumber}</span>
                    <span className="text-blue-300">→</span>
                  </>
                )}
                <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">GRN: {lot.grnNumber}</span>
                <span className="text-blue-300">→</span>
                <span className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white font-mono">{lot.lotNumber}</span>
              </div>
            </div>
          )}

          {/* Lot Details + Storage Location side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Lot Details — 2/3 width */}
            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Lot Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Lot Number",    value: lot.lotNumber,          mono: true },
                  { label: "Received Date", value: lot.grnDate },
                  { label: "GRN #",         value: lot.grnNumber,          blue: true },
                  { label: "FIFO Seq",      value: `#${lot.fifoSequence}` },
                  { label: "Mill",          value: lot.millName },
                  { label: "Material",      value: `${lot.paper} · ${lot.gsm}g · ${lot.size || ""}` },
                ].map(({ label, value, blue, mono }) => (
                  <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] text-gray-400">{label}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${blue ? "text-blue-700" : "text-gray-900"} ${mono ? "font-mono" : ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Storage Location — 1/3 width */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Storage Location</p>
              {lot.warehouseName || lot.binLocation ? (
                <div className="h-full rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 flex-shrink-0">
                      <Warehouse className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-400 font-semibold uppercase">Warehouse</p>
                      <p className="text-sm font-bold text-indigo-900">{lot.warehouseName || "—"}</p>
                    </div>
                  </div>
                  {lot.binLocation && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 flex-shrink-0">
                        <MapPin className="h-4 w-4 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-indigo-400 font-semibold uppercase">Bin</p>
                        <p className="text-sm font-bold text-indigo-700 font-mono">{lot.binLocation}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full rounded-xl border border-amber-100 bg-amber-50 p-3 flex items-center gap-2 text-xs text-amber-700">
                  <MapPin className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <span>No bin assigned. Use "Assign Location".</span>
                </div>
              )}
            </div>
          </div>

          {/* Quantities */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Quantity Summary</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Opening Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Current Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-orange-600">Allocated</th>
                    <th className="px-3 py-2 text-right font-semibold text-green-700">Available</th>
                    {lot.costPerUnit != null && <th className="px-3 py-2 text-right font-semibold text-gray-500">Rate</th>}
                    {lot.costPerUnit != null && <th className="px-3 py-2 text-right font-semibold text-gray-500">Est. Value</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-3 py-2.5 text-gray-600">{lot.openingQty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">{lot.currentQty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={lot.allocatedQty > 0 ? "font-semibold text-orange-600" : "text-gray-300"}>
                        {lot.allocatedQty > 0 ? lot.allocatedQty.toLocaleString() : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700">{lot.availableQty.toLocaleString()}</td>
                    {lot.costPerUnit != null && <td className="px-3 py-2.5 text-right text-gray-600">₹{lot.costPerUnit.toLocaleString()}</td>}
                    {lot.costPerUnit != null && <td className="px-3 py-2.5 text-right font-semibold text-gray-900">₹{(lot.costPerUnit * lot.currentQty).toLocaleString()}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* GRN + TLP side by side */}
          {(lot.grnQcResult || lot.grnVehicleNumber || lot.tlpTruckNumber) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">GRN Details</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "GRN Date",   value: lot.grnDate },
                    { label: "QC Result",  value: lot.grnQcResult || "—" },
                    { label: "LR Number",  value: lot.grnLrNumber || "—", mono: true },
                    { label: "Condition",  value: lot.grnCondition || "—" },
                    { label: "Vehicle #",  value: lot.grnVehicleNumber || "—", mono: true },
                    { label: "PO #",       value: lot.poNumber, blue: true },
                  ].map(({ label, value, mono, blue }) => (
                    <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-[10px] text-gray-400">{label}</p>
                      <p className={`text-xs font-semibold text-gray-900 mt-0.5 ${mono ? "font-mono" : ""} ${blue ? "text-blue-700" : ""}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              {(lot.tlpTruckNumber || lot.tlpTransporter || lot.tlpOrigin) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Transport Plan</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Plan #",      value: lot.loadPlanNumber || "—", mono: true },
                      { label: "Plan Date",   value: lot.tlpDate || "—" },
                      { label: "Origin",      value: lot.tlpOrigin || "—" },
                      { label: "Transporter", value: lot.tlpTransporter || "—" },
                      { label: "Truck #",     value: lot.tlpTruckNumber || "—", mono: true },
                      { label: "TLP Status",  value: lot.tlpStatus || "—" },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-[10px] text-gray-400">{label}</p>
                        <p className={`text-xs font-semibold text-gray-900 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirm Delete */}
          {confirmDelete && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800 mb-1">Delete this stock lot?</p>
              <p className="text-xs text-red-600 mb-3">
                {lot.allocatedQty > 0
                  ? `Cannot delete — ${lot.allocatedQty.toLocaleString()} sheets are currently allocated.`
                  : `This will permanently remove ${lot.lotNumber}. This action cannot be undone.`}
              </p>
              {lot.allocatedQty === 0 && (
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={onDelete} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Yes, Delete</button>
                </div>
              )}
              {lot.allocatedQty > 0 && (
                <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700">OK</button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={() => printStockLot(lot)} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
              <MapPin className="h-3.5 w-3.5" /> Assign Location
            </button>
            <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Edit Modal (qty / quality adjustment only) ───────────────────────────────

function EditStockLotModal({
  lot,
  onSave,
  onClose,
}: {
  lot: StockLotRow;
  onSave: (dto: UpdateStockLotDto) => Promise<void>;
  onClose: () => void;
}) {
  const [currentQty, setCurrentQty] = useState(lot.currentQty);
  const [saving, setSaving] = useState(false);
  const newStatus = currentQty === 0 ? "Exhausted" : lot.allocatedQty > 0 ? "Allocated" : "Available";

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ currentQty: currentQty !== lot.currentQty ? currentQty : undefined });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Adjust Quantity</h2>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{lot.lotNumber}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          <label className="block text-xs font-medium text-gray-700 mb-1">Current Qty (Physical Count)</label>
          <input
            type="number" min={0} value={currentQty}
            onChange={(e) => setCurrentQty(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <span>Allocated: <span className="font-semibold text-orange-600">{lot.allocatedQty.toLocaleString()}</span></span>
            <span>→ Available: <span className="font-semibold text-green-600">{Math.max(0, currentQty - lot.allocatedQty).toLocaleString()}</span></span>
            <span>→ <span className={`font-semibold ${newStatus === "Exhausted" ? "text-gray-500" : newStatus === "Allocated" ? "text-orange-600" : "text-green-600"}`}>{newStatus}</span></span>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Assign Bin Modal ─────────────────────────────────────────────────────────

interface BinAssignRow {
  warehouseId: number | undefined;
  binId: number | undefined;
  rackId: number | undefined;
  qty: number;
}

function AssignBinModal({
  lot, warehouses, onSave, onClose,
}: {
  lot: StockLotRow;
  warehouses: WarehouseDropdown[];
  onSave: (dto: UpdateStockLotDto) => Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<BinAssignRow[]>([{
    warehouseId: lot.warehouseId ?? warehouses[0]?.id,
    binId: undefined,
    rackId: undefined,
    qty: lot.currentQty,
  }]);
  const [warehouseCache, setWarehouseCache] = useState<Record<number, WarehouseBinDto[]>>({});
  const [saving, setSaving] = useState(false);
  const [warnMode, setWarnMode] = useState(false);

  const loadWarehouse = useCallback(async (wid: number) => {
    if (warehouseCache[wid]) return;
    try {
      const wh = await warehouseApi.getById(wid);
      setWarehouseCache((prev) => ({ ...prev, [wid]: wh.bins }));
    } catch {}
  }, [warehouseCache]);

  useEffect(() => {
    const initWid = lot.warehouseId ?? warehouses[0]?.id;
    if (initWid) loadWarehouse(initWid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPhysical = lot.currentQty;
  const totalPlaced   = rows.reduce((s, r) => s + (r.qty || 0), 0);
  const remaining     = totalPhysical - totalPlaced;
  const pct           = totalPhysical > 0 ? Math.min(100, (totalPlaced / totalPhysical) * 100) : 0;
  const overPlaced    = totalPlaced > totalPhysical;

  const updateRow = useCallback((idx: number, field: keyof BinAssignRow, value: number | undefined) => {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: value };
      if (field === "warehouseId") { u.binId = undefined; u.rackId = undefined; }
      if (field === "binId")       { u.rackId = undefined; }
      return u;
    }));
    if (field === "warehouseId" && typeof value === "number") loadWarehouse(value);
  }, [loadWarehouse]);

  const addRow = () => {
    const rem = Math.max(0, remaining);
    const wid = warehouses[0]?.id;
    setRows((prev) => [...prev, { warehouseId: wid, binId: undefined, rackId: undefined, qty: rem }]);
    if (wid) loadWarehouse(wid);
  };

  const handleSave = async (confirmed = false) => {
    if (overPlaced) return;
    if (remaining > 0 && !confirmed) { setWarnMode(true); return; }
    setSaving(true);
    try {
      const primary = rows[0];
      await onSave({ warehouseId: primary.warehouseId, binLocationId: primary.binId });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
              <MapPin className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Assign Bin Location</h2>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">{lot.lotNumber} · {lot.paper} · {lot.gsm}g · {lot.size}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">

          {/* Physical qty summary */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex items-start justify-between mb-2.5">
              <div>
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Total Physical Quantity</p>
                <p className="text-2xl font-black text-indigo-900 mt-0.5">
                  {totalPhysical.toLocaleString()}
                  <span className="text-sm font-semibold text-indigo-400 ml-1">sheets</span>
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${overPlaced ? "text-red-600" : remaining === 0 ? "text-green-600" : "text-amber-600"}`}>
                  {totalPlaced.toLocaleString()} placed
                </p>
                <p className={`text-xs mt-0.5 ${overPlaced ? "text-red-500" : remaining === 0 ? "text-green-500" : "text-gray-400"}`}>
                  {overPlaced
                    ? `▲ ${(totalPlaced - totalPhysical).toLocaleString()} over limit`
                    : remaining > 0
                    ? `${remaining.toLocaleString()} unassigned`
                    : "Fully assigned ✓"}
                </p>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-indigo-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${overPlaced ? "bg-red-500" : remaining === 0 ? "bg-green-500" : "bg-indigo-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-indigo-400 mt-1.5">{pct.toFixed(0)}% assigned · {rows.length} location{rows.length !== 1 ? "s" : ""}</p>
          </div>

          {/* Assignment rows */}
          <div className="space-y-2">
            {rows.map((row, idx) => {
              const bins = row.warehouseId ? (warehouseCache[row.warehouseId] ?? []) : [];
              const selectedBin = bins.find((b) => b.id === row.binId);
              const racks = selectedBin?.racks.filter((r) => r.isActive) ?? [];
              const colSpan = racks.length > 0 ? "" : "sm:col-span-2";
              return (
                <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white flex-shrink-0">{idx + 1}</span>
                    <span className="text-xs font-semibold text-gray-600">Location {idx + 1}</span>
                    {rows.length > 1 && (
                      <button
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-auto rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className={colSpan}>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Warehouse</label>
                      <select
                        value={row.warehouseId ?? ""}
                        onChange={(e) => updateRow(idx, "warehouseId", e.target.value ? parseInt(e.target.value) : undefined)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none"
                      >
                        <option value="">Select…</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Bin</label>
                      <select
                        value={row.binId ?? ""}
                        onChange={(e) => updateRow(idx, "binId", e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={bins.length === 0}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-mono focus:border-indigo-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">{bins.length === 0 ? "No bins" : "Select…"}</option>
                        {bins.map((b) => <option key={b.id} value={b.id!}>{b.name}</option>)}
                      </select>
                    </div>
                    {racks.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Rack <span className="normal-case font-normal">(optional)</span></label>
                        <select
                          value={row.rackId ?? ""}
                          onChange={(e) => updateRow(idx, "rackId", e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-mono focus:border-indigo-400 focus:outline-none"
                        >
                          <option value="">None</option>
                          {racks.map((r) => <option key={r.id} value={r.id!}>{r.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Qty (sheets)</label>
                      <input
                        type="number" min={0}
                        value={row.qty || ""}
                        onChange={(e) => {
                          const n = parseInt(e.target.value);
                          setRows((prev) => prev.map((r, i) => i === idx ? { ...r, qty: isNaN(n) ? 0 : Math.max(0, n) } : r));
                        }}
                        className={`w-full rounded-lg border px-2 py-1.5 text-xs text-right font-semibold focus:outline-none ${
                          overPlaced ? "border-red-300 bg-red-50 focus:border-red-400" : "border-gray-300 bg-white focus:border-indigo-400"
                        }`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add location button */}
          {!overPlaced && remaining > 0 && (
            <button
              onClick={addRow}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 py-2.5 text-xs font-semibold text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Location
            </button>
          )}

          {/* Validation feedback */}
          {overPlaced && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 font-medium">
              Placed qty ({totalPlaced.toLocaleString()}) exceeds physical qty ({totalPhysical.toLocaleString()}). Reduce before saving.
            </div>
          )}
          {warnMode && !overPlaced && remaining > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠ {remaining.toLocaleString()} sheets unassigned</p>
              <p className="text-amber-600">Not all physical quantity has a bin. You can still save — unassigned stock remains in staging.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400">
            {remaining === 0 && !overPlaced ? "✓ All quantity assigned" : overPlaced ? "Fix over-placed qty" : `${remaining.toLocaleString()} sheets unassigned`}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            {warnMode && remaining > 0 ? (
              <button onClick={() => handleSave(true)} disabled={saving || overPlaced}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Anyway
              </button>
            ) : (
              <button onClick={() => handleSave(false)} disabled={saving || overPlaced}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Location
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({ onView, onEdit, onAssignBin, onPrint, onDelete }: {
  onView: () => void; onEdit: () => void; onAssignBin: () => void; onPrint: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const action = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); fn(); };

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 rounded-xl border border-gray-200 bg-white shadow-xl py-1">
          {[
            { label: "View Details",    icon: Eye,     fn: onView },
            { label: "Assign Location", icon: MapPin,  fn: onAssignBin },
            { label: "Adjust Qty",      icon: Pencil,  fn: onEdit },
            { label: "Print",           icon: Printer, fn: onPrint },
            { label: "Delete",          icon: Trash2,  fn: onDelete, red: true },
          ].map(({ label, icon: Icon, fn, red }) => (
            <button key={label} onClick={action(fn)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-gray-50 ${red ? "text-red-600 hover:bg-red-50" : "text-gray-700"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockLotsPage() {
  const [lots, setLots] = useState<StockLotRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<WarehouseDropdown[]>([]);

  const [viewId, setViewId] = useState<number | null>(null);
  const [editLot, setEditLot] = useState<StockLotRow | null>(null);
  const [binAssignLot, setBinAssignLot] = useState<StockLotRow | null>(null);
  const [showPendingBin, setShowPendingBin] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await stockLotApi.list({ page: p, pageSize });
      setLots(res.items);
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
    warehouseApi.dropdown().then(setWarehouses).catch(console.error);
  }, [load]);

  // ── Pending bin (lots without bin assignment) ──────────────────────────────

  const pendingBin = useMemo(() => lots.filter((l) => !l.binLocation), [lots]);

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const available  = lots.filter((l) => l.status === "Available").length;
    const allocated  = lots.filter((l) => l.status !== "Available" && l.status !== "Exhausted").length;
    const exhausted  = lots.filter((l) => l.status === "Exhausted").length;
    const totalQty   = lots.reduce((s, l) => s + l.currentQty, 0);
    const availQty   = lots.reduce((s, l) => s + l.availableQty, 0);
    return { total: lots.length, available, allocated, exhausted, totalQty, availQty };
  }, [lots]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleEdit = async (dto: UpdateStockLotDto) => {
    if (!editLot) return;
    await stockLotApi.update(editLot.id, dto);
    setEditLot(null);
    load(page);
  };

  const handleDelete = async (id: number) => {
    await stockLotApi.remove(id);
    setViewId(null);
    load(page);
  };

  const handlePrintRow = async (id: number) => {
    try {
      const detail = await stockLotApi.getById(id);
      printStockLot(detail);
    } catch (e) {
      console.error(e);
    }
  };

  // ── Status/quality filter options ──────────────────────────────────────────

  const statusOptions = [
    { label: "Available",          value: "Available" },
    { label: "Allocated",          value: "Allocated" },
    { label: "Partially Allocated",value: "Partially Allocated" },
    { label: "Exhausted",          value: "Exhausted" },
  ];
  const qualityOptions = [
    { label: "A Grade", value: "A Grade" },
    { label: "B Grade", value: "B Grade" },
    { label: "Damaged", value: "Damaged" },
  ];

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnConfig<StockLotRow>[] = useMemo(() => [
    {
      id: "lotNumber", accessorKey: "lotNumber", header: "Lot Number",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 150,
      cell: (info) => <span className="font-mono font-medium text-gray-900 text-xs">{info.getValue() as string}</span>,
    },
    {
      id: "grnDate", accessorKey: "grnDate", header: "Received",
      filterType: "date", enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => {
        const d = new Date(info.getValue() as string);
        const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
        return (
          <div>
            <div className="text-sm text-gray-900">{info.getValue() as string}</div>
            <div className="text-xs text-gray-400">{days}d ago</div>
          </div>
        );
      },
    },
    {
      id: "paper", accessorKey: "paper", header: "Paper",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 180,
    },
    {
      id: "gsm", accessorKey: "gsm", header: "GSM",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 80,
      cell: (info) => <span>{info.getValue() as number} GSM</span>,
    },
    {
      id: "size", accessorKey: "size", header: "Size",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 100,
    },
    {
      id: "millName", accessorKey: "millName", header: "Mill",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
    },
    {
      id: "warehouseName", accessorKey: "warehouseName", header: "Warehouse",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => <span>{(info.getValue() as string) || <span className="text-gray-300">—</span>}</span>,
    },
    {
      id: "binLocation", accessorKey: "binLocation", header: "Bin Location",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className="font-mono text-xs text-blue-600">{v}</span>
          : <span className="text-xs text-amber-500 font-medium">Unassigned</span>;
      },
    },
    {
      id: "openingQty", accessorKey: "openingQty", header: "Opening",
      filterType: "none", enableSorting: true, defaultVisible: false, size: 100,
      cell: (info) => <span className="text-gray-500">{(info.getValue() as number).toLocaleString()}</span>,
    },
    {
      id: "currentQty", accessorKey: "currentQty", header: "Current Qty",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => <span className="font-medium text-gray-900">{(info.getValue() as number).toLocaleString()}</span>,
    },
    {
      id: "allocatedQty", accessorKey: "allocatedQty", header: "Allocated",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 110,
      cell: (info) => {
        const qty = info.getValue() as number;
        return qty > 0
          ? <span className="text-orange-600 font-medium">{qty.toLocaleString()}</span>
          : <span className="text-gray-300">—</span>;
      },
    },
    {
      id: "availableQty", accessorKey: "availableQty", header: "Available",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 110,
      cell: (info) => (
        <span className="font-semibold text-green-600">{(info.getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: "qualityGrade", accessorKey: "qualityGrade", header: "Quality",
      filterType: "select", filterOptions: qualityOptions,
      enableSorting: true, defaultVisible: true, size: 110,
      cell: (info) => {
        const v = info.getValue() as string | undefined;
        return v
          ? <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getQualityColor(v)}`}>{v}</span>
          : <span className="text-gray-300">—</span>;
      },
    },
    {
      id: "status", accessorKey: "status", header: "Status",
      filterType: "select", filterOptions: statusOptions,
      enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => {
        const s = info.getValue() as string;
        return (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${getStatusColor(s)}`}>{s}</span>
        );
      },
    },
    {
      id: "grnNumber", accessorKey: "grnNumber", header: "GRN #",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="text-blue-600 font-medium font-mono text-xs">{info.getValue() as string}</span>,
    },
    {
      id: "poNumber", accessorKey: "poNumber", header: "PO #",
      filterType: "text", enableSorting: false, defaultVisible: false, size: 130,
      cell: (info) => <span className="text-gray-600 font-mono text-xs">{info.getValue() as string}</span>,
    },
    {
      id: "fifoSequence", accessorKey: "fifoSequence", header: "FIFO",
      filterType: "none", enableSorting: true, defaultVisible: false, size: 70,
      cell: (info) => <span className="text-gray-400 text-xs">#{info.getValue() as number}</span>,
    },
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48,
      cell: (info) => {
        const lot = info.row.original;
        return (
          <RowActions
            onView={() => setViewId(lot.id)}
            onAssignBin={() => setBinAssignLot(lot)}
            onEdit={() => setEditLot(lot)}
            onPrint={() => handlePrintRow(lot.id)}
            onDelete={async () => { if (confirm(`Delete lot ${lot.lotNumber}?`)) await handleDelete(lot.id); }}
          />
        );
      },
    },
  ], [qualityOptions, statusOptions]);

  return (
    <div className="space-y-6 pb-24">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">

        {/* Pending Bin */}
        <button
          onClick={() => setShowPendingBin((v) => !v)}
          className={`rounded-xl p-4 text-left transition-all shadow-sm relative overflow-hidden ${
            showPendingBin
              ? "bg-amber-600 shadow-amber-200 shadow-lg"
              : pendingBin.length > 0
              ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-100 shadow-md hover:shadow-lg hover:-translate-y-0.5"
              : "bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200"
          }`}
        >
          {pendingBin.length > 0 && !showPendingBin && (
            <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${pendingBin.length > 0 || showPendingBin ? "text-white/80" : "text-gray-400"}`}>Pending Bin</p>
              <p className={`mt-1.5 text-3xl font-black ${pendingBin.length > 0 || showPendingBin ? "text-white" : "text-gray-500"}`}>{pendingBin.length}</p>
              <p className={`mt-0.5 text-xs font-medium ${pendingBin.length > 0 || showPendingBin ? "text-white/70" : "text-gray-400"}`}>
                {showPendingBin ? "Click to hide" : pendingBin.length > 0 ? "Needs bin" : "All assigned"}
              </p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-full ${pendingBin.length > 0 || showPendingBin ? "bg-white/20" : "bg-gray-200"}`}>
              <MapPin className={`h-5 w-5 ${pendingBin.length > 0 || showPendingBin ? "text-white" : "text-gray-400"}`} />
            </div>
          </div>
        </button>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Lots</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.total}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50"><Package className="h-5 w-5 text-blue-500" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Available</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.available}</p>
              <p className="mt-0.5 text-xs text-green-600">Lots ready</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50"><PackageCheck className="h-5 w-5 text-green-500" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Allocated</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.allocated}</p>
              <p className="mt-0.5 text-xs text-orange-600">Reserved</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50"><AlertTriangle className="h-5 w-5 text-orange-500" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Exhausted</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.exhausted}</p>
              <p className="mt-0.5 text-xs text-gray-500">Empty lots</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50"><PackageMinus className="h-5 w-5 text-gray-400" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Stock</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">{(kpis.totalQty / 1000).toFixed(1)}K</p>
            <p className="mt-0.5 text-xs text-gray-500">Available: <span className="font-semibold text-green-600">{(kpis.availQty / 1000).toFixed(1)}K</span></p>
          </div>
        </div>
      </div>

      {/* Pending Bin Panel */}
      {showPendingBin && (
        <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-indigo-100 bg-indigo-50">
            <MapPin className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-indigo-900">Lots Without Bin Assignment</h2>
            <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">{pendingBin.length}</span>
            <p className="ml-2 text-xs text-indigo-500">Click Edit to assign a bin location</p>
          </div>
          {pendingBin.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">All lots have bin locations assigned.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Lot #", "GRN #", "Material", "Current Qty", "Warehouse", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingBin.map((lot) => (
                    <tr key={lot.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900 text-xs">{lot.lotNumber}</td>
                      <td className="px-4 py-3 font-mono font-medium text-blue-600 text-xs">{lot.grnNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{lot.paper}</p>
                        <p className="text-xs text-gray-500">{lot.gsm}g · {lot.size}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{lot.currentQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-700">{lot.warehouseName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${getStatusColor(lot.status)}`}>{lot.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setBinAssignLot(lot)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                          <MapPin className="h-3 w-3" /> Assign Bin
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {!showPendingBin && (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-xl">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}
          <DataGrid
            data={lots}
            columns={columns}
            tableName="stock-lots"
            enableFilters={true}
            enablePagination={true}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            initialPageSize={pageSize}
            onRowClick={(lot) => setViewId(lot.id)}
            emptyMessage="No stock locations found. Stock entries are created automatically when a GRN is processed."
          />
          <div className="flex items-center justify-between px-1 pt-2 text-xs text-gray-400">
            <span>{total.toLocaleString()} total entries</span>
            <button onClick={() => load(page)} className="flex items-center gap-1 hover:text-gray-600">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewId !== null && (
        <ViewStockLotModal
          lotId={viewId}
          onEdit={() => {
            const lot = lots.find((l) => l.id === viewId);
            if (lot) { setBinAssignLot(lot); setViewId(null); }
          }}
          onDelete={() => handleDelete(viewId)}
          onClose={() => setViewId(null)}
        />
      )}

      {/* Qty Adjust Modal */}
      {editLot && (
        <EditStockLotModal
          lot={editLot}
          onSave={handleEdit}
          onClose={() => setEditLot(null)}
        />
      )}

      {/* Bin Assignment Modal */}
      {binAssignLot && (
        <AssignBinModal
          lot={binAssignLot}
          warehouses={warehouses}
          onSave={async (dto) => {
            await stockLotApi.update(binAssignLot.id, dto);
            setBinAssignLot(null);
            load(page);
          }}
          onClose={() => setBinAssignLot(null)}
        />
      )}
    </div>
  );
}
