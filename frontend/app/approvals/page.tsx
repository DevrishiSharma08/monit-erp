"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { SalesOrder, SOLine as SalesOrderLine } from "@/context/SalesOrderContext";
import {
  ThumbsUp, Clock, IndianRupee, Eye, Mail, Check, Package,
  ShoppingCart, Pencil, Factory, Download,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { ActionMenu } from "@/components/ActionMenu";
import { EmailModal, EmailFormData, EmailContact } from "@/components/EmailModal";
import { Modal } from "@/components/Modal";
import { SalesOrderForm } from "@/components/forms/SalesOrderForm";
import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm";
import { cn } from "@/lib/utils";
import { PortalModal, ModalCloseButton } from "@/components/PortalModal";
import { useSalesOrder } from "@/context/SalesOrderContext";
import { useToast } from "@/context/ToastContext";
import { poApi, PORow, CreatePODto, salesOrderApi, customerApi, millApi } from "@/lib/api-services";
import { emailSentCache } from "@/lib/emailSentCache";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmailData(so: SalesOrder): EmailFormData {
  const totalKg = so.lines.reduce((s, l) => s + ((l as any).weightKg ?? 0), 0);
  return {
    to:      (so as any).customerEmail ? [(so as any).customerEmail] : [],
    cc:      [],
    subject: `Sales Order ${so.soNumber} Approved — ${so.customer}`,
    body: [
      `Dear ${so.customer},`,
      ``,
      `Your Sales Order ${so.soNumber} dated ${so.orderDate} has been approved and is now being processed.`,
      ``,
      `Order Summary:`,
      `  • Items       : ${so.lines.length}`,
      `  • Total Weight: ${totalKg.toLocaleString("en-IN")} KG`,
      `  • Total Amount: ₹${so.totalValue.toLocaleString("en-IN")}`,
      ``,
      `We will keep you informed about the dispatch schedule.`,
      ``,
      `Thank you for your business.`,
      ``,
      `Regards,`,
      `Monit Paper Agency`,
    ].join("\n"),
  };
}

function buildPOEmailData(po: PORow): EmailFormData {
  const totalWeightKg = po.items.reduce((s, i) => s + (i.weightKg ?? 0), 0);
  return {
    to:      [],
    cc:      [],
    subject: `Purchase Order ${po.poNumber} Approved — ${po.millName}`,
    body: [
      `Dear ${po.millName},`,
      ``,
      `We are pleased to confirm Purchase Order ${po.poNumber} dated ${po.orderDate}.`,
      ``,
      `Order Summary:`,
      `  • Items       : ${po.items.length}`,
      totalWeightKg > 0
        ? `  • Total Wt    : ${totalWeightKg.toLocaleString("en-IN")} KG`
        : `  • Total Qty   : ${po.totalQuantity.toLocaleString("en-IN")}`,
      `  • Total Value : ₹${po.totalValue.toLocaleString("en-IN")}`,
      po.deliveryMode ? `  • Delivery    : ${po.deliveryMode}` : "",
      po.expectedDeliveryDate ? `  • Expected By : ${po.expectedDeliveryDate}` : "",
      ``,
      `Please acknowledge receipt and confirm production schedule.`,
      ``,
      `Regards,`,
      `Monit Paper Agency`,
    ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n"),
  };
}

// ─── SO Approval View Modal ───────────────────────────────────────────────────

function ApprovalViewModal({
  so, onApprove, onApproveAndSend, onEdit, onClose,
}: {
  so: SalesOrder;
  onApprove: () => void;
  onApproveAndSend: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <PortalModal onClose={onClose}>

        {/* Header — orange tinted */}
        <div className="flex items-center justify-between border-b border-orange-100 px-5 py-3.5 bg-orange-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 shadow-sm">
              <ShoppingCart className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">{so.soNumber}</h2>
              <p className="text-xs text-gray-500">{so.customer} · {so.orderDate}</p>
            </div>
            <span className="ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-orange-100 text-orange-600">
              Approval Pending
            </span>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-4">

          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">SO Number</p>
              <p className="text-sm font-black text-blue-700 mt-0.5">{so.soNumber}</p>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400">Customer</p>
              <p className="text-sm font-bold text-violet-700 mt-0.5 truncate">{so.customer}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Order Value</p>
              <p className="text-sm font-black text-emerald-700 mt-0.5">₹{so.totalValue.toLocaleString("en-IN")}</p>
            </div>
          </div>

          {/* Order details */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Details</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                { label: "SO Number",     value: so.soNumber,               blue: true },
                { label: "Order Date",    value: so.orderDate },
                { label: "Customer",      value: so.customer },
                { label: "Contact",       value: so.contactPerson || "—" },
                { label: "Salesman",      value: so.salesman },
                { label: "Payment Terms", value: so.paymentTerms || "—" },
                { label: "Delivery Mode", value: so.deliveryMode },
                { label: "Delivery Terms",value: so.deliveryTerms || "—" },
                {
                  label: "Delivery Party",
                  value: (so as any).deliveryParty || so.customer,
                },
                {
                  label: "Delivery Address",
                  value: so.lines[0]?.deliveryAddress || "—",
                },
              ].map(({ label, value, blue }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className={cn("text-xs font-semibold mt-0.5 text-gray-900", blue && "text-blue-700")}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Lines table */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Lines</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Qty / Weight</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Disc %</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {so.lines.map((line) => (
                    <tr key={line.id} className="border-t border-gray-100">
                      <td className="px-3 py-2.5 text-gray-400">{line.lineNumber}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{line.materialCode || line.materialId}</p>
                        {line.gsm && <p className="text-gray-400">{line.gsm}g · {line.size}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                        {(line as any).qty !== undefined && (line as any).qty > 0 ? (
                          <span>
                            {(line as any).qty.toLocaleString()} Sheets
                            {(line as any).weightKg ? (
                              <span className="block text-xs text-gray-400">{(line as any).weightKg.toLocaleString()} KG</span>
                            ) : null}
                          </span>
                        ) : (
                          <span>{((line as any).weightKg ?? line.orderedQty).toLocaleString()} KG</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{line.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">
                        {line.discount && line.discount > 0 ? `${line.discount}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                        ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold text-blue-700">Order Total</td>
                    <td className="px-3 py-2.5 text-right text-sm font-black text-blue-800">
                      ₹{so.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {so.remarks && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400">Remarks</p>
              <p className="text-xs text-gray-700 mt-0.5">{so.remarks}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white transition-colors">
            Close
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit SO
          </button>
          <button onClick={onApprove}
            className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
            <ThumbsUp className="h-3.5 w-3.5" /> Approve
          </button>
          <button onClick={onApproveAndSend}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
            <Mail className="h-3.5 w-3.5" /> Approve &amp; Send
          </button>
        </div>
    </PortalModal>
  );
}

// ─── PO Approval View Modal ───────────────────────────────────────────────────

function POApprovalViewModal({
  po, onApprove, onApproveAndSend, onEdit, onClose,
}: {
  po: PORow;
  onApprove: () => void;
  onApproveAndSend: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const shipMode  = po.shipmentMode ?? (po.blindShipment ? "Blind" : "Normal");
  const isBlind    = shipMode === "Blind";
  const isOverride = shipMode === "InvoiceOverride";

  return (
    <PortalModal onClose={onClose}>

        {/* Header — violet tinted */}
        <div className="flex items-center justify-between border-b border-violet-100 px-5 py-3.5 bg-violet-50 rounded-t-2xl">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 shadow-sm flex-shrink-0">
              <Factory className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">{po.poNumber}</h2>
              <p className="text-xs text-gray-500">{po.millName} · {po.orderDate}</p>
            </div>
            <span className="ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-100 text-violet-600">
              Approval Pending
            </span>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-4">

          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400">PO Number</p>
              <p className="text-sm font-black text-violet-700 mt-0.5">{po.poNumber}</p>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">Mill</p>
              <p className="text-sm font-bold text-blue-700 mt-0.5 truncate">{po.millName}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Total Value</p>
              <p className="text-sm font-black text-emerald-700 mt-0.5">₹{po.totalValue.toLocaleString("en-IN")}</p>
            </div>
          </div>

          {/* PO Details — 3-col grid */}
          <div className="rounded-xl bg-gray-50 p-3 grid grid-cols-3 gap-x-4 gap-y-3">
            {[
              { label: "Mill",              value: po.millName },
              { label: "PO Date",           value: po.orderDate },
              { label: "Expected Delivery", value: po.expectedDeliveryDate || "—" },
              { label: "Payment Terms",     value: po.paymentTerms || "—" },
              { label: "Total Qty",         value: po.totalQuantity.toLocaleString("en-IN") },
              { label: "Total Value",       value: `₹${po.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
              ...(po.millSONumber ? [{ label: "Mill SO No.", value: po.millSONumber }] : []),
              ...(po.poType !== "For Stock" ? [{ label: "PO Type", value: po.poType }] : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {/* SO Reference + shipment mode info */}
          {po.linkedSONumber && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-indigo-400">SO Reference</p>
                  <p className="text-sm font-semibold text-indigo-700">{po.linkedSONumber}</p>
                </div>
                {!isBlind && !isOverride && (
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-indigo-400">Customer</p>
                      <p className="text-sm font-medium text-indigo-700">{po.directCustomer || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-indigo-400">Delivery Address</p>
                      <p className="text-xs text-indigo-600 leading-snug">{po.directDeliveryAddress || "—"}</p>
                    </div>
                  </>
                )}
                {isBlind && (
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-indigo-400">Bill To (Mill sees)</p>
                      <p className="text-sm font-medium text-orange-700">Monit Paper Agency</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-indigo-400">Ship To</p>
                      <p className="text-xs text-orange-600 leading-snug">{po.directDeliveryAddress || "—"}</p>
                    </div>
                  </>
                )}
                {isOverride && (
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-indigo-400">Invoice Party</p>
                      <p className="text-sm font-medium text-purple-700">{po.invoiceParty || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-indigo-400">Delivery Address</p>
                      <p className="text-xs text-purple-600 leading-snug">{po.directDeliveryAddress || "—"}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* For Stock: godown delivery address */}
          {!po.linkedSONumber && po.directDeliveryAddress && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Delivery Address</p>
              <p className="text-xs text-gray-700">{po.directDeliveryAddress}</p>
            </div>
          )}

          {/* Items table */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Items ({po.items.length})
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <th className="px-2 py-2 text-left font-semibold w-7">#</th>
                    <th className="px-2 py-2 text-left font-semibold">Material</th>
                    <th className="px-2 py-2 text-right font-semibold">Qty</th>
                    <th className="px-2 py-2 text-right font-semibold">Wt (KG)</th>
                    <th className="px-2 py-2 text-right font-semibold">Rate (₹)</th>
                    <th className="px-2 py-2 text-right font-semibold">Disc%</th>
                    <th className="px-2 py-2 text-right font-semibold">Final (₹)</th>
                    <th className="px-2 py-2 text-right font-semibold">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, idx) => {
                    const rawRate = item.discount && item.discount > 0 ? (item.rate / (1 - item.discount / 100)) : 0;
                    return (
                      <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                        <td className="px-2 py-2.5 text-gray-400">{idx + 1}</td>
                        <td className="px-2 py-2.5">
                          <p className="font-medium text-gray-900">{item.description || `Material #${item.materialId}`}</p>
                          {(item.gsm || item.size) && (
                            <p className="text-[10px] text-gray-400">
                              {item.gsm ? `${item.gsm}g` : ""}{item.gsm && item.size ? " · " : ""}{item.size || ""}
                            </p>
                          )}
                          {item.remark && <p className="text-[10px] text-amber-600 italic mt-0.5">{item.remark}</p>}
                        </td>
                        <td className="px-2 py-2.5 text-right font-medium text-gray-900">
                          {item.quantity.toLocaleString("en-IN")}
                        </td>
                        <td className="px-2 py-2.5 text-right text-gray-600">
                          {item.weightKg && item.weightKg > 0 ? item.weightKg.toLocaleString("en-IN") : "—"}
                        </td>
                        <td className="px-2 py-2.5 text-right text-gray-600">
                          {rawRate > 0 ? rawRate.toLocaleString("en-IN") : item.rate > 0 ? item.rate.toLocaleString("en-IN") : "—"}
                        </td>
                        <td className="px-2 py-2.5 text-right text-gray-500">
                          {item.discount && item.discount > 0 ? `${item.discount}%` : "—"}
                        </td>
                        <td className="px-2 py-2.5 text-right font-medium text-blue-700">
                          {item.rate > 0 ? item.rate.toFixed(2) : "—"}
                        </td>
                        <td className="px-2 py-2.5 text-right font-bold text-gray-900">
                          ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-violet-50 border-t-2 border-violet-200">
                    <td colSpan={2} className="px-2 py-2.5 text-right text-xs font-semibold text-violet-700">Total</td>
                    <td className="px-2 py-2.5 text-right text-xs font-bold text-violet-800">
                      {po.totalQuantity.toLocaleString("en-IN")}
                    </td>
                    <td colSpan={4} />
                    <td className="px-2 py-2.5 text-right text-sm font-black text-violet-800">
                      ₹{po.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Special instructions — 2-col numbered grid */}
          {po.specialInstructions && (() => {
            const instrLines = po.specialInstructions.split("\n").filter((l) => l.trim());
            return (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-amber-500 font-medium mb-2">
                  Special Instructions
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {instrLines.map((line, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                      <span className="text-[10px] text-amber-400 flex-shrink-0 mt-0.5">{i + 1}.</span>
                      <span className="leading-snug">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Internal remarks */}
          {po.remarks && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400">Internal Remarks</p>
              <p className="text-xs text-gray-700 mt-0.5">{po.remarks}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white transition-colors">
            Close
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit PO
          </button>
          <button onClick={onApprove}
            className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors">
            <ThumbsUp className="h-3.5 w-3.5" /> Approve
          </button>
          <button onClick={onApproveAndSend}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
            <Mail className="h-3.5 w-3.5" /> Approve &amp; Send
          </button>
        </div>
    </PortalModal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { salesOrders, updateSalesOrder, reload } = useSalesOrder();
  const { success, error: showError } = useToast();

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"so" | "po">("so");

  // ── SO state ──────────────────────────────────────────────────────────────
  const pendingOrders = useMemo(
    () => salesOrders.filter((o) => o.status === "Approval Pending"),
    [salesOrders],
  );

  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [viewOrder,    setViewOrder]    = useState<SalesOrder | null>(null);
  const [emailOrder,   setEmailOrder]   = useState<SalesOrder | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [editingOrder, setEditingOrder] = useState<Partial<SalesOrder> | undefined>();

  // ── PO state ──────────────────────────────────────────────────────────────
  const [pendingPOs,     setPendingPOs]     = useState<PORow[]>([]);
  const [poLoading,      setPoLoading]      = useState(false);
  const [selectedPOIds,  setSelectedPOIds]  = useState<Set<number>>(new Set());
  const [viewPO,         setViewPO]         = useState<PORow | null>(null);
  const [editPO,         setEditPO]         = useState<PORow | null>(null);
  const [emailPO,        setEmailPO]        = useState<PORow | null>(null);
  const [emailContacts,  setEmailContacts]  = useState<EmailContact[]>([]);

  const loadPendingPOs = useCallback(async () => {
    setPoLoading(true);
    try {
      const result = await poApi.list({ status: "Approval Pending", pageSize: 200 });
      setPendingPOs(result.items);
    } catch {
      // silently fail — tab shows empty state
    } finally {
      setPoLoading(false);
    }
  }, []);

  useEffect(() => { loadPendingPOs(); }, [loadPendingPOs]);

  // ── SO KPIs ───────────────────────────────────────────────────────────────

  const soKpis = useMemo(() => {
    const totalKg = pendingOrders.reduce(
      (s, o) => s + o.lines.reduce((ls, l) => ls + ((l as any).weightKg ?? 0), 0), 0,
    );
    const totalValue = pendingOrders.reduce((s, o) => s + o.totalValue, 0);
    const today = new Date();
    const oldestDays = pendingOrders.length
      ? Math.max(...pendingOrders.map((o) => {
          const d = new Date(o.orderDate);
          return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
        }))
      : 0;
    return { count: pendingOrders.length, totalKg, totalValue, oldestDays };
  }, [pendingOrders]);

  // ── PO KPIs ───────────────────────────────────────────────────────────────

  const poKpis = useMemo(() => {
    const totalQty   = pendingPOs.reduce((s, p) => s + p.totalQuantity, 0);
    const totalValue = pendingPOs.reduce((s, p) => s + p.totalValue, 0);
    const today = new Date();
    const oldestDays = pendingPOs.length
      ? Math.max(...pendingPOs.map((p) => {
          const d = new Date(p.orderDate);
          return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
        }))
      : 0;
    return { count: pendingPOs.length, totalQty, totalValue, oldestDays };
  }, [pendingPOs]);

  // ── SO Selection ─────────────────────────────────────────────────────────

  const isAllSelected = pendingOrders.length > 0 && pendingOrders.every((o) => selectedIds.has(o.id));

  const toggleAll = useCallback(() => {
    setSelectedIds(isAllSelected ? new Set() : new Set(pendingOrders.map((o) => o.id)));
  }, [isAllSelected, pendingOrders]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── PO Selection ─────────────────────────────────────────────────────────

  const isAllPOSelected = pendingPOs.length > 0 && pendingPOs.every((p) => selectedPOIds.has(p.id));

  const toggleAllPO = useCallback(() => {
    setSelectedPOIds(isAllPOSelected ? new Set() : new Set(pendingPOs.map((p) => p.id)));
  }, [isAllPOSelected, pendingPOs]);

  const toggleOnePO = useCallback((id: number) => {
    setSelectedPOIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── SO handlers ───────────────────────────────────────────────────────────

  const handleEdit = useCallback((so: SalesOrder) => {
    setEditingOrder(so);
    setViewOrder(null);
    setShowForm(true);
  }, []);

  const handleSuccess = useCallback((_soNumber: string, _isUpdate: boolean) => {
    reload();
    success("Sales order updated.");
    setShowForm(false);
    setEditingOrder(undefined);
  }, [reload, success]);

  const handleApprove = useCallback((id: string) => {
    updateSalesOrder(id, { status: "Pending Allocation" });
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setViewOrder(null);
    success("SO approved → Pending Allocation.");
  }, [updateSalesOrder, success]);

  const handleApproveAndSend = useCallback(async (so: SalesOrder) => {
    updateSalesOrder(so.id, { status: "Pending Allocation" });
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(so.id); return n; });
    setViewOrder(null);
    try {
      const raw = await customerApi.getContacts(parseInt(so.customerId));
      setEmailContacts(raw.filter((c) => c.email).map((c) => ({
        name: c.name, email: c.email!, isDefault: c.isDefault ?? false,
      })));
    } catch {
      setEmailContacts([]);
    }
    setEmailOrder(so);
    success("SO approved → Pending Allocation. Compose email below.");
  }, [updateSalesOrder, success]);

  const handleApproveSelected = useCallback(() => {
    const count = selectedIds.size;
    selectedIds.forEach((id) => updateSalesOrder(id, { status: "Pending Allocation" }));
    setSelectedIds(new Set());
    success(`${count} order${count !== 1 ? "s" : ""} approved → Pending Allocation.`);
  }, [selectedIds, updateSalesOrder, success]);

  const handleSendEmail = useCallback(async (data: EmailFormData) => {
    if (!emailOrder) return;
    await salesOrderApi.sendEmail(parseInt(emailOrder.id), {
      to: data.to, cc: data.cc, subject: data.subject, body: data.body,
    });
    emailSentCache.addSoId(emailOrder.id);
    success(`Email sent to ${data.to.join(", ")}`);
    setEmailOrder(null);
    setEmailContacts([]);
  }, [emailOrder, success]);

  // ── PO handlers ───────────────────────────────────────────────────────────

  const handleApprovePO = useCallback(async (po: PORow) => {
    try {
      await poApi.approve(po.id);
      setPendingPOs((prev) => prev.filter((p) => p.id !== po.id));
      setSelectedPOIds((prev) => { const n = new Set(prev); n.delete(po.id); return n; });
      setViewPO(null);
      success(`PO ${po.poNumber} approved → Sent to Mill.`);
    } catch {
      showError("Failed to approve PO. Please try again.");
    }
  }, [success, showError]);

  const handleApprovePOAndSend = useCallback(async (po: PORow) => {
    try {
      await poApi.approve(po.id);
      setPendingPOs((prev) => prev.filter((p) => p.id !== po.id));
      setSelectedPOIds((prev) => { const n = new Set(prev); n.delete(po.id); return n; });
      setViewPO(null);
      try {
        const raw = await millApi.getContacts(po.millId);
        setEmailContacts(raw.filter((c) => c.email).map((c) => ({
          name: c.contactPerson, email: c.email!, isDefault: c.isDefault ?? false,
        })));
      } catch {
        setEmailContacts([]);
      }
      setEmailPO(po);
      success(`PO ${po.poNumber} approved → Sent to Mill. Compose email below.`);
    } catch {
      showError("Failed to approve PO. Please try again.");
    }
  }, [success, showError]);

  const handleApproveSelectedPOs = useCallback(async () => {
    const ids  = Array.from(selectedPOIds);
    const count = ids.length;
    try {
      await Promise.all(ids.map((id) => poApi.approve(id)));
      setPendingPOs((prev) => prev.filter((p) => !selectedPOIds.has(p.id)));
      setSelectedPOIds(new Set());
      success(`${count} PO${count !== 1 ? "s" : ""} approved → Sent to Mill.`);
    } catch {
      showError("Some approvals failed. Please refresh and try again.");
    }
  }, [selectedPOIds, success, showError]);

  const handleSendPOEmail = useCallback(async (data: EmailFormData) => {
    if (!emailPO) return;
    await poApi.sendEmail(emailPO.id, {
      to: data.to, cc: data.cc, subject: data.subject, body: data.body,
    });
    emailSentCache.addPoId(emailPO.id);
    success(`Email sent to ${data.to.join(", ")}`);
    setEmailPO(null);
    setEmailContacts([]);
  }, [emailPO, success]);

  const handleDownloadSOPdf = useCallback(async (id: number) => {
    try {
      const { blob, filename } = await salesOrderApi.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      showError("Failed to download PDF.");
    }
  }, [showError]);

  const handleDownloadPOPdf = useCallback(async (id: number) => {
    try {
      const { blob, filename } = await poApi.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      showError("Failed to download PDF.");
    }
  }, [showError]);

  const handleEditPOSubmit = useCallback(async (dto: CreatePODto, id?: number) => {
    if (!id) return;
    try {
      await poApi.update(id, dto);
      await loadPendingPOs();
      setEditPO(null);
      success("PO updated successfully.");
    } catch {
      showError("Failed to update PO. Please try again.");
    }
  }, [loadPendingPOs, success, showError]);

  // ── SO Columns ─────────────────────────────────────────────────────────────

  const soColumns: ColumnConfig<SalesOrder>[] = useMemo(() => [
    {
      id: "_select", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 44,
      cell: (info) => {
        const id = info.getValue() as string;
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(id)}
            onChange={() => toggleOne(id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
          />
        );
      },
    },
    {
      id: "soNumber", accessorKey: "soNumber", header: "SO #",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 130,
      cell: (info) => (
        <span className="font-semibold text-blue-700">{info.getValue() as string}</span>
      ),
    },
    {
      id: "orderDate", accessorKey: "orderDate", header: "Date",
      filterType: "dateRange", enableSorting: true, defaultVisible: true, size: 100,
    },
    {
      id: "customer", accessorKey: "customer", header: "Customer",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 200,
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue() as string}</span>
      ),
    },
    {
      id: "salesman", accessorKey: "salesman", header: "Salesman",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 120,
    },
    {
      id: "lines", accessorKey: "lines", header: "Items",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 300, noTruncate: true,
      cell: (info) => {
        const lines = info.getValue() as SalesOrderLine[];
        const first = lines[0];
        if (!first) return <span className="text-gray-300 text-xs">—</span>;
        const code = first.materialCode || first.materialId || "—";
        const qty = (first as any).weightKg
          ? `${(first as any).weightKg.toLocaleString("en-IN")} KG`
          : `${first.orderedQty.toLocaleString("en-IN")}`;
        return (
          <div className="text-xs leading-snug">
            <span className="font-medium text-gray-800">{code}</span>
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">{qty}</span>
            {lines.length > 1 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">+{lines.length - 1}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "lineCount", accessorKey: "lines", header: "# Items",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 75,
      cell: (info) => {
        const n = (info.getValue() as SalesOrderLine[]).length;
        return (
          <span className={cn(
            "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
            n === 1 ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-600 ring-1 ring-blue-100"
          )}>
            {n}
          </span>
        );
      },
    },
    {
      id: "totalValue", accessorKey: "totalValue", header: "Amount",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => (
        <span className="font-semibold text-gray-900">
          ₹{(info.getValue() as number).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      id: "_actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 50,
      cell: (info) => {
        const so = info.row.original;
        return (
          <ActionMenu
            items={[
              { label: "View",           icon: Eye,      onClick: () => setViewOrder(so) },
              { label: "Edit SO",        icon: Pencil,   onClick: () => handleEdit(so) },
              { label: "Download PDF",   icon: Download, onClick: () => handleDownloadSOPdf(parseInt(so.id)) },
              { label: "Approve",        icon: ThumbsUp, onClick: () => handleApprove(so.id) },
              { label: "Approve & Send", icon: Mail,     onClick: () => handleApproveAndSend(so) },
            ]}
            shareData={{
              title: so.soNumber,
              subject: `Sales Order ${so.soNumber} — ${so.customer}`,
              text: `Sales Order: ${so.soNumber}\nCustomer: ${so.customer}\nDate: ${so.orderDate}\nAmount: ₹${so.totalValue?.toLocaleString("en-IN") ?? "—"}\nStatus: ${so.status}`,
            }}
          />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedIds, toggleOne, handleApprove, handleApproveAndSend, handleEdit]);

  // ── PO Columns ─────────────────────────────────────────────────────────────

  const poColumns: ColumnConfig<PORow>[] = useMemo(() => [
    {
      id: "_select", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 44,
      cell: (info) => {
        const id = info.getValue() as number;
        return (
          <input
            type="checkbox"
            checked={selectedPOIds.has(id)}
            onChange={() => toggleOnePO(id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-violet-600 cursor-pointer accent-violet-600"
          />
        );
      },
    },
    {
      id: "poNumber", accessorKey: "poNumber", header: "PO #",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 140,
      cell: (info) => (
        <span className="font-semibold text-violet-700">{info.getValue() as string}</span>
      ),
    },
    {
      id: "orderDate", accessorKey: "orderDate", header: "Date",
      filterType: "dateRange", enableSorting: true, defaultVisible: true, size: 100,
    },
    {
      id: "millName", accessorKey: "millName", header: "Mill",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 180,
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue() as string}</span>
      ),
    },
    {
      id: "poType", accessorKey: "poType", header: "Type",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 140,
      cell: (info) => {
        const val = info.getValue() as string;
        const cls = val === "Against Sales Order"
          ? "bg-blue-50 text-blue-700"
          : val === "For Stock"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-violet-50 text-violet-700";
        return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{val}</span>;
      },
    },
    {
      id: "items", accessorKey: "items", header: "Items",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 300, noTruncate: true,
      cell: (info) => {
        const items = info.getValue() as PORow["items"];
        if (!items?.length) return <span className="text-gray-300 text-xs">—</span>;
        const first = items[0];
        const qty = first.weightKg && first.weightKg > 0
          ? `${first.weightKg.toLocaleString("en-IN")} KG`
          : `${first.quantity.toLocaleString("en-IN")}`;
        return (
          <div className="text-xs leading-snug">
            <span className="font-medium text-gray-800">{first.description || `Material #${first.materialId}`}</span>
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">{qty}</span>
            {items.length > 1 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">+{items.length - 1}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "itemCount", accessorKey: "items", header: "# Items",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 75,
      cell: (info) => {
        const n = (info.getValue() as PORow["items"])?.length ?? 0;
        if (n === 0) return <span className="text-gray-300 text-xs">—</span>;
        return (
          <span className={cn(
            "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
            n === 1 ? "bg-gray-100 text-gray-500" : "bg-violet-50 text-violet-600 ring-1 ring-violet-100"
          )}>
            {n}
          </span>
        );
      },
    },
    {
      id: "totalValue", accessorKey: "totalValue", header: "Amount",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => (
        <span className="font-semibold text-gray-900">
          ₹{(info.getValue() as number).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      id: "_actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 50,
      cell: (info) => {
        const po = info.row.original;
        return (
          <ActionMenu items={[
            { label: "View",           icon: Eye,      onClick: () => setViewPO(po) },
            { label: "Edit",           icon: Pencil,   onClick: () => setEditPO(po) },
            { label: "Download PDF",   icon: Download, onClick: () => handleDownloadPOPdf(po.id) },
            { label: "Approve",        icon: ThumbsUp, onClick: () => handleApprovePO(po) },
            { label: "Approve & Send", icon: Mail,     onClick: () => handleApprovePOAndSend(po) },
          ]} />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedPOIds, toggleOnePO, handleApprovePO, handleApprovePOAndSend, setEditPO]);

  // ── SO Toolbar ────────────────────────────────────────────────────────────

  const soToolbarActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 select-none transition-colors">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={toggleAll}
          className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-600"
        />
        Select all
      </label>
      {selectedIds.size > 0 && (
        <button
          onClick={handleApproveSelected}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 shadow-sm transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          Approve Selected ({selectedIds.size})
        </button>
      )}
    </div>
  ), [isAllSelected, toggleAll, selectedIds.size, handleApproveSelected]);

  // ── PO Toolbar ────────────────────────────────────────────────────────────

  const poToolbarActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 select-none transition-colors">
        <input
          type="checkbox"
          checked={isAllPOSelected}
          onChange={toggleAllPO}
          className="h-3.5 w-3.5 rounded border-gray-300 accent-violet-600"
        />
        Select all
      </label>
      {selectedPOIds.size > 0 && (
        <button
          onClick={handleApproveSelectedPOs}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 shadow-sm transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          Approve Selected ({selectedPOIds.size})
        </button>
      )}
    </div>
  ), [isAllPOSelected, toggleAllPO, selectedPOIds.size, handleApproveSelectedPOs]);

  // ── Active KPIs ───────────────────────────────────────────────────────────

  const activeCount      = activeTab === "so" ? soKpis.count      : poKpis.count;
  const activeValue      = activeTab === "so" ? soKpis.totalValue  : poKpis.totalValue;
  const activeOldestDays = activeTab === "so" ? soKpis.oldestDays  : poKpis.oldestDays;
  const activeSubLabel   = activeTab === "so"
    ? `${soKpis.totalKg.toLocaleString("en-IN")} KG total`
    : `${poKpis.totalQty.toLocaleString("en-IN")} total qty`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("so")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
            activeTab === "so"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          Sales Orders
          {soKpis.count > 0 && (
            <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
              {soKpis.count}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("po")}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
            activeTab === "po"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Factory className="h-4 w-4" />
          Purchase Orders
          {poKpis.count > 0 && (
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
              {poKpis.count}
            </span>
          )}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">

        {/* Pending Approvals */}
        <div className={cn(
          "group relative overflow-hidden rounded-2xl border border-white/80 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
          activeTab === "so" ? "bg-orange-50" : "bg-violet-50"
        )}>
          <p className={cn("text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider", activeTab === "so" ? "text-orange-500" : "text-violet-500")}>
            Pending Approvals
          </p>
          <p className={cn("mt-1.5 text-2xl sm:text-4xl font-black leading-none tabular-nums animate-kpi-value", activeTab === "so" ? "text-orange-700" : "text-violet-700")}>
            {activeCount}
          </p>
          <p className={cn("mt-1 text-[10px] sm:text-xs truncate", activeTab === "so" ? "text-orange-400" : "text-violet-400")}>
            {activeSubLabel}
          </p>
          <div className={cn("pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18]", activeTab === "so" ? "text-orange-500" : "text-violet-500")}>
            <Clock className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1} />
          </div>
        </div>

        {/* Total Value */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/80 bg-emerald-50 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
          <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-500">Total Value</p>
          <p className="mt-1.5 text-2xl sm:text-4xl font-black text-gray-900 leading-none tabular-nums animate-kpi-value">
            ₹{(activeValue / 100000).toFixed(1)}L
          </p>
          <p className="mt-1 text-[10px] sm:text-xs text-gray-500 truncate">across {activeCount} orders</p>
          <div className="pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18] text-emerald-500">
            <IndianRupee className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1} />
          </div>
        </div>

        {/* Oldest Pending */}
        <div className={cn(
          "group relative overflow-hidden rounded-2xl border border-white/80 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
          activeOldestDays > 3 ? "bg-red-50" : "bg-gray-100"
        )}>
          <p className={cn("text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider", activeOldestDays > 3 ? "text-red-500" : "text-gray-500")}>
            Oldest Pending
          </p>
          <p className={cn("mt-1.5 text-2xl sm:text-4xl font-black leading-none tabular-nums animate-kpi-value", activeOldestDays > 3 ? "text-red-700" : "text-gray-900")}>
            {activeOldestDays}d
          </p>
          <p className={cn("mt-1 text-[10px] sm:text-xs truncate", activeOldestDays > 3 ? "text-red-400" : "text-gray-400")}>
            {activeOldestDays > 3 ? "overdue — action needed" : "within SLA"}
          </p>
          <div className={cn("pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18]", activeOldestDays > 3 ? "text-red-500" : "text-gray-500")}>
            <Package className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1} />
          </div>
        </div>

      </div>

      {/* ── SO Tab ─────────────────────────────────────────────────────────────── */}
      {activeTab === "so" && (
        <>
          {pendingOrders.length === 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
              <ThumbsUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-700">All caught up!</p>
              <p className="text-xs text-green-500 mt-0.5">No sales orders are pending approval right now.</p>
            </div>
          )}

          {pendingOrders.length > 0 && (
            <DataGrid
              data={pendingOrders}
              columns={soColumns}
              tableName="approvals-so"
              enableFilters
              enablePagination
              enableColumnReordering
              enableColumnVisibility
              initialPageSize={15}
              onRowClick={(so) => setViewOrder(so)}
              emptyMessage="No pending SO approvals."
              toolbarActions={soToolbarActions}
            />
          )}
        </>
      )}

      {/* ── PO Tab ─────────────────────────────────────────────────────────────── */}
      {activeTab === "po" && (
        <>
          {poLoading && (
            <div className="rounded-xl border border-gray-100 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">Loading purchase orders…</p>
            </div>
          )}

          {!poLoading && pendingPOs.length === 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
              <ThumbsUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-700">All caught up!</p>
              <p className="text-xs text-green-500 mt-0.5">No purchase orders are pending approval right now.</p>
            </div>
          )}

          {!poLoading && pendingPOs.length > 0 && (
            <DataGrid
              data={pendingPOs}
              columns={poColumns}
              tableName="approvals-po"
              enableFilters
              enablePagination
              enableColumnReordering
              enableColumnVisibility
              initialPageSize={15}
              onRowClick={(po) => setViewPO(po)}
              emptyMessage="No pending PO approvals."
              toolbarActions={poToolbarActions}
            />
          )}
        </>
      )}

      {/* SO View Modal */}
      {viewOrder && (
        <ApprovalViewModal
          so={viewOrder}
          onApprove={() => handleApprove(viewOrder.id)}
          onApproveAndSend={() => handleApproveAndSend(viewOrder)}
          onEdit={() => handleEdit(viewOrder)}
          onClose={() => setViewOrder(null)}
        />
      )}

      {/* SO Edit Form Modal */}
      {showForm && editingOrder && (
        <Modal
          isOpen={showForm}
          title={`Edit SO — ${editingOrder.soNumber}`}
          onClose={() => { setShowForm(false); setEditingOrder(undefined); }}
          size="xl"
        >
          <SalesOrderForm
            initialData={editingOrder as SalesOrder}
            onSuccess={handleSuccess}
            onCancel={() => { setShowForm(false); setEditingOrder(undefined); }}
          />
        </Modal>
      )}

      {/* SO Email Modal */}
      {emailOrder && (
        <EmailModal
          title={`Send — ${emailOrder.soNumber}`}
          initialData={buildEmailData(emailOrder)}
          contacts={emailContacts}
          onSend={handleSendEmail}
          onClose={() => { setEmailOrder(null); setEmailContacts([]); }}
        />
      )}

      {/* PO View Modal */}
      {viewPO && (
        <POApprovalViewModal
          po={viewPO}
          onApprove={() => handleApprovePO(viewPO)}
          onApproveAndSend={() => handleApprovePOAndSend(viewPO)}
          onEdit={() => { setViewPO(null); setEditPO(viewPO); }}
          onClose={() => setViewPO(null)}
        />
      )}

      {/* PO Edit Modal */}
      {editPO && (
        <Modal
          isOpen={!!editPO}
          title={`Edit PO — ${editPO.poNumber}`}
          onClose={() => setEditPO(null)}
          size="xl"
        >
          <PurchaseOrderForm
            initialData={editPO}
            onSubmit={handleEditPOSubmit}
            onCancel={() => setEditPO(null)}
          />
        </Modal>
      )}

      {/* PO Email Modal */}
      {emailPO && (
        <EmailModal
          title={`Send PO — ${emailPO.poNumber}`}
          initialData={buildPOEmailData(emailPO)}
          contacts={emailContacts}
          onSend={handleSendPOEmail}
          onClose={() => { setEmailPO(null); setEmailContacts([]); }}
        />
      )}

    </div>
  );
}
