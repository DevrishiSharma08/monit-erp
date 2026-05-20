"use client";

import { PermGuard } from "@/components/PermGuard";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Factory, Clock, CheckCircle2, Truck, Plus, IndianRupee,
  ShoppingCart, ChevronUp, ChevronDown,
  MoreVertical, Eye, Pencil, Trash2, Printer, Mail, X,
} from "lucide-react";
import { EmailModal, EmailFormData, EmailContact } from "@/components/EmailModal";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm";
import { Modal } from "@/components/Modal";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSalesOrder, SalesOrder } from "@/context/SalesOrderContext";
import { useToast } from "@/context/ToastContext";
import { poApi, PORow, POItemRow, CreatePODto, millApi } from "@/lib/api-services";
import { emailSentCache } from "@/lib/emailSentCache";
import { cn } from "@/lib/utils";

// ─── SO status colours (for inline SO view modal) ─────────────────────────────

const SO_STATUS_COLORS: Record<string, string> = {
  "Approval Pending":    "bg-orange-50 text-orange-600",
  "Draft":               "bg-gray-100 text-gray-600",
  "Pending Allocation":  "bg-amber-50 text-amber-600",
  "Partially Allocated": "bg-blue-50 text-blue-600",
  "Fully Allocated":     "bg-cyan-50 text-cyan-600",
  "In Dispatch":         "bg-purple-50 text-purple-600",
  "Partially Delivered": "bg-indigo-50 text-indigo-600",
  "Completed":           "bg-green-50 text-green-600",
  "Closed":              "bg-gray-50 text-gray-500",
  "Cancelled":           "bg-rose-50 text-rose-600",
};

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  "Approval Pending": "bg-yellow-50 text-yellow-700",
  "Draft":            "bg-gray-50 text-gray-600",
  "Sent to Mill":     "bg-blue-50 text-blue-600",
  "Acknowledged":     "bg-cyan-50 text-cyan-600",
  "In Production":    "bg-purple-50 text-purple-600",
  "Partial Ready":    "bg-amber-50 text-amber-600",
  "Ready":            "bg-green-50 text-green-600",
  "Dispatched":       "bg-orange-50 text-orange-600",
  "In Transit":       "bg-indigo-50 text-indigo-600",
  "Part Received":    "bg-teal-50 text-teal-600",
  "Completed":        "bg-emerald-50 text-emerald-600",
};

const STATUS_OPTIONS = Object.keys(STATUS_COLOR).map((v) => ({ label: v, value: v }));

