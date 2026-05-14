"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { GRN, TruckLoadPlan, PurchaseOrder, StockLot } from "@/data/mockData";
import { useStock } from "@/context/StockContext";
import { usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { useSalesOrder } from "@/context/SalesOrderContext";
import {
  PackageCheck, Clock, AlertTriangle, CheckCircle, X, FileText,
  Truck, User, MapPin, Hash, Calendar, ShieldCheck, ClipboardCheck,
  Weight, Ban, Plus, Printer, Search, MoreVertical, Eye, Pencil,
  Trash2, CheckCircle2,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { createPortal } from "react-dom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    "QC Pending": "bg-yellow-100 text-yellow-700 border-yellow-200",
    Approved: "bg-blue-100 text-blue-700 border-blue-200",
    "Stock Updated": "bg-green-100 text-green-700 border-green-200",
    "Discrepancy Raised": "bg-red-100 text-red-700 border-red-200",
  };
  return map[status] || "bg-gray-100 text-gray-700 border-gray-200";
}

function getQcColor(qc: string) {
  const map: Record<string, string> = {
    Accepted: "bg-green-100 text-green-700 border-green-200",
    "Accepted with Remark": "bg-yellow-100 text-yellow-700 border-yellow-200",
    Rejected: "bg-red-100 text-red-700 border-red-200",
    Hold: "bg-orange-100 text-orange-700 border-orange-200",
  };
  return map[qc] || "bg-gray-100 text-gray-700";
}

function genGrnNumber() {
  return `GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function genLotNumber(mill: string, paper: string, gsm: number, size: string) {
  const d = new Date().toISOString().split("T")[0].replace(/-/g, "");
  return `${mill.replace(/\s/g, "").substring(0, 3).toUpperCase()}-${paper.replace(/\s/g, "").substring(0, 4).toUpperCase()}-${gsm}-${size}-${d}-001`;
}

function printGRN(grn: GRN) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>GRN — ${grn.grnNumber}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
    body{padding:28px;font-size:12px;color:#111}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:14px;margin-bottom:20px}
    .co{font-size:20px;font-weight:700;color:#1d4ed8}.co-sub{font-size:10px;color:#6b7280;margin-top:2px}
    .gt{text-align:right}.gt h2{font-size:16px;font-weight:700}.gt .num{font-size:15px;font-weight:700;color:#1d4ed8;margin-top:3px}
    .st{display:inline-block;margin-top:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;background:#dcfce7;color:#15803d}
    .sec{margin-bottom:16px}.sec-t{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
    .f{background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:7px 9px}
    .fl{font-size:9px;color:#9ca3af;margin-bottom:2px}.fv{font-size:12px;font-weight:600;color:#111}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th{background:#f1f5f9;text-align:left;padding:7px 9px;font-size:10px;font-weight:600;color:#374151;border:1px solid #e2e8f0}
    td{padding:7px 9px;border:1px solid #e2e8f0;font-size:11px}
    tr:nth-child(even) td{background:#f9fafb}
    .footer{margin-top:24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;text-align:center;border-top:1px solid #e5e7eb;padding-top:16px}
    .sign{border-top:1px dashed #9ca3af;padding-top:5px;margin-top:28px;font-size:10px;color:#6b7280}
    @media print{body{padding:16px}}
  </style></head><body>
  <div class="hdr">
    <div><div class="co">MONIT PAPER AGENCY</div>
    <div class="co-sub">Paper Trading · Indore, Madhya Pradesh</div>
    <div class="co-sub">GST: 23XXXXX0000X1Z5 · Ph: +91-XXXXXXXXXX</div></div>
    <div class="gt"><h2>GOODS RECEIPT NOTE</h2><div class="num">${grn.grnNumber}</div><span class="st">${grn.status}</span></div>
  </div>
  <div class="sec"><div class="sec-t">GRN Details</div>
    <div class="g3">
      <div class="f"><div class="fl">GRN Date</div><div class="fv">${grn.grnDate}</div></div>
      <div class="f"><div class="fl">PO Reference</div><div class="fv">${grn.poNumber}</div></div>
      <div class="f"><div class="fl">Mill / Supplier</div><div class="fv">${grn.mill}</div></div>
      <div class="f"><div class="fl">Mill Challan #</div><div class="fv">${grn.millChallanNumber || "—"}</div></div>
      <div class="f"><div class="fl">Purchase Invoice</div><div class="fv">${grn.purchaseInvoiceNumber || "—"}</div></div>
      <div class="f"><div class="fl">Warehouse</div><div class="fv">${grn.warehouse}</div></div>
    </div>
  </div>
  <div class="sec"><div class="sec-t">Material Details</div>
    <table><thead><tr><th>Paper</th><th>GSM</th><th>Size</th><th>Ordered</th><th>Received</th><th>Short</th><th>Damaged</th><th>Balance</th></tr></thead>
    <tbody><tr>
      <td><strong>${grn.paper}</strong></td><td>${grn.gsm} GSM</td><td>${grn.size}</td>
      <td style="text-align:right">${grn.orderedQty.toLocaleString()}</td>
      <td style="text-align:right;color:#15803d;font-weight:700">${grn.receivedQty.toLocaleString()}</td>
      <td style="text-align:right;color:${grn.shortQty > 0 ? "#d97706" : "#9ca3af"}">${grn.shortQty.toLocaleString()}</td>
      <td style="text-align:right;color:${grn.damagedQty > 0 ? "#b91c1c" : "#9ca3af"}">${grn.damagedQty.toLocaleString()}</td>
      <td style="text-align:right;font-weight:700;color:${grn.balanceQty > 0 ? "#b91c1c" : "#15803d"}">${grn.balanceQty > 0 ? grn.balanceQty.toLocaleString() : "NIL"}</td>
    </tr></tbody></table>
  </div>
  <div class="sec"><div class="sec-t">Transport & Logistics</div>
    <div class="g2">
      <div class="f"><div class="fl">LR Number</div><div class="fv">${grn.lrNumber || "—"}</div></div>
      <div class="f"><div class="fl">Transporter</div><div class="fv">${grn.transporterName || "—"}</div></div>
      <div class="f"><div class="fl">Vehicle Number</div><div class="fv">${grn.vehicleNumber || "—"}</div></div>
      <div class="f"><div class="fl">Received By</div><div class="fv">${grn.receivedBy || "—"}</div></div>
    </div>
  </div>
  <div class="sec"><div class="sec-t">Quality Check</div>
    <div class="g3">
      <div class="f"><div class="fl">Condition</div><div class="fv">${grn.condition}</div></div>
      <div class="f"><div class="fl">QC Result</div><div class="fv">${grn.qcResult}</div></div>
      <div class="f"><div class="fl">Quality Grade</div><div class="fv">${grn.qualityGrade}</div></div>
      <div class="f"><div class="fl">Lot Number</div><div class="fv" style="font-family:monospace">${grn.lotNumber}</div></div>
      <div class="f"><div class="fl">Bin Location</div><div class="fv" style="font-family:monospace">${grn.binLocation || grn.suggestedBin || "—"}</div></div>
      ${grn.verifiedBy ? `<div class="f"><div class="fl">Verified By</div><div class="fv">${grn.verifiedBy} · ${grn.verifiedDate}</div></div>` : ""}
    </div>
    ${grn.remarks ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:5px;padding:8px;margin-top:6px;font-size:11px;color:#78350f"><strong>Remarks:</strong> ${grn.remarks}</div>` : ""}
  </div>
  <div class="footer">
    <div><div class="sign">Received By (Godown)</div></div>
    <div><div class="sign">QC Checked By</div></div>
    <div><div class="sign">Authorised Signatory</div></div>
  </div>
  <div style="margin-top:20px;font-size:9px;color:#9ca3af;text-align:center">
    System-generated document · Printed ${new Date().toLocaleDateString("en-IN")} · ${grn.grnNumber}
  </div>
