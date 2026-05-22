"use client";

import { PermGuard } from "@/components/PermGuard";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  grnApi, GrnRow, GrnDetailRow, CreateGrnDto, UpdateGrnDto,
  truckLoadPlanApi, TruckLoadPlanApiDto,
  warehouseApi, WarehouseDropdown,
  millTrackerApi, MillTrackerRow,
} from "@/lib/api-services";
import {
  PackageCheck, Clock, AlertTriangle, CheckCircle, X, FileText,
  Truck, MapPin, Plus, Printer, Search, MoreVertical, Eye,
  Pencil, Trash2, CheckCircle2, Ban, Loader2, ArrowRight, ChevronDown,
  ShieldAlert, ShieldCheck, EyeOff, Scale, Share2,
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

function getDeliveryModeColor(mode: string) {
  if (mode === "DirectToClient") return "bg-purple-100 text-purple-700 border-purple-200";
  if (mode === "Split") return "bg-indigo-100 text-indigo-700 border-indigo-200";
  return "bg-teal-100 text-teal-700 border-teal-200";
}

function getBillingModeLabel(mode: string, blind: boolean) {
  if (blind || mode === "Blind") return { label: "Blind Shipment", color: "bg-red-100 text-red-700 border-red-200", Icon: EyeOff };
  if (mode === "InvoiceOverride") return { label: "Invoice Override", color: "bg-orange-100 text-orange-700 border-orange-200", Icon: ShieldAlert };
  return { label: "Normal", color: "bg-green-100 text-green-700 border-green-200", Icon: ShieldCheck };
}

function printGRN(grn: GrnDetailRow) {
  const billing = getBillingModeLabel(grn.billingMode, grn.blindShipment);
  const hasDirectDelivery = grn.grnDeliveryMode !== "StockIn";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>GRN — ${grn.grnNumber}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
    body{padding:28px;font-size:12px;color:#111}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:14px;margin-bottom:20px}
    .co{font-size:20px;font-weight:700;color:#1d4ed8}.co-sub{font-size:10px;color:#6b7280;margin-top:2px}
    .gt{text-align:right}.gt h2{font-size:16px;font-weight:700}.gt .num{font-size:15px;font-weight:700;color:#1d4ed8;margin-top:3px}
    .badge{display:inline-block;margin-top:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
    .badge-green{background:#dcfce7;color:#15803d}.badge-orange{background:#ffedd5;color:#c2410c}
    .badge-red{background:#fee2e2;color:#b91c1c}.badge-purple{background:#f3e8ff;color:#7e22ce}
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
    <div class="gt"><h2>GOODS RECEIPT NOTE</h2><div class="num">${grn.grnNumber}</div>
      <span class="badge badge-green">${grn.status}</span>
      ${grn.grnDeliveryMode !== "StockIn" ? `<span class="badge badge-purple" style="margin-left:4px">${grn.grnDeliveryMode === "DirectToClient" ? "Direct to Client" : "Split Delivery"}</span>` : ""}
      ${grn.billingMode === "Blind" || grn.blindShipment ? `<span class="badge badge-red" style="margin-left:4px">Blind Shipment</span>` : ""}
      ${grn.billingMode === "InvoiceOverride" ? `<span class="badge badge-orange" style="margin-left:4px">Invoice Override</span>` : ""}
    </div>
  </div>
  <div class="sec"><div class="sec-t">GRN Details</div>
    <div class="g3">
      <div class="f"><div class="fl">GRN Date</div><div class="fv">${grn.grnDate}</div></div>
      <div class="f"><div class="fl">PO Reference</div><div class="fv">${grn.poNumber}</div></div>
      <div class="f"><div class="fl">Mill / Supplier</div><div class="fv">${grn.millName}</div></div>
      <div class="f"><div class="fl">Mill Challan #</div><div class="fv">${grn.millChallanNumber || "—"}</div></div>
      <div class="f"><div class="fl">Purchase Invoice</div><div class="fv">${grn.purchaseInvoiceNumber || "—"}</div></div>
      <div class="f"><div class="fl">Warehouse</div><div class="fv">${grn.warehouseName || "—"}</div></div>
      ${grn.effectiveClientName ? `<div class="f"><div class="fl">Customer (Internal)</div><div class="fv">${grn.effectiveClientName}</div></div>` : ""}
      ${grn.billingMode === "InvoiceOverride" && grn.overrideClientName ? `<div class="f"><div class="fl">Client on PO</div><div class="fv">${grn.overrideClientName}</div></div>` : ""}
    </div>
  </div>
  <div class="sec"><div class="sec-t">Material & Weight Split</div>
    <table><thead><tr><th>Paper</th><th>GSM</th><th>Size</th><th>Ordered (kg)</th><th>Received (kg)</th><th>Short (kg)</th><th>Damaged (kg)</th>
      ${hasDirectDelivery ? "<th>→ Stock (kg)</th><th>→ Client (kg)</th>" : "<th>Balance (kg)</th>"}
    </tr></thead>
    <tbody><tr>
      <td><strong>${grn.paper}</strong></td><td>${grn.gsm} GSM</td><td>${grn.size}</td>
      <td style="text-align:right">${qtyToKg(grn, grn.orderedQty).toLocaleString()}</td>
      <td style="text-align:right;color:#15803d;font-weight:700">${qtyToKg(grn, grn.receivedQty).toLocaleString()}</td>
      <td style="text-align:right;color:${grn.shortQty > 0 ? "#d97706" : "#9ca3af"}">${qtyToKg(grn, grn.shortQty).toLocaleString()}</td>
      <td style="text-align:right;color:${grn.damagedQty > 0 ? "#b91c1c" : "#9ca3af"}">${qtyToKg(grn, grn.damagedQty).toLocaleString()}</td>
      ${hasDirectDelivery
        ? `<td style="text-align:right;color:#0f766e;font-weight:700">${qtyToKg(grn, grn.stockQty).toLocaleString()}</td>
           <td style="text-align:right;color:#7e22ce;font-weight:700">${qtyToKg(grn, grn.directQty).toLocaleString()}</td>`
        : `<td style="text-align:right;font-weight:700;color:${grn.balanceQty > 0 ? "#b91c1c" : "#15803d"}">${grn.balanceQty > 0 ? qtyToKg(grn, grn.balanceQty).toLocaleString() : "NIL"}</td>`}
    </tr></tbody></table>
    ${grn.grnDeliveryMode === "DirectToClient" || grn.grnDeliveryMode === "Split"
      ? `<div style="margin-top:6px;font-size:10px;color:#7e22ce;background:#faf5ff;border:1px solid #e9d5ff;border-radius:4px;padding:6px 8px">
          Direct to Client: <strong>${qtyToKg(grn, grn.directQty).toLocaleString()} kg</strong>${grn.directClientName ? ` → ${grn.directClientName}` : ""}
          ${grn.directDeliveryAddress ? ` · ${grn.directDeliveryAddress}` : ""}
        </div>` : ""}
  </div>
  <div class="sec"><div class="sec-t">Transport & Logistics</div>
    <div class="g2">
      <div class="f"><div class="fl">LR Number</div><div class="fv">${grn.lrNumber || "—"}</div></div>
      <div class="f"><div class="fl">TLP #</div><div class="fv">${grn.loadPlanNumber || "—"}</div></div>
      <div class="f"><div class="fl">Vehicle Number</div><div class="fv">${grn.vehicleNumber || "—"}</div></div>
      <div class="f"><div class="fl">Received By</div><div class="fv">${grn.receivedBy || "—"}</div></div>
    </div>
  </div>
  <div class="sec"><div class="sec-t">Quality Check</div>
    <div class="g3">
      <div class="f"><div class="fl">Condition</div><div class="fv">${grn.condition || "—"}</div></div>
      <div class="f"><div class="fl">QC Result</div><div class="fv">${grn.qcResult || "—"}</div></div>
      <div class="f"><div class="fl">Quality Grade</div><div class="fv">${grn.qualityGrade || "—"}</div></div>
      <div class="f"><div class="fl">Lot Number</div><div class="fv" style="font-family:monospace">${grn.lotNumber || "—"}</div></div>
      <div class="f"><div class="fl">Bin Location</div><div class="fv" style="font-family:monospace">${grn.binLocation || "—"}</div></div>
      ${grn.qcApprovedBy ? `<div class="f"><div class="fl">QC Approved By</div><div class="fv">${grn.qcApprovedBy} · ${grn.qcDate || ""}</div></div>` : ""}
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

// ─── Weight helpers ───────────────────────────────────────────────────────────
// Procurement flow stores all qty fields in KG already (MillTracker.OrderedQty
// is PO.WeightKg, TLP.Quantity is kg, GRN.receivedQty is kg). So these helpers
// are identity for callers that already have a kg value, kept for naming clarity.

function qtyToKg(_item: { weightKg?: number; quantity?: number; gsm?: number; size?: string }, kg: number): number {
  return Math.round(kg);
}

// ─── Create GRN Modal ─────────────────────────────────────────────────────────

type DeliveryMode = "StockIn" | "DirectToClient" | "Split";

type PackingType = "Sheets" | "Packets" | "Bundle";

interface ItemFormState {
  receivedQty: number;
  damagedQty: number;
  qcResult: string;
  deliveryMode: DeliveryMode;
  directQty: number;
  // New fields
  itemInvoiceNo: string;
  billingRate: number;
  packingType: PackingType;
  sheetsPerPacket: number;
  packetsPerBundle: number;
  noOfPackets: number;
  noOfBundles: number;
}

interface CreateGRNModalProps {
  tlp: TruckLoadPlanApiDto;
  warehouses: WarehouseDropdown[];
  onSave: (dtos: CreateGrnDto[]) => Promise<void>;
  onClose: () => void;
}

function CreateGRNModal({ tlp, warehouses, onSave, onClose }: CreateGRNModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trackerMap, setTrackerMap] = useState<Record<number, MillTrackerRow>>({});

  // Load tracker info for each item
  useEffect(() => {
    const trackerIds = tlp.items.map((i) => i.trackerId).filter(Boolean) as number[];
    const unique = [...new Set(trackerIds)];
    Promise.all(unique.map((id) => millTrackerApi.getById(id).catch(() => null))).then((results) => {
      const map: Record<number, MillTrackerRow> = {};
      results.forEach((t) => { if (t) map[t.id] = t; });
      setTrackerMap(map);
      // Auto-populate delivery mode from PO via tracker
      setItemForms((forms) =>
        forms.map((f, idx) => {
          const t = map[tlp.items[idx]?.trackerId ?? 0];
          if (!t) return f;
          const mode: DeliveryMode =
            t.deliveryMode === "Direct To Customer" ? "DirectToClient" : "StockIn";
          return { ...f, deliveryMode: mode };
        })
      );
    });
  }, [tlp.items]);

  const [itemForms, setItemForms] = useState<ItemFormState[]>(() =>
    tlp.items.map((item) => ({
      receivedQty: item.quantity,
      damagedQty: 0,
      qcResult: "Accepted",
      deliveryMode: "StockIn" as DeliveryMode,
      directQty: 0,
      itemInvoiceNo: "",
      billingRate: 0,
      packingType: "Sheets" as PackingType,
      sheetsPerPacket: 0,
      packetsPerBundle: 0,
      noOfPackets: 0,
      noOfBundles: 0,
    }))
  );

  const defaultWarehouseId = warehouses[0]?.id;
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    () => new Set(tlp.items.map((_, i) => i))
  );
  const toggleItem = (idx: number) => setExpandedItems((prev) => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  const [warehouseText, setWarehouseText] = useState(
    () => warehouses.find((w) => w.id === defaultWarehouseId)?.name ?? ""
  );
  const handleWarehouseChange = (text: string) => {
    setWarehouseText(text);
    const match = warehouses.find((w) => w.name.toLowerCase() === text.toLowerCase());
    set("warehouseId", match?.id as number | undefined);
  };

  const [form, setForm] = useState({
    lrNumber: "",
    vehicleNumber: tlp.truckNumber || "",
    receivedBy: "",
    millChallanNumber: "",
    purchaseInvoiceNumber: "",
    dispatchDate: "",
    condition: "Good",
    qualityGrade: "A Grade",
    warehouseId: defaultWarehouseId as number | undefined,
    remarks: "",
    freightAmount: tlp.freightAmount ?? 0,
    unloadingCharges: 0,
  });

  const set = useCallback(
    <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v })),
    []
  );

  const setItem = useCallback(
    (idx: number, field: keyof ItemFormState, value: number | string) =>
      setItemForms((forms) => forms.map((f, i) => {
        if (i !== idx) return f;
        const updated = { ...f, [field]: value };

        // Auto-compute receivedQty from packing fields
        const packingFields = ["packingType", "sheetsPerPacket", "packetsPerBundle", "noOfPackets", "noOfBundles"];
        if (packingFields.includes(field)) {
          const spp  = field === "sheetsPerPacket"  ? (value as number) : updated.sheetsPerPacket;
          const ppb  = field === "packetsPerBundle" ? (value as number) : updated.packetsPerBundle;
          const pkts = field === "noOfPackets"      ? (value as number) : updated.noOfPackets;
          const bnds = field === "noOfBundles"      ? (value as number) : updated.noOfBundles;
          const type = field === "packingType"      ? (value as PackingType) : updated.packingType;
          if (type === "Packets" && spp > 0 && pkts > 0)
            updated.receivedQty = spp * pkts;
          else if (type === "Bundle" && spp > 0 && ppb > 0 && bnds > 0)
            updated.receivedQty = spp * ppb * bnds;
        }

        // For DirectToClient, auto-set directQty = good qty
        if (field === "deliveryMode" && value === "DirectToClient")
          updated.directQty = Math.max(0, updated.receivedQty - updated.damagedQty);
        if (field === "deliveryMode" && value === "StockIn")
          updated.directQty = 0;

        // Keep directQty in sync in DirectToClient mode
        if ((field === "receivedQty" || field === "damagedQty") && updated.deliveryMode === "DirectToClient") {
          updated.directQty = Math.max(0, updated.receivedQty - updated.damagedQty);
        }
        return updated;
      })),
    []
  );

  const resolvedStatus = useMemo(() => {
    if (itemForms.some((f) => f.qcResult === "Rejected")) return "Discrepancy Raised";
    if (itemForms.some((f) => f.qcResult === "Hold")) return "QC Pending";
    return "Stock Updated";
  }, [itemForms]);

  const buildDtos = (): CreateGrnDto[] =>
    tlp.items
      .filter((item) => item.trackerId)
      .map((item, idx) => {
        const iForm = itemForms[idx];
        const goodQty  = Math.max(0, iForm.receivedQty - iForm.damagedQty);
        const shortQty = Math.max(0, item.quantity - iForm.receivedQty - iForm.damagedQty);
        const directQty = iForm.deliveryMode === "DirectToClient" ? goodQty : iForm.directQty;
        return {
          millTrackerId:         item.trackerId!,
          sourceLoadPlanId:      tlp.id,
          grnDate:               today,
          purchaseInvoiceNumber: form.purchaseInvoiceNumber || undefined,
          millChallanNumber:     form.millChallanNumber || undefined,
          dispatchDate:          form.dispatchDate || undefined,
          itemInvoiceNo:         iForm.itemInvoiceNo || undefined,
          billingRate:           iForm.billingRate > 0 ? iForm.billingRate : undefined,
          receivedQty:           iForm.receivedQty,
          damagedQty:            iForm.damagedQty,
          shortQty,
          packingType:           iForm.packingType,
          sheetsPerPacket:       iForm.packingType !== "Sheets" ? iForm.sheetsPerPacket : undefined,
          packetsPerBundle:      iForm.packingType === "Bundle"  ? iForm.packetsPerBundle : undefined,
          noOfPackets:           iForm.packingType === "Packets" ? iForm.noOfPackets : (iForm.packingType === "Bundle" ? undefined : undefined),
          noOfBundles:           iForm.packingType === "Bundle"  ? iForm.noOfBundles : undefined,
          grnDeliveryMode:       iForm.deliveryMode,
          directQty,
          warehouseId:           iForm.deliveryMode !== "DirectToClient" ? form.warehouseId : undefined,
          condition:             form.condition,
          qcResult:              iForm.qcResult,
          qualityGrade:          form.qualityGrade,
          vehicleNumber:         form.vehicleNumber || undefined,
          lrNumber:              form.lrNumber || undefined,
          driverName:            tlp.driverName || undefined,
          freightAmount:         form.freightAmount,
          unloadingCharges:      form.unloadingCharges,
          invoiceEligible:       true,
          receivedBy:            form.receivedBy || undefined,
          remarks:               form.remarks || undefined,
        };
      });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(buildDtos());
    } finally {
      setSaving(false);
    }
  };

  const deliveryModeOptions: { value: DeliveryMode; label: string; desc: string }[] = [
    { value: "StockIn",        label: "To Stock",       desc: "All to godown inventory" },
    { value: "DirectToClient", label: "Direct to Client", desc: "All direct to customer" },
    { value: "Split",          label: "Split",          desc: "Part to stock, part direct" },
  ];

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
                {tlp.items.length} item{tlp.items.length !== 1 ? "s" : ""} · {tlp.origin || "—"}
                {tlp.transporterName ? ` · ${tlp.transporterName}` : ""}
                {tlp.truckNumber ? ` · ${tlp.truckNumber}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        {confirming ? (
          /* ─── Confirm Screen ─── */
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Review Before Saving
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div><span className="text-green-600">Plan</span><p className="font-semibold text-green-900 mt-0.5">{tlp.planNumber}</p></div>
                <div><span className="text-green-600">Origin</span><p className="font-semibold text-green-900 mt-0.5">{tlp.origin || "—"}</p></div>
                <div><span className="text-green-600">Warehouse</span><p className="font-semibold text-green-900 mt-0.5">{warehouses.find((w) => w.id === form.warehouseId)?.name || "—"}</p></div>
                <div><span className="text-green-600">LR Number</span><p className="font-semibold text-green-900 mt-0.5">{form.lrNumber || "—"}</p></div>
                <div><span className="text-green-600">Transporter</span><p className="font-semibold text-green-900 mt-0.5">{tlp.transporterName || "—"}</p></div>
                <div><span className="text-green-600">Vehicle</span><p className="font-semibold text-green-900 mt-0.5 font-mono">{form.vehicleNumber || "—"}</p></div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Dispatched (kg)</th>
                  <th className="px-3 py-2 text-right font-semibold text-green-700">Received (kg)</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-600">Damaged (kg)</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-600">Short (kg)</th>
                  <th className="px-3 py-2 text-left font-semibold text-indigo-600">QC</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Routing</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {tlp.items.map((item, idx) => {
                    const iForm = itemForms[idx];
                    const goodQty = Math.max(0, iForm.receivedQty - iForm.damagedQty);
                    const short = Math.max(0, item.quantity - iForm.receivedQty - iForm.damagedQty);
                    const stockQty = iForm.deliveryMode === "StockIn" ? goodQty :
                                     iForm.deliveryMode === "DirectToClient" ? 0 :
                                     Math.max(0, goodQty - iForm.directQty);
                    const directQty = iForm.deliveryMode === "DirectToClient" ? goodQty :
                                      iForm.deliveryMode === "Split" ? iForm.directQty : 0;
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.paper} {item.gsm}g · {item.size}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{qtyToKg(item, item.quantity).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">{qtyToKg(item, iForm.receivedQty).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-red-600">{iForm.damagedQty > 0 ? qtyToKg(item, iForm.damagedQty).toLocaleString() : "—"}</td>
                        <td className="px-3 py-2 text-right text-orange-600">{short > 0 ? qtyToKg(item, short).toLocaleString() : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getQcColor(iForm.qcResult)}`}>{iForm.qcResult}</span>
                        </td>
                        <td className="px-3 py-2">
                          {iForm.deliveryMode === "StockIn" && (
                            <span className="text-[10px] text-teal-700 font-semibold">↓ {qtyToKg(item, stockQty).toLocaleString()} kg → Stock</span>
                          )}
                          {iForm.deliveryMode === "DirectToClient" && (
                            <span className="text-[10px] text-purple-700 font-semibold">→ {qtyToKg(item, directQty).toLocaleString()} kg Direct</span>
                          )}
                          {iForm.deliveryMode === "Split" && (
                            <span className="text-[10px] font-semibold">
                              <span className="text-teal-700">{qtyToKg(item, stockQty).toLocaleString()} kg Stock</span>
                              <span className="text-gray-400 mx-1">+</span>
                              <span className="text-purple-700">{qtyToKg(item, directQty).toLocaleString()} kg Direct</span>
                            </span>
                          )}
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
              {" "}· Stock lot auto-created for "To Stock" portion only
            </div>
          </div>
        ) : (
          /* ─── Form ─── */
          <div className="max-h-[calc(100vh-160px)] overflow-y-auto">

            {/* Section 1: Plan & Transport Reference */}
            <div className="px-6 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Plan & Transport Reference</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                {[
                  { label: "TLP #",       value: tlp.planNumber,                                        cls: "font-semibold text-blue-700" },
                  { label: "Origin",      value: tlp.origin || "—" },
                  { label: "Load Date",   value: tlp.actualLoadDate || tlp.plannedLoadDate || "—" },
                  { label: "Truck #",     value: tlp.truckNumber || "—",                                cls: "font-mono" },
                  { label: "Transporter", value: tlp.transporterName || "—" },
                  { label: "Driver",      value: tlp.driverName || "—" },
                  { label: "Freight (₹)", value: tlp.freightAmount ? `₹${Number(tlp.freightAmount).toLocaleString()}` : "—" },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <span className="text-gray-400">{label}</span>
                    <p className={`font-semibold text-gray-900 mt-0.5 ${cls ?? ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer from first item */}
            {tlp.items[0]?.customerName && (
              <div className="px-6 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Customer & SO Details</p>
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                  <div><span className="text-blue-400">Customer</span><p className="font-semibold text-blue-900 mt-0.5">{tlp.items[0].customerName}</p></div>
                  {tlp.items[0].soNumber && <div><span className="text-blue-400">SO #</span><p className="font-semibold text-blue-700 mt-0.5">{tlp.items[0].soNumber}</p></div>}
                  {tlp.items[0].deliveryAddress && <div><span className="text-blue-400">Delivery Address</span><p className="font-semibold text-blue-900 mt-0.5">{tlp.items[0].deliveryAddress}</p></div>}
                </div>
              </div>
            )}

            {/* Section 3: Receipt Details */}
            <div className="px-6 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Receipt Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Invoice #</label>
                  <input type="text" value={form.purchaseInvoiceNumber} onChange={(e) => set("purchaseInvoiceNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="INV-2024-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mill Challan #</label>
                  <input type="text" value={form.millChallanNumber} onChange={(e) => set("millChallanNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" placeholder="MC-ITC-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dispatch Date</label>
                  <input type="date" value={form.dispatchDate} onChange={(e) => set("dispatchDate", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">LR Number</label>
                  <input type="text" value={form.lrNumber} onChange={(e) => set("lrNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="LR-12345" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Received By</label>
                  <input type="text" value={form.receivedBy} onChange={(e) => set("receivedBy", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Godown person" />
                </div>
              </div>
            </div>

            {/* Section 4: Items — card layout */}
            <div className="px-6 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Items Received — Verification & Routing</p>
              <div className="space-y-3">
                {tlp.items.map((item, idx) => {
                  const iForm = itemForms[idx];
                  const tracker = item.trackerId ? trackerMap[item.trackerId] : undefined;
                  const orderedQty = tracker?.orderedQty ?? item.quantity;
                  const poRate = tracker
                    ? (tracker.discount && tracker.discount > 0
                        ? tracker.rate / (1 - tracker.discount / 100)
                        : tracker.rate)
                    : undefined;
                  const goodQty = Math.max(0, iForm.receivedQty - iForm.damagedQty);
                  const shortQty = Math.max(0, item.quantity - iForm.receivedQty - iForm.damagedQty);
                  const rateDiff = iForm.billingRate > 0 && poRate ? iForm.billingRate - poRate : null;
                  return (
                    <div key={item.id} className="rounded-xl border border-gray-200 overflow-hidden">
                      {/* Card header — clickable to collapse */}
                      <button
                        type="button"
                        onClick={() => toggleItem(idx)}
                        className="w-full bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-left hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <span className="font-semibold text-sm text-gray-900">{item.paper}</span>
                          <span className="text-xs text-gray-500 ml-2">{item.gsm}g · {item.size}</span>
                        </div>
                        {item.poNumber && <span className="text-xs text-blue-600 font-medium">{item.poNumber}</span>}
                        {item.deliveryLocation && (
                          <span className="text-xs text-blue-500 flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />{item.deliveryLocation}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
                          <span>Ordered: <strong className="text-gray-800">{qtyToKg(item, orderedQty).toLocaleString()} kg</strong></span>
                          <span>Dispatched: <strong className="text-gray-800">{qtyToKg(item, item.quantity).toLocaleString()} kg</strong></span>
                          <span className="text-amber-700 font-semibold">Received: {qtyToKg(item, iForm.receivedQty).toLocaleString()} kg</span>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${expandedItems.has(idx) ? "rotate-0" : "-rotate-90"}`} />
                        </div>
                      </button>

                      {/* Card body — collapsible */}
                      {expandedItems.has(idx) && <div className="p-4 space-y-4">

                        {/* Packing format */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">Packing Format</label>
                          <div className="flex flex-wrap gap-3 items-center">
                            <div className="flex gap-1.5">
                              {(["Sheets", "Packets", "Bundle"] as PackingType[]).map((pt) => (
                                <button key={pt} type="button"
                                  onClick={() => setItem(idx, "packingType", pt)}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                                    iForm.packingType === pt
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                                  }`}>
                                  {pt}
                                </button>
                              ))}
                            </div>
                            {iForm.packingType === "Sheets" && (
                              <div className="flex items-center gap-2">
                                <input type="number" value={iForm.receivedQty}
                                  onChange={(e) => setItem(idx, "receivedQty", Math.max(0, +e.target.value || 0))}
                                  className="w-28 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-right text-xs font-semibold text-gray-900 focus:border-amber-500 focus:outline-none"
                                  min={0} max={item.quantity} />
                                <span className="text-xs text-gray-500">sheets</span>
                              </div>
                            )}
                            {iForm.packingType === "Packets" && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <input type="number" value={iForm.sheetsPerPacket || ""}
                                  onChange={(e) => setItem(idx, "sheetsPerPacket", Math.max(0, +e.target.value || 0))}
                                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-xs focus:border-blue-500 focus:outline-none"
                                  placeholder="sht/pkt" />
                                <span className="text-xs text-gray-400">sht/pkt ×</span>
                                <input type="number" value={iForm.noOfPackets || ""}
                                  onChange={(e) => setItem(idx, "noOfPackets", Math.max(0, +e.target.value || 0))}
                                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-xs focus:border-blue-500 focus:outline-none"
                                  placeholder="pkts" />
                                <span className="text-xs text-gray-400">pkts</span>
                                {iForm.sheetsPerPacket > 0 && iForm.noOfPackets > 0 && (
                                  <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                                    = {(iForm.sheetsPerPacket * iForm.noOfPackets).toLocaleString()} sheets
                                  </span>
                                )}
                              </div>
                            )}
                            {iForm.packingType === "Bundle" && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <input type="number" value={iForm.sheetsPerPacket || ""}
                                  onChange={(e) => setItem(idx, "sheetsPerPacket", Math.max(0, +e.target.value || 0))}
                                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-xs focus:border-blue-500 focus:outline-none"
                                  placeholder="sht/pkt" />
                                <span className="text-xs text-gray-400">sht/pkt ×</span>
                                <input type="number" value={iForm.packetsPerBundle || ""}
                                  onChange={(e) => setItem(idx, "packetsPerBundle", Math.max(0, +e.target.value || 0))}
                                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-xs focus:border-blue-500 focus:outline-none"
                                  placeholder="pkt/bnd" />
                                <span className="text-xs text-gray-400">pkt/bnd ×</span>
                                <input type="number" value={iForm.noOfBundles || ""}
                                  onChange={(e) => setItem(idx, "noOfBundles", Math.max(0, +e.target.value || 0))}
                                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-xs focus:border-blue-500 focus:outline-none"
                                  placeholder="bndls" />
                                <span className="text-xs text-gray-400">bndls</span>
                                {iForm.sheetsPerPacket > 0 && iForm.packetsPerBundle > 0 && iForm.noOfBundles > 0 && (
                                  <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                                    = {(iForm.sheetsPerPacket * iForm.packetsPerBundle * iForm.noOfBundles).toLocaleString()} sheets
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Weight Verification — 3-way: PO / Plan / GRN (all kg) */}
                        {(() => {
                          const poWt   = tracker?.orderedQty ?? item.quantity;
                          const planWt = item.weightKg ?? item.quantity ?? 0;
                          const grnWt  = iForm.receivedQty;
                          const baseWt = planWt > 0 ? planWt : poWt;
                          const diff   = grnWt - baseWt;
                          const pct    = baseWt > 0 ? (diff / baseWt) * 100 : 0;
                          const fmt    = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
                          const diffCls = Math.abs(pct) <= 1
                            ? "border-green-200 bg-green-50 text-green-700"
                            : Math.abs(pct) <= 4
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-red-200 bg-red-50 text-red-700";
                          return (
                            <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500 mb-2.5 flex items-center gap-1.5">
                                <Scale className="h-3 w-3" /> Weight Verification
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                {/* PO ordered */}
                                <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-center">
                                  <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-0.5">PO Ordered</p>
                                  <p className="text-sm font-bold text-gray-800">{fmt(poWt)} <span className="text-[10px] font-medium text-gray-400">kg</span></p>
                                </div>
                                {/* Plan dispatched */}
                                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-center">
                                  <p className="text-[9px] uppercase tracking-wide text-indigo-400 mb-0.5">Plan Dispatched</p>
                                  <p className="text-sm font-bold text-indigo-800">
                                    {planWt > 0 ? <>{fmt(planWt)} <span className="text-[10px] font-medium text-indigo-400">kg</span></> : <span className="text-gray-400">—</span>}
                                  </p>
                                </div>
                                {/* GRN received */}
                                <div className={`rounded-lg border px-2.5 py-2 text-center ${iForm.receivedQty > 0 ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}>
                                  <p className={`text-[9px] uppercase tracking-wide mb-0.5 ${iForm.receivedQty > 0 ? "text-emerald-500" : "text-gray-400"}`}>GRN Received</p>
                                  <p className={`text-sm font-bold ${iForm.receivedQty > 0 ? "text-emerald-800" : "text-gray-400"}`}>
                                    {iForm.receivedQty > 0 ? <>{fmt(grnWt)} <span className="text-[10px] font-medium text-emerald-500">kg</span></> : "—"}
                                  </p>
                                  {iForm.receivedQty === 0 && <p className="text-[9px] mt-0.5 text-gray-400">enter qty above</p>}
                                </div>
                              </div>
                              {/* Difference bar */}
                              {iForm.receivedQty > 0 && baseWt > 0 && (
                                <div className={`mt-2 rounded-lg border px-3 py-1.5 text-xs font-semibold flex items-center justify-between ${diffCls}`}>
                                  <span>
                                    vs {planWt > 0 ? "Plan" : "PO"}:{" "}
                                    {diff >= 0 ? "+" : ""}{fmt(diff)} kg
                                    {diff !== 0 && (
                                      <span className="ml-2 font-normal opacity-75">
                                        ({diff > 0 ? "surplus" : "short"})
                                      </span>
                                    )}
                                  </span>
                                  <span className="tabular-nums">
                                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Invoice & billing rate */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Item Invoice No</label>
                            <input type="text" value={iForm.itemInvoiceNo}
                              onChange={(e) => setItem(idx, "itemInvoiceNo", e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none"
                              placeholder="INV-001" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">PO Rate (₹)</label>
                            <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-700">
                              {poRate ? `₹${poRate.toLocaleString()}` : "—"}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Billing Rate (₹)</label>
                            <input type="number" value={iForm.billingRate || ""}
                              onChange={(e) => setItem(idx, "billingRate", Math.max(0, +e.target.value || 0))}
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                              placeholder="0.00" step="0.01" />
                          </div>
                          <div className="flex items-end pb-0.5">
                            {rateDiff !== null && (
                              <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold border ${
                                rateDiff > 0 ? "bg-red-50 text-red-700 border-red-200" :
                                rateDiff < 0 ? "bg-green-50 text-green-700 border-green-200" :
                                "bg-gray-50 text-gray-500 border-gray-200"
                              }`}>
                                {rateDiff > 0 ? "▲" : rateDiff < 0 ? "▼" : "="} ₹{Math.abs(rateDiff).toFixed(2)} {rateDiff > 0 ? "over" : rateDiff < 0 ? "under" : "match"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Damaged / Short / QC / Delivery */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Damaged Qty</label>
                            <input type="number" value={iForm.damagedQty || ""}
                              onChange={(e) => setItem(idx, "damagedQty", Math.max(0, +e.target.value || 0))}
                              className="w-full rounded-lg border border-red-200 bg-red-50/50 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none"
                              min={0} placeholder="0" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Short (kg)</label>
                            <div className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold ${shortQty > 0 ? "border-orange-200 bg-orange-50 text-orange-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
                              {shortQty > 0 ? qtyToKg(item, shortQty).toLocaleString() : "—"}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">QC Result</label>
                            <select value={iForm.qcResult} onChange={(e) => setItem(idx, "qcResult", e.target.value)}
                              className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${
                                iForm.qcResult === "Accepted" ? "border-green-200 bg-green-50 text-green-700" :
                                iForm.qcResult === "Rejected" ? "border-red-200 bg-red-50 text-red-700" :
                                iForm.qcResult === "Hold" ? "border-orange-200 bg-orange-50 text-orange-700" :
                                "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
                              {["Accepted", "Accepted with Remark", "Rejected", "Hold"].map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Routing</label>
                            <select value={iForm.deliveryMode}
                              onChange={(e) => setItem(idx, "deliveryMode", e.target.value as DeliveryMode)}
                              className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none ${
                                iForm.deliveryMode === "DirectToClient" ? "border-purple-200 bg-purple-50 text-purple-700" :
                                iForm.deliveryMode === "Split" ? "border-indigo-200 bg-indigo-50 text-indigo-700" :
                                "border-teal-200 bg-teal-50 text-teal-700"}`}>
                              {deliveryModeOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Split qty */}
                        {iForm.deliveryMode === "Split" && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-purple-600 font-medium whitespace-nowrap">Direct (kg):</span>
                            <input type="number" value={iForm.directQty || ""}
                              onChange={(e) => {
                                const kg = Math.max(0, Math.min(+e.target.value || 0, goodQty));
                                setItem(idx, "directQty", kg);
                              }}
                              className="w-28 rounded-lg border border-purple-300 bg-purple-50 px-2 py-1.5 text-right text-xs font-semibold text-purple-900 focus:border-purple-500 focus:outline-none"
                              placeholder="0" />
                            <span className="text-xs text-teal-600">Stock: {qtyToKg(item, Math.max(0, goodQty - iForm.directQty)).toLocaleString()} kg</span>
                          </div>
                        )}
                        {iForm.deliveryMode === "DirectToClient" && (
                          <p className="text-xs text-purple-600 font-medium">All {qtyToKg(item, goodQty).toLocaleString()} kg → client</p>
                        )}
                      </div>}
                    </div>
                  );
                })}
              </div>
              {itemForms.some((f) => f.qcResult === "Rejected") && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-xs text-red-700">
                  <Ban className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  Rejected items will create a discrepancy — GRN will be saved with "Discrepancy Raised" status.
                </div>
              )}
            </div>

            {/* Section 7: Warehouse & Remarks */}
            <div className="px-6 pt-4 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Warehouse
                    {itemForms.every((f) => f.deliveryMode === "DirectToClient") && (
                      <span className="ml-1 text-purple-500">(not required — all direct)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    list="wh-datalist"
                    value={warehouseText}
                    onChange={(e) => handleWarehouseChange(e.target.value)}
                    disabled={itemForms.every((f) => f.deliveryMode === "DirectToClient")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="Search or type warehouse…"
                  />
                  <datalist id="wh-datalist">
                    {warehouses.map((w) => <option key={w.id} value={w.name} />)}
                  </datalist>
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
              <p className="text-xs text-gray-500">{tlp.items.length} GRN {tlp.items.length !== 1 ? "entries" : "entry"} · Stock lot auto-created for stock portion</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirming(false)} disabled={saving} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Back</button>
                <button onClick={handleSave} disabled={saving}
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirm & Save
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400">
                {tlp.items.length} item{tlp.items.length !== 1 ? "s" : ""} · Status: <span className="font-semibold">{resolvedStatus}</span>
                {itemForms.some((f) => f.deliveryMode !== "StockIn") && (
                  <span className="ml-2 text-purple-600 font-semibold">· Split/Direct routing active</span>
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => setConfirming(true)}
                  disabled={tlp.items.some((i) => !i.trackerId)}
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

// ─── Edit GRN Modal ────────────────────────────────────────────────────────────

function EditGRNModal({
  grn, warehouses, onSave, onClose,
}: {
  grn: GrnRow;
  warehouses: WarehouseDropdown[];
  onSave: (dto: UpdateGrnDto) => Promise<void>;
  onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState<number | undefined>(grn.warehouseId ?? undefined);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ warehouseId, remarks: remarks || undefined });
    } finally {
      setSaving(false);
    }
  };

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
            <select value={warehouseId ?? ""} onChange={(e) => setWarehouseId(+e.target.value || undefined)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="">— Select Warehouse —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
            <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── View GRN Modal ────────────────────────────────────────────────────────────

function ViewGRNModal({
  grn, detail, onEdit, onPrint, onDelete, onClose,
}: {
  grn: GrnRow;
  detail: GrnDetailRow | null;
  onEdit: () => void;
  onPrint: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const d = detail;
  const billing = getBillingModeLabel(grn.billingMode, grn.blindShipment);
  const BillingIcon = billing.Icon;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <PackageCheck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{grn.grnNumber}</h2>
              <p className="text-xs text-gray-500">{grn.poNumber} · {grn.millName}</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(grn.status)}`}>{grn.status}</span>
            {grn.grnDeliveryMode !== "StockIn" && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDeliveryModeColor(grn.grnDeliveryMode)}`}>
                <ArrowRight className="h-3 w-3" />
                {grn.grnDeliveryMode === "DirectToClient" ? "Direct to Client" : "Split Delivery"}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${billing.color}`}>
              <BillingIcon className="h-3 w-3" /> {billing.label}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5 space-y-4">

          {/* Flow Chain */}
          {(d?.linkedSoNumber || d?.loadPlanNumber) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 mb-2">Flow Chain</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {d?.soCustomerName && (
                  <><span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{d.soCustomerName}</span>
                  <span className="text-blue-300">→</span></>
                )}
                {d?.linkedSoNumber && (
                  <><span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{d.linkedSoNumber}</span>
                  <span className="text-blue-300">→</span></>
                )}
                <span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{grn.poNumber}</span>
                <span className="text-blue-300">→</span>
                {d?.loadPlanNumber && (
                  <><span className="rounded-lg bg-white border border-blue-200 px-2.5 py-1 font-medium text-blue-800">{d.loadPlanNumber}</span>
                  <span className="text-blue-300">→</span></>
                )}
                <span className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white">{grn.grnNumber}</span>
              </div>
            </div>
          )}

          {/* Billing Mode notice for non-normal */}
          {(grn.billingMode !== "Normal" || grn.blindShipment) && (
            <div className={`rounded-xl border p-3 ${grn.billingMode === "Blind" || grn.blindShipment ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
              <div className="flex items-center gap-2 text-xs">
                <BillingIcon className="h-4 w-4" />
                <strong>{billing.label}</strong>
                {grn.billingMode === "InvoiceOverride" && d?.overrideClientName && (
                  <span className="text-gray-600">— Mill-facing name: <span className="font-semibold">{d.overrideClientName}</span></span>
                )}
                {(grn.billingMode === "Blind" || grn.blindShipment) && (
                  <span className="text-red-700">— Mill does not know the end customer</span>
                )}
              </div>
            </div>
          )}

          {/* GRN Details */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">GRN Details</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                { label: "GRN Date",        value: grn.grnDate },
                { label: "PO #",            value: grn.poNumber, blue: true },
                { label: "Mill / Origin",   value: grn.millName },
                { label: "Warehouse",       value: grn.warehouseName || "—" },
                { label: "Mill Challan #",  value: d?.millChallanNumber || "—", mono: true },
                { label: "Purchase Invoice",value: d?.purchaseInvoiceNumber || "—", mono: true },
                { label: "Bin Location",    value: grn.binLocation || "—", mono: true },
                { label: "Lot #",           value: grn.lotNumber || "—", mono: true },
              ].map(({ label, value, blue, mono }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${blue ? "text-blue-700" : "text-gray-900"} ${mono ? "font-mono" : ""}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quantities & Delivery Split */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Material & Quantity Routing</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Ordered</th>
                  <th className="px-3 py-2 text-right font-semibold text-green-700">Received</th>
                  <th className="px-3 py-2 text-right font-semibold text-teal-700">→ Stock</th>
                  <th className="px-3 py-2 text-right font-semibold text-purple-700">→ Client</th>
                  <th className="px-3 py-2 text-right font-semibold text-orange-600">Short</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-600">Damaged</th>
                </tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-900">{grn.paper}</p>
                      <p className="text-gray-500 mt-0.5">{grn.gsm}g · {grn.size}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{d?.poRate ? `₹${d.poRate.toLocaleString()}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 font-medium">{grn.orderedQty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-green-700">{grn.receivedQty.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right">
                      {grn.stockQty > 0
                        ? <span className="font-bold text-teal-700">{grn.stockQty.toLocaleString()}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {grn.directQty > 0
                        ? <div>
                            <span className="font-bold text-purple-700">{grn.directQty.toLocaleString()}</span>
                            {grn.directClientName && <p className="text-[10px] text-purple-500">{grn.directClientName}</p>}
                          </div>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold"><span className={grn.shortQty > 0 ? "text-orange-600" : "text-gray-300"}>{grn.shortQty > 0 ? grn.shortQty.toLocaleString() : "—"}</span></td>
                    <td className="px-3 py-2.5 text-right font-semibold"><span className={grn.damagedQty > 0 ? "text-red-600" : "text-gray-300"}>{grn.damagedQty > 0 ? grn.damagedQty.toLocaleString() : "—"}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transport + QC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Transport</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "LR Number",  value: grn.lrNumber || "—", mono: true },
                  { label: "TLP #",      value: grn.loadPlanNumber || "—", blue: true },
                  { label: "Vehicle #",  value: grn.vehicleNumber || "—", mono: true },
                  { label: "Received By",value: d?.receivedBy || "—" },
                ].map(({ label, value, mono, blue }) => (
                  <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] text-gray-400">{label}</p>
                    <p className={`text-xs font-semibold text-gray-900 mt-0.5 ${mono ? "font-mono" : ""} ${blue ? "text-blue-700" : ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Quality Check</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">Condition</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{grn.condition || "—"}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">QC Result</p>
                  {grn.qcResult
                    ? <span className={`inline-flex mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getQcColor(grn.qcResult)}`}>{grn.qcResult}</span>
                    : <span className="text-xs text-gray-400">—</span>
                  }
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">Quality Grade</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{grn.qualityGrade || "—"}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">Effective Client</p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">{grn.effectiveClientName || grn.customerName || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status log */}
          {d?.statusLog && d.statusLog.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Status History</p>
              <div className="space-y-1.5">
                {d.statusLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        {entry.fromStatus && <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${getStatusColor(entry.fromStatus)}`}>{entry.fromStatus}</span>}
                        {entry.fromStatus && <span className="text-gray-300">→</span>}
                        <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getStatusColor(entry.toStatus)}`}>{entry.toStatus}</span>
                      </div>
                      {entry.remarks && <p className="text-[11px] text-gray-500 mt-0.5">{entry.remarks}</p>}
                    </div>
                    <div className="text-right text-[10px] text-gray-400 flex-shrink-0">
                      <p>{entry.changedBy}</p>
                      <p>{new Date(entry.changedAt).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d?.remarks && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400">Remarks</p>
              <p className="text-xs text-gray-700 mt-0.5">{d.remarks}</p>
            </div>
          )}

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
            {d && (
              <button onClick={onPrint} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            )}
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

function RowActions({ onView, onEdit, onDelete }: {
  onView: () => void; onEdit: () => void; onDelete: () => void;
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
            { label: "Edit GRN",    icon: Pencil, fn: onEdit },
            { label: "Delete",      icon: Trash2, fn: onDelete, red: true },
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

function GRNPage() {
  const [grns, setGrns] = useState<GrnRow[]>([]);
  const [pendingTlps, setPendingTlps] = useState<TruckLoadPlanApiDto[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDropdown[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGrn, setSelectedGrn] = useState<GrnRow | null>(null);
  const [selectedGrnDetail, setSelectedGrnDetail] = useState<GrnDetailRow | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTlp, setSelectedTlp] = useState<TruckLoadPlanApiDto | null>(null);
  const [showPending, setShowPending] = useState(false);
  const [pendingSearch, setPendingSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [grnRes, tlpRes, whRes] = await Promise.all([
        grnApi.list({ pageSize: 200 }),
        truckLoadPlanApi.list({ status: "In Transit", pageSize: 200 }),
        warehouseApi.dropdown(),
      ]);
      setGrns(grnRes.items);
      const grnTlpIds = new Set(grnRes.items.map((g) => g.sourceLoadPlanId).filter(Boolean));
      setPendingTlps(tlpRes.items.filter((t) => !grnTlpIds.has(t.id)));
      setWarehouses(whRes);
    } catch {
      // silently fail — page shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => ({
    draft:         grns.filter((g) => g.status === "Draft").length,
    qcPending:     grns.filter((g) => g.status === "QC Pending").length,
    approved:      grns.filter((g) => g.status === "Approved").length,
    stockUpdated:  grns.filter((g) => g.status === "Stock Updated").length,
    discrepancy:   grns.filter((g) => g.status === "Discrepancy Raised").length,
    totalReceived: grns.reduce((s, g) => s + g.receivedQty, 0),
    totalStock:    grns.reduce((s, g) => s + qtyToKg(g, g.stockQty), 0),
    totalDirect:   grns.reduce((s, g) => s + qtyToKg(g, g.directQty), 0),
  }), [grns]);

  const filteredPending = useMemo(() => {
    if (!pendingSearch.trim()) return pendingTlps;
    const q = pendingSearch.toLowerCase();
    return pendingTlps.filter((tlp) =>
      tlp.planNumber.toLowerCase().includes(q) ||
      (tlp.origin || "").toLowerCase().includes(q) ||
      (tlp.transporterName || "").toLowerCase().includes(q) ||
      (tlp.truckNumber || "").toLowerCase().includes(q) ||
      tlp.items.some((i) => (i.poNumber || "").toLowerCase().includes(q))
    );
  }, [pendingTlps, pendingSearch]);

  const openView = async (grn: GrnRow) => {
    setSelectedGrn(grn);
    setSelectedGrnDetail(null);
    setShowViewModal(true);
    try {
      const detail = await grnApi.getById(grn.id);
      setSelectedGrnDetail(detail);
    } catch {}
  };

  const openEdit = (grn: GrnRow) => {
    setSelectedGrn(grn);
    setShowViewModal(false);
    setShowEditModal(true);
  };

  const handleSaveGRN = async (dtos: CreateGrnDto[], tlpId: number) => {
    await Promise.all(dtos.map((dto) => grnApi.create(dto)));
    await truckLoadPlanApi.updateStatus(tlpId, { status: "Delivered" }).catch(() => {});
    await load();
    setShowCreateModal(false);
    setSelectedTlp(null);
  };

  const handleUpdateGRN = async (id: number, dto: UpdateGrnDto) => {
    await grnApi.update(id, dto);
    await load();
    setShowEditModal(false);
    setSelectedGrn(null);
  };

  const handleDeleteGRN = async (id: number) => {
    await grnApi.remove(id);
    await load();
    setShowViewModal(false);
    setSelectedGrn(null);
  };

  const statusOptions = [
    { label: "Draft",              value: "Draft" },
    { label: "QC Pending",         value: "QC Pending" },
    { label: "Approved",           value: "Approved" },
    { label: "Stock Updated",      value: "Stock Updated" },
    { label: "Discrepancy Raised", value: "Discrepancy Raised" },
  ];

  const columns: ColumnConfig<GrnRow>[] = useMemo(() => [
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
      id: "millName", accessorKey: "millName", header: "Mill",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 130,
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
      id: "routing", accessorKey: "grnDeliveryMode", header: "Routing",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => {
        const g = info.row.original;
        return (
          <div className="text-xs space-y-0.5">
            <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${getDeliveryModeColor(g.grnDeliveryMode)}`}>
              {g.grnDeliveryMode === "StockIn" ? "To Stock" : g.grnDeliveryMode === "DirectToClient" ? "Direct" : "Split"}
            </span>
            {g.stockQty > 0 && <p className="text-teal-700">{qtyToKg(g, g.stockQty).toLocaleString()} kg → stock</p>}
            {g.directQty > 0 && <p className="text-purple-700">{qtyToKg(g, g.directQty).toLocaleString()} kg → client</p>}
          </div>
        );
      },
    },
    {
      id: "qtyTracking", accessorKey: "orderedQty", header: "Ordered / Received (kg)",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 170,
      cell: (info) => {
        const g = info.row.original;
        const ord = qtyToKg(g, g.orderedQty);
        const rcv = qtyToKg(g, g.receivedQty);
        const bal = qtyToKg(g, g.balanceQty);
        return (
          <div className="text-sm">
            <span className="text-gray-500">{ord.toLocaleString()}</span>
            <span className="mx-1 text-gray-300">/</span>
            <span className={`font-semibold ${g.balanceQty > 0 ? "text-red-600" : "text-green-700"}`}>{rcv.toLocaleString()}</span>
            {g.balanceQty > 0 && <span className="ml-1 text-xs text-red-500">(-{bal.toLocaleString()})</span>}
          </div>
        );
      },
    },
    {
      id: "warehouseName", accessorKey: "warehouseName", header: "Warehouse",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => <span>{(info.getValue() as string) || <span className="text-gray-300">—</span>}</span>,
    },
    {
      id: "customerName", accessorKey: "customerName", header: "Customer",
      filterType: "text", enableSorting: true, defaultVisible: false, size: 130,
      cell: (info) => {
        const g = info.row.original;
        return (
          <div className="text-xs">
            <p>{g.effectiveClientName || g.customerName || <span className="text-gray-300">—</span>}</p>
            {g.billingMode !== "Normal" && (
              <span className={`text-[10px] ${g.billingMode === "Blind" || g.blindShipment ? "text-red-500" : "text-orange-500"}`}>
                {g.billingMode === "Blind" || g.blindShipment ? "Blind" : "Override"}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "qcResult", accessorKey: "qcResult", header: "QC",
      filterType: "select",
      filterOptions: [
        { label: "Accepted",             value: "Accepted" },
        { label: "Accepted with Remark", value: "Accepted with Remark" },
        { label: "Rejected",             value: "Rejected" },
        { label: "Hold",                 value: "Hold" },
      ],
      enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => {
        const v = info.getValue() as string;
        return v
          ? <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getQcColor(v)}`}>{v}</span>
          : <span className="text-xs text-gray-300">—</span>;
      },
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
            onView={() => openView(grn)}
            onEdit={() => openEdit(grn)}
            onDelete={() => handleDeleteGRN(grn.id)}
          />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">

        <button onClick={() => { setShowPending((v) => !v); setPendingSearch(""); }}
          className={`rounded-xl border-2 p-4 text-left transition-all ${showPending ? "border-amber-400 bg-amber-500 shadow-md" : pendingTlps.length > 0 ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-300" : "border-gray-100 bg-white hover:border-gray-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${showPending ? "text-amber-100" : "text-gray-400"}`}>Pending GRN</p>
              <p className={`mt-1.5 text-2xl font-bold ${showPending ? "text-white" : pendingTlps.length > 0 ? "text-amber-600" : "text-gray-900"}`}>{pendingTlps.length}</p>
              <p className={`mt-0.5 text-xs ${showPending ? "text-amber-100" : "text-amber-500"}`}>{showPending ? "Click to hide" : "Shipments waiting"}</p>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${showPending ? "bg-amber-400" : "bg-amber-100"}`}>
              <Truck className={`h-5 w-5 ${showPending ? "text-white" : "text-amber-600"}`} />
            </div>
          </div>
        </button>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Stock Updated</p>
              <p className="mt-1.5 text-2xl font-bold text-green-700">{kpis.stockUpdated}</p>
              <p className="mt-0.5 text-xs text-green-600">In inventory</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50"><PackageCheck className="h-5 w-5 text-green-500" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Discrepancy</p>
              <p className="mt-1.5 text-2xl font-bold text-red-700">{kpis.discrepancy}</p>
              <p className="mt-0.5 text-xs text-red-600">Issues found</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Draft</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-700">{kpis.draft}</p>
              <p className="mt-0.5 text-xs text-gray-500">New arrivals</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50"><FileText className="h-5 w-5 text-gray-400" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">QC Pending</p>
              <p className="mt-1.5 text-2xl font-bold text-yellow-700">{kpis.qcPending}</p>
              <p className="mt-0.5 text-xs text-yellow-600">On hold</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50"><Clock className="h-5 w-5 text-yellow-500" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-medium uppercase tracking-wide text-gray-400">Approved</p>
              <p className="mt-1.5 text-2xl font-bold text-blue-700">{kpis.approved}</p>
              <p className="mt-0.5 text-xs text-blue-600">QC passed</p></div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50"><CheckCircle className="h-5 w-5 text-blue-500" /></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">→ Stock</p>
            <p className="mt-1.5 text-2xl font-bold text-teal-700">{(kpis.totalStock / 1000).toFixed(1)}K</p>
            <p className="mt-0.5 text-xs text-teal-600">kg to inventory</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">→ Client Direct</p>
            <p className="mt-1.5 text-2xl font-bold text-purple-700">{(kpis.totalDirect / 1000).toFixed(1)}K</p>
            <p className="mt-0.5 text-xs text-purple-600">kg bypassed stock</p>
          </div>
        </div>
      </div>

      {/* Pending TLP Grid */}
      {showPending && (
        <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-100 bg-amber-50">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-amber-900">Shipments Awaiting GRN</h2>
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{pendingTlps.length}</span>
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
                  {["Plan #", "Origin", "Truck", "Transporter", "Items / POs", "Total Weight", "Planned Delivery", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPending.map((tlp) => {
                    const totalWt = tlp.items.reduce((s, i) => s + qtyToKg(i, i.quantity), 0);
                    const uniquePOs = new Set(tlp.items.map((i) => i.poNumber)).size;
                    return (
                      <tr key={tlp.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-3"><span className="font-semibold text-blue-700">{tlp.planNumber}</span></td>
                        <td className="px-4 py-3 text-gray-700">{tlp.origin || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{tlp.truckNumber || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{tlp.transporterName || "—"}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900">{tlp.items.length} item{tlp.items.length !== 1 ? "s" : ""} · {uniquePOs} PO{uniquePOs !== 1 ? "s" : ""}</p>
                          {tlp.items[0] && <p className="text-xs text-gray-500 mt-0.5">{tlp.items[0].paper} {tlp.items[0].gsm}g{tlp.items.length > 1 ? ` +${tlp.items.length - 1}` : ""}</p>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalWt.toLocaleString()}<span className="ml-1 text-xs font-normal text-gray-400">kg</span></td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{tlp.plannedDeliveryDate || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            disabled={tlp.items.some((i) => !i.trackerId)}
                            onClick={() => { setSelectedTlp(tlp); setShowCreateModal(true); }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
            emptyMessage="No GRNs yet. Create GRNs from dispatched shipments above."
          />
        </div>
      )}

      {showViewModal && selectedGrn && (
        <ViewGRNModal
          grn={selectedGrn}
          detail={selectedGrnDetail}
          onEdit={() => openEdit(selectedGrn)}
          onPrint={() => selectedGrnDetail && printGRN(selectedGrnDetail)}
          onDelete={() => handleDeleteGRN(selectedGrn.id)}
          onClose={() => { setShowViewModal(false); setSelectedGrn(null); setSelectedGrnDetail(null); }}
        />
      )}

      {showEditModal && selectedGrn && (
        <EditGRNModal
          grn={selectedGrn}
          warehouses={warehouses}
          onSave={(dto) => handleUpdateGRN(selectedGrn.id, dto)}
          onClose={() => { setShowEditModal(false); setSelectedGrn(null); }}
        />
      )}

      {showCreateModal && selectedTlp && (
        <CreateGRNModal
          tlp={selectedTlp}
          warehouses={warehouses}
          onSave={(dtos) => handleSaveGRN(dtos, selectedTlp.id)}
          onClose={() => { setShowCreateModal(false); setSelectedTlp(null); }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="grn.read"><GRNPage /></PermGuard>;
}
