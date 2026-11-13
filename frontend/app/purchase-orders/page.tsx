"use client";

import { PermGuard } from "@/components/PermGuard";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { PortalModal, ModalCloseButton } from "@/components/PortalModal";
import {
  Factory, Clock, CheckCircle2, Truck, Plus, IndianRupee,
  ShoppingCart, ChevronUp, ChevronDown,
  MoreVertical, Eye, Pencil, Trash2, Printer, Mail, Share2, Ban, ImageIcon,
} from "lucide-react";
import { EmailModal, EmailFormData, EmailContact } from "@/components/EmailModal";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { PurchaseOrderForm } from "@/components/forms/PurchaseOrderForm";
import { Modal } from "@/components/Modal";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSalesOrder, SalesOrder } from "@/context/SalesOrderContext";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { useToast } from "@/context/ToastContext";
import { poApi, PORow, POItemRow, CreatePODto, millApi } from "@/lib/api-services";
import { SharePanel, ShareData } from "@/components/ShareMenu";
import { emailSentCache } from "@/lib/emailSentCache";
import { cn } from "@/lib/utils";
import { lineWeightKg, lineSheetCount } from "@/lib/weight";
import { printPdfBlob } from "@/lib/printPdf";

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
  "Part Received":    "bg-teal-50 text-teal-600",
  "Completed":        "bg-emerald-50 text-emerald-600",
  "Cancelled":        "bg-rose-50 text-rose-600",
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
  const { config: companyConfig } = useCompanySettings();

  const [pos, setPos]                       = useState<PORow[]>([]);
  const [loadingPos, setLoadingPos]         = useState(true);
  const [showForm, setShowForm]             = useState(false);
  const [editingOrder, setEditingOrder]     = useState<PORow | undefined>();
  const [sourceSO, setSourceSO]             = useState<SalesOrder | null>(null);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [viewOrder, setViewOrder]           = useState<PORow | null>(null);
  const [viewSO, setViewSO]                 = useState<SalesOrder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget]     = useState<PORow | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelBusy, setCancelBusy]         = useState(false);
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
    dispatched:   pos.filter((p) => ["Dispatched","Part Received","Completed"].includes(p.status)).length,
    totalValue:   pos.reduce((s, p) => s + p.totalValue, 0),
    pendingPO:    pendingPoSOs.length,
  }), [pos, pendingPoSOs]);

  // ── PO table columns ───────────────────────────────────────────────────────
  const columns: ColumnConfig<PORow>[] = useMemo(() => [
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48, sticky: "left",
      cell: (info) => {
        const po = info.row.original;
        return (
          <PORowActions
            po={po}
            onView={() => setViewOrder(po)}
            onEdit={() => { setSourceSO(null); setEditingOrder(po); setShowForm(true); }}
            onDelete={() => setDeleteConfirmId(po.id)}
            onCancel={() => { setCancelTarget(po); setCancelReasonInput(""); }}
            onPrint={async () => {
              try {
                const { blob } = await poApi.downloadPdf(po.id);
                printPdfBlob(blob);
              } catch (e) {
                showError(e instanceof Error ? e.message : "Print failed.");
              }
            }}
            onExportImage={async () => {
              try {
                const { blob, filename } = await poApi.downloadImage(po.id);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename || `PO_${po.poNumber.replace(/\//g, "-")}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (e) {
                showError(e instanceof Error ? e.message : "Image export failed.");
              }
            }}
            onSendMail={() => openEmailModal(po)}
            mailSent={emailSentIds.has(po.id)}
          />
        );
      },
    },
    {
      id: "poNumber", accessorKey: "poNumber", header: "PO Number",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 200, align: "left" as const, noTruncate: true,
      cell: (info) => {
        const po = info.row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-semibold text-purple-700">{info.getValue() as string}</span>
              {po.isBackfilled && (
                <span
                  title="Backfilled / historical PO entered from the manual register"
                  className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase border border-amber-200"
                >
                  Backfill
                </span>
              )}
            </span>
            {(po.shipmentMode === "Blind" || po.blindShipment) && (
              <span className="inline-flex w-fit rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">Blind</span>
            )}
            {po.shipmentMode === "InvoiceOverride" && (
              <span className="inline-flex w-fit rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">Inv. Override</span>
            )}
          </div>
        );
      },
    },
    {
      id: "linkedSONumber", accessorKey: "linkedSONumber", header: "SO Ref / Customer",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 175, align: "left" as const,
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
      // Single "Mill" column per client UAT — when a Mill Unit was picked on
      // the PO, that unit's name is what shows here (since items are
      // unit-wise). POs whose mill has no units fall back to the mill name.
      // Filter + sort both work on the same composite value so the user can
      // type the unit name and find rows directly.
      id: "millName",
      accessorKey: "millName",
      header: "Mill",
      filterType: "text",
      enableSorting: true,
      defaultVisible: true,
      size: 200,
      align: "left" as const,
      cell: (info) => {
        const po = info.row.original;
        const unit = po.millUnitName?.trim();
        return unit
          ? (
            <div className="leading-tight">
              <div className="text-xs font-semibold text-blue-700">{unit}</div>
              <div className="text-[10px] text-gray-400">{po.millName}</div>
            </div>
          )
          : <span className="text-sm text-gray-800">{po.millName || "—"}</span>;
      },
      // Used by global search + the per-column text filter so typing unit
      // name OR mill name matches the row.
      accessorFn: (po: PORow) => {
        const unit = po.millUnitName?.trim();
        return unit ? `${unit} (${po.millName})` : (po.millName ?? "");
      },
      exportValue: (po: PORow) => {
        const unit = po.millUnitName?.trim();
        return unit ? `${po.millName} — ${unit}` : (po.millName ?? "");
      },
    },
    {
      id: "items", accessorKey: "items", header: "Material",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 260, align: "left" as const, noTruncate: true,
      exportValue: (po) => {
        if (!po.items?.length) return "";
        const first = po.items[0];
        const desc = first.description || "";
        const wt = first.weightKg && first.weightKg > 0
          ? `${first.weightKg} KG`
          : `${first.quantity} ${first.unit || ""}`.trim();
        const extra = po.items.length > 1 ? ` (+${po.items.length - 1} more)` : "";
        return `${desc} | ${wt}${extra}`;
      },
      cell: (info) => {
        const po = info.row.original;
        const first = po.items[0];
        if (!first) return <span className="text-gray-300 text-xs">—</span>;
        const weightLine = `${lineWeightKg({ weightKg: first.weightKg, quantity: first.quantity, gsm: first.gsm, size: first.size }).toLocaleString("en-IN")} kg`;
        return (
          <div className="text-xs leading-snug">
            <div className="font-medium text-gray-900 truncate">
              {first.description || "—"}
              {po.items.length > 1 && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">+{po.items.length - 1}</span>
              )}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5 tabular-nums">{weightLine}</div>
          </div>
        );
      },
    },
    {
      id: "itemCount", accessorKey: "items", header: "# Items",
      filterType: "none", enableSorting: false, defaultVisible: true, size: 75,
      exportValue: (po) => po.items?.length ?? 0,
      cell: (info) => {
        const n = (info.getValue() as any[]).length;
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
      id: "orderDate", accessorKey: "orderDate", header: "PO Date",
      filterType: "dateRange", enableSorting: true, defaultVisible: true, size: 105,
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
      filterType: "dateRange", enableSorting: true, defaultVisible: true, size: 120,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [emailSentIds]);

  // ── Pending SO table columns ──────────────────────────────────────────────
  const pendingSOColumns: ColumnConfig<SalesOrder>[] = useMemo(() => [
    {
      id: "actions", accessorKey: "id", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 48, sticky: "left",
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
    {
      id: "soNumber", accessorKey: "soNumber", header: "SO Number",
      filterType: "text", enableSorting: true, enableHiding: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-semibold text-blue-600">{info.getValue() as string}</span>,
    },
    {
      id: "orderDate", accessorKey: "orderDate", header: "SO Date",
      filterType: "dateRange", enableSorting: true, defaultVisible: true, size: 110,
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
        const totalWt  = so.lines.reduce((s, l) => s + lineWeightKg(l), 0);
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
      // Editing never auto-resends the PDF/email to the mill — reopen the
      // View modal right after saving so the "resend to mill?" reminder
      // (computed from updatedAt vs emailSentAt) is immediately visible
      // instead of the user just landing back on the grid unaware.
      if (updated.status !== "Approval Pending" && updated.status !== "Cancelled") {
        setViewOrder(updated);
      }
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
    try {
      await poApi.remove(deleteConfirmId);
      setPos((prev) => prev.filter((p) => p.id !== deleteConfirmId));
      success("Purchase order deleted.");
      setDeleteConfirmId(null);
    } catch (e) {
      // Show the backend's error message via toast (permission denied,
      // FK conflict, etc.) instead of letting Next.js dev overlay
      // surface it as an uncaught runtime ApiError.
      const msg = e instanceof Error && e.message ? e.message : "Failed to delete purchase order.";
      showError(msg);
      setDeleteConfirmId(null);
    }
  };

  const handleCancelPO = async () => {
    if (!cancelTarget) return;
    if (!cancelReasonInput.trim()) { showError("Please enter a cancellation reason."); return; }
    setCancelBusy(true);
    try {
      const updated = await poApi.cancel(cancelTarget.id, cancelReasonInput.trim());
      setPos((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      success(`PO ${cancelTarget.poNumber} cancelled.`);
      setCancelTarget(null);
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Failed to cancel purchase order.";
      showError(msg);
    } finally {
      setCancelBusy(false);
    }
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
    // Strictly from Company Settings — no hardcoded "Monit Paper Agency"
    // fallback so the second tenant (Monit Paper Associates, different DB)
    // never sees the wrong brand string in its outgoing emails.
    const monitName = companyConfig.companyName?.trim() ?? "";
    const monitAddr = companyConfig.address?.trim() ?? "";
    const billTo =
      shipMode === "Blind"           ? monitName :
      shipMode === "InvoiceOverride" ? (po.invoiceParty || "—") :
      po.directCustomer || "";
    // Ship-To address: Blind → Monit's own address (mill thinks goods come to
    // the agency); Override / Normal → actual delivery address.
    const shipToAddr =
      shipMode === "Blind" ? monitAddr : (po.directDeliveryAddress || "");
    const totalWeightKg = po.items.reduce((s, item) => s + (item.weightKg ?? 0), 0);
    const itemLines = po.items.map((item, i) => {
      // PO stores `rate` as POST-discount (finalPrice) and `discount`
      // as flat ₹/KG. Email "Rate" line shows the LIST/master rate the
      // user configured — reconstruct as rate + discount.
      const baseRate = +(item.rate + (item.discount ?? 0)).toFixed(2);
      const qty = `${lineWeightKg({ weightKg: item.weightKg, quantity: item.quantity, gsm: item.gsm, size: item.size }).toLocaleString("en-IN")} KG`;
      // Per UAT — Item Code removed from PO email. Material is identified by
      // Brand + GSM + Size as separate fields. Brand falls back to the first
      // segment of the legacy item code so older items still read sensibly.
      const brand = item.brandName?.trim() || (item.description || "").split("/")[1]?.trim() || (item.description || "—");
      const gsm   = item.gsm ? `${item.gsm} GSM` : "—";
      const size  = item.size?.trim() || "—";
      return `  ${i + 1}. ${brand} | ${gsm} | ${size} | ${qty} | ₹${baseRate.toFixed(2)}/- | Amt: ₹${item.amount.toLocaleString("en-IN")}`;
    }).join("\n");
    // Greet with the picked unit when present so the mill's unit clerk
    // sees their own name (e.g. "Dear ITC Paperboards — Bhadrachalam,").
    // Address shown right below for routing context.
    const millGreeting = po.millUnitName?.trim()
      ? `${po.millName} — ${po.millUnitName.trim()}`
      : po.millName;
    const body = [
      `Dear ${millGreeting},`,
      ...(po.millUnitAddress ? [po.millUnitAddress] : []),
      ``,
      `Kindly find below our Purchase Order details:`,
      ``,
      `PO No.   : ${po.poNumber}`,
      `Date     : ${po.orderDate}`,
      `Payment  : ${po.paymentTerms || "—"}`,
      `Delivery : ${po.expectedDeliveryDate || "—"}`,
      ...(po.linkedSONumber   ? [`SO Ref   : ${po.linkedSONumber}`]         : []),
      // Mill GST (from the picked unit, else mill-level) — printed on every
      // PO email so the mill can match the order to its own GST records.
      ...(po.millGstNo        ? [`Mill GST : ${po.millGstNo}`]               : []),
      ...(billTo              ? [`Bill To  : ${billTo}`]                     : []),
      // Cust GST line — Normal mode shows the direct customer's GST,
      // InvoiceOverride mode shows the override entity's GST (pulled from
      // its customer master). Blind mode stays generic — no end-customer GST.
      ...(shipMode === "Normal" && po.directCustomerGstNo
            ? [`Cust GST : ${po.directCustomerGstNo}`]
            : []),
      ...(shipMode === "InvoiceOverride" && po.invoicePartyGstNo
            ? [`Cust GST : ${po.invoicePartyGstNo}`]
            : []),
      // Blind mode: Ship-To carries Monit's own address (mill believes the
      // goods are coming to the agency). Override / Normal use the actual
      // delivery address.
      ...(shipToAddr ? [`Ship To  : ${shipToAddr}`] : []),
      ``,
      `Items:`,
      itemLines,
      ``,
      `Total Wt   : ${(totalWeightKg > 0 ? totalWeightKg : po.items.reduce((s, i) => s + lineWeightKg({ weightKg: i.weightKg, quantity: i.quantity, gsm: i.gsm, size: i.size }), 0)).toLocaleString("en-IN")} KG`,
      `Total Value: ₹${po.totalValue.toLocaleString("en-IN")}`,
      ...(po.specialInstructions ? [``, `Special Instructions:`, po.specialInstructions] : []),
      ``,
      `Please acknowledge receipt of this PO.`,
      ``,
      `Regards,`,
      // Sign-off matches the active company config — works for both
      // Monit Paper Agency and Monit Paper Associates tenants.
      monitName,
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
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4 overflow-hidden">

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="kpi-grid grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 flex-shrink-0">
        <KpiCard title="Total POs"     value={kpis.total}        subtitle="All time"              icon={Factory}     iconBg="bg-blue-50"    iconColor="text-blue-500"   />
        <KpiCard title="Pending"       value={kpis.pending}      subtitle="Draft / Sent"          icon={Clock}       iconBg="bg-yellow-50"  iconColor="text-yellow-500" subtitleColor="amber" />
        <KpiCard title="In Production" value={kpis.inProduction} subtitle="Being manufactured"    icon={Factory}     iconBg="bg-purple-50"  iconColor="text-purple-500" subtitleColor="blue"  />
        <KpiCard title="Ready"         value={kpis.ready}        subtitle="Ready for dispatch"    icon={CheckCircle2}iconBg="bg-green-50"   iconColor="text-green-500"  subtitleColor="green" />
        <KpiCard title="Dispatched"    value={kpis.dispatched}   subtitle="In transit / received" icon={Truck}       iconBg="bg-cyan-50"    iconColor="text-cyan-500"   />
        <KpiCard
          title="Total Value"
          value={`₹${(kpis.totalValue / 100000).toFixed(1)}L`}
          subtitle="All POs combined"
          icon={IndianRupee}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
        />

        {/* Pending PO — interactive KPI */}
        <button
          type="button"
          onClick={() => kpis.pendingPO > 0 && setShowPendingPanel((v) => !v)}
          className={cn(
            "rounded-xl border p-3 sm:p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]",
            kpis.pendingPO > 0
              ? showPendingPanel
                ? "border-blue-300 bg-blue-500 text-white"
                : "border-blue-200 bg-blue-50 hover:border-blue-300"
              : "border-gray-100 bg-white cursor-default"
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className={cn("text-[9px] sm:text-xs font-semibold uppercase tracking-wide truncate",
                kpis.pendingPO > 0 ? showPendingPanel ? "text-blue-100" : "text-blue-700" : "text-gray-400"
              )}>Pending PO</p>
              <p className={cn("mt-1 text-xl sm:text-2xl font-bold leading-tight",
                kpis.pendingPO > 0 ? showPendingPanel ? "text-white" : "text-blue-700" : "text-gray-900"
              )}>{kpis.pendingPO}</p>
              <p className={cn("mt-0.5 text-[10px] sm:text-xs truncate",
                kpis.pendingPO > 0 ? showPendingPanel ? "text-blue-100" : "text-blue-600" : "text-gray-400"
              )}>{kpis.pendingPO > 0 ? "SOs awaiting PO" : "All SOs covered"}</p>
            </div>
            <div className={cn("flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
              kpis.pendingPO > 0 ? showPendingPanel ? "bg-blue-400" : "bg-blue-100" : "bg-gray-50"
            )}>
              {kpis.pendingPO > 0
                ? showPendingPanel ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-blue-600" />
                : <CheckCircle2 className="h-4 w-4 text-gray-300" />
              }
            </div>
          </div>
        </button>
      </div>

      {/* ── Pending SO Table ──────────────────────────────────────────────── */}
      {showPendingPanel && (
        <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center border-b border-blue-100 bg-blue-50 px-5 py-3 gap-2.5 flex-shrink-0">
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
          <div className="flex flex-1 min-h-0 flex-col">
          <DataGrid
            data={pendingPoSOs}
            columns={pendingSOColumns}
            tableName="pending-po-sos"
            enableFilters={true}
            enablePagination={true}
            enableColumnReordering={true}
            enableColumnVisibility={true}
            scrollMaxHeight="100%"
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
        </div>
      )}

      {/* ── Purchase Orders Table ─────────────────────────────────────────── */}
      {!showPendingPanel && (
        <div className="flex flex-1 min-h-0 flex-col">
        <DataGrid
          data={pos}
          columns={columns}
          tableName="purchase-orders"
          enableFilters={true}
          enablePagination={true}
          enableColumnReordering={true}
          enableColumnVisibility={true}
          scrollMaxHeight="100%"
          initialPageSize={10}
          onRowClick={(po) => setViewOrder(po)}
          dimRow={(po) => po.status === "Cancelled"}
          // Custom "Export → PDF" — hits the bulk-PDF endpoint so the file
          // matches the single-PO document layout used by Preview / Print.
          onPdfExport={async (rows) => {
            const ids = rows.map((p) => p.id).filter((n): n is number => Number.isFinite(n));
            if (ids.length === 0) return;
            const { blob, filename } = await poApi.downloadBulkPdf(ids);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename || `PurchaseOrders_${new Date().toISOString().slice(0, 10)}_${ids.length}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          // ZIP variant — one PDF per PO inside a single archive.
          onPdfZipExport={async (rows) => {
            const ids = rows.map((p) => p.id).filter((n): n is number => Number.isFinite(n));
            if (ids.length === 0) return;
            const { blob, filename } = await poApi.downloadBulkPdfZip(ids);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename || `PurchaseOrders_${new Date().toISOString().slice(0, 10)}_${ids.length}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          // JPG variant — downloads one image file per selected PO directly
          // (no ZIP), same as the row-level "Export as Image" action, so the
          // user can forward each file immediately (e.g. on WhatsApp)
          // without extracting an archive first. Staggered slightly so the
          // browser doesn't treat the burst as a single blocked pop-up.
          onImageExport={async (rows) => {
            const targets = rows.filter((p) => Number.isFinite(p.id));
            for (const po of targets) {
              try {
                const { blob, filename } = await poApi.downloadImage(po.id);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename || `PO_${po.poNumber.replace(/\//g, "-")}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch {
                // skip a failed row so one bad PO doesn't stop the rest downloading
              }
              await new Promise((r) => setTimeout(r, 300));
            }
          }}
          emptyMessage={loadingPos ? "Loading purchase orders…" : "No purchase orders yet. Raise a PO from a confirmed Sales Order."}
          toolbarActions={
            <button
              onClick={handleNewPO}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.97] transition-all whitespace-nowrap"
            >
              <Plus className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
              <span className="hidden sm:inline">New PO</span>
              <span className="sm:hidden">New</span>
            </button>
          }
        />
        </div>
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
          existingPos={pos}
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

      {/* ── Cancel Confirm ───────────────────────────────────────────────── */}
      {cancelTarget && (
        <Modal isOpen onClose={() => { if (!cancelBusy) setCancelTarget(null); }} title={`Cancel PO ${cancelTarget.poNumber}?`} size="sm">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              The PO number, its history, and all its data stay intact for tracking — the row will just show as
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
                placeholder="e.g. Mill unable to supply, order raised by mistake…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setCancelTarget(null)} disabled={cancelBusy}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Back
              </button>
              <button onClick={handleCancelPO} disabled={cancelBusy}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                {cancelBusy ? "Cancelling…" : "Cancel Order"}
              </button>
            </div>
          </div>
        </Modal>
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

function PORowActions({ po, onView, onEdit, onDelete, onCancel, onPrint, onExportImage, onSendMail, mailSent }: {
  po: PORow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onPrint: () => void;
  onExportImage: () => void;
  onSendMail: () => void;
  mailSent: boolean;
}) {
  const [open, setOpen]           = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Estimated menu height (View + Edit + Print + Export Image + Send Mail +
  // Cancel + Delete + Share divider/button) — used to flip the menu upward
  // when a row is near the bottom of the viewport, so the last row's menu
  // never clips off-screen.
  const MENU_H = 326;
  const [pos, setPos]             = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });
  const [shareAnchor, setShareAnchor] = useState<{ top: number; right: number } | null>(null);
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
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < MENU_H && r.top > MENU_H;
      setPos(openUp
        ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right }
        : { top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setShareAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setShareOpen(true);
  };

  const shareData: ShareData = {
    title: po.poNumber,
    subject: `Purchase Order ${po.poNumber} — ${po.millName}`,
    text: `Purchase Order: ${po.poNumber}\nMill: ${po.millName}\nDate: ${po.orderDate}\nAmount: ₹${po.totalValue?.toLocaleString("en-IN") ?? "—"}\nStatus: ${po.status}`,
    // PDF attaches to the share when the platform supports Web Share API
    // w/ files (mobile / macOS Safari). On desktop the PDF is downloaded
    // so the user can attach it manually in WhatsApp Web / Outlook / etc.
    getPdf: () => poApi.downloadPdf(po.id),
  };

  const menuItems = [
    { icon: Eye,     label: "View",   fn: onView,   cls: "" },
    { icon: Pencil,  label: "Edit",   fn: onEdit,   cls: "" },
    { icon: Printer, label: "Print",  fn: onPrint,  cls: "" },
    { icon: ImageIcon, label: "Export as Image", fn: onExportImage, cls: "" },
    { icon: Mail,    label: mailSent ? "Mail Sent ✓" : "Send Mail to Mill", fn: onSendMail,
      cls: mailSent ? "text-green-600 hover:bg-green-50 cursor-default" : "text-blue-600 hover:bg-blue-50" },
    ...(po.status !== "Cancelled"
      ? [{ icon: Ban, label: "Cancel Order", fn: onCancel, cls: "text-amber-600 hover:bg-amber-50" }]
      : []),
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
        <div ref={menuRef}
          style={pos.bottom != null
            ? { position: "fixed", bottom: pos.bottom, right: pos.right, zIndex: 9999 }
            : { position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="min-w-[160px] rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
          {menuItems.map(({ icon: Icon, label, fn, cls }) => (
            <button key={label}
              onClick={() => { if (!mailSent || label !== "Mail Sent ✓") fn(); setOpen(false); }}
              className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors", cls)}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
          <div className="my-1 border-t border-gray-100" />
          <button onClick={handleShare}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Share2 className="h-3.5 w-3.5 text-blue-500" /> Share
          </button>
        </div>,
        document.body
      )}
      {shareOpen && shareAnchor && (
        <SharePanel data={shareData} anchor={shareAnchor} onClose={() => setShareOpen(false)} />
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

  return (
    <PortalModal onClose={onClose}>
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
          <ModalCloseButton onClose={onClose} />
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
                        {(() => {
                          const wt = lineWeightKg(line);
                          const sh = lineSheetCount(line);
                          return (
                            <>
                              <span className="font-semibold text-gray-900">{wt.toLocaleString("en-IN")} kg</span>
                              {sh !== null && <span className="block text-[10px] text-gray-400">{sh.toLocaleString("en-IN")} sheets</span>}
                            </>
                          );
                        })()}
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
    </PortalModal>
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
  const { error: showError } = useToast();
  const handlePrint = async () => {
    try {
      const { blob } = await poApi.downloadPdf(po.id);
      printPdfBlob(blob);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Print failed.");
    }
  };

  const shipMode  = po.shipmentMode ?? (po.blindShipment ? "Blind" : "Normal");
  const isBlind    = shipMode === "Blind";
  const isOverride = shipMode === "InvoiceOverride";

  const statusCls = STATUS_COLOR[po.status] ?? "bg-gray-100 text-gray-600";

  // Editing a PO never auto-resends anything to the mill — this flags when
  // the PO was updated after its last (or first-ever) email, so the reminder
  // survives a page reload instead of only flashing right after a save.
  const needsResend = po.status !== "Approval Pending" && po.status !== "Cancelled"
    && (!po.emailSentAt || (!!po.updatedAt && new Date(po.updatedAt) > new Date(po.emailSentAt)));

  // Parties block mirrors the PO PDF (Order To / Billed To / Shipped To)
  // including the same shipment-mode resolution so what the user sees on
  // screen matches what the mill receives in the printed/emailed PDF.
  const { config: viewCompanyConfig } = useCompanySettings();
  const companyName = viewCompanyConfig?.companyName ?? "";
  const companyAddr = viewCompanyConfig?.address ?? "";
  const companyGst  = viewCompanyConfig?.gstNumber ?? "";

  let shipName: string;
  let shipAddr: string;
  let shipGst:  string;
  if (isBlind) {
    shipName = companyName || "—";
    shipAddr = companyAddr;
    shipGst  = companyGst;
  } else if (isOverride) {
    shipName = po.invoiceParty || "—";
    shipAddr = po.invoicePartyAddress || po.directDeliveryAddress || "";
    shipGst  = po.invoicePartyGstNo  || "";
  } else if (po.showDeliveryParty && po.linkedSODeliveryPartyName) {
    // SO's own separate delivery party (client-requested: SO placed by
    // one customer, goods ship to a different one) — only shown when the
    // user explicitly opted in on this PO (showDeliveryParty). Default off
    // = falls through to directCustomer below, same as before. Mirrors the
    // PDF's fallback chain exactly.
    shipName = po.linkedSODeliveryPartyName;
    shipAddr = po.linkedSODeliveryPartyAddress || po.directDeliveryAddress || "";
    shipGst  = po.linkedSODeliveryPartyGstNo   || "";
  } else if (po.directCustomer) {
    shipName = po.directCustomer;
    shipAddr = po.directCustomerAddress || po.directDeliveryAddress || "";
    shipGst  = po.directCustomerGstNo   || "";
  } else if (po.linkedSOCustomerName) {
    shipName = po.linkedSOCustomerName;
    shipAddr = po.linkedSOCustomerAddress || po.directDeliveryAddress || "";
    shipGst  = po.linkedSOCustomerGstNo   || "";
  } else {
    // No customer at all — a "For Stock" PO (not raised against any SO), so
    // the goods ship to Monit's own godown, same as Blind mode. Previously
    // fell through to a blank/dash Shipped To (client-reported).
    shipName = companyName || "—";
    shipAddr = companyAddr;
    shipGst  = companyGst;
  }

  return (
    <PortalModal onClose={onClose}>

      {/* Header — violet tinted */}
      <div className="flex items-center justify-between border-b border-violet-100 px-5 py-3.5 bg-violet-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 shadow-sm">
            <Factory className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900">{po.poNumber}</h2>
            <p className="text-xs text-gray-500">{po.millName} · {po.orderDate}</p>
          </div>
          {/* Status badge hidden from print — clutter on a printed PO. */}
          <span className={cn("ml-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold print:hidden", statusCls)}>
            {po.status}
          </span>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <div className="max-h-[calc(100vh-160px)] overflow-y-auto p-5 space-y-4">

        {/* Cancelled banner */}
        {po.status === "Cancelled" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 print:hidden">
            <p className="text-xs font-bold text-rose-700">
              Cancelled{po.cancelledAt ? ` on ${po.cancelledAt}` : ""}{po.cancelledBy ? ` by ${po.cancelledBy}` : ""}
            </p>
            {po.cancelReason && <p className="mt-0.5 text-xs text-rose-600">Reason: {po.cancelReason}</p>}
          </div>
        )}

        {/* Resend reminder — edits to an already-approved PO don't auto-reach
            the mill; nothing resends the email/PDF on its own. Client-asked
            2026-09-11 so this doesn't get silently forgotten. */}
        {needsResend && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 print:hidden">
            <p className="text-xs font-semibold text-amber-800">
              {po.emailSentAt
                ? "This PO was edited after it was last sent to the mill — the mill still has the old version."
                : "This PO hasn't been emailed to the mill yet."}
            </p>
            <button
              onClick={onSendMail}
              className="flex-shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 active:scale-95 transition-all"
            >
              Send to Mill
            </button>
          </div>
        )}

        {/* Top metric cards removed per client UAT — PO number lives in the
            header, mill + total value are already in the Parties + PO Details
            blocks below, so the duplicated tiles were just noise. */}

        {/* Parties — mirrors the PO PDF (Order To / Billed To / Shipped To)
            so what the user sees matches what's printed/emailed to the mill.
            Shipped-To respects ShipmentMode (Blind / InvoiceOverride / Normal)
            using the same resolution as PurchaseOrderPdfService. */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Parties</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Order To (Supplier)</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{po.millName || "—"}</p>
              {po.millUnitName && <p className="text-[11px] font-medium text-blue-700 mt-0.5">{po.millUnitName}</p>}
              {po.millUnitAddress && <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{po.millUnitAddress}</p>}
              <p className="text-[10px] text-gray-500 mt-1">GST: <span className="font-medium text-gray-700">{po.millGstNo || "—"}</span></p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-violet-500">Billed To</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{companyName || "—"}</p>
              {companyAddr && <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{companyAddr}</p>}
              <p className="text-[10px] text-gray-500 mt-1">GST: <span className="font-medium text-gray-700">{companyGst || "—"}</span></p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">
                Shipped To
                {isBlind && <span className="ml-1.5 inline-flex rounded px-1.5 py-0 text-[8px] font-bold text-orange-700 bg-orange-100">BLIND</span>}
                {isOverride && <span className="ml-1.5 inline-flex rounded px-1.5 py-0 text-[8px] font-bold text-purple-700 bg-purple-100">OVERRIDE</span>}
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{shipName}</p>
              {shipAddr && <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{shipAddr}</p>}
              <p className="text-[10px] text-gray-500 mt-1">GST: <span className="font-medium text-gray-700">{shipGst || "—"}</span></p>
            </div>
          </div>
        </div>

        {/* PO Details — 3-col grid */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">PO Details</p>
          <div className="grid grid-cols-3 gap-2">
          {[
            { label: "PO Date",           value: po.orderDate },
            { label: "Expected Delivery", value: po.expectedDeliveryDate || "—" },
            { label: "Payment Terms",     value: po.paymentTerms || "—" },
            { label: "Total Weight",      value: `${po.items.reduce((s, i) => s + lineWeightKg({ weightKg: i.weightKg, qty: i.quantity, gsm: i.gsm, size: i.size }), 0).toLocaleString("en-IN")} kg` },
            ...(po.millSONumber ? [{ label: "Order ID", value: po.millSONumber }] : []),
            // Customer reference — a per-PO, user-controlled toggle (default
            // off). Used to print unconditionally whenever the PO was linked
            // to an SO, which leaked the customer's identity on Blind POs
            // (client-reported 2026-09-11). Now gated the same way in every
            // shipment mode — Billed To/Shipped To above are unaffected.
            ...(po.showCustomerName && po.linkedSOCustomerName ? [{ label: "Customer", value: po.linkedSOCustomerName }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-xs font-semibold mt-0.5 text-gray-800">{value}</p>
            </div>
          ))}
          </div>
        </div>

        {/* SO Reference — kept as its own compact row. Customer / address /
            GST already live in the Parties block above, so we only show the
            SO link here (clicking PO Details to drill into the SO is the
            useful action from this modal). */}
        {po.linkedSONumber && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-indigo-400">SO Reference</p>
            <p className="text-sm font-semibold text-indigo-700">{po.linkedSONumber}</p>
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
                  {/* Per UAT — Item Code column dropped from PO print/preview.
                      Material is now Brand + GSM + Size + Qty (separately). */}
                  <th className="px-2 py-2 text-left font-medium w-7">#</th>
                  <th className="px-2 py-2 text-left font-medium">Brand</th>
                  <th className="px-2 py-2 text-right font-medium">GSM</th>
                  <th className="px-2 py-2 text-left  font-medium">Size</th>
                  <th className="px-2 py-2 text-right font-medium">Qty (kg)</th>
                  <th className="px-2 py-2 text-right font-medium">Rate (₹)</th>
                  <th className="px-2 py-2 text-right font-medium">Disc (₹/KG)</th>
                  <th className="px-2 py-2 text-right font-medium">Final (₹)</th>
                  <th className="px-2 py-2 text-right font-medium">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {po.items.map((item: POItemRow, idx: number) => {
                  // PO line stores rate = post-discount (finalPrice) and
                  // discount = flat ₹/KG. View shows the master rate in
                  // the Rate col (= rate + discount) and the actual mill
                  // bill rate in the Final col (= stored rate).
                  const disc      = item.discount ?? 0;
                  const listRate  = +(item.rate + disc).toFixed(2);
                  const finalRate = item.rate;
                  const wt        = lineWeightKg({ weightKg: item.weightKg, quantity: item.quantity, gsm: item.gsm, size: item.size });
                  // If weightKg is set AND item.quantity is a different value, treat quantity as sheets (secondary info)
                  const sheetsHint = item.weightKg && item.weightKg > 0 && item.quantity > 0 && item.quantity !== item.weightKg
                    ? item.quantity : null;
                  // Per UAT — Brand replaces the Item Code in PO print/preview.
                  // Falls back to the 2nd "/" segment of the legacy description
                  // (which is where the quality / brand used to live in the
                  // composed Item Code) so old POs still read sensibly.
                  const brand = item.brandName?.trim()
                              || (item.description || "").split("/")[1]?.trim()
                              || (item.description || "—");
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-gray-800">{brand}</div>
                        {item.remark && <div className="text-[10px] text-amber-600 italic mt-0.5">{item.remark}</div>}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-700">{item.gsm ?? "—"}</td>
                      <td className="px-2 py-2 text-left  text-gray-700">{item.size?.trim() || "—"}</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-900">
                        {wt > 0 ? wt.toLocaleString("en-IN") : "—"}
                        {sheetsHint && <div className="text-[10px] font-normal text-gray-400">{sheetsHint.toLocaleString("en-IN")} sheets</div>}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-600">
                        {listRate > 0 ? listRate.toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500">
                        {item.discount && item.discount > 0 ? `₹${item.discount.toLocaleString("en-IN")}` : "—"}
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
                {/* 9-column footer: # | Brand | GSM | Size = "Total" (span 4)
                                     Qty kg | Rate | Disc | Final = blank (span 3)
                                     Amount = totalValue */}
                <tr className="bg-blue-50 border-t border-blue-100">
                  <td colSpan={4} className="px-2 py-2 text-xs font-semibold text-blue-700">Total</td>
                  <td className="px-2 py-2 text-right text-xs font-bold text-blue-800">
                    {po.items.reduce((s, i) => s + lineWeightKg({ weightKg: i.weightKg, quantity: i.quantity, gsm: i.gsm, size: i.size }), 0).toLocaleString("en-IN")} kg
                  </td>
                  <td colSpan={3} />
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

        {/* Footer — fully hidden in print so the printed sheet shows only
            the PO content, not the action toolbar. */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 print:hidden">
          <button onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
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
    </PortalModal>
  );
}

export default function Page() {
  return <PermGuard perm="po.read"><PurchaseOrdersPage /></PermGuard>;
}