</body></html>`;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Create GRN Modal ─────────────────────────────────────────────────────────

interface ItemFormState {
  receivedQty: number;
  damagedQty: number;
  qcResult: GRN["qcResult"];
}

interface CreateGRNModalProps {
  tlp: TruckLoadPlan;
  soCustomer?: string;
  soNumber?: string;
  soDeliveryAddress?: string;
  soLines?: { paper: string; gsm: number; size: string; orderedQty: number; rate: number }[];
  purchaseOrders?: PurchaseOrder[];
  onSave: (grns: GRN[]) => void;
  onClose: () => void;
}

function CreateGRNModal({ tlp, soCustomer, soNumber, soDeliveryAddress, purchaseOrders, onSave, onClose }: CreateGRNModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [confirming, setConfirming] = useState(false);

  const poData = useMemo(() =>
    tlp.items.map((item) => {
      const po = purchaseOrders?.find((p) => p.poNumber === item.poNumber);
      const poItem = (po?.items as any[] | undefined)?.find((pi: any) => pi.gsm === item.gsm && pi.size === item.size);
      return { rate: (poItem?.rate ?? 0) as number, orderedQty: (poItem?.orderedQty ?? item.quantity) as number };
    }),
    [tlp.items, purchaseOrders]
  );

  const [itemForms, setItemForms] = useState<ItemFormState[]>(() =>
    tlp.items.map((item) => ({ receivedQty: item.quantity, damagedQty: 0, qcResult: "Accepted" as GRN["qcResult"] }))
  );

  const [form, setForm] = useState({
    lrNumber: "",
    transporterName: tlp.transporterName || "",
    vehicleNumber: tlp.truckNumber || "",
    receivedBy: "",
    millChallanNumber: "",
    purchaseInvoiceNumber: "",
    condition: "Good" as GRN["condition"],
    qualityGrade: "A Grade" as GRN["qualityGrade"],
    warehouse: "Lasudia",
    remarks: "",
  });

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v })), []);
  const setItem = useCallback((idx: number, field: keyof ItemFormState, value: number | string) =>
    setItemForms((forms) => forms.map((f, i) => (i === idx ? { ...f, [field]: value } : f))), []);

  const resolvedStatus = useMemo((): GRN["status"] => {
    if (itemForms.some((f) => f.qcResult === "Rejected")) return "Discrepancy Raised";
    if (itemForms.some((f) => f.qcResult === "Hold")) return "QC Pending";
    return "Stock Updated";
  }, [itemForms]);

  const buildGRNs = (): GRN[] =>
    tlp.items.map((item, idx) => {
      const iForm = itemForms[idx];
      const pd = poData[idx];
      const shortQty = Math.max(0, item.quantity - iForm.receivedQty - iForm.damagedQty);
      const balanceQty = Math.max(0, (pd?.orderedQty ?? item.quantity) - iForm.receivedQty - iForm.damagedQty);
      return {
        id: `grn_${Date.now()}_${idx}`,
        grnNumber: genGrnNumber(),
        grnDate: today,
        poNumber: item.poNumber || "",
        purchaseInvoiceNumber: form.purchaseInvoiceNumber,
        millChallanNumber: form.millChallanNumber,
        mill: tlp.origin,
        paper: item.paper,
        gsm: item.gsm,
        size: item.size,
        orderedQty: pd?.orderedQty ?? item.quantity,
        previouslyReceivedQty: 0,
        receivedQty: iForm.receivedQty,
        shortQty,
        damagedQty: iForm.damagedQty,
        balanceQty,
        warehouse: form.warehouse,
        binLocation: "",
        suggestedBin: `${form.warehouse}-A-1-A1`,
        condition: form.condition,
        qcResult: iForm.qcResult,
        qualityGrade: form.qualityGrade,
        lotNumber: genLotNumber(tlp.origin, item.paper, item.gsm, item.size),
        lrNumber: form.lrNumber,
        transporterName: form.transporterName,
        vehicleNumber: form.vehicleNumber,
        receivedBy: form.receivedBy,
        status: resolvedStatus,
        remarks: form.remarks,
        sourceLoadPlanNumber: tlp.planNumber,
        millTrackerUpdated: true,
      };
    });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <PackageCheck className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {confirming ? "Confirm & Save GRN" : `Create GRN — ${tlp.planNumber}`}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {tlp.items.length} item{tlp.items.length !== 1 ? "s" : ""} · {tlp.origin}
                {tlp.transporterName ? ` · ${tlp.transporterName}` : ""}
                {tlp.truckNumber ? ` · ${tlp.truckNumber}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        {confirming ? (
          /* ── Confirmation Step ── */
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Review Before Saving
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div><span className="text-green-600">Plan</span><p className="font-semibold text-green-900 mt-0.5">{tlp.planNumber}</p></div>
                <div><span className="text-green-600">Origin</span><p className="font-semibold text-green-900 mt-0.5">{tlp.origin}</p></div>
                <div><span className="text-green-600">Warehouse</span><p className="font-semibold text-green-900 mt-0.5">{form.warehouse}</p></div>
                <div><span className="text-green-600">LR Number</span><p className="font-semibold text-green-900 mt-0.5">{form.lrNumber}</p></div>
                <div><span className="text-green-600">Transporter</span><p className="font-semibold text-green-900 mt-0.5">{form.transporterName || "—"}</p></div>
                <div><span className="text-green-600">Vehicle</span><p className="font-semibold text-green-900 mt-0.5 font-mono">{form.vehicleNumber || "—"}</p></div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">PO #</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Dispatched</th>
                  <th className="px-3 py-2 text-right font-semibold text-green-700">Received</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-600">Damaged</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-600">Short</th>
                  <th className="px-3 py-2 text-left font-semibold text-indigo-600">QC</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {tlp.items.map((item, idx) => {
                    const iForm = itemForms[idx];
                    const short = Math.max(0, item.quantity - iForm.receivedQty - iForm.damagedQty);
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.paper} {item.gsm}g · {item.size}</td>
                        <td className="px-3 py-2 text-blue-600">{item.poNumber}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{item.quantity.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">{iForm.receivedQty.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-red-600">{iForm.damagedQty || "—"}</td>
                        <td className="px-3 py-2 text-right text-orange-600">{short > 0 ? short.toLocaleString() : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getQcColor(iForm.qcResult)}`}>{iForm.qcResult}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
              <strong>Status after save:</strong>{" "}
              <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold border ${getStatusColor(resolvedStatus)}`}>{resolvedStatus}</span>
              {" "}· Stock lot will be created automatically · Bin location can be set in Stock Lots
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <div className="max-h-[calc(100vh-160px)] overflow-y-auto">

            {/* Section 1: Plan & Transport Reference */}
            <div className="px-6 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Plan & Transport Reference</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 text-xs">
                {[
                  { label: "TLP #", value: tlp.planNumber, cls: "font-semibold text-blue-700" },
                  { label: "Origin", value: tlp.origin },
                  { label: "Load Date", value: tlp.actualLoadDate || tlp.plannedLoadDate },
                  { label: "Truck #", value: tlp.truckNumber || "—", cls: "font-mono" },
                  { label: "Transporter", value: tlp.transporterName || "—" },
                  { label: "Driver", value: tlp.driverName || "—" },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <span className="text-gray-400">{label}</span>
                    <p className={`font-semibold text-gray-900 mt-0.5 ${cls ?? ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Customer & SO */}
            {soCustomer && (
              <div className="px-6 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Customer & SO Details</p>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                  <div><span className="text-blue-400">Customer</span><p className="font-semibold text-blue-900 mt-0.5">{soCustomer}</p></div>
                  {soNumber && <div><span className="text-blue-400">SO #</span><p className="font-semibold text-blue-700 mt-0.5">{soNumber}</p></div>}
                  {soDeliveryAddress && <div><span className="text-blue-400">Delivery Address</span><p className="font-semibold text-blue-900 mt-0.5">{soDeliveryAddress}</p></div>}
                </div>
              </div>
            )}

            {/* Section 3: Items table */}
            <div className="px-6 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Items Received — Quantity Verification</p>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Material / Location</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">PO #</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Rate (₹/kg)</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">Ord. Qty</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">Disp. Qty</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-amber-700 whitespace-nowrap">Recv. Qty *</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-red-600 whitespace-nowrap">Dmg. Qty</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-orange-600 whitespace-nowrap">Short</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-600 whitespace-nowrap">QC Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tlp.items.map((item, idx) => {
                        const iForm = itemForms[idx];
                        const pd = poData[idx];
                        const shortQty = Math.max(0, item.quantity - iForm.receivedQty - iForm.damagedQty);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50/60">
                            <td className="px-3 py-2.5 min-w-[160px]">
                              <p className="font-semibold text-gray-900 text-xs">{item.paper}</p>
                              <p className="text-[11px] text-gray-500">{item.gsm}g · {item.size}</p>
                              {item.deliveryLocation && (
                                <p className="text-[11px] text-blue-500 flex items-center gap-0.5 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />{item.deliveryLocation}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-xs font-medium text-blue-600">{item.poNumber || "—"}</span></td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className="text-xs font-semibold text-gray-900">{pd?.rate ? `₹${pd.rate.toLocaleString()}` : "—"}</span></td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className="text-xs text-gray-500">{(pd?.orderedQty ?? item.quantity).toLocaleString()}</span></td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className="text-xs font-semibold text-gray-800">{item.quantity.toLocaleString()}</span></td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <input type="number" value={iForm.receivedQty}
                                onChange={(e) => setItem(idx, "receivedQty", Math.max(0, +e.target.value || 0))}
                                className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-right text-xs font-semibold text-gray-900 focus:border-amber-500 focus:outline-none"
                                min={0} max={item.quantity} />
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <input type="number" value={iForm.damagedQty || ""}
                                onChange={(e) => setItem(idx, "damagedQty", Math.max(0, +e.target.value || 0))}
                                className="w-20 rounded-lg border border-red-200 bg-red-50/50 px-2 py-1 text-right text-xs focus:border-red-400 focus:outline-none"
                                min={0} placeholder="0" />
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <span className={`text-xs font-bold ${shortQty > 0 ? "text-orange-600" : "text-gray-300"}`}>
                                {shortQty > 0 ? shortQty.toLocaleString() : "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <select value={iForm.qcResult} onChange={(e) => setItem(idx, "qcResult", e.target.value)}
                                className={`rounded-md border px-2 py-1 text-xs focus:outline-none ${
                                  iForm.qcResult === "Accepted" ? "border-green-200 bg-green-50 text-green-700" :
                                  iForm.qcResult === "Rejected" ? "border-red-200 bg-red-50 text-red-700" :
                                  iForm.qcResult === "Hold" ? "border-orange-200 bg-orange-50 text-orange-700" :
                                  "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
                                {["Accepted", "Accepted with Remark", "Rejected", "Hold"].map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {itemForms.some((f) => f.qcResult === "Rejected") && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-xs text-red-700">
                  <Ban className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  Rejected items will create a discrepancy — GRN will be saved with "Discrepancy Raised" status.
                </div>
              )}
            </div>

            {/* Section 4: Mill Documents */}
            <div className="px-6 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Mill Documents</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mill Challan #</label>
                  <input type="text" value={form.millChallanNumber} onChange={(e) => set("millChallanNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="e.g. MC-ITC-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Invoice #</label>
                  <input type="text" value={form.purchaseInvoiceNumber} onChange={(e) => set("purchaseInvoiceNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="e.g. INV-2024-001" />
                </div>
              </div>
            </div>

            {/* Section 5: Quality Check */}
            <div className="px-6 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Quality Check — Overall</p>
              <div className="rounded-xl border border-yellow-100 bg-yellow-50/40 p-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Condition *</label>
                  <select value={form.condition} onChange={(e) => set("condition", e.target.value as GRN["condition"])}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none">
                    {["Good", "Slight Damage", "Wet", "Torn", "Mixed GSM"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quality Grade *</label>
                  <select value={form.qualityGrade} onChange={(e) => set("qualityGrade", e.target.value as GRN["qualityGrade"])}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none">
                    {["A Grade", "B Grade", "Rejected"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 6: Transport */}
            <div className="px-6 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Transport Details</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">LR Number *</label>
                  <input type="text" value={form.lrNumber} onChange={(e) => set("lrNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="e.g. LR-12345" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Transporter</label>
                  <input type="text" value={form.transporterName} onChange={(e) => set("transporterName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle #</label>
                  <input type="text" value={form.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="MP09AB1234" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Received By</label>
                  <input type="text" value={form.receivedBy} onChange={(e) => set("receivedBy", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Godown person" />
                </div>
              </div>
            </div>

            {/* Section 7: Warehouse & Remarks */}
            <div className="px-6 pt-4 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Warehouse *</label>
                  <select value={form.warehouse} onChange={(e) => set("warehouse", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    {["Lasudia", "Sanwer", "Pithampur"].map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                  <input type="text" value={form.remarks} onChange={(e) => set("remarks", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Any discrepancy or notes..." />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-2xl">
          {confirming ? (
            <>
              <p className="text-xs text-gray-500">{tlp.items.length} GRN {tlp.items.length !== 1 ? "entries" : "entry"} · Stock lot auto-created · Bin to be set in Stock Lots</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirming(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
                <button onClick={() => onSave(buildGRNs())} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Confirm & Save
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">{tlp.items.length} GRN {tlp.items.length !== 1 ? "entries" : "entry"} will be created with status: <span className="font-semibold">{resolvedStatus}</span></p>
              <div className="flex gap-3">
                <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => setConfirming(true)} disabled={!form.lrNumber.trim()}
                  className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  Review & Save{tlp.items.length > 1 ? ` (${tlp.items.length} items)` : ""}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Edit GRN Modal (warehouse / bin update) ──────────────────────────────────

function EditGRNModal({ grn, onSave, onClose }: { grn: GRN; onSave: (patch: Partial<GRN>) => void; onClose: () => void }) {
  const [warehouse, setWarehouse] = useState(grn.warehouse);
  const [binLocation, setBinLocation] = useState(grn.binLocation || "");
  const [remarks, setRemarks] = useState(grn.remarks || "");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit GRN — {grn.grnNumber}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{grn.paper} · {grn.gsm}g · {grn.size}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Warehouse</label>
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              {["Lasudia", "Sanwer", "Pithampur"].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Bin Location</label>
            <input type="text" value={binLocation} onChange={(e) => setBinLocation(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              placeholder="e.g. Lasudia-A-1-A1" />
            {grn.suggestedBin && <p className="text-xs text-gray-400 mt-1">Suggested: {grn.suggestedBin}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
            <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave({ warehouse, binLocation, remarks })}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">Save Changes</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── View GRN Modal (full detail) ─────────────────────────────────────────────

interface ViewGRNModalProps {
  grn: GRN;
  tlp?: TruckLoadPlan;
  soCustomer?: string;
  soNumber?: string;
  poRate?: number;
  onEdit: () => void;
  onPrint: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ViewGRNModal({ grn, tlp, soCustomer, soNumber, poRate, onEdit, onPrint, onDelete, onClose }: ViewGRNModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <PackageCheck className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{grn.grnNumber}</h2>
              <p className="text-xs text-gray-500">{grn.poNumber} · {grn.mill}</p>
            </div>
            <span className={`ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(grn.status)}`}>{grn.status}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5 space-y-4">

          {/* Chain: SO → PO → TLP */}
          {(soCustomer || tlp) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 mb-2">Flow Chain</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {soCustomer && (<><span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{soCustomer}</span><span className="text-blue-300">→ SO</span>{soNumber && <span className="font-mono text-blue-600">{soNumber}</span>}<span className="text-blue-300">→</span></>)}
                <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{grn.poNumber}</span>
                <span className="text-blue-300">→</span>
                {tlp && <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{tlp.planNumber}</span>}
                {tlp && <span className="text-blue-300">→</span>}
                <span className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white">{grn.grnNumber}</span>
              </div>
            </div>
          )}

          {/* GRN Details */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">GRN Details</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                { label: "GRN Date", value: grn.grnDate },
                { label: "PO #", value: grn.poNumber, blue: true },
                { label: "Mill / Origin", value: grn.mill },
                { label: "Warehouse", value: grn.warehouse },
                { label: "Mill Challan #", value: grn.millChallanNumber || "—", mono: true },
                { label: "Purchase Invoice", value: grn.purchaseInvoiceNumber || "—", mono: true },
                { label: "Bin Location", value: grn.binLocation || grn.suggestedBin || "—", mono: true },
                { label: "Lot #", value: grn.lotNumber, mono: true },
              ].map(({ label, value, blue, mono }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${blue ? "text-blue-700" : "text-gray-900"} ${mono ? "font-mono" : ""}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quantities */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Material & Quantities</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Ordered</th>
                  <th className="px-3 py-2 text-right font-semibold text-green-700">Received</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-600">Short</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-600">Damaged</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Balance</th>
                </tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-900">{grn.paper}</p>
                      <p className="text-gray-500 mt-0.5">{grn.gsm}g · {grn.size}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{poRate ? `₹${poRate.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 font-medium">{grn.orderedQty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700">{grn.receivedQty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-semibold"><span className={grn.shortQty > 0 ? "text-orange-600" : "text-gray-300"}>{grn.shortQty > 0 ? grn.shortQty.toLocaleString() : "—"}</span></td>
                    <td className="px-3 py-2.5 text-right font-semibold"><span className={grn.damagedQty > 0 ? "text-red-600" : "text-gray-300"}>{grn.damagedQty > 0 ? grn.damagedQty.toLocaleString() : "—"}</span></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`rounded-lg px-2 py-0.5 font-bold ${grn.balanceQty > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                        {grn.balanceQty > 0 ? grn.balanceQty.toLocaleString() : "NIL"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transport + QC side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Transport</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "LR Number", value: grn.lrNumber || "—", mono: true },
                  { label: "Transporter", value: grn.transporterName || "—" },
                  { label: "Vehicle #", value: grn.vehicleNumber || "—", mono: true },
                  { label: "Received By", value: grn.receivedBy || "—" },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] text-gray-400">{label}</p>
                    <p className={`text-xs font-semibold text-gray-900 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Quality Check</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">Condition</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{grn.condition}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">QC Result</p>
                  <span className={`inline-flex mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getQcColor(grn.qcResult)}`}>{grn.qcResult}</span>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">Quality Grade</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{grn.qualityGrade}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">TLP #</p>
                  <p className="text-xs font-semibold text-blue-700 mt-0.5">{grn.sourceLoadPlanNumber || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {grn.remarks && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400">Remarks</p>
              <p className="text-xs text-gray-700 mt-0.5">{grn.remarks}</p>
            </div>
          )}

          {/* Confirm delete */}
          {confirmDelete && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800 mb-1">Delete this GRN?</p>
              <p className="text-xs text-red-600 mb-3">This will permanently remove {grn.grnNumber}. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={onDelete} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Yes, Delete</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onPrint} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Row Actions Dropdown ──────────────────────────────────────────────────────

function RowActions({ grn, onView, onEdit, onPrint, onDelete }: {
  grn: GRN;
  onView: () => void; onEdit: () => void; onPrint: () => void; onDelete: () => void;
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
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
            { label: "View Details", icon: Eye, fn: onView },
            { label: "Edit GRN", icon: Pencil, fn: onEdit },
            { label: "Print", icon: Printer, fn: onPrint },
            { label: "Delete", icon: Trash2, fn: onDelete, red: true },
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

export default function GRNPage() {
  const { grns, updateGRN, addToStock, addGRN, deleteGRN, stockLots } = useStock();
  const { dispatchedTLPs, millTrackers, purchaseOrders } = usePurchaseOrder();
  const { salesOrders } = useSalesOrder();

  const [selectedGrn, setSelectedGrn] = useState<GRN | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTLP, setSelectedTLP] = useState<TruckLoadPlan | null>(null);
  const [showPending, setShowPending] = useState(false);
  const [pendingSearch, setPendingSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  const pendingFromTLP = useMemo(
    () => dispatchedTLPs.filter((tlp) => !grns.some((g) => g.sourceLoadPlanNumber === tlp.planNumber)),
    [dispatchedTLPs, grns]
  );

  const filteredPending = useMemo(() => {
    if (!pendingSearch.trim()) return pendingFromTLP;
    const q = pendingSearch.toLowerCase();
    return pendingFromTLP.filter((tlp) =>
      tlp.planNumber.toLowerCase().includes(q) ||
      tlp.origin.toLowerCase().includes(q) ||
      (tlp.transporterName || "").toLowerCase().includes(q) ||
      (tlp.truckNumber || "").toLowerCase().includes(q) ||
      tlp.items.some((i) => (i.poNumber || "").toLowerCase().includes(q))
    );
  }, [pendingFromTLP, pendingSearch]);

  const kpis = useMemo(() => {
    const draft = grns.filter((g) => g.status === "Draft").length;
    const qcPending = grns.filter((g) => g.status === "QC Pending").length;
    const approved = grns.filter((g) => g.status === "Approved").length;
    const stockUpdated = grns.filter((g) => g.status === "Stock Updated").length;
    const discrepancy = grns.filter((g) => g.status === "Discrepancy Raised").length;
    const totalReceived = grns.reduce((s, g) => s + g.receivedQty, 0);
    const totalShort = grns.reduce((s, g) => s + g.shortQty, 0);
    return { draft, qcPending, approved, stockUpdated, discrepancy, totalReceived, totalShort };
  }, [grns]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getChainForGRN(grn: GRN) {
    const tlp = dispatchedTLPs.find((t) => t.planNumber === grn.sourceLoadPlanNumber);
    const tracker = millTrackers.find((t) => t.poNumber === grn.poNumber);
    const so = tracker?.soNumber ? salesOrders.find((s) => s.soNumber === tracker.soNumber) : undefined;
    const po = purchaseOrders?.find((p) => p.poNumber === grn.poNumber);
    const poItem = (po?.items as any[] | undefined)?.find((i: any) => i.gsm === grn.gsm && i.size === grn.size);
    return { tlp, soCustomer: so?.customer, soNumber: tracker?.soNumber, poRate: poItem?.rate as number | undefined };
  }

  function getSoDetailsForTLP(tlp: TruckLoadPlan) {
    const tracker = millTrackers.find((t) => t.poNumber === tlp.items[0]?.poNumber);
    if (!tracker?.soNumber) return { soCustomer: undefined, soNumber: undefined, soDeliveryAddress: undefined, soLines: undefined };
    const so = salesOrders.find((s) => s.soNumber === tracker.soNumber);
    if (!so) return { soCustomer: undefined, soNumber: undefined, soDeliveryAddress: undefined, soLines: undefined };
    return {
      soCustomer: so.customer,
      soNumber: tracker.soNumber,
      soDeliveryAddress: (so as any).deliveryAddress || "",
      soLines: so.lines.map((l) => ({ paper: l.materialCode || "", gsm: l.gsm || 0, size: l.size || "", orderedQty: l.orderedQty, rate: l.rate })),
    };
  }

  function openCreateGRN(tlp: TruckLoadPlan) { setSelectedTLP(tlp); setShowCreateModal(true); }
  function openView(grn: GRN) { setSelectedGrn(grn); setShowViewModal(true); }
  function openEdit(grn: GRN) { setSelectedGrn(grn); setShowViewModal(false); setShowEditModal(true); }

  function handleSaveGRN(newGrns: GRN[]) {
    newGrns.forEach((g) => {
      addGRN(g);
      if (g.status === "Stock Updated" || g.status === "Approved") addToStock(g);
    });
    setShowCreateModal(false);
    setSelectedTLP(null);
  }

  function handleDeleteGRN(id: string) {
    deleteGRN(id);
    setShowViewModal(false);
    setSelectedGrn(null);
    setDeleteConfirmId(null);
  }

  const statusOptions = useMemo(() => [
    { label: "Draft", value: "Draft" },
    { label: "QC Pending", value: "QC Pending" },
    { label: "Approved", value: "Approved" },
    { label: "Stock Updated", value: "Stock Updated" },
    { label: "Discrepancy Raised", value: "Discrepancy Raised" },
  ], []);

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnConfig<GRN>[] = useMemo(() => [
    {
      id: "grnNumber", accessorKey: "grnNumber", header: "GRN #",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-semibold text-blue-700">{info.getValue() as string}</span>,
    },
    {
      id: "grnDate", accessorKey: "grnDate", header: "Date",
      filterType: "date", enableSorting: true, defaultVisible: true, size: 100,
    },
    {
      id: "poNumber", accessorKey: "poNumber", header: "PO #",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 140,
      cell: (info) => <span className="text-blue-600 font-medium">{info.getValue() as string}</span>,
    },
    {
      id: "mill", accessorKey: "mill", header: "Mill",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 140,
    },
    {
      id: "paper", accessorKey: "paper", header: "Paper",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
    },
    {
      id: "spec", accessorKey: "gsm", header: "Spec",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 90,
      cell: (info) => <span className="text-xs text-gray-700">{info.row.original.gsm}G · {info.row.original.size}</span>,
    },
    {
      id: "qtyTracking", accessorKey: "orderedQty", header: "Ordered / Received",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 160,
      cell: (info) => {
        const g = info.row.original;
        return (
          <div className="text-sm">
            <span className="text-gray-500">{g.orderedQty.toLocaleString()}</span>
            <span className="mx-1 text-gray-300">/</span>
            <span className={`font-semibold ${g.balanceQty > 0 ? "text-red-600" : "text-green-700"}`}>{g.receivedQty.toLocaleString()}</span>
            {g.balanceQty > 0 && <span className="ml-1 text-xs text-red-500">(-{g.balanceQty.toLocaleString()})</span>}
          </div>
        );
      },
    },
    {
      id: "warehouse", accessorKey: "warehouse", header: "Warehouse",
      filterType: "select",
      filterOptions: [{ label: "Lasudia", value: "Lasudia" }, { label: "Sanwer", value: "Sanwer" }, { label: "Pithampur", value: "Pithampur" }],
      enableSorting: true, defaultVisible: true, size: 110,
    },
    {
      id: "binLocation", accessorKey: "binLocation", header: "Bin",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 110,
      cell: (info) => {
        const v = info.getValue() as string;
        return v ? <span className="font-mono text-xs text-blue-600">{v}</span> : <span className="text-xs text-gray-300">—</span>;
      },
    },
    {
      id: "qcResult", accessorKey: "qcResult", header: "QC",
      filterType: "select",
      filterOptions: [
        { label: "Accepted", value: "Accepted" },
        { label: "Accepted with Remark", value: "Accepted with Remark" },
        { label: "Rejected", value: "Rejected" },
        { label: "Hold", value: "Hold" },
      ],
      enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getQcColor(info.getValue() as string)}`}>{info.getValue() as string}</span>,
    },
    {
      id: "status", accessorKey: "status", header: "Status",
      filterType: "select", filterOptions: statusOptions,
      enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(info.getValue() as string)}`}>{info.getValue() as string}</span>,
    },
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48,
      cell: (info) => {
        const grn = info.row.original;
        return (
          <RowActions
            grn={grn}
            onView={() => openView(grn)}
            onEdit={() => openEdit(grn)}
            onPrint={() => printGRN(grn)}
            onDelete={() => setDeleteConfirmId(grn.id)}
          />
        );
      },
    },
  ], [statusOptions]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-24">

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">

        {/* Pending GRN (TLP awaiting) */}
        <button onClick={() => { setShowPending((v) => !v); setPendingSearch(""); }}
          className={`rounded-xl border-2 p-4 text-left transition-all ${showPending ? "border-amber-400 bg-amber-500 shadow-md" : pendingFromTLP.length > 0 ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-300" : "border-gray-100 bg-white hover:border-gray-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${showPending ? "text-amber-100" : "text-gray-400"}`}>Pending GRN</p>
              <p className={`mt-1.5 text-2xl font-bold ${showPending ? "text-white" : pendingFromTLP.length > 0 ? "text-amber-600" : "text-gray-900"}`}>{pendingFromTLP.length}</p>
              <p className={`mt-0.5 text-xs ${showPending ? "text-amber-100" : "text-amber-500"}`}>{showPending ? "Click to hide" : "Shipments waiting"}</p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${showPending ? "bg-amber-400" : "bg-amber-100"}`}>
              <Truck className={`h-5 w-5 ${showPending ? "text-white" : "text-amber-600"}`} />
            </div>
          </div>
        </button>

        {/* Stock Updated */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Stock Updated</p>
              <p className="mt-1.5 text-2xl font-bold text-green-700">{kpis.stockUpdated}</p>
              <p className="mt-0.5 text-xs text-green-600">In inventory</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50"><PackageCheck className="h-5 w-5 text-green-500" /></div>
          </div>
        </div>

        {/* Discrepancy */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Discrepancy</p>
              <p className="mt-1.5 text-2xl font-bold text-red-700">{kpis.discrepancy}</p>
              <p className="mt-0.5 text-xs text-red-600">Issues found</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
          </div>
        </div>

        {/* Draft */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Draft</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-700">{kpis.draft}</p>
              <p className="mt-0.5 text-xs text-gray-500">New arrivals</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50"><FileText className="h-5 w-5 text-gray-400" /></div>
          </div>
        </div>

        {/* QC Pending */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">QC Pending</p>
              <p className="mt-1.5 text-2xl font-bold text-yellow-700">{kpis.qcPending}</p>
              <p className="mt-0.5 text-xs text-yellow-600">Held / On Hold</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50"><Clock className="h-5 w-5 text-yellow-500" /></div>
          </div>
        </div>

        {/* Approved */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Approved</p>
              <p className="mt-1.5 text-2xl font-bold text-blue-700">{kpis.approved}</p>
              <p className="mt-0.5 text-xs text-blue-600">QC passed</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50"><CheckCircle className="h-5 w-5 text-blue-500" /></div>
          </div>
        </div>

        {/* Total Received */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Received</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">{(kpis.totalReceived / 1000).toFixed(0)}K</p>
            <p className="mt-0.5 text-xs text-gray-500">kg received</p></div>
        </div>

        {/* Short Supply */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Short Supply</p>
            <p className="mt-1.5 text-2xl font-bold text-red-600">{kpis.totalShort.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-red-500">kg short</p></div>
        </div>
      </div>

      {/* Pending TLP Grid */}
      {showPending && (
        <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-100 bg-amber-50">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-amber-900">Shipments Awaiting GRN</h2>
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{pendingFromTLP.length}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)}
                placeholder="Search plan, PO, truck..."
                className="rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs focus:border-amber-400 focus:outline-none w-52" />
            </div>
          </div>
          {filteredPending.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">No pending shipments match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  {["Plan #", "Origin", "Truck", "Transporter", "Items / POs", "Total Qty", "Planned Delivery", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPending.map((tlp) => {
                    const totalQty = tlp.items.reduce((s, i) => s + i.quantity, 0);
                    const uniquePOs = new Set(tlp.items.map((i) => i.poNumber)).size;
                    return (
                      <tr key={tlp.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-3"><span className="font-semibold text-blue-700">{tlp.planNumber}</span></td>
                        <td className="px-4 py-3 text-gray-700">{tlp.origin}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{tlp.truckNumber || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{tlp.transporterName || "—"}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900">{tlp.items.length} item{tlp.items.length !== 1 ? "s" : ""} · {uniquePOs} PO{uniquePOs !== 1 ? "s" : ""}</p>
                          {tlp.items[0] && <p className="text-xs text-gray-500 mt-0.5">{tlp.items[0].paper} {tlp.items[0].gsm}g{tlp.items.length > 1 ? ` +${tlp.items.length - 1}` : ""}</p>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalQty.toLocaleString()}<span className="ml-1 text-xs font-normal text-gray-400">sht</span></td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{tlp.plannedDeliveryDate}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openCreateGRN(tlp)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors">
                            <Plus className="h-3 w-3" /> Create GRN
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GRN DataGrid */}
      {!showPending && (
        <div className="overflow-x-auto">
          <DataGrid
            data={grns}
            columns={columns}
            tableName="grns"
            enableFilters={true}
            enablePagination={true}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            initialPageSize={10}
            onRowClick={(grn) => openView(grn)}
            emptyMessage="No GRNs yet. Create GRNs from shipments in transit."
          />
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Delete GRN?</h3>
            <p className="text-sm text-gray-500 mb-5">This GRN will be permanently removed. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDeleteGRN(deleteConfirmId)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Modal */}
      {showViewModal && selectedGrn && (() => {
        const { tlp, soCustomer, soNumber, poRate } = getChainForGRN(selectedGrn);
        return (
          <ViewGRNModal
            grn={selectedGrn}
            tlp={tlp}
            soCustomer={soCustomer}
            soNumber={soNumber}
            poRate={poRate}
            onEdit={() => openEdit(selectedGrn)}
            onPrint={() => printGRN(selectedGrn)}
            onDelete={() => { setShowViewModal(false); setDeleteConfirmId(selectedGrn.id); }}
            onClose={() => { setShowViewModal(false); setSelectedGrn(null); }}
          />
        );
      })()}

      {/* Edit Modal */}
      {showEditModal && selectedGrn && (
        <EditGRNModal
          grn={selectedGrn}
          onSave={(patch) => { updateGRN(selectedGrn.id, patch); setShowEditModal(false); setSelectedGrn(null); }}
          onClose={() => { setShowEditModal(false); setSelectedGrn(null); }}
        />
      )}

      {/* Create GRN Modal */}
      {showCreateModal && selectedTLP && (() => {
        const { soCustomer, soNumber, soDeliveryAddress, soLines } = getSoDetailsForTLP(selectedTLP);
        return (
          <CreateGRNModal
            tlp={selectedTLP}
            soCustomer={soCustomer}
            soNumber={soNumber}
            soDeliveryAddress={soDeliveryAddress}
            soLines={soLines}
            purchaseOrders={purchaseOrders}
            onSave={handleSaveGRN}
            onClose={() => { setShowCreateModal(false); setSelectedTLP(null); }}
          />
        );
      })()}
    </div>
  );
}
