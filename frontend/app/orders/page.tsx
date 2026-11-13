"use client";

import { useMemo, useState } from "react";
import { SalesOrder, SOLine as SalesOrderLine } from "@/context/SalesOrderContext";
import {
  ShoppingCart, AlertCircle, CheckCircle2, Package, Plus, MoreVertical,
  Eye, Pencil, Trash2, X, Clock, Mail, Share2, IndianRupee, Ban, Printer, ImageIcon,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { SalesOrderForm } from "@/components/forms/SalesOrderForm";
import { Modal } from "@/components/Modal";
import { EmailModal, EmailContact, EmailFormData } from "@/components/EmailModal";
import { salesOrderApi, customerApi, soLineDisplayCode } from "@/lib/api-services";
import { emailSentCache } from "@/lib/emailSentCache";
import { useSalesOrder } from "@/context/SalesOrderContext";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import { lineWeightKg, lineSheetCount } from "@/lib/weight";
import { printPdfBlob } from "@/lib/printPdf";
import { createPortal } from "react-dom";
import { PortalModal, ModalCloseButton } from "@/components/PortalModal";
import { SharePanel, ShareData } from "@/components/ShareMenu";
import { useRef, useEffect } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SO_STATUS_COLORS: Record<string, string> = {
  "Approval Pending":    "bg-orange-50 text-orange-600",
  "Draft":               "bg-gray-100 text-gray-600",
  "Pending Allocation":    "bg-amber-50 text-amber-600",
  "Partially Allocated": "bg-blue-50 text-blue-600",
  "Fully Allocated":     "bg-cyan-50 text-cyan-600",
  "In Dispatch":         "bg-purple-50 text-purple-600",
  "Partially Delivered": "bg-indigo-50 text-indigo-600",
  "Completed":           "bg-green-50 text-green-600",
  "Closed":              "bg-gray-50 text-gray-500",
  "Cancelled":           "bg-rose-50 text-rose-600",
};
const SO_STATUS_OPTIONS = Object.keys(SO_STATUS_COLORS).map((v) => ({ label: v, value: v }));

// ─── Row Actions ──────────────────────────────────────────────────────────────

function RowActions({
  onView, onEdit, onDelete, onCancel, onSend, onPrint, onExportImage, status, emailSent, shareData,
}: {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSend?: () => void;
  onPrint: () => void;
  onExportImage?: () => void;
  status?: string;
  emailSent?: boolean;
  shareData?: ShareData;
}) {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Estimated menu height (Send Email + View + Edit + Print + Export Image +
  // Cancel + Delete + Share divider/button) — used to flip the menu upward
  // when a row is near the bottom of the viewport, so the last row's menu
  // never clips off-screen.
  const MENU_H = 332;
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const [shareAnchor, setShareAnchor] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < MENU_H && r.top > MENU_H;
      setPos(openUp
        ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right }
        : { top: r.bottom + 4, right: window.innerWidth - r.right });
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

  const act = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); fn(); };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setShareAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setShareOpen(true);
  };

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef}
          style={pos.bottom != null
            ? { position: "fixed", bottom: pos.bottom, right: pos.right, zIndex: 9999 }
            : { position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 rounded-xl border border-gray-200 bg-white shadow-xl py-1">
          {status !== "Approval Pending" && onSend && (
            <button
              onClick={emailSent ? undefined : act(onSend)}
              disabled={emailSent}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
                emailSent
                  ? "text-gray-300 cursor-not-allowed"
                  : "font-medium text-blue-600 hover:bg-blue-50"
              }`}
            >
              <Mail className="h-3.5 w-3.5" /> {emailSent ? "Mail Sent ✓" : "Send Email"}
            </button>
          )}
          {[
            { label: "View Details", icon: Eye, fn: onView },
            { label: "Edit SO", icon: Pencil, fn: onEdit },
            { label: "Print", icon: Printer, fn: onPrint },
            ...(onExportImage ? [{ label: "Export as Image", icon: ImageIcon, fn: onExportImage }] : []),
            ...(status !== "Cancelled" ? [{ label: "Cancel Order", icon: Ban, fn: onCancel, red: false, amber: true }] : []),
            { label: "Delete", icon: Trash2, fn: onDelete, red: true },
          ].map(({ label, icon: Icon, fn, red, amber }: { label: string; icon: typeof Eye; fn: () => void; red?: boolean; amber?: boolean }) => (
            <button key={label} onClick={act(fn)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-gray-50 ${red ? "text-red-600 hover:bg-red-50" : amber ? "text-amber-600 hover:bg-amber-50" : "text-gray-700"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
          {shareData && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={handleShare}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Share2 className="h-3.5 w-3.5 text-blue-500" /> Share
              </button>
            </>
          )}
        </div>,
        document.body
      )}
      {shareOpen && shareAnchor && shareData && (
        <SharePanel data={shareData} anchor={shareAnchor} onClose={() => setShareOpen(false)} />
      )}
    </>
  );
}

// ─── View SO Modal ────────────────────────────────────────────────────────────

// Maps SO status to header bg tint
const STATUS_HEADER_BG: Record<string, string> = {
  "Approval Pending":    "bg-orange-50",
  "Draft":               "bg-gray-50",
  "Pending Allocation":  "bg-amber-50",
  "Partially Allocated": "bg-blue-50",
  "Fully Allocated":     "bg-cyan-50",
  "In Dispatch":         "bg-purple-50",
  "Partially Delivered": "bg-indigo-50",
  "Completed":           "bg-green-50",
  "Closed":              "bg-gray-50",
  "Cancelled":           "bg-rose-50",
};

function ViewSOModal({ so, onEdit, onSend, onClose, emailSent }: { so: SalesOrder; onEdit: () => void; onSend?: () => void; onClose: () => void; emailSent?: boolean }) {
  const statusCls   = SO_STATUS_COLORS[so.status] ?? "bg-gray-100 text-gray-600";
  const headerBg    = STATUS_HEADER_BG[so.status] ?? "bg-blue-50";
  const deliveryCls = so.deliveryMode === "From Stock"
    ? "bg-green-50 text-green-600"
    : so.deliveryMode === "Direct Mill Delivery"
    ? "bg-blue-50 text-blue-600"
    : "bg-purple-50 text-purple-600";

  // Parties block matches the SO PDF layout exactly: Supplier (Monit) on
  // the left, Billed To (SO customer) middle, Shipped To (delivery party,
  // falling back to SO customer) on the right. PDF fallback rules are
  // mirrored here so on-screen view and printed PDF stay 1:1.
  const { config } = useCompanySettings();
  const shipName = (so.deliveryParty ?? "").trim() || so.customer;
  const shipAddr = (so.deliveryPartyAddress ?? "").trim() || (so.customerAddress ?? "");
  const shipGst  = (so.deliveryPartyGstNo ?? "").trim() || (so.customerGstNo ?? "");

  // Print the actual generated PDF (same bytes as Download/email attachment)
  // rather than the browser's print of this on-screen view, so the printed
  // page always matches the downloaded PDF exactly (client-reported).
  const { error: showPrintError } = useToast();
  const handlePrint = async () => {
    try {
      const { blob } = await salesOrderApi.downloadPdf(Number(so.id));
      printPdfBlob(blob);
    } catch (e) {
      showPrintError(e instanceof Error ? e.message : "Print failed.");
    }
  };

  return (
    <PortalModal onClose={onClose}>
        {/* Status-tinted header */}
        <div className={cn("flex items-center justify-between border-b border-gray-100 px-5 py-3.5 rounded-t-2xl", headerBg)}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 shadow-sm">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">{so.soNumber}</h2>
              <p className="text-xs text-gray-500">{so.customer} · {so.orderDate}</p>
            </div>
            <span className={cn("ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusCls)}>
              {so.status}
            </span>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5 space-y-4">

          {/* Cancelled banner */}
          {so.status === "Cancelled" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
              <p className="text-xs font-bold text-rose-700">
                Cancelled{so.cancelledAt ? ` on ${so.cancelledAt}` : ""}{so.cancelledBy ? ` by ${so.cancelledBy}` : ""}
              </p>
              {so.cancelReason && <p className="mt-0.5 text-xs text-rose-600">Reason: {so.cancelReason}</p>}
            </div>
          )}

          {/* Colored summary metrics */}
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

          {/* Parties — mirrors the SO PDF (Supplier / Billed To / Shipped To)
              so what the user sees on screen matches what's printed/emailed. */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Parties</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Supplier Name</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{config?.companyName || "—"}</p>
                {config?.address && <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{config.address}</p>}
                <p className="text-[10px] text-gray-500 mt-1">GST: <span className="font-medium text-gray-700">{config?.gstNumber || "—"}</span></p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-violet-500">Billed To</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{so.customer}</p>
                {so.customerAddress && <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{so.customerAddress}</p>}
                <p className="text-[10px] text-gray-500 mt-1">GST: <span className="font-medium text-gray-700">{so.customerGstNo || "—"}</span></p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Shipped To</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{shipName}</p>
                {shipAddr && <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{shipAddr}</p>}
                <p className="text-[10px] text-gray-500 mt-1">GST: <span className="font-medium text-gray-700">{shipGst || "—"}</span></p>
              </div>
            </div>
          </div>

          {/* Detail fields */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { label: "Order Date",     value: so.orderDate,                       accent: "" },
                { label: "Salesman",       value: so.salesman,                        accent: "" },
                { label: "Contact",        value: so.contactPerson || "—",            accent: "" },
                { label: "Payment Terms",  value: so.paymentTerms || "—",            accent: "" },
                { label: "Delivery Party", value: (so as any).deliveryParty || so.customer, accent: "" },
                { label: "Delivery Address", value: so.lines[0]?.deliveryAddress || "—", accent: "" },
              ] as { label: string; value: string; accent: string }[]).map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="text-xs font-semibold mt-0.5 text-gray-800">{value}</p>
                </div>
              ))}
              {/* Delivery Mode — colored badge style */}
              <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                <p className="text-[10px] text-gray-400">Delivery Mode</p>
                <span className={cn("mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", deliveryCls)}>
                  {so.deliveryMode}
                </span>
              </div>
            </div>
          </div>

          {/* Order Lines */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Lines</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Weight (kg)</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Disc</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Req. Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {so.lines.map((line, idx) => (
                    <tr key={line.id} className={idx % 2 === 0 ? "bg-white border-t border-gray-100" : "bg-slate-50/60 border-t border-gray-100"}>
                      <td className="px-3 py-2.5 text-gray-400">{line.lineNumber}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-gray-900">
                          {soLineDisplayCode(line, so.showBrandInItemCode) || line.materialId}
                        </p>
                        {line.gsm && <p className="text-[10px] text-gray-400 mt-0.5">{line.gsm}g · {line.size}</p>}
                        {line.remarks && <p className="text-[10px] text-amber-600 italic mt-0.5">{line.remarks}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                        {(() => {
                          const wt = lineWeightKg(line);
                          const sh = lineSheetCount(line);
                          return (
                            <>
                              <span className="text-blue-700 font-semibold">{wt.toLocaleString("en-IN")} kg</span>
                              {sh !== null && <span className="block text-[10px] text-gray-400">{sh.toLocaleString("en-IN")} sheets</span>}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{line.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">
                        {line.discount && line.discount > 0 ? <span className="text-amber-600 font-medium">{line.discount}%</span> : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                        ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{line.requiredDeliveryDate}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", SO_STATUS_COLORS[line.status] ?? "bg-gray-100 text-gray-600")}>
                          {line.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                    <td colSpan={8} className="px-4 py-2.5 text-right">
                      <span className="text-xs font-semibold text-emerald-700 mr-4">Order Total</span>
                      <span className="text-sm font-black text-emerald-800">₹{so.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {so.remarks && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[10px] text-amber-500 font-semibold">Remarks</p>
              <p className="text-xs text-gray-700 mt-0.5">{so.remarks}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50/80 rounded-b-2xl">
          {onSend && so.status !== "Approval Pending" && (
            <button
              onClick={emailSent ? undefined : onSend}
              disabled={emailSent}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                emailSent
                  ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              )}
            >
              <Mail className="h-3.5 w-3.5" /> {emailSent ? "Mail Sent ✓" : "Send Mail"}
            </button>
          )}
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
    </PortalModal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { success, error: showError } = useToast();
  const { salesOrders, reload, deleteSalesOrder, cancelSalesOrder } = useSalesOrder();
  // Company name from CompanySettings drives the email sign-off so the
  // right tenant brand goes out (Monit Paper Agency vs Monit Paper
  // Associates) — no hardcoded string in the body.
  const { config: orderCompanyCfg } = useCompanySettings();
  const monitName = orderCompanyCfg.companyName?.trim() ?? "";

  const [showForm, setShowForm]         = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | undefined>();
  const [viewOrder, setViewOrder]       = useState<SalesOrder | null>(null);
  const [emailOrder, setEmailOrder]     = useState<SalesOrder | null>(null);
  const [emailContacts, setEmailContacts] = useState<EmailContact[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SalesOrder | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [emailSentIds, setEmailSentIds] = useState<Set<string>>(() => emailSentCache.getSoIds());

  const displayOrders = useMemo(
    () => statusFilter ? salesOrders.filter(o => o.status === statusFilter) : salesOrders,
    [salesOrders, statusFilter],
  );

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const weightKg = (orders: typeof salesOrders) =>
      orders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + lineWeightKg(l), 0), 0);

    const approvalOrders  = salesOrders.filter((o) => o.status === "Approval Pending");
    const pendingOrders   = salesOrders.filter((o) => ["Draft", "Pending Allocation"].includes(o.status));
    const allocatedOrders = salesOrders.filter((o) => ["Partially Allocated", "Fully Allocated", "In Dispatch"].includes(o.status));
    const completedOrders = salesOrders.filter((o) => ["Completed", "Closed"].includes(o.status));

    return {
      total:              salesOrders.length,
      totalKg:            weightKg(salesOrders),
      approvalPending:    approvalOrders.length,
      approvalKg:         weightKg(approvalOrders),
      pendingAllocation:  pendingOrders.length,
      pendingKg:          weightKg(pendingOrders),
      allocated:          allocatedOrders.length,
      allocatedKg:        weightKg(allocatedOrders),
      completed:          completedOrders.length,
      completedKg:        weightKg(completedOrders),
      totalValue:         salesOrders.reduce((s, o) => s + o.totalValue, 0),
    };
  }, [salesOrders]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleNewSO = () => { setEditingOrder(undefined); setShowForm(true); };
  const handleEdit  = (order: SalesOrder) => { setEditingOrder(order); setViewOrder(null); setShowForm(true); };

  const openEmailModal = async (so: SalesOrder) => {
    setEmailOrder(so);
    try {
      const raw = await customerApi.getContacts(parseInt(so.customerId));
      setEmailContacts(raw.filter((c) => c.email).map((c) => ({
        name:      c.name,
        email:     c.email!,
        isDefault: c.isDefault ?? false,
      })));
    } catch {
      setEmailContacts([]);
    }
  };

  const buildEmailData = (so: SalesOrder): EmailFormData => {
    const lines = so.lines.map((l, i) => {
      const qty  = `${lineWeightKg(l).toLocaleString("en-IN")} KG`;
      const code = soLineDisplayCode(l, so.showBrandInItemCode) || String(l.materialId);
      return `  ${i + 1}. ${code} — ${qty} — ₹${l.rate.toLocaleString("en-IN")}/- — Amt: ₹${l.amount.toLocaleString("en-IN")}`;
    }).join("\n");
    // Pre-select the default contact email as the initial TO
    const defaultEmail = so.customerEmail ?? "";
    return {
      to:      defaultEmail ? [defaultEmail] : [],
      cc:      [],
      subject: `Sales Order Confirmed — ${so.soNumber}`,
      body:    `Dear ${so.customer},\n\nThank you for your order. Please find the details below:\n\nOrder No : ${so.soNumber}\nDate     : ${so.orderDate}\nSalesman : ${so.salesman}\nPayment  : ${so.paymentTerms}\n\nItems:\n${lines}\n\nTotal Value: ₹${so.totalValue.toLocaleString("en-IN")}\n\nFor any queries, please contact us.\n\nRegards,\n${monitName}`,
    };
  };

  const handleSendEmail = async (data: EmailFormData) => {
    if (!emailOrder) return;
    await salesOrderApi.sendEmail(parseInt(emailOrder.id), {
      to: data.to, cc: data.cc, subject: data.subject, body: data.body,
    });
    emailSentCache.addSoId(emailOrder.id);
    setEmailSentIds((prev) => new Set([...prev, emailOrder.id]));
    success(`Email sent to ${data.to.join(", ")}`);
    setEmailOrder(null);
    setEmailContacts([]);
  };

  const handleSuccess = (soNumber: string, isUpdate: boolean) => {
    reload();
    success(isUpdate ? "Sales order updated." : `Sales order ${soNumber} created.`);
    setShowForm(false);
    setEditingOrder(undefined);
  };

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns: ColumnConfig<SalesOrder>[] = useMemo(() => [
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48, sticky: "left",
      noTruncate: true,   // suppress the CSS text-ellipsis that was painting an extra "…" next to the menu icon
      cell: (info) => {
        const so = info.row.original;
        return (
          <RowActions
            status={so.status}
            onView={() => setViewOrder(so)}
            onEdit={() => handleEdit(so)}
            onDelete={() => setDeleteConfirmId(so.id)}
            onCancel={() => { setCancelTarget(so); setCancelReasonInput(""); }}
            onSend={() => openEmailModal(so)}
            onPrint={async () => {
              try {
                const { blob } = await salesOrderApi.downloadPdf(Number(so.id));
                printPdfBlob(blob);
              } catch (e) {
                showError(e instanceof Error ? e.message : "Print failed.");
              }
            }}
            onExportImage={async () => {
              try {
                const { blob, filename } = await salesOrderApi.downloadImage(Number(so.id));
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename || `SO_${so.soNumber.replace(/\//g, "-")}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (e) {
                showError(e instanceof Error ? e.message : "Image export failed.");
              }
            }}
            emailSent={emailSentIds.has(so.id)}
            shareData={(() => {
              const itemLines = so.lines.map((l, i) => {
                const qty  = `${lineWeightKg(l).toLocaleString("en-IN")} KG`;
                const code = soLineDisplayCode(l, so.showBrandInItemCode) || String(l.materialId);
                return `  ${i + 1}. ${code} — ${qty} @ ₹${l.rate.toLocaleString("en-IN")}`;
              }).join("\n");
              return {
                title: so.soNumber,
                subject: `Sales Order ${so.soNumber} — ${so.customer}`,
                text: `Sales Order: ${so.soNumber}\nCustomer: ${so.customer}\nDate: ${so.orderDate}\nItems:\n${itemLines}\nTotal: ₹${so.totalValue?.toLocaleString("en-IN") ?? "—"}`,
                // PDF attaches to the share when the platform supports
                // Web Share API w/ files (mobile / macOS Safari). On
                // desktop the PDF is downloaded so user can attach it.
                getPdf: () => salesOrderApi.downloadPdf(Number(so.id)),
              };
            })()}
          />
        );
      },
    },
    {
      id: "soNumber", accessorKey: "soNumber", header: "SO #",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 160, align: "left" as const,
      cell: (info) => {
        const so = info.row.original;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-semibold text-blue-700">{info.getValue() as string}</span>
            {so.isBackfilled && (
              <span
                title="Backfilled / historical SO entered from the manual register"
                className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase border border-amber-200"
              >
                Backfill
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: "orderDate", accessorKey: "orderDate", header: "Date",
      filterType: "dateRange", enableSorting: true, defaultVisible: true, size: 100,
    },
    {
      id: "customer", accessorKey: "customer", header: "Customer",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 200,
      cell: (info) => <span className="font-medium text-gray-900">{info.getValue() as string}</span>,
    },
    {
      id: "salesman", accessorKey: "salesman", header: "Salesman",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 120,
    },
    {
      id: "lines", accessorKey: "lines", header: "Items",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 260, align: "left" as const, noTruncate: true,
      cell: (info) => {
        const so    = info.row.original;
        const first = so.lines[0];
        if (!first) return <span className="text-gray-400 text-xs">—</span>;
        // Respect the per-SO "Show brand in code" flag so the grid stays in
        // sync with the popup / view modal / PDF rendering.
        const code = soLineDisplayCode(first, so.showBrandInItemCode) || first.materialId || "—";
        const qty  = `${lineWeightKg(first).toLocaleString("en-IN")} kg`;
        return (
          <div className="text-xs leading-snug">
            <div className="font-medium text-gray-900">{code}</div>
            <div className="text-gray-500 mt-0.5">· {qty}</div>
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
      id: "deliveryMode", accessorKey: "deliveryMode", header: "Delivery",
      filterType: "select",
      filterOptions: [
        { label: "From Stock",           value: "From Stock" },
        { label: "Direct Mill Delivery", value: "Direct Mill Delivery" },
        { label: "Mixed",                value: "Mixed" },
      ],
      enableSorting: false, defaultVisible: true, size: 150,
      cell: (info) => {
        const mode = info.getValue() as string;
        const cls = mode === "From Stock" ? "bg-green-50 text-green-600"
          : mode === "Direct Mill Delivery" ? "bg-blue-50 text-blue-600"
          : "bg-purple-50 text-purple-600";
        return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", cls)}>{mode}</span>;
      },
    },
    {
      id: "paymentTerms", accessorKey: "paymentTerms", header: "Payment",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 110,
      cell: (info) => <span className="text-xs text-gray-600">{info.getValue() as string}</span>,
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
      id: "status", accessorKey: "status", header: "Status",
      filterType: "select", filterOptions: SO_STATUS_OPTIONS,
      enableSorting: true, defaultVisible: true, size: 175,
      cell: (info) => {
        const s = info.getValue() as string;
        return (
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", SO_STATUS_COLORS[s] ?? "bg-gray-100 text-gray-600")}>
            {s}
          </span>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [emailSentIds]);

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4 overflow-hidden">

      {/* KPI Cards */}
      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 flex-shrink-0">
        {[
          { label: "Total Orders",      value: kpis.total,            sub: `${kpis.totalKg.toLocaleString("en-IN")} KG`,        icon: ShoppingCart, iconBg: "bg-blue-50",   iconColor: "text-blue-500"   },
          { label: "Awaiting Approval", value: kpis.approvalPending,  sub: `${kpis.approvalKg.toLocaleString("en-IN")} KG`,     icon: Clock,        iconBg: "bg-orange-50", iconColor: "text-orange-500" },
          { label: "No Stock Linked",   value: kpis.pendingAllocation,sub: `${kpis.pendingKg.toLocaleString("en-IN")} KG`,      icon: AlertCircle,  iconBg: "bg-amber-50",  iconColor: "text-amber-500", clickable: true },
          { label: "Ready to Dispatch", value: kpis.allocated,        sub: `${kpis.allocatedKg.toLocaleString("en-IN")} KG`,   icon: Package,      iconBg: "bg-sky-50",    iconColor: "text-sky-500"    },
          { label: "Delivered",         value: kpis.completed,        sub: `${kpis.completedKg.toLocaleString("en-IN")} KG`,   icon: CheckCircle2, iconBg: "bg-green-50",  iconColor: "text-green-500"  },
          { label: "Total Value",       value: `₹${(kpis.totalValue / 100000).toFixed(1)}L`, sub: `${salesOrders.length} orders`, icon: IndianRupee, iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
        ].map((card) => (
          <div
            key={card.label}
            onClick={card.clickable ? () => setStatusFilter(prev => prev === "Pending Allocation" ? null : "Pending Allocation") : undefined}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-white/80 p-2.5 sm:p-3.5 shadow-sm",
              "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
              card.iconBg,
              card.clickable && "cursor-pointer active:scale-[0.98]",
              card.clickable && statusFilter === "Pending Allocation" && "ring-2 ring-amber-400"
            )}
          >
            <p className={cn("text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider truncate", card.iconColor)}>{card.label}</p>
            <p className="mt-1 text-xl sm:text-3xl font-black text-gray-900 leading-none tabular-nums animate-kpi-value">{card.value}</p>
            <p className="mt-0.5 text-[9px] sm:text-[11px] text-gray-500 truncate">{card.sub}</p>
            <div className={cn("pointer-events-none absolute -right-3 -bottom-3 opacity-[0.12] transition-transform duration-300 group-hover:scale-110 group-hover:opacity-[0.18]", card.iconColor)}>
              <card.icon className="h-14 w-14 sm:h-16 sm:w-16" strokeWidth={1} />
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex-shrink-0">
          <p className="text-sm font-bold text-red-800 mb-1">Delete this sales order?</p>
          <p className="text-xs text-red-600 mb-3">
            SO <span className="font-mono font-semibold">{salesOrders.find((o) => o.id === deleteConfirmId)?.soNumber}</span> will be permanently removed.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={() => { deleteSalesOrder(deleteConfirmId!).catch(() => {}); setDeleteConfirmId(null); }} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Delete</button>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {cancelTarget && (
        <Modal
          isOpen={!!cancelTarget}
          title={`Cancel SO ${cancelTarget.soNumber}?`}
          onClose={() => { if (!cancelBusy) setCancelTarget(null); }}
          size="sm"
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              The SO number, its history, and all its data stay intact for tracking — the row will just show as
              <span className="mx-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">Cancelled</span>
              and greyed out in the grid. This is different from Delete, which removes it entirely.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Cancellation reason (required)</label>
              <textarea
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. Customer changed requirement, entered by mistake…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelBusy}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={async () => {
                  if (!cancelReasonInput.trim()) { showError("Please enter a cancellation reason."); return; }
                  setCancelBusy(true);
                  try {
                    await cancelSalesOrder(cancelTarget.id, cancelReasonInput.trim());
                    success(`SO ${cancelTarget.soNumber} cancelled.`);
                    setCancelTarget(null);
                  } catch {
                    showError("Failed to cancel the sales order.");
                  } finally {
                    setCancelBusy(false);
                  }
                }}
                disabled={cancelBusy}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {cancelBusy ? "Cancelling…" : "Cancel Order"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Active filter banner */}
      {statusFilter && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex-shrink-0">
          <span className="text-xs font-medium text-amber-700">
            Filtered: <strong>{statusFilter}</strong> — {displayOrders.length} order{displayOrders.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setStatusFilter(null)}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-100 transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {/* Data Grid */}
      <div className="flex flex-1 min-h-0 flex-col">
      <DataGrid
        data={displayOrders}
        columns={columns}
        tableName="sales-orders"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        scrollMaxHeight="100%"
        initialPageSize={15}
        // Custom "Export → PDF" — call the bulk-PDF endpoint so the exported
        // file uses the SAME rich one-SO-per-page document layout as the
        // Preview / Print view (instead of a flat grid dump).
        onPdfExport={async (rows) => {
          const ids = rows.map((s) => parseInt(s.id, 10)).filter((n) => Number.isFinite(n));
          if (ids.length === 0) return;
          const { blob, filename } = await salesOrderApi.downloadBulkPdf(ids);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename || `SalesOrders_${new Date().toISOString().slice(0, 10)}_${ids.length}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        // ZIP variant — one PDF per SO inside a single archive.
        onPdfZipExport={async (rows) => {
          const ids = rows.map((s) => parseInt(s.id, 10)).filter((n) => Number.isFinite(n));
          if (ids.length === 0) return;
          const { blob, filename } = await salesOrderApi.downloadBulkPdfZip(ids);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename || `SalesOrders_${new Date().toISOString().slice(0, 10)}_${ids.length}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }}
        // JPG variant — downloads one image file per selected SO directly
        // (no ZIP), same as the row-level "Export as Image" action, so the
        // user can forward each file immediately (e.g. on WhatsApp) without
        // extracting an archive first. Staggered slightly so the browser
        // doesn't treat the burst as a single blocked pop-up.
        onImageExport={async (rows) => {
          for (const so of rows) {
            const id = parseInt(so.id, 10);
            if (!Number.isFinite(id)) continue;
            try {
              const { blob, filename } = await salesOrderApi.downloadImage(id);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename || `SO_${so.soNumber.replace(/\//g, "-")}.jpg`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch {
              // skip a failed row so one bad SO doesn't stop the rest downloading
            }
            await new Promise((r) => setTimeout(r, 300));
          }
        }}
        onRowClick={(so) => setViewOrder(so)}
        highlightRow={(so) => so.id === viewOrder?.id}
        dimRow={(so) => so.status === "Cancelled"}
        emptyMessage="No sales orders yet. Create the first one."
        toolbarActions={
          <button
            onClick={handleNewSO}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.97] transition-all whitespace-nowrap"
          >
            <Plus className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
            <span className="hidden sm:inline">New SO</span>
            <span className="sm:hidden">New</span>
          </button>
        }
      />
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <Modal
          isOpen={showForm}
          title={editingOrder?.id ? `Edit SO — ${editingOrder.soNumber}` : "New Sales Order"}
          onClose={() => { setShowForm(false); setEditingOrder(undefined); }}
          size="xl"
        >
          <SalesOrderForm
            initialData={editingOrder}
            onSuccess={handleSuccess}
            onCancel={() => { setShowForm(false); setEditingOrder(undefined); }}
          />
        </Modal>
      )}

      {/* View Modal */}
      {viewOrder && (
        <ViewSOModal
          so={viewOrder}
          onEdit={() => { handleEdit(viewOrder); setViewOrder(null); }}
          onSend={() => { openEmailModal(viewOrder); setViewOrder(null); }}
          onClose={() => setViewOrder(null)}
          emailSent={emailSentIds.has(viewOrder.id)}
        />
      )}

      {/* Email Modal */}
      {emailOrder && (
        <EmailModal
          title={`Send — ${emailOrder.soNumber}`}
          initialData={buildEmailData(emailOrder)}
          contacts={emailContacts}
          onSend={handleSendEmail}
          onClose={() => { setEmailOrder(null); setEmailContacts([]); }}
        />
      )}

    </div>
  );
}
