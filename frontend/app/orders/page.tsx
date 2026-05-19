"use client";

import { useMemo, useState } from "react";
import { SalesOrder, SOLine as SalesOrderLine } from "@/context/SalesOrderContext";
import {
  ShoppingCart, AlertCircle, CheckCircle2, Package, Plus, MoreVertical,
  Eye, Pencil, Trash2, X, Clock, Mail,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { SalesOrderForm } from "@/components/forms/SalesOrderForm";
import { Modal } from "@/components/Modal";
import { EmailModal, EmailContact, EmailFormData } from "@/components/EmailModal";
import { salesOrderApi, customerApi } from "@/lib/api-services";
import { emailSentCache } from "@/lib/emailSentCache";
import { useSalesOrder } from "@/context/SalesOrderContext";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
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
  onView, onEdit, onDelete, onSend, status, emailSent,
}: {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSend?: () => void;
  status?: string;
  emailSent?: boolean;
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

  const act = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); fn(); };

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
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
            { label: "Delete", icon: Trash2, fn: onDelete, red: true },
          ].map(({ label, icon: Icon, fn, red }) => (
            <button key={label} onClick={act(fn)}
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

// ─── View SO Modal ────────────────────────────────────────────────────────────

function ViewSOModal({ so, onEdit, onSend, onClose, emailSent }: { so: SalesOrder; onEdit: () => void; onSend?: () => void; onClose: () => void; emailSent?: boolean }) {
  const statusCls = SO_STATUS_COLORS[so.status] ?? "bg-gray-100 text-gray-600";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{so.soNumber}</h2>
              <p className="text-xs text-gray-500">{so.customer} · {so.orderDate}</p>
            </div>
            <span className={cn("ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusCls)}>
              {so.status}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5 space-y-4">
          {/* Header fields */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Details</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                { label: "SO Number",      value: so.soNumber,               blue: true },
                { label: "Order Date",     value: so.orderDate },
                { label: "Customer",       value: so.customer },
                { label: "Contact",        value: so.contactPerson || "—" },
                { label: "Salesman",       value: so.salesman },
                { label: "Payment Terms",  value: so.paymentTerms || "—" },
                { label: "Delivery Mode",  value: so.deliveryMode },
                { label: "Delivery Terms", value: so.deliveryTerms || "—" },
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

          {/* Items */}
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
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Req. Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
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
                        {line.qty !== undefined && line.qty > 0 ? (
                          <span>
                            {line.qty.toLocaleString()} Sheets
                            {line.weightKg ? (
                              <span className="block text-xs text-gray-400">{line.weightKg.toLocaleString()} KG</span>
                            ) : null}
                          </span>
                        ) : (
                          <span>{(line.weightKg ?? line.orderedQty).toLocaleString()} KG</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{line.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">
                        {line.discount && line.discount > 0 ? `${line.discount}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                        ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{line.requiredDeliveryDate}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {line.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold text-blue-700">
                      Order Total
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-black text-blue-800">
                      ₹{so.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} />
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

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
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
          <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { success } = useToast();
  const { salesOrders, reload, deleteSalesOrder } = useSalesOrder();

  const [showForm, setShowForm]         = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | undefined>();
  const [viewOrder, setViewOrder]       = useState<SalesOrder | null>(null);
  const [emailOrder, setEmailOrder]     = useState<SalesOrder | null>(null);
  const [emailContacts, setEmailContacts] = useState<EmailContact[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [emailSentIds, setEmailSentIds] = useState<Set<string>>(() => emailSentCache.getSoIds());

  const displayOrders = useMemo(
    () => statusFilter ? salesOrders.filter(o => o.status === statusFilter) : salesOrders,
    [salesOrders, statusFilter],
  );

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const weightKg = (orders: typeof salesOrders) =>
      orders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + (l.weightKg ?? 0), 0), 0);

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
      const qty = l.weightKg && l.weightKg > 0
        ? `${l.weightKg.toLocaleString("en-IN")} KG`
        : `${l.orderedQty.toLocaleString("en-IN")} ${l.unit || ""}`.trim();
      return `  ${i + 1}. ${l.materialCode || l.materialId} — ${qty} — ₹${l.rate.toLocaleString("en-IN")}/- — Amt: ₹${l.amount.toLocaleString("en-IN")}`;
    }).join("\n");
    // Pre-select the default contact email as the initial TO
    const defaultEmail = so.customerEmail ?? "";
    return {
      to:      defaultEmail ? [defaultEmail] : [],
      cc:      [],
      subject: `Sales Order Confirmed — ${so.soNumber}`,
      body:    `Dear ${so.customer},\n\nThank you for your order. Please find the details below:\n\nOrder No : ${so.soNumber}\nDate     : ${so.orderDate}\nSalesman : ${so.salesman}\nPayment  : ${so.paymentTerms}\n\nItems:\n${lines}\n\nTotal Value: ₹${so.totalValue.toLocaleString("en-IN")}\n\nFor any queries, please contact us.\n\nRegards,\nMonit Paper Agency`,
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
      id: "soNumber", accessorKey: "soNumber", header: "SO #",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-semibold text-blue-700">{info.getValue() as string}</span>,
    },
    {
      id: "orderDate", accessorKey: "orderDate", header: "Date",
      filterType: "date", enableSorting: true, defaultVisible: true, size: 100,
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
      filterType: "none", enableSorting: false, defaultVisible: true, size: 260,
      cell: (info) => {
        const lines = info.getValue() as SalesOrderLine[];
        const preview = lines.slice(0, 2);
        return (
          <div className="space-y-1 py-0.5">
            {preview.map((l, i) => {
              const shortCode = l.materialCode || l.materialId || "—";
              const qty = (l as any).weightKg
                ? `${(l as any).weightKg.toLocaleString("en-IN")} KG`
                : `${l.orderedQty.toLocaleString("en-IN")}`;
              return (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-gray-800 truncate max-w-[170px]">{shortCode}</span>
                  <span className="flex-shrink-0 text-gray-400">·</span>
                  <span className="flex-shrink-0 text-gray-500">{qty}</span>
                </div>
              );
            })}
            {lines.length > 2 && (
              <span className="text-[10px] text-gray-400">+{lines.length - 2} more item{lines.length - 2 !== 1 ? "s" : ""}</span>
            )}
          </div>
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
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48,
      cell: (info) => {
        const so = info.row.original;
        return (
          <RowActions
            status={so.status}
            onView={() => setViewOrder(so)}
            onEdit={() => handleEdit(so)}
            onDelete={() => setDeleteConfirmId(so.id)}
            onSend={() => openEmailModal(so)}
            emailSent={emailSentIds.has(so.id)}
          />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [emailSentIds]);

  return (
    <div className="space-y-6 pb-10">

      {/* KPI Cards + New SO button */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex-1 min-w-[140px] rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Orders</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.total}</p>
              <p className="mt-0.5 text-xs text-gray-400">{kpis.totalKg.toLocaleString("en-IN")} KG total</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-orange-400">Approval Pending</p>
              <p className="mt-1.5 text-2xl font-bold text-orange-600">{kpis.approvalPending}</p>
              <p className="mt-0.5 text-xs text-orange-400">{kpis.approvalKg.toLocaleString("en-IN")} KG · awaiting approval</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>
        <div
          onClick={() => setStatusFilter(prev => prev === "Pending Allocation" ? null : "Pending Allocation")}
          className={cn(
            "flex-1 min-w-[140px] rounded-xl border bg-white p-5 shadow-sm cursor-pointer transition-all hover:shadow-md",
            statusFilter === "Pending Allocation"
              ? "border-amber-400 ring-2 ring-amber-200"
              : "border-amber-100 hover:border-amber-300"
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-400">Pending Allocation</p>
              <p className="mt-1.5 text-2xl font-bold text-amber-600">{kpis.pendingAllocation}</p>
              <p className="mt-0.5 text-xs text-amber-500">{kpis.pendingKg.toLocaleString("en-IN")} KG · awaiting PO</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Allocated</p>
              <p className="mt-1.5 text-2xl font-bold text-blue-700">{kpis.allocated}</p>
              <p className="mt-0.5 text-xs text-blue-500">{kpis.allocatedKg.toLocaleString("en-IN")} KG · ready for dispatch</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Completed</p>
              <p className="mt-1.5 text-2xl font-bold text-green-700">{kpis.completed}</p>
              <p className="mt-0.5 text-xs text-green-500">{kpis.completedKg.toLocaleString("en-IN")} KG · dispatched + closed</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Value</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">
              ₹{(kpis.totalValue / 100000).toFixed(1)}L
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{salesOrders.length} orders</p>
          </div>
        </div>
        <button
          onClick={handleNewSO}
          className="flex items-center gap-2 self-stretch rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          <Plus className="h-4 w-4" /> New Sales Order
        </button>
      </div>

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
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

      {/* Active filter banner */}
      {statusFilter && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
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
      <DataGrid
        data={displayOrders}
        columns={columns}
        tableName="sales-orders"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={15}
        onRowClick={(so) => setViewOrder(so)}
        emptyMessage="No sales orders yet. Click 'New Sales Order' to create the first one."
      />

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