const PO_TYPE_COLORS: Record<string, string> = {
  "Against Sales Order": "bg-blue-50 text-blue-700",
  "For Stock":           "bg-emerald-50 text-emerald-700",
  "Mixed":               "bg-violet-50 text-violet-700",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function PurchaseOrdersPage() {
  const { pendingPoSOs, linkPO } = useSalesOrder();
  const { success, error: showError } = useToast();

  const [pos, setPos]                       = useState<PORow[]>([]);
  const [loadingPos, setLoadingPos]         = useState(true);
  const [showForm, setShowForm]             = useState(false);
  const [editingOrder, setEditingOrder]     = useState<PORow | undefined>();
  const [sourceSO, setSourceSO]             = useState<SalesOrder | null>(null);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [viewOrder, setViewOrder]           = useState<PORow | null>(null);
  const [viewSO, setViewSO]                 = useState<SalesOrder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [emailOrder, setEmailOrder]         = useState<PORow | null>(null);
  const [emailContacts, setEmailContacts]   = useState<EmailContact[]>([]);
  const [emailSentIds, setEmailSentIds]     = useState<Set<number>>(() => emailSentCache.getPoIds());

  const loadPos = useCallback(() => {
    setLoadingPos(true);
    poApi.list({ pageSize: 200 })
      .then((r) => {
        setPos(r.items);
        const sentFromApi = r.items.filter((p) => p.emailSentAt).map((p) => p.id);
        if (sentFromApi.length > 0) {
          emailSentCache.seedPoIds(sentFromApi);
          setEmailSentIds(emailSentCache.getPoIds());
        }
      })
      .catch(() => showError("Failed to load purchase orders."))
      .finally(() => setLoadingPos(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadPos(); }, [loadPos]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total:        pos.length,
    pending:      pos.filter((p) => ["Approval Pending","Draft","Sent to Mill","Acknowledged"].includes(p.status)).length,
    inProduction: pos.filter((p) => ["In Production","Partial Ready"].includes(p.status)).length,
    ready:        pos.filter((p) => p.status === "Ready").length,
    dispatched:   pos.filter((p) => ["Dispatched","In Transit","Part Received","Completed"].includes(p.status)).length,
    totalValue:   pos.reduce((s, p) => s + p.totalValue, 0),
    pendingPO:    pendingPoSOs.length,
  }), [pos, pendingPoSOs]);

  // ── PO table columns ───────────────────────────────────────────────────────
  const columns: ColumnConfig<PORow>[] = useMemo(() => [
    {
      id: "poNumber", accessorKey: "poNumber", header: "PO Number",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 150,
      cell: (info) => {
        const po = info.row.original;
        return (
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-900">{info.getValue() as string}</span>
            {(po.shipmentMode === "Blind" || po.blindShipment) && (
              <span className="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">Blind</span>
            )}
            {po.shipmentMode === "InvoiceOverride" && (
              <span className="inline-flex rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">Inv. Override</span>
            )}
          </span>
        );
      },
    },
    {
      id: "linkedSONumber", accessorKey: "linkedSONumber", header: "SO Ref / Customer",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 175,
      cell: (info) => {
        const po  = info.row.original;
        const ref = info.getValue() as string | undefined;
        return (
          <div>
            {ref
              ? <span className="font-medium text-blue-600">{ref}</span>
              : <span className="text-gray-300">—</span>}
            {po.directCustomer && (
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight truncate">{po.directCustomer}</p>
            )}
          </div>
        );
      },
    },
    {
      id: "millName", accessorKey: "millName", header: "Mill",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 170,
    },
    {
      id: "items", accessorKey: "items", header: "Material",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 180,
      cell: (info) => {
        const po = info.row.original;
        const first = po.items[0];
        if (!first) return <span className="text-gray-300">—</span>;
        const more = po.items.length > 1 ? ` +${po.items.length - 1}` : "";
        return (
          <span className="text-xs">
            <span className="font-medium text-gray-800">{first.description || "—"}</span>
            {first.gsm ? <span className="text-gray-400"> · {first.gsm}g</span> : null}
            {more && <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{more}</span>}
          </span>
        );
      },
    },
    {
      id: "orderDate", accessorKey: "orderDate", header: "PO Date",
      filterType: "date", enableSorting: true, defaultVisible: true, size: 105,
    },
    {
      id: "poType", accessorKey: "poType", header: "Type",
      filterType: "select",
      filterOptions: [
        { label: "Against SO", value: "Against Sales Order" },
        { label: "For Stock",  value: "For Stock" },
        { label: "Mixed",      value: "Mixed" },
      ],
      enableSorting: false, defaultVisible: true, size: 115,
      cell: (info) => {
        const t = info.getValue() as string;
        return (
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", PO_TYPE_COLORS[t] ?? "bg-gray-50 text-gray-600")}>
            {t === "Against Sales Order" ? "Against SO" : t}
          </span>
        );
      },
    },
    {
      id: "expectedDeliveryDate", accessorKey: "expectedDeliveryDate", header: "Delivery Date",
      filterType: "date", enableSorting: true, defaultVisible: true, size: 120,
      cell: (info) => {
        const date = info.getValue() as string | undefined;
        const overdue = date && new Date(date) < new Date() && !["Completed","Dispatched"].includes(info.row.original.status);
        return <span className={overdue ? "font-medium text-red-600" : "text-gray-600"}>{date || "—"}{overdue ? " ⚠" : ""}</span>;
      },
    },
    {
      id: "totalValue", accessorKey: "totalValue", header: "Value",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 115,
      cell: (info) => <span className="font-semibold text-gray-900">₹{(info.getValue() as number).toLocaleString("en-IN")}</span>,
    },
    {
      id: "status", accessorKey: "status", header: "Status",
      filterType: "select", filterOptions: STATUS_OPTIONS,
      enableSorting: true, defaultVisible: true, size: 130,
      cell: (info) => {
        const s = info.getValue() as string;
        return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLOR[s] ?? "bg-gray-50 text-gray-600")}>{s}</span>;
      },
    },
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48,
      cell: (info) => {
        const po = info.row.original;
        return (
          <PORowActions
            po={po}
            onView={() => setViewOrder(po)}
            onEdit={() => { setSourceSO(null); setEditingOrder(po); setShowForm(true); }}
            onDelete={() => setDeleteConfirmId(po.id)}
            onPrint={() => {}}
            onSendMail={() => openEmailModal(po)}
            mailSent={emailSentIds.has(po.id)}
          />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [emailSentIds]);

  // ── Pending SO table columns ──────────────────────────────────────────────
  const pendingSOColumns: ColumnConfig<SalesOrder>[] = useMemo(() => [
    {
      id: "soNumber", accessorKey: "soNumber", header: "SO Number",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-semibold text-blue-600">{info.getValue() as string}</span>,
    },
    {
      id: "orderDate", accessorKey: "orderDate", header: "SO Date",
      filterType: "date", enableSorting: true, defaultVisible: true, size: 110,
    },
    {
      id: "customer", accessorKey: "customer", header: "Customer",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 180,
    },
    {
      id: "lines", accessorKey: "lines", header: "Items",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 260,
      cell: (info) => {
        const so = info.row.original as SalesOrder;
        return (
          <div className="space-y-0.5">
            {so.lines.map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 w-4 shrink-0">{i + 1}.</span>
                <span className="text-xs font-medium text-gray-700 truncate">{l.materialCode ?? l.materialId}</span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      id: "weight", accessorKey: "lines", header: "Wt / Qty",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 110,
      cell: (info) => {
        const so = info.row.original as SalesOrder;
        const totalWt  = so.lines.reduce((s, l) => s + (l.weightKg ?? l.orderedQty ?? 0), 0);
        const totalQty = so.lines.reduce((s, l) => s + (l.qty ?? 0), 0);
        return (
          <div className="text-xs text-gray-700">
            <p className="font-semibold">{totalWt.toLocaleString("en-IN")} KG</p>
            {totalQty > 0 && <p className="text-gray-400">{totalQty.toLocaleString("en-IN")} Sheets</p>}
          </div>
        );
      },
    },
    {
      id: "deliveryMode", accessorKey: "deliveryMode", header: "Delivery",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 140,
      cell: (info) => {
        const m = info.getValue() as string;
        const cls = m === "From Stock" ? "bg-green-50 text-green-700"
          : m === "Direct Mill Delivery" ? "bg-blue-50 text-blue-700"
          : "bg-violet-50 text-violet-700";
        return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>{m}</span>;
      },
    },
    {
      id: "salesman", accessorKey: "salesman", header: "Salesman",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 120,
    },
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48,
      cell: (info) => {
        const so = info.row.original as SalesOrder;
        return (
          <PendingSORowActions
            so={so}
            onRaisePO={() => handleCreateFromSO(so)}
            onViewSO={() => setViewSO(so)}
          />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateFromSO = (so: SalesOrder) => {
    setSourceSO(so);
    setEditingOrder(undefined);
    setShowPendingPanel(false);
    setShowForm(true);
  };

  const handleNewPO = () => {
    setSourceSO(null);
    setEditingOrder(undefined);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingOrder(undefined);
    if (sourceSO) setShowPendingPanel(true);
    setSourceSO(null);
  };

  const handleSubmit = async (dto: CreatePODto, editId?: number) => {
    if (editId) {
      const updated = await poApi.update(editId, { ...dto, status: editingOrder?.status });
      setPos((prev) => prev.map((p) => p.id === editId ? updated : p));
      success("Purchase order updated.");
    } else {
      const created = await poApi.create(dto);
      setPos((prev) => [created, ...prev]);
      if (sourceSO) linkPO(sourceSO.id, created.poNumber);
      success(`Purchase order ${created.poNumber} raised successfully.`);
    }
    setShowForm(false);
    setEditingOrder(undefined);
    setSourceSO(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await poApi.remove(deleteConfirmId);
    setPos((prev) => prev.filter((p) => p.id !== deleteConfirmId));
    success("Purchase order deleted.");
    setDeleteConfirmId(null);
  };

  const openEmailModal = async (po: PORow) => {
    setEmailOrder(po);
    try {
      const raw = await millApi.getContacts(po.millId);
      setEmailContacts(raw.filter((c) => c.email).map((c) => ({
        name:      c.contactPerson,
        email:     c.email!,
        isDefault: c.isDefault ?? false,
      })));
    } catch {
      setEmailContacts([]);
    }
  };

  const buildPOEmailData = (po: PORow): EmailFormData => {
    const shipMode = po.shipmentMode ?? (po.blindShipment ? "Blind" : "Normal");
    // For blind/override POs, the mill must NOT see the actual SO customer name
    const billTo =
      shipMode === "Blind"           ? "Monit Paper Agency" :
      shipMode === "InvoiceOverride" ? (po.invoiceParty || "—") :
      po.directCustomer || "";
    const totalWeightKg = po.items.reduce((s, item) => s + (item.weightKg ?? 0), 0);
    const itemLines = po.items.map((item, i) => {
      const baseRate = item.discount && item.discount > 0
        ? (item.rate / (1 - item.discount / 100))
        : item.rate;
      const qty = item.weightKg && item.weightKg > 0
        ? `${item.weightKg.toLocaleString("en-IN")} KG`
        : `${item.quantity.toLocaleString("en-IN")} ${item.unit || ""}`.trim();
      return `  ${i + 1}. ${item.description || "—"} — ${qty} — ₹${baseRate.toFixed(2)}/- — Amt: ₹${item.amount.toLocaleString("en-IN")}`;
    }).join("\n");
    const body = [
      `Dear ${po.millName},`,
      ``,
      `Kindly find below our Purchase Order details:`,
      ``,
      `PO No.   : ${po.poNumber}`,
      `Date     : ${po.orderDate}`,
      `Payment  : ${po.paymentTerms || "—"}`,
      `Delivery : ${po.expectedDeliveryDate || "—"}`,
      ...(po.linkedSONumber   ? [`SO Ref   : ${po.linkedSONumber}`]         : []),
      ...(billTo              ? [`Bill To  : ${billTo}`]                     : []),
      ...(po.directDeliveryAddress ? [`Ship To  : ${po.directDeliveryAddress}`] : []),
      ``,
      `Items:`,
      itemLines,
      ``,
      totalWeightKg > 0
        ? `Total Wt   : ${totalWeightKg.toLocaleString("en-IN")} KG`
        : `Total Qty  : ${po.totalQuantity.toLocaleString("en-IN")}`,
      `Total Value: ₹${po.totalValue.toLocaleString("en-IN")}`,
      ...(po.specialInstructions ? [``, `Special Instructions:`, po.specialInstructions] : []),
      ``,
      `Please acknowledge receipt of this PO.`,
      ``,
      `Regards,`,
      `Monit Paper Agency`,
    ].join("\n");
    return { to: [], cc: [], subject: `Purchase Order: ${po.poNumber}`, body };
  };

  const handleSendPOEmail = async (data: EmailFormData) => {
    if (!emailOrder) return;
    await poApi.sendEmail(emailOrder.id, {
      to: data.to, cc: data.cc, subject: data.subject, body: data.body,
    });
    emailSentCache.addPoId(emailOrder.id);
    setEmailSentIds((prev) => new Set([...prev, emailOrder.id]));
    success(`Email sent to ${data.to.join(", ")}`);
    setEmailOrder(null);
    setEmailContacts([]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">

      {/* ── KPI Cards + New PO button ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex-1 min-w-[130px]"><KpiCard title="Total POs"     value={kpis.total}        subtitle="All time"              icon={Factory}     iconBg="bg-blue-50"    iconColor="text-blue-500"   className="h-full" /></div>
        <div className="flex-1 min-w-[130px]"><KpiCard title="Pending"       value={kpis.pending}      subtitle="Draft / Sent"          icon={Clock}       iconBg="bg-yellow-50"  iconColor="text-yellow-500" subtitleColor="amber" className="h-full" /></div>
        <div className="flex-1 min-w-[130px]"><KpiCard title="In Production" value={kpis.inProduction} subtitle="Being manufactured"    icon={Factory}     iconBg="bg-purple-50"  iconColor="text-purple-500" subtitleColor="blue"  className="h-full" /></div>
        <div className="flex-1 min-w-[130px]"><KpiCard title="Ready"         value={kpis.ready}        subtitle="Ready for dispatch"    icon={CheckCircle2}iconBg="bg-green-50"   iconColor="text-green-500"  subtitleColor="green" className="h-full" /></div>
        <div className="flex-1 min-w-[130px]"><KpiCard title="Dispatched"    value={kpis.dispatched}   subtitle="In transit / received" icon={Truck}       iconBg="bg-cyan-50"    iconColor="text-cyan-500"   className="h-full" /></div>
        <div className="flex-1 min-w-[130px]">
          <KpiCard
            title="Total Value"
            value={`₹${(kpis.totalValue / 100000).toFixed(1)}L`}
            subtitle="All POs combined"
            icon={IndianRupee}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-500"
            className="h-full"
          />
        </div>

        {/* Pending PO KPI */}
        <button
          type="button"
          onClick={() => kpis.pendingPO > 0 && setShowPendingPanel((v) => !v)}
          className={cn(
            "flex-1 min-w-[130px] rounded-xl border p-5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]",
            kpis.pendingPO > 0
              ? showPendingPanel
                ? "border-blue-300 bg-blue-500 text-white"
                : "border-blue-200 bg-blue-50 hover:border-blue-300"
              : "border-gray-100 bg-white cursor-default"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className={cn("text-xs font-medium uppercase tracking-wide truncate",
                kpis.pendingPO > 0 ? showPendingPanel ? "text-blue-100" : "text-blue-700" : "text-gray-400"
              )}>Pending PO</p>
              <p className={cn("mt-1.5 text-2xl font-bold",
                kpis.pendingPO > 0 ? showPendingPanel ? "text-white" : "text-blue-700" : "text-gray-900"
              )}>{kpis.pendingPO}</p>
              <p className={cn("mt-0.5 text-xs",
                kpis.pendingPO > 0 ? showPendingPanel ? "text-blue-100" : "text-blue-600" : "text-gray-400"
              )}>{kpis.pendingPO > 0 ? "SOs awaiting PO" : "All SOs covered"}</p>
            </div>
            <div className={cn("ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
              kpis.pendingPO > 0 ? showPendingPanel ? "bg-blue-400" : "bg-blue-100" : "bg-gray-50"
            )}>
              {kpis.pendingPO > 0
                ? showPendingPanel ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-blue-600" />
                : <CheckCircle2 className="h-4 w-4 text-gray-300" />
              }
            </div>
          </div>
        </button>

        <button
          onClick={handleNewPO}
          className="flex items-center gap-2 self-stretch rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-600 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          <Plus className="h-4 w-4" /> New PO
        </button>
      </div>

      {/* ── Pending SO Table ──────────────────────────────────────────────── */}
      {showPendingPanel && (
        <div className="rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center border-b border-blue-100 bg-blue-50 px-5 py-3 gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
              <ShoppingCart className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">Sales Orders — Pending PO</p>
              <p className="text-xs text-blue-600">
                {pendingPoSOs.length} {pendingPoSOs.length === 1 ? "SO" : "SOs"} with no purchase order raised yet · click a row to raise PO
              </p>
            </div>
          </div>
          <DataGrid
            data={pendingPoSOs}
            columns={pendingSOColumns}
            tableName="pending-po-sos"
            enableFilters={true}
            enablePagination={true}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            initialPageSize={5}
            onRowClick={handleCreateFromSO}
            emptyState={
              <EmptyState
                icon={CheckCircle2}
                title="All SOs covered!"
                description="Every sales order has at least one purchase order raised."
              />
            }
          />
        </div>
      )}

      {/* ── Purchase Orders Table ─────────────────────────────────────────── */}
      {!showPendingPanel && (
        <DataGrid
          data={pos}
          columns={columns}
          tableName="purchase-orders"
          enableFilters={true}
          enablePagination={true}
          enableColumnReordering={true}
          enableColumnVisibility={true}
          initialPageSize={10}
          onRowClick={(po) => setViewOrder(po)}
          emptyMessage={loadingPos ? "Loading purchase orders…" : "No purchase orders yet. Raise a PO from a confirmed Sales Order."}
        />
      )}

      {/* ── PO Form Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={handleCancel}
        title={
          sourceSO
            ? `New PO — ${sourceSO.soNumber} · ${sourceSO.customer}`
            : editingOrder?.id
            ? `Edit ${editingOrder.poNumber}`
            : "New Purchase Order"
        }
        size="2xl"
      >
        <PurchaseOrderForm
          initialData={editingOrder}
          sourceSO={sourceSO ?? undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </Modal>

      {/* ── View Modal ───────────────────────────────────────────────────── */}
      {viewOrder && (
        <POViewModal
          po={viewOrder}
          onClose={() => setViewOrder(null)}
          onEdit={() => { setEditingOrder(viewOrder); setViewOrder(null); setShowForm(true); }}
          onSendMail={() => { const po = viewOrder; setViewOrder(null); openEmailModal(po); }}
          mailSent={emailSentIds.has(viewOrder.id)}
        />
      )}

      {/* ── SO View Modal (from Pending PO panel) ────────────────────────── */}
      {viewSO && (
        <SOViewModal
          so={viewSO}
          onClose={() => setViewSO(null)}
          onRaisePO={() => { setViewSO(null); handleCreateFromSO(viewSO); }}
        />
      )}

      {/* ── Email Modal ──────────────────────────────────────────────────── */}
      {emailOrder && (
        <EmailModal
          title={`Send Mail to Mill — ${emailOrder.poNumber}`}
          initialData={buildPOEmailData(emailOrder)}
          contacts={emailContacts}
          onSend={handleSendPOEmail}
          onClose={() => { setEmailOrder(null); setEmailContacts([]); }}
        />
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      {deleteConfirmId && (
        <Modal isOpen onClose={() => setDeleteConfirmId(null)} title="Delete Purchase Order?" size="sm">
          <p className="text-sm text-gray-600 mb-4">
            This action cannot be undone. The PO will be permanently removed.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Row Actions: PO grid ──────────────────────────────────────────────────────

function PORowActions({ po, onView, onEdit, onDelete, onPrint, onSendMail, mailSent }: {
  po: PORow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrint: () => void;
  onSendMail: () => void;
  mailSent: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, right: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  void po;

  const menuItems = [
    { icon: Eye,     label: "View",   fn: onView,   cls: "" },
    { icon: Pencil,  label: "Edit",   fn: onEdit,   cls: "" },
    { icon: Printer, label: "Print",  fn: onPrint,  cls: "" },
    { icon: Mail,    label: mailSent ? "Mail Sent ✓" : "Send Mail to Mill", fn: onSendMail,
      cls: mailSent ? "text-green-600 hover:bg-green-50 cursor-default" : "text-blue-600 hover:bg-blue-50" },
    { icon: Trash2,  label: "Delete", fn: onDelete, cls: "text-red-600 hover:bg-red-50" },
  ];

  return (
    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} onClick={toggle}
        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="min-w-[160px] rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          {menuItems.map(({ icon: Icon, label, fn, cls }) => (
            <button key={label}
              onClick={() => { if (!mailSent || label !== "Mail Sent ✓") fn(); setOpen(false); }}
              className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors", cls)}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Row Actions: Pending SO grid ─────────────────────────────────────────────

function PendingSORowActions({ so, onRaisePO, onViewSO }: {
  so: SalesOrder;
  onRaisePO: () => void;
  onViewSO: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, right: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  void so;

  return (
    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} onClick={toggle}
        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="min-w-[140px] rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          <button
            onClick={() => { onRaisePO(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Factory className="h-3.5 w-3.5" /> Raise PO
          </button>
          <button
            onClick={() => { onViewSO(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> View SO
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── SOViewModal (inline SO detail from Pending PO panel) ─────────────────────

function SOViewModal({ so, onClose, onRaisePO }: {
  so: SalesOrder;
  onClose: () => void;
  onRaisePO: () => void;
}) {
  const statusCls = SO_STATUS_COLORS[so.status] ?? "bg-gray-100 text-gray-600";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
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
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Details</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                { label: "SO Number",      value: so.soNumber,                  blue: true },
                { label: "Order Date",     value: so.orderDate },
                { label: "Customer",       value: so.customer },
                { label: "Contact",        value: so.contactPerson || "—" },
                { label: "Salesman",       value: so.salesman },
                { label: "Payment Terms",  value: so.paymentTerms },
                { label: "Delivery Mode",  value: so.deliveryMode || "—" },
                { label: "Delivery Terms", value: so.deliveryTerms || "—" },
                { label: "Delivery Party", value: so.deliveryParty || so.customer },
                { label: "Delivery Address", value: so.lines[0]?.deliveryAddress || "—" },
              ].map(({ label, value, blue }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className={cn("text-xs font-semibold mt-0.5 text-gray-900", blue && "text-blue-700")}>{value}</p>
                </div>
              ))}
            </div>
          </div>

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
                        {line.qty !== undefined && line.qty > 0
                          ? <span>{line.qty.toLocaleString()} Sheets{line.weightKg ? <span className="block text-[10px] text-gray-400">{line.weightKg.toLocaleString()} KG</span> : null}</span>
                          : <span>{(line.weightKg ?? line.orderedQty).toLocaleString()} KG</span>
                        }
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">₹{line.rate.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                        ₹{line.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{line.requiredDeliveryDate || "—"}</td>
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
                    <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold text-blue-700">Order Total</td>
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

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            Close
          </button>
          <button
            onClick={onRaisePO}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
          >
            <Factory className="h-3.5 w-3.5" /> Raise PO
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── POViewModal ───────────────────────────────────────────────────────────────

function POViewModal({ po, onClose, onEdit, onSendMail, mailSent }: {
  po: PORow;
  onClose: () => void;
  onEdit: () => void;
  onSendMail: () => void;
  mailSent: boolean;
}) {
  const shipMode  = po.shipmentMode ?? (po.blindShipment ? "Blind" : "Normal");
  const isBlind    = shipMode === "Blind";
  const isOverride = shipMode === "InvoiceOverride";

  return (
    <Modal isOpen onClose={onClose} title={po.poNumber} size="2xl">
      <div className="space-y-4 text-sm">

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

              {/* Always: SO Number */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-indigo-400">SO Reference</p>
                <p className="text-sm font-semibold text-indigo-700">{po.linkedSONumber}</p>
              </div>

              {/* Normal: actual customer from SO */}
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

              {/* Blind: Mill sees Monit as buyer */}
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

              {/* Invoice Override: Mill invoices override party */}
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
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1.5">
            Items ({po.items.length})
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-xs min-w-[620px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-2 py-2 text-left font-medium w-7">#</th>
                  <th className="px-2 py-2 text-left font-medium">Material</th>
                  <th className="px-2 py-2 text-right font-medium">Qty</th>
                  <th className="px-2 py-2 text-right font-medium">Wt (KG)</th>
                  <th className="px-2 py-2 text-right font-medium">Rate (₹)</th>
                  <th className="px-2 py-2 text-right font-medium">Disc%</th>
                  <th className="px-2 py-2 text-right font-medium">Final (₹)</th>
                  <th className="px-2 py-2 text-right font-medium">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {po.items.map((item: POItemRow, idx: number) => {
                  const rawRate   = item.discount && item.discount > 0 ? (item.rate / (1 - item.discount / 100)) : 0;
                  const finalRate = item.rate;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-gray-800">{item.description || "—"}</div>
                        {(item.gsm || item.size) && (
                          <div className="text-[10px] text-gray-400">
                            {item.gsm ? `${item.gsm}g` : ""}{item.gsm && item.size ? " · " : ""}{item.size || ""}
                          </div>
                        )}
                        {item.remark && <div className="text-[10px] text-amber-600 italic mt-0.5">{item.remark}</div>}
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-gray-800">
                        {item.quantity.toLocaleString("en-IN")}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-600">
                        {item.weightKg && item.weightKg > 0 ? item.weightKg.toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-600">
                        {rawRate > 0 ? rawRate.toLocaleString("en-IN") : finalRate > 0 ? finalRate.toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500">
                        {item.discount && item.discount > 0 ? `${item.discount}%` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-blue-700">
                        {finalRate > 0 ? finalRate.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-800">
                        {item.amount > 0 ? `₹${item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t border-blue-100">
                  <td colSpan={2} className="px-2 py-2 text-xs font-semibold text-blue-700">Total</td>
                  <td className="px-2 py-2 text-right text-xs font-bold text-blue-800">
                    {po.totalQuantity.toLocaleString("en-IN")}
                  </td>
                  <td colSpan={4} />
                  <td className="px-2 py-2 text-right text-xs font-black text-blue-900">
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

        {/* Internal remarks — hidden from print */}
        {po.remarks && (
          <div className="print:hidden">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Internal Remarks</p>
            <p className="text-xs text-gray-600">{po.remarks}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <button onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              onClick={mailSent ? undefined : onSendMail}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                mailSent
                  ? "border-green-200 bg-green-50 text-green-600 cursor-default"
                  : "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
              )}
            >
              <Mail className="h-3.5 w-3.5" /> {mailSent ? "Mail Sent ✓" : "Send Mail to Mill"}
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit PO
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Page() {
  return <PermGuard perm="po.read"><PurchaseOrdersPage /></PermGuard>;
}
