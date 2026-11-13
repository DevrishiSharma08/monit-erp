"use client";

import { PermGuard } from "@/components/PermGuard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList, Plus, X, Truck, CheckCircle2, FileText, Clock,
  Loader2, Eye, MoreVertical, Trash2, Package, Warehouse, AlertTriangle,
  ChevronLeft, ChevronRight, Printer,
} from "lucide-react";
import {
  deliveryChallanApi, DeliveryChallanRow, DeliveryChallanItemDto,
  CreateDeliveryChallanDto, CreateDeliveryChallanItemDto,
  OpenSoForDcDto, OpenSoLineForDcDto, AvailableStockSourceDto,
} from "@/lib/api-services";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { KpiCard } from "@/components/ui/KpiCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { printPdfBlob } from "@/lib/printPdf";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Status colour map ────────────────────────────────────────────────────────

function getStatusColor(s: string) {
  const map: Record<string, string> = {
    "Draft":      "bg-gray-100 text-gray-700 border-gray-200",
    "Dispatched": "bg-blue-100 text-blue-700 border-blue-200",
    "Delivered":  "bg-green-100 text-green-700 border-green-200",
    "Cancelled":  "bg-red-100 text-red-700 border-red-200",
  };
  return map[s] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

function deliveryModeBadge(m: string) {
  const map: Record<string, string> = {
    "FromStock":      "bg-teal-50 text-teal-700 border-teal-200",
    "DirectFromMill": "bg-purple-50 text-purple-700 border-purple-200",
    "Mixed":          "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return map[m] ?? "bg-gray-50 text-gray-600 border-gray-200";
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Flattened "one row per delivered item" shape — same pattern as Dispatch grid
// so the user can scan every item shipped on every challan side-by-side.
interface ChallanItemRow {
  rowKey: string;
  challan: DeliveryChallanRow;
  item: DeliveryChallanItemDto | null;
  challanNumber: string;
  challanDate: string;
  soNumber?: string;
  customerName?: string;
  deliveryMode: string;
  vehicleNumber?: string;
  status: string;
  paper?: string;
  gsm?: number;
  size?: string;
  quantityKg: number;
  sourceLabel: string;
  sourceType: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DeliveryChallanPage() {
  const { success, error: toastError, warning } = useToast();

  const surfaceApiError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.message) {
      if (err.status >= 400 && err.status < 500) warning(err.message);
      else toastError(err.message);
    } else {
      toastError(fallback);
    }
  }, [toastError, warning]);

  const handlePrint = useCallback(async (id: number) => {
    try {
      const { blob } = await deliveryChallanApi.downloadPdf(id);
      printPdfBlob(blob);
    } catch (err) {
      surfaceApiError(err, "Print failed.");
    }
  }, [surfaceApiError]);

  const [challans, setChallans]       = useState<DeliveryChallanRow[]>([]);
  const [openSos,  setOpenSos]        = useState<OpenSoForDcDto[]>([]);
  // Pagination for the "Pending" table is by SO GROUP, not raw line rows —
  // an SO's rowSpan'd lines must never split across a page boundary.
  const [pendingPage, setPendingPage] = useState(0);
  const pendingPageSize = 15;
  const [loading,  setLoading]        = useState(true);

  const [showPending,    setShowPending]    = useState(true);
  const [showCreateModal,setShowCreateModal]= useState(false);
  const [activeSo,       setActiveSo]       = useState<OpenSoForDcDto | null>(null);
  const [activeChallan,  setActiveChallan]  = useState<DeliveryChallanRow | null>(null);
  const [deleteChallan,  setDeleteChallan]  = useState<DeliveryChallanRow | null>(null);
  const [deleting,       setDeleting]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dcRes, soRes] = await Promise.all([
        deliveryChallanApi.list({ pageSize: 200 }),
        deliveryChallanApi.openSos(undefined),
      ]);
      setChallans(dcRes.items);
      setOpenSos(soRes);
    } catch {
      // surfaced by middleware
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteChallan) return;
    setDeleting(true);
    try {
      await deliveryChallanApi.remove(deleteChallan.id);
      success(`Challan ${deleteChallan.challanNumber} deleted.`);
      setDeleteChallan(null);
      load();
    } catch (err) {
      surfaceApiError(err, "Failed to delete delivery challan.");
    } finally {
      setDeleting(false);
    }
  };

  const kpis = useMemo(() => ({
    pendingSo:  openSos.length,
    draft:      challans.filter((c) => c.status === "Draft").length,
    dispatched: challans.filter((c) => c.status === "Dispatched").length,
    delivered:  challans.filter((c) => c.status === "Delivered").length,
    total:      challans.length,
  }), [challans, openSos]);

  // Flatten DCs into one row per item — same MOT-style pattern as Dispatch.
  // Parent challan-level fields are denormalised onto each row so all info
  // about source / quantity / item is visible without opening the modal.
  const itemRows: ChallanItemRow[] = useMemo(
    () => challans.flatMap((c) =>
      (c.items.length > 0 ? c.items : [null as unknown as DeliveryChallanItemDto]).map((it) => ({
        rowKey:        it ? `${c.id}-${it.id}` : `${c.id}-empty`,
        challan:       c,
        item:          it,
        challanNumber: c.challanNumber,
        challanDate:   c.challanDate,
        soNumber:      c.soNumber,
        customerName:  c.customerName,
        deliveryMode:  c.deliveryMode,
        vehicleNumber: c.vehicleNumber,
        status:        c.status,
        paper:         it?.paper,
        gsm:           it?.gsm,
        size:          it?.size,
        quantityKg:    it?.quantityKg ?? 0,
        // Keep the source pill compact — full chain (bin / PO) is available
        // inside the View modal; the grid needs to stay readable.
        sourceLabel:   it?.lotNumber
          ? it.lotNumber
          : it?.grnNumber ?? "",
        sourceType:    it?.lotNumber ? "stock" : it?.grnNumber ? "direct" : "",
      })),
    ),
    [challans],
  );

  const columns: ColumnConfig<ChallanItemRow>[] = useMemo(() => [
    {
      id: "actions", accessorKey: "rowKey", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 60, sticky: "left",
      cell: (info) => {
        const c = info.row.original.challan;
        return (
          <ChallanActionsMenu
            challan={c}
            onView={() => setActiveChallan(c)}
            onPrint={() => handlePrint(c.id)}
            onDelete={() => setDeleteChallan(c)}
            onMarkDispatched={async () => {
              try {
                await deliveryChallanApi.updateStatus(c.id, { status: "Dispatched" });
                success(`${c.challanNumber} marked Dispatched.`);
                load();
              } catch (err) { surfaceApiError(err, "Status update failed."); }
            }}
            onMarkDelivered={async () => {
              try {
                await deliveryChallanApi.updateStatus(c.id, { status: "Delivered" });
                success(`${c.challanNumber} marked Delivered.`);
                load();
              } catch (err) { surfaceApiError(err, "Status update failed."); }
            }}
          />
        );
      },
    },
    {
      id: "challanNumber", accessorKey: "challanNumber", header: "Challan #",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => <span className="font-semibold text-indigo-700">{info.getValue() as string}</span>,
    },
    {
      id: "challanDate", accessorKey: "challanDate", header: "Date",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 110,
    },
    {
      id: "soNumber", accessorKey: "soNumber", header: "SO #",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-mono text-xs text-blue-700">{(info.getValue() as string) || "—"}</span>,
    },
    {
      id: "customerName", accessorKey: "customerName", header: "Customer",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 160,
      cell: (info) => <span className="text-sm">{(info.getValue() as string) || "—"}</span>,
    },
    {
      id: "paper", accessorKey: "paper", header: "Item",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 300,
      cell: (info) => {
        const r = info.row.original;
        return (
          <div className="whitespace-normal break-words">
            <p className="font-medium text-gray-900 leading-tight">{r.paper ?? "—"}</p>
            {(r.gsm || r.size) && <p className="text-[11px] text-gray-400 mt-0.5">{r.gsm}g · {r.size}</p>}
          </div>
        );
      },
    },
    {
      id: "sourceLabel", accessorKey: "sourceLabel", header: "Source",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 150,
      cell: (info) => {
        const r = info.row.original;
        if (!r.sourceLabel) return <span className="text-gray-300">—</span>;
        const isStock = r.sourceType === "stock";
        return (
          <span
            title={r.sourceLabel}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold font-mono ${isStock ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
            {isStock ? <Warehouse className="h-3 w-3 flex-shrink-0" /> : <Truck className="h-3 w-3 flex-shrink-0" />}
            <span className="truncate">{r.sourceLabel}</span>
          </span>
        );
      },
    },
    {
      id: "quantityKg", accessorKey: "quantityKg", header: "Qty (kg)",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => <span className="font-semibold tabular-nums">{(info.getValue() as number).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>,
    },
    {
      id: "deliveryMode", accessorKey: "deliveryMode", header: "Mode",
      filterType: "select",
      filterOptions: [
        { label: "From Stock", value: "FromStock" },
        { label: "Direct From Mill", value: "DirectFromMill" },
        { label: "Mixed", value: "Mixed" },
      ],
      enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => {
        const m = info.getValue() as string;
        return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold border ${deliveryModeBadge(m)}`}>{m}</span>;
      },
    },
    {
      id: "vehicleNumber", accessorKey: "vehicleNumber", header: "Vehicle",
      filterType: "text", enableSorting: false, defaultVisible: false, size: 110,
      cell: (info) => <span className="font-mono text-xs">{(info.getValue() as string) || "—"}</span>,
    },
    {
      id: "status", accessorKey: "status", header: "Status",
      filterType: "select",
      filterOptions: [
        { label: "Draft",      value: "Draft" },
        { label: "Dispatched", value: "Dispatched" },
        { label: "Delivered",  value: "Delivered" },
        { label: "Cancelled",  value: "Cancelled" },
      ],
      enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => {
        const s = info.getValue() as string;
        return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${getStatusColor(s)}`}>{s}</span>;
      },
    },
  ], [success, surfaceApiError, load]);

  const pendingPageCount = Math.max(1, Math.ceil(openSos.length / pendingPageSize));
  const pendingSafePage = Math.min(pendingPage, pendingPageCount - 1);
  const pagedOpenSos = openSos.slice(pendingSafePage * pendingPageSize, pendingSafePage * pendingPageSize + pendingPageSize);

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4 overflow-hidden">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0">
        <KpiCard
          title="Pending SO Closure"
          value={String(kpis.pendingSo)}
          subtitle={showPending ? "Click to hide list" : "Click to view list"}
          subtitleColor="amber"
          icon={Package}
          iconBg={showPending ? "bg-amber-100 ring-2 ring-amber-400" : "bg-amber-50"}
          iconColor="text-amber-500"
          onClick={() => setShowPending((v) => !v)}
        />
        <KpiCard title="Draft"      value={String(kpis.draft)}      subtitle="Being prepared" icon={Clock}        iconBg="bg-gray-50"   iconColor="text-gray-500" />
        <KpiCard title="Dispatched" value={String(kpis.dispatched)} subtitle="In transit"    icon={Truck}        iconBg="bg-blue-50"   iconColor="text-blue-500" />
        <KpiCard title="Delivered"  value={String(kpis.delivered)}  subtitle="Customer signed off" icon={CheckCircle2} iconBg="bg-green-50" iconColor="text-green-500" />
        <KpiCard title="Total"      value={String(kpis.total)}      subtitle="All time"      icon={FileText}     iconBg="bg-indigo-50" iconColor="text-indigo-500" />
      </div>

      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
      {showPending ? (
        <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2.5">
              <Package className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-900">Open Sales Orders (pending delivery)</span>
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{openSos.length}</span>
              {openSos.length > 0 && (
                <span className="text-[11px] text-amber-700">
                  <span className="font-semibold text-emerald-700">{openSos.filter(s => s.hasAvailableStock).length} ready</span>
                  {" · "}
                  {openSos.filter(s => !s.hasAvailableStock).length} awaiting stock
                </span>
              )}
            </div>
            <button onClick={() => setShowPending(false)} className="text-xs text-amber-700 hover:text-amber-900 inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Close
            </button>
          </div>
          {openSos.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">No open sales orders.</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["SO #", "#", "Order Date", "Customer", "Status", "Item", "Ordered", "Delivered", "Pending", ""].map((h) => (
                      <th key={h} className="bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedOpenSos.flatMap((s, groupIdx) => {
                    const lines = s.lines.length > 0 ? s.lines : [null as unknown as OpenSoLineForDcDto];
                    const total = lines.length;
                    // Ready-to-deliver SOs (some stock/GRN actually available
                    // right now) get a white/green tint; ones with nothing to
                    // pick yet are greyed out so the user doesn't have to open
                    // every single one just to find out it's not ready —
                    // list itself is already sorted ready-first by the backend.
                    const groupBg = s.hasAvailableStock
                      ? (groupIdx % 2 === 0 ? "bg-white" : "bg-emerald-50/40")
                      : "bg-gray-50/70";
                    return lines.map((line, idx) => (
                      <tr key={line ? `${s.salesOrderId}-${line.salesOrderLineId}` : `${s.salesOrderId}-empty`}
                        className={`${groupBg} ${s.hasAvailableStock ? "hover:bg-amber-50/60" : "hover:bg-gray-100/70"} transition-colors ${idx === 0 ? "border-t-2 border-amber-300" : ""} ${!s.hasAvailableStock ? "opacity-70" : ""}`}>
                        <td className="px-4 py-3 font-mono font-semibold text-xs text-blue-700">
                          {idx === 0 ? s.soNumber : <span className="text-gray-300">↳</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-amber-700 font-semibold tabular-nums">#{idx + 1}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{idx === 0 ? (s.orderDate ?? "—") : ""}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{idx === 0 ? (s.customerName ?? "—") : ""}</td>
                        <td className="px-4 py-3">
                          {idx === 0 && (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">{s.status}</span>
                              {s.hasAvailableStock ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                  ● Ready to deliver
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-gray-100 text-gray-500 border-gray-200">
                                  ○ No stock/GRN yet
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {line ? (
                            <>
                              <p className="font-medium text-gray-900">{line.paper ?? "—"}</p>
                              {(line.gsm || line.size) && <p className="text-[11px] text-gray-400">{line.gsm}g · {line.size}</p>}
                            </>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-800 tabular-nums">
                          {line ? `${line.orderedQty.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-green-700 tabular-nums">
                          {line ? `${line.deliveredQty.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-amber-700 font-semibold tabular-nums">
                          {line ? `${line.pendingQty.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg` : "—"}
                        </td>
                        {idx === 0 && (
                          <td className="px-4 py-3 text-right align-middle" rowSpan={total}>
                            <button
                              onClick={() => { setActiveSo(s); setShowCreateModal(true); }}
                              title={s.hasAvailableStock ? undefined : "No stock or Direct-GRN available for this SO yet — you can still open it, but there'll be nothing to pick."}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                s.hasAvailableStock
                                  ? "bg-amber-500 text-white hover:bg-amber-600"
                                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                              )}>
                              <Plus className="h-3 w-3" /> Create Challan
                            </button>
                          </td>
                        )}
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
          {openSos.length > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between border-t px-4 py-2">
              <p className="text-xs text-gray-600">
                Showing {pendingSafePage * pendingPageSize + 1} to {Math.min((pendingSafePage + 1) * pendingPageSize, openSos.length)} of {openSos.length} SOs
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPendingPage((p) => Math.max(0, p - 1))}
                  disabled={pendingSafePage === 0}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${pendingSafePage === 0 ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-1 text-xs text-gray-500">{pendingSafePage + 1} / {pendingPageCount}</span>
                <button
                  onClick={() => setPendingPage((p) => Math.min(pendingPageCount - 1, p + 1))}
                  disabled={pendingSafePage >= pendingPageCount - 1}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${pendingSafePage >= pendingPageCount - 1 ? "border-gray-200 text-gray-400 cursor-not-allowed" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading delivery challans…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col">
          <DataGrid
            data={itemRows}
            columns={columns}
            tableName="delivery-challans"
            enableFilters
            enablePagination
            enableColumnVisibility
            scrollMaxHeight="100%"
            initialPageSize={15}
            onRowClick={(r) => setActiveChallan(r.challan)}
            emptyMessage="No delivery challans yet. Click the Pending SO Closure KPI to start one."
          />
          </div>
        )
      )}
      </div>

      {/* Create modal */}
      {showCreateModal && activeSo && (
        <CreateChallanModal
          so={activeSo}
          onClose={() => { setShowCreateModal(false); setActiveSo(null); }}
          onSaved={() => { setShowCreateModal(false); setActiveSo(null); success("Delivery challan created."); load(); }}
          onError={(err) => surfaceApiError(err, "Failed to save delivery challan.")}
        />
      )}

      {/* View modal */}
      {activeChallan && (
        <ViewChallanModal
          challan={activeChallan}
          onClose={() => setActiveChallan(null)}
          onPrint={() => handlePrint(activeChallan.id)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteChallan}
        onClose={() => !deleting && setDeleteChallan(null)}
        onConfirm={handleDelete}
        title="Delete Delivery Challan?"
        description={deleteChallan
          ? `This will reverse the stock decrement and SO delivery against ${deleteChallan.challanNumber}.`
          : ""}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}

// ─── 3-dot actions menu ───────────────────────────────────────────────────────

function ChallanActionsMenu({
  challan, onView, onPrint, onDelete, onMarkDispatched, onMarkDelivered,
}: {
  challan: DeliveryChallanRow;
  onView: () => void;
  onPrint: () => void;
  onDelete: () => void;
  onMarkDispatched: () => void;
  onMarkDelivered: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };
  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation(); fn(); setOpen(false);
  };

  const canEdit = challan.status === "Draft";
  const canDispatch = challan.status === "Draft";
  const canDeliver = challan.status === "Dispatched";

  return (
    <>
      {open && <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />}
      <button ref={btnRef} onClick={toggle} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed z-30 min-w-[180px] rounded-xl border border-gray-100 bg-white py-1.5 shadow-xl" style={{ top: pos.top, right: pos.right }}>
          <button onClick={act(onView)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Eye className="h-3.5 w-3.5 text-gray-400" /> View Details
          </button>
          <button onClick={act(onPrint)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Printer className="h-3.5 w-3.5 text-gray-400" /> Print
          </button>
          {canDispatch && (
            <button onClick={act(onMarkDispatched)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Truck className="h-3.5 w-3.5 text-blue-400" /> Mark Dispatched
            </button>
          )}
          {canDeliver && (
            <button onClick={act(onMarkDelivered)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Mark Delivered
            </button>
          )}
          {canEdit && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={act(onDelete)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ─── Create Challan Modal ─────────────────────────────────────────────────────

interface LineAlloc {
  soLineId: number;
  sources: AvailableStockSourceDto[];
  expanded: boolean;
  loading: boolean;
  picks: { stockLotId?: number; grnId?: number; quantityKg: number; sourceLabel: string }[];
}

function CreateChallanModal({ so, onClose, onSaved, onError }: {
  so: OpenSoForDcDto;
  onClose: () => void;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [saving, setSaving] = useState(false);

  const [challanDate,     setChallanDate]     = useState(today);
  const [vehicleNumber,   setVehicleNumber]   = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [lrNumber,        setLrNumber]        = useState("");
  const [driverName,      setDriverName]      = useState("");
  const [driverPhone,     setDriverPhone]     = useState("");
  const [freightAmount,   setFreightAmount]   = useState<number | "">("");
  const [deliveryAddress, setDeliveryAddress] = useState(so.lines[0]?.deliveryAddress ?? "");
  const [eWayBillNumber,  setEWayBillNumber]  = useState("");
  const [remarks,         setRemarks]         = useState("");

  const [allocs, setAllocs] = useState<Record<number, LineAlloc>>(() => {
    const init: Record<number, LineAlloc> = {};
    so.lines.forEach((l) => {
      init[l.salesOrderLineId] = {
        soLineId: l.salesOrderLineId,
        sources: [], expanded: false, loading: false, picks: [],
      };
    });
    return init;
  });

  const expandLine = async (line: OpenSoLineForDcDto) => {
    const cur = allocs[line.salesOrderLineId];
    if (cur.expanded) {
      setAllocs((a) => ({ ...a, [line.salesOrderLineId]: { ...cur, expanded: false } }));
      return;
    }
    if (cur.sources.length === 0) {
      setAllocs((a) => ({ ...a, [line.salesOrderLineId]: { ...cur, loading: true, expanded: true } }));
      try {
        const sources = await deliveryChallanApi.sources(line.salesOrderLineId);
        setAllocs((a) => ({ ...a, [line.salesOrderLineId]: { ...a[line.salesOrderLineId], sources, loading: false } }));
      } catch (err) {
        onError(err);
        setAllocs((a) => ({ ...a, [line.salesOrderLineId]: { ...a[line.salesOrderLineId], loading: false, expanded: false } }));
      }
    } else {
      setAllocs((a) => ({ ...a, [line.salesOrderLineId]: { ...cur, expanded: true } }));
    }
  };

  const addPick = (line: OpenSoLineForDcDto, src: AvailableStockSourceDto) => {
    setAllocs((a) => {
      const cur = a[line.salesOrderLineId];
      const label = src.sourceType === "Stock"
        ? `Lot ${src.lotNumber ?? "?"} ${src.binLocation ? `· ${src.binLocation}` : ""}`
        : `Direct GRN ${src.grnNumber ?? "?"}${src.poNumber ? ` (${src.poNumber})` : ""}`;
      const remainingNeeded = Math.max(0, line.pendingQty - cur.picks.reduce((s, p) => s + p.quantityKg, 0));
      const defaultQty = Math.min(src.availableQty, remainingNeeded);
      return {
        ...a,
        [line.salesOrderLineId]: {
          ...cur,
          picks: [...cur.picks, {
            stockLotId: src.stockLotId,
            grnId:      src.grnId,
            quantityKg: Number(defaultQty.toFixed(3)),
            sourceLabel: label,
          }],
        },
      };
    });

    // Auto-fill transport details from the picked Direct-GRN source — but
    // only into fields the user hasn't typed in yet, and only on the FIRST
    // pick (subsequent picks must not overwrite earlier values). For Stock
    // sources we have nothing to copy.
    if (src.sourceType === "DirectGrn") {
      if (!vehicleNumber   && src.vehicleNumber)   setVehicleNumber(src.vehicleNumber);
      if (!lrNumber        && src.lrNumber)        setLrNumber(src.lrNumber);
      if (!transporterName && src.transporterName) setTransporterName(src.transporterName);
      if (!driverName      && src.driverName)      setDriverName(src.driverName);
      if (!driverPhone     && src.driverPhone)     setDriverPhone(src.driverPhone);
    }
  };

  const updatePickQty = (lineId: number, idx: number, qty: number) => {
    setAllocs((a) => {
      const cur = a[lineId];
      const picks = cur.picks.map((p, i) => i === idx ? { ...p, quantityKg: qty } : p);
      return { ...a, [lineId]: { ...cur, picks } };
    });
  };

  const removePick = (lineId: number, idx: number) => {
    setAllocs((a) => {
      const cur = a[lineId];
      const picks = cur.picks.filter((_, i) => i !== idx);
      return { ...a, [lineId]: { ...cur, picks } };
    });
  };

  const itemsDto = useMemo<CreateDeliveryChallanItemDto[]>(() => {
    const list: CreateDeliveryChallanItemDto[] = [];
    for (const line of so.lines) {
      const cur = allocs[line.salesOrderLineId];
      cur.picks.forEach((p) => {
        if (p.quantityKg > 0) {
          list.push({
            salesOrderLineId: line.salesOrderLineId,
            stockLotId:       p.stockLotId,
            grnId:            p.grnId,
            quantityKg:       p.quantityKg,
            rate:             line.rate,
          });
        }
      });
    }
    return list;
  }, [allocs, so.lines]);

  const totalKg = useMemo(() => itemsDto.reduce((s, i) => s + i.quantityKg, 0), [itemsDto]);
  const isValid = itemsDto.length > 0 && !!challanDate;

  const handleSave = async () => {
    setSaving(true);
    try {
      const dto: CreateDeliveryChallanDto = {
        challanDate,
        salesOrderId: so.salesOrderId,
        customerId:   so.customerId,
        vehicleNumber:   vehicleNumber || undefined,
        transporterName: transporterName || undefined,
        lrNumber:        lrNumber || undefined,
        driverName:      driverName || undefined,
        driverPhone:     driverPhone || undefined,
        freightAmount:   freightAmount === "" ? undefined : Number(freightAmount),
        deliveryAddress: deliveryAddress || undefined,
        eWayBillNumber:  eWayBillNumber || undefined,
        remarks:         remarks || undefined,
        items:           itemsDto,
      };
      await deliveryChallanApi.create(dto);
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Create Delivery Challan — {so.soNumber}</h2>
              <p className="text-xs text-gray-500">Customer: <span className="font-semibold text-gray-800">{so.customerName}</span> · Pending: <span className="font-semibold text-amber-700">{so.totalPendingQty.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg</span></p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-5">
          {/* Shipment header */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Shipment Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Challan Date <span className="text-red-500">*</span></label>
                <input type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Number</label>
                <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Transporter</label>
                <input type="text" value={transporterName} onChange={(e) => setTransporterName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">LR Number</label>
                <input type="text" value={lrNumber} onChange={(e) => setLrNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Driver Name</label>
                <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Driver Phone</label>
                <input type="text" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Freight Amount</label>
                <input type="number" value={freightAmount} onChange={(e) => setFreightAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-Way Bill</label>
                <input type="text" value={eWayBillNumber} onChange={(e) => setEWayBillNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Address</label>
                <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* SO lines with source allocation */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Allocate Quantity from Stock or Direct GRN</p>
            <div className="space-y-3">
              {so.lines.map((line) => {
                const a = allocs[line.salesOrderLineId];
                const allocated = a.picks.reduce((s, p) => s + p.quantityKg, 0);
                const overAllocated = allocated > line.pendingQty + 0.0001;
                return (
                  <div key={line.salesOrderLineId} className="rounded-xl border border-gray-200 overflow-hidden">
                    <button type="button" onClick={() => expandLine(line)}
                      className="w-full bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-left hover:bg-gray-100 transition-colors">
                      <div>
                        <span className="font-semibold text-sm text-gray-900">{line.paper ?? `Line ${line.lineNumber}`}</span>
                        <span className="text-xs text-gray-500 ml-2">{line.gsm}g · {line.size}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-4 text-xs">
                        <span className="text-gray-500">Ordered: <strong className="text-gray-800">{line.orderedQty.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg</strong></span>
                        <span className="text-green-700">Delivered: <strong>{line.deliveredQty.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg</strong></span>
                        <span className="text-amber-700">Pending: <strong>{line.pendingQty.toLocaleString("en-IN", { maximumFractionDigits: 0 })} kg</strong></span>
                        <span className={`font-semibold ${overAllocated ? "text-red-700" : allocated > 0 ? "text-indigo-700" : "text-amber-700"}`}>
                          Picking: {allocated.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg
                          {allocated === 0 && <span className="ml-1 text-[10px] font-normal">(click to pick)</span>}
                        </span>
                      </div>
                    </button>

                    {a.expanded && (
                      <div className="p-3 space-y-3">
                        {a.picks.length > 0 && (
                          <div className="space-y-1.5">
                            {a.picks.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-1.5">
                                {p.stockLotId
                                  ? <Warehouse className="h-3.5 w-3.5 text-teal-600 flex-shrink-0" />
                                  : <Truck className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />}
                                <span className="text-xs text-gray-800 flex-1 truncate">{p.sourceLabel}</span>
                                <input type="number" value={p.quantityKg}
                                  onChange={(e) => updatePickQty(line.salesOrderLineId, i, Math.max(0, +e.target.value || 0))}
                                  className="w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-right text-xs font-semibold focus:border-amber-500 focus:outline-none" />
                                <span className="text-[10px] text-gray-400">kg</span>
                                <button onClick={() => removePick(line.salesOrderLineId, i)} className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Available Sources</p>
                          {a.loading ? (
                            <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</p>
                          ) : a.sources.length === 0 ? (
                            <p className="text-xs text-gray-400">No stock lots or direct-GRN portions available for this material.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {a.sources.map((src, idx) => (
                                <div key={idx} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                                  {src.sourceType === "Stock"
                                    ? <Warehouse className="h-3.5 w-3.5 text-teal-600 flex-shrink-0" />
                                    : <Truck className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    {src.sourceType === "Stock" ? (
                                      <>
                                        <span className="text-xs font-semibold text-teal-700">Lot {src.lotNumber}</span>
                                        {src.binLocation && <span className="text-[10px] text-gray-500 ml-2">@ {src.binLocation}</span>}
                                        {src.fifoSequence != null && <span className="text-[10px] text-gray-400 ml-2">FIFO #{src.fifoSequence}</span>}
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-xs font-semibold text-purple-700">Direct GRN {src.grnNumber}</span>
                                        {src.poNumber && <span className="text-[10px] text-gray-500 ml-2">({src.poNumber})</span>}
                                      </>
                                    )}
                                  </div>
                                  <span className="text-xs font-semibold text-gray-800">{src.availableQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg</span>
                                  <button onClick={() => addPick(line, src)} className="rounded-lg bg-indigo-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-600">
                                    <Plus className="h-3 w-3 inline" /> Add
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          {itemsDto.length === 0 ? (
            <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Click an item below and pick stock / GRN source to enable Save.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              {itemsDto.length} item{itemsDto.length === 1 ? "" : "s"} · Total: <strong className="text-gray-800">{totalKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg</strong>
            </p>
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
            <button onClick={handleSave} disabled={!isValid || saving}
              title={!isValid && itemsDto.length === 0 ? "Pick stock or GRN source for at least one item first" : ""}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Challan
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── View Challan Modal ───────────────────────────────────────────────────────

function ViewChallanModal({ challan, onClose, onPrint }: { challan: DeliveryChallanRow; onClose: () => void; onPrint: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
              <ClipboardList className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{challan.challanNumber}</h2>
              <p className="text-xs text-gray-500">{challan.challanDate} · {challan.soNumber ?? "—"} · {challan.customerName ?? "—"}</p>
            </div>
            <span className={`ml-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${getStatusColor(challan.status)}`}>
              {challan.status}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${deliveryModeBadge(challan.deliveryMode)}`}>
              {challan.deliveryMode}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["SO #", challan.soNumber ?? "—"],
              ["Customer", challan.customerName ?? "—"],
              ["Vehicle", challan.vehicleNumber ?? "—"],
              ["Transporter", challan.transporterName ?? "—"],
              ["LR Number", challan.lrNumber ?? "—"],
              ["Driver", challan.driverName ?? "—"],
              ["Driver Phone", challan.driverPhone ?? "—"],
              ["E-Way Bill", challan.eWayBillNumber ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{k}</p>
                <p className="text-xs font-semibold text-gray-900 mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {challan.deliveryAddress && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Delivery Address</p>
              <p className="text-xs text-gray-800 mt-0.5">{challan.deliveryAddress}</p>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Items Delivered</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["#", "Item", "Source", "Quantity (kg)", "Rate"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {challan.items.map((it, idx) => (
                    <tr key={it.id} className="bg-white">
                      <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{it.paper ?? `Item #${it.materialId}`}</p>
                        {(it.gsm || it.size) && <p className="text-[11px] text-gray-400">{it.gsm} GSM · {it.size}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        {it.lotNumber ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                            <Warehouse className="h-3 w-3" /> Lot {it.lotNumber}{it.binLocation && ` @ ${it.binLocation}`}
                          </span>
                        ) : it.grnNumber ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                            <Truck className="h-3 w-3" /> Direct {it.grnNumber}{it.poNumber && ` (${it.poNumber})`}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums">{it.quantityKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 text-gray-700 tabular-nums">{it.rate != null ? `₹${it.rate.toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-semibold text-indigo-700">Total</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-indigo-800 tabular-nums">{challan.totalQuantityKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg</td>
                    <td className="px-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {challan.remarks && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase">Remarks</p>
              <p className="text-xs text-gray-700 mt-0.5">{challan.remarks}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={onPrint} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Page() {
  return <PermGuard perm="grn.read"><DeliveryChallanPage /></PermGuard>;
}
