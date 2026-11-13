"use client";

import { PermGuard } from "@/components/PermGuard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Truck, Plus, X, Clock, FileText, CheckCircle2,
  Eye, Loader2, Pencil, MoreVertical, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/lib/api";
import {
  dispatchReceiptApi, DispatchReceiptRow, DispatchReceiptItemDto, PendingTlpForDispatchRow, PendingTlpItemDto,
  CreateDispatchReceiptDto, truckLoadPlanApi, TruckLoadPlanApiDto,
} from "@/lib/api-services";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { KpiCard } from "@/components/ui/KpiCard";
import { useToast } from "@/context/ToastContext";

// ─── Status colour map ────────────────────────────────────────────────────────

function getStatusColor(s: string) {
  const map: Record<string, string> = {
    "Pending GRN":  "bg-amber-100 text-amber-700 border-amber-200",
    "Partial GRN":  "bg-blue-100 text-blue-700 border-blue-200",
    "GRN Done":     "bg-green-100 text-green-700 border-green-200",
  };
  return map[s] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

// ─── Types ────────────────────────────────────────────────────────────────────

// Flattened "one row per dispatched item" shape used by the main grid so the
// user can clearly see every item in a dispatch instead of just the header.
interface DispatchItemRow {
  rowKey: string;
  receipt: DispatchReceiptRow;
  item: DispatchReceiptItemDto | null;
  dispatchNumber: string;
  dispatchDate: string;
  loadPlanNumber?: string;
  truckNumber?: string;
  transporterName?: string;
  status: string;
  itemInvoiceNo?: string;
  paper?: string;
  gsm?: number;
  size?: string;
  dispatchedQty: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DispatchPage() {
  const { success, error: showError, warning } = useToast();

  // Surface 4xx as warning toasts (user-actionable validation), 5xx/network as error.
  const surfaceApiError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.message) {
      if (err.status >= 400 && err.status < 500) warning(err.message);
      else showError(err.message);
    } else {
      showError(fallback);
    }
  }, [showError, warning]);

  const [receipts, setReceipts]         = useState<DispatchReceiptRow[]>([]);
  const [pending,  setPending]          = useState<PendingTlpForDispatchRow[]>([]);
  const [loading,  setLoading]          = useState(true);
  // Pagination for the "Pending" table is by PLAN GROUP, not raw item rows —
  // a plan's rowSpan'd items must never split across a page boundary.
  const [pendingPage, setPendingPage] = useState(0);
  const pendingPageSize = 15;
  const pendingPageCount = Math.max(1, Math.ceil(pending.length / pendingPageSize));
  const pendingSafePage = Math.min(pendingPage, pendingPageCount - 1);
  const pagedPending = pending.slice(pendingSafePage * pendingPageSize, pendingSafePage * pendingPageSize + pendingPageSize);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTlp,       setActiveTlp]       = useState<PendingTlpForDispatchRow | null>(null);
  const [activeReceipt,   setActiveReceipt]   = useState<DispatchReceiptRow | null>(null);
  const [editReceipt,     setEditReceipt]     = useState<DispatchReceiptRow | null>(null);
  const [deleteReceipt,   setDeleteReceipt]   = useState<DispatchReceiptRow | null>(null);
  const [deleting,        setDeleting]        = useState(false);
  // Default landing view = Pending (per client UAT, same pattern as Truck
  // Load Plan) — operators open this page primarily to enter dispatch
  // details for freshly-loaded trucks, not to review history.
  const [showPending,     setShowPending]     = useState(true);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteReceipt) return;
    setDeleting(true);
    try {
      await dispatchReceiptApi.remove(deleteReceipt.id);
      success(`Dispatch ${deleteReceipt.dispatchNumber} deleted.`);
      setDeleteReceipt(null);
      load();
    } catch (err) {
      surfaceApiError(err, "Failed to delete dispatch receipt.");
    } finally {
      setDeleting(false);
    }
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [drRes, pendRes] = await Promise.all([
        dispatchReceiptApi.list({ pageSize: 200 }),
        dispatchReceiptApi.pendingTlps(),
      ]);
      setReceipts(drRes.items);
      setPending(pendRes);
    } catch {
      // surfaced by global error middleware
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    pendingTlps:  pending.length,
    pendingGrn:   receipts.filter((r) => r.status === "Pending GRN").length,
    grnDone:      receipts.filter((r) => r.status === "GRN Done").length,
    total:        receipts.length,
  }), [pending, receipts]);

  // ── Flatten DRs into item-level rows (Mill-Tracker style) ─────────────────
  // One grid row per dispatched item, with parent DR header fields denormalised
  // so the user can scan multiple items in the same dispatch side-by-side.
  const itemRows: DispatchItemRow[] = useMemo(
    () => receipts.flatMap((r) =>
      (r.items.length > 0 ? r.items : [null as unknown as DispatchReceiptItemDto]).map((it) => ({
        rowKey:           it ? `${r.id}-${it.id}` : `${r.id}-empty`,
        receipt:          r,
        item:             it,
        // denormalised fields used by the grid columns
        dispatchNumber:   r.dispatchNumber,
        dispatchDate:     r.dispatchDate,
        loadPlanNumber:   r.loadPlanNumber,
        truckNumber:      r.truckNumber,
        transporterName:  r.transporterName,
        status:           r.status,
        itemInvoiceNo:    it?.itemInvoiceNo ?? r.invoiceNumber,
        paper:            it?.paper,
        gsm:              it?.gsm,
        size:             it?.size,
        dispatchedQty:    it?.dispatchedQty ?? 0,
      })),
    ),
    [receipts],
  );

  const filteredItemRows = useMemo(
    () => activeStatusFilter ? itemRows.filter((r) => r.status === activeStatusFilter) : itemRows,
    [itemRows, activeStatusFilter],
  );

  // ── DataGrid columns ──────────────────────────────────────────────────────
  const columns: ColumnConfig<DispatchItemRow>[] = useMemo(() => [
    {
      id: "actions", accessorKey: "rowKey", header: "",
      filterType: "none", enableSorting: false, enableHiding: false, defaultVisible: true, size: 60, sticky: "left",
      cell: (info) => {
        const r = info.row.original.receipt;
        return (
          <DispatchActionsMenu
            receipt={r}
            onView={() => setActiveReceipt(r)}
            onEdit={() => setEditReceipt(r)}
            onDelete={() => setDeleteReceipt(r)}
          />
        );
      },
    },
    {
      id: "dispatchNumber", accessorKey: "dispatchNumber", header: "Dispatch #",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 150,
      cell: (info) => <span className="font-semibold text-purple-700">{info.getValue() as string}</span>,
    },
    {
      id: "dispatchDate", accessorKey: "dispatchDate", header: "Date",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 110,
    },
    {
      id: "loadPlanNumber", accessorKey: "loadPlanNumber", header: "Plan #",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => <span className="font-mono text-xs text-blue-700">{(info.getValue() as string) || "—"}</span>,
    },
    {
      id: "paper", accessorKey: "paper", header: "Item",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 200,
      cell: (info) => {
        const r = info.row.original;
        return (
          <div>
            <p className="font-medium text-gray-900">{r.paper ?? "—"}</p>
            {(r.gsm || r.size) && <p className="text-[11px] text-gray-400">{r.gsm}g · {r.size}</p>}
          </div>
        );
      },
    },
    {
      id: "dispatchedQty", accessorKey: "dispatchedQty", header: "Qty (kg)",
      filterType: "none", enableSorting: true, defaultVisible: true, size: 100,
      cell: (info) => <span className="font-semibold tabular-nums">{(info.getValue() as number).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>,
    },
    {
      id: "itemInvoiceNo", accessorKey: "itemInvoiceNo", header: "Invoice #",
      filterType: "text", enableSorting: true, defaultVisible: true, size: 140,
      cell: (info) => <span className="font-mono text-xs">{(info.getValue() as string) || "—"}</span>,
    },
    {
      id: "truckNumber", accessorKey: "truckNumber", header: "Truck",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 120,
      cell: (info) => <span className="font-mono text-xs">{(info.getValue() as string) || "—"}</span>,
    },
    {
      id: "transporterName", accessorKey: "transporterName", header: "Transporter",
      filterType: "text", enableSorting: false, defaultVisible: true, size: 150,
    },
    {
      id: "status", accessorKey: "status", header: "Status",
      filterType: "select",
      filterOptions: [
        { label: "Pending GRN", value: "Pending GRN" },
        { label: "Partial GRN", value: "Partial GRN" },
        { label: "GRN Done",    value: "GRN Done"    },
      ],
      enableSorting: false, defaultVisible: true, size: 130,
      cell: (info) => {
        const s = info.getValue() as string;
        return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${getStatusColor(s)}`}>{s}</span>;
      },
    },
  ], []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4 overflow-hidden">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard
          title="Pending Plans"
          value={String(kpis.pendingTlps)}
          subtitle={showPending ? "Click to hide list" : "Click to view list"}
          subtitleColor="amber"
          icon={Truck}
          iconBg={showPending ? "bg-amber-100 ring-2 ring-amber-400" : "bg-amber-50"}
          iconColor="text-amber-500"
          onClick={() => setShowPending((v) => !v)}
        />
        <KpiCard title="Pending GRN"    value={String(kpis.pendingGrn)}  subtitle="Awaiting warehouse" icon={Clock} iconBg="bg-blue-50" iconColor="text-blue-500"
          onClick={() => { setShowPending(false); setActiveStatusFilter((f) => f === "Pending GRN" ? null : "Pending GRN"); }}
          className={activeStatusFilter === "Pending GRN" ? "ring-2 ring-blue-400" : ""} />
        <KpiCard title="GRN Done"       value={String(kpis.grnDone)}     subtitle="Received in stock" icon={CheckCircle2} iconBg="bg-green-50" iconColor="text-green-500"
          onClick={() => { setShowPending(false); setActiveStatusFilter((f) => f === "GRN Done" ? null : "GRN Done"); }}
          className={activeStatusFilter === "GRN Done" ? "ring-2 ring-green-400" : ""} />
        <KpiCard title="Total Dispatches" value={String(kpis.total)}     subtitle="All time" icon={FileText} iconBg="bg-gray-50" iconColor="text-gray-500"
          onClick={() => { setShowPending(false); setActiveStatusFilter(null); }} />
      </div>

      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
      {showPending ? (
        /* Pending TLP list — shown only when the Pending Plans KPI is active */
        <div className="flex flex-1 min-h-0 flex-col rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-2.5">
              <Truck className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-900">Plans Awaiting Dispatch Entry</span>
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{pending.length}</span>
            </div>
            <button onClick={() => setShowPending(false)}
              className="text-xs text-amber-700 hover:text-amber-900 inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Close
            </button>
          </div>
          {pending.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              No trucks awaiting dispatch entry.
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Plan #", "#", "Plan Date", "Truck", "Transporter", "Mill / Origin", "Item", "Weight (kg)", "Status", ""].map((h) => (
                      <th key={h} className="bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedPending.flatMap((t, planGroupIdx) => {
                    // Render one row per item so the user can scan item-wise.
                    // If a plan has no items (edge case), still render a summary row.
                    const items = t.items.length > 0 ? t.items : [null as unknown as PendingTlpItemDto];
                    const total = items.length;
                    // Alternating background per plan group so adjacent plans are
                    // visually distinct even when they have similar item counts.
                    const groupBg = planGroupIdx % 2 === 0 ? "bg-white" : "bg-amber-50/40";
                    return items.map((it, idx) => (
                      <tr
                        key={it ? `${t.tlpId}-${it.itemId}` : `${t.tlpId}-empty`}
                        className={`${groupBg} hover:bg-amber-50/60 transition-colors ${idx === 0 ? "border-t-2 border-amber-300" : ""}`}>
                        <td className="px-4 py-3 font-mono font-semibold text-xs text-blue-700">
                          {/* Show the plan # only on the first row of each group so
                              it reads like one plan with sub-items (MOT-style). */}
                          {idx === 0 ? t.planNumber : <span className="text-gray-300">↳</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-amber-700 font-semibold tabular-nums">#{idx + 1}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{idx === 0 ? t.planDate : ""}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{idx === 0 ? (t.truckNumber ?? "—") : ""}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{idx === 0 ? (t.transporterName ?? "—") : ""}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{idx === 0 ? (t.origin ?? "—") : ""}</td>
                        <td className="px-4 py-3 text-xs">
                          {it ? (
                            <>
                              <p className="font-medium text-gray-900">{it.paper ?? "—"}</p>
                              {(it.gsm || it.size) && <p className="text-[11px] text-gray-400">{it.gsm}g · {it.size}</p>}
                            </>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-900 tabular-nums">
                          {it ? it.weightKg.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {idx === 0 && (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">{t.status}</span>
                          )}
                        </td>
                        {/* Single Enter Dispatch button per TLP group — the <td>
                            uses rowSpan so it spans every item row of the plan,
                            making it visually clear that one button controls the
                            whole plan. Cell is omitted on non-first rows. */}
                        {idx === 0 && (
                          <td className="px-4 py-3 text-right align-middle" rowSpan={total}>
                            <button
                              onClick={() => { setActiveTlp(t); setShowCreateModal(true); }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors">
                              <Plus className="h-3 w-3" /> Enter Dispatch
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
          {pending.length > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between border-t px-4 py-2">
              <p className="text-xs text-gray-600">
                Showing {pendingSafePage * pendingPageSize + 1} to {Math.min((pendingSafePage + 1) * pendingPageSize, pending.length)} of {pending.length} plans
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
        /* Default: saved Dispatch Receipts list */
        loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading dispatch receipts…
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col">
            {activeStatusFilter && (
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusColor(activeStatusFilter)}`}>
                  {activeStatusFilter}
                </span>
                <button onClick={() => setActiveStatusFilter(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-gray-400">{filteredItemRows.length} row{filteredItemRows.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="flex flex-1 min-h-0 flex-col">
            <DataGrid
              data={filteredItemRows}
              columns={columns}
              tableName="dispatch-receipts"
              enableFilters
              enablePagination
              enableColumnVisibility
              scrollMaxHeight="100%"
              initialPageSize={15}
              onRowClick={(r) => setActiveReceipt(r.receipt)}
              emptyMessage="No dispatch receipts yet. Click the Pending Plans KPI to enter invoice details."
            />
            </div>
          </div>
        )
      )}
      </div>

      {/* Create modal */}
      {showCreateModal && activeTlp && (
        <CreateDispatchModal
          tlp={activeTlp}
          onClose={() => { setShowCreateModal(false); setActiveTlp(null); }}
          onSaved={() => { setShowCreateModal(false); setActiveTlp(null); success("Dispatch receipt created."); load(); }}
          onError={(err) => surfaceApiError(err, "Failed to save dispatch receipt.")}
        />
      )}

      {/* View modal */}
      {activeReceipt && (
        <ViewDispatchModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
          onEdit={() => { setEditReceipt(activeReceipt); setActiveReceipt(null); }}
        />
      )}

      {/* Edit modal */}
      {editReceipt && (
        <EditDispatchModal
          receipt={editReceipt}
          onClose={() => setEditReceipt(null)}
          onSaved={() => { setEditReceipt(null); success("Dispatch updated."); load(); }}
          onError={(err) => surfaceApiError(err, "Failed to update dispatch receipt.")}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteReceipt}
        onClose={() => !deleting && setDeleteReceipt(null)}
        onConfirm={handleDelete}
        title="Delete Dispatch Receipt?"
        description={deleteReceipt
          ? `This will soft-delete ${deleteReceipt.dispatchNumber} (Invoice ${deleteReceipt.invoiceNumber}). Linked GRNs will lose the dispatch reference.`
          : ""}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}

// ─── Actions menu (3-dot) for each receipt row ────────────────────────────────

function DispatchActionsMenu({ receipt, onView, onEdit, onDelete }: {
  receipt: DispatchReceiptRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
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

  // Backend now rejects Edit/Delete once ANY GRN references this dispatch
  // (not just a fully "GRN Done" one) — a "Partial GRN" receipt already has
  // at least one GRN recorded against it, so it must be blocked here too,
  // otherwise the button is clickable but errors out on submit.
  const canEditOrDelete = receipt.status !== "GRN Done" && receipt.status !== "Partial GRN";

  return (
    <>
      {open && <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />}
      <button ref={btnRef} onClick={toggle}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed z-30 min-w-[160px] rounded-xl border border-gray-100 bg-white py-1.5 shadow-xl"
          style={{ top: pos.top, right: pos.right }}>
          <button onClick={act(onView)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Eye className="h-3.5 w-3.5 text-gray-400" /> View Details
          </button>
          {canEditOrDelete && (
            <button onClick={act(onEdit)}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Pencil className="h-3.5 w-3.5 text-blue-400" /> Edit
            </button>
          )}
          {canEditOrDelete && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={act(onDelete)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ─── Create Dispatch Modal ────────────────────────────────────────────────────

function CreateDispatchModal({ tlp, onClose, onSaved, onError }: {
  tlp: PendingTlpForDispatchRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [tlpDetail, setTlpDetail] = useState<TruckLoadPlanApiDto | null>(null);
  const [saving, setSaving] = useState(false);

  // form state — Dispatch Date and Received By removed per latest spec.
  // dispatchDate is auto-set to today on save. Invoice No moved to per-item.
  const [invoiceDate,       setInvoiceDate]       = useState(today);
  // Mill Challan dropped from Enter Dispatch popup per client UAT — ops
  // weren't using it on entry; relevant info already flows from the
  // mill-side invoice + LR. Existing receipts keep the field on display.
  const [lrNumber,          setLrNumber]          = useState("");
  const [vehicleNumber,     setVehicleNumber]     = useState("");
  const [remarks,           setRemarks]           = useState("");

  // Per-item dispatched qty + per-item invoice no (keys = TLP item id)
  const [qtyMap,        setQtyMap]        = useState<Record<number, number>>({});
  const [invoiceNoMap,  setInvoiceNoMap]  = useState<Record<number, string>>({});
  // Per-item "close tracker after this dispatch" flag — when ticked, the
  // source mill tracker is finalised in the same save (short-delivery
  // acceptance). Tracker leaves the default MOT view; balance qty won't
  // appear as pending anymore.
  const [closeMap,      setCloseMap]      = useState<Record<number, boolean>>({});

  // Load the TLP detail (items + their weights) — but DON'T show PO/SO/customer context.
  // We only need: item code (paper/gsm/size), suggested qty from TLP weight.
  useEffect(() => {
    truckLoadPlanApi.getById(tlp.tlpId).then((d) => {
      setTlpDetail(d);
      const init: Record<number, number> = {};
      (d.items ?? []).forEach((it) => {
        init[it.id] = it.weightKg ?? it.quantity ?? 0;
      });
      setQtyMap(init);
    }).catch((err) => onError(err));
  }, [tlp.tlpId, onError]);

  const totalQty = useMemo(
    () => Object.values(qtyMap).reduce((s, v) => s + (v || 0), 0),
    [qtyMap],
  );

  // Derive header invoice from the first non-empty per-item invoice so existing
  // backend validation (which requires a header InvoiceNumber) keeps passing.
  const derivedHeaderInvoice = useMemo(() => {
    const first = Object.values(invoiceNoMap).find((v) => v && v.trim());
    return first?.trim() ?? "";
  }, [invoiceNoMap]);

  const isValid = !!derivedHeaderInvoice && totalQty > 0;

  const handleSave = async () => {
    if (!tlpDetail) return;
    setSaving(true);
    try {
      const dto: CreateDispatchReceiptDto = {
        dispatchDate:     today,           // auto: dispatch date = today
        sourceLoadPlanId: tlp.tlpId,
        invoiceNumber:    derivedHeaderInvoice,
        invoiceDate:      invoiceDate || undefined,
        lrNumber:         lrNumber || undefined,
        vehicleNumber:    vehicleNumber || undefined,
        receivedBy:       undefined,       // field removed from popup
        remarks:          remarks || undefined,
        items: tlpDetail.items.map((it) => ({
          sourceTrackerId:   it.trackerId ?? undefined,
          sourceTlpItemId:   it.id,
          materialId:        undefined,
          dispatchedQty:     qtyMap[it.id] ?? 0,
          itemInvoiceNo:     (invoiceNoMap[it.id] ?? "").trim() || undefined,
          closeTrackerAfter: !!closeMap[it.id],
        })),
      };
      await dispatchReceiptApi.create(dto);
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <Truck className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Enter Dispatch — {tlp.planNumber}</h2>
              <p className="text-xs text-gray-500">Truck: {tlp.truckNumber ?? "—"} · {tlp.transporterName ?? "—"} · {tlp.origin ?? "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-5">

          {/* Mill Invoice / Transport — Dispatch Date & Received By removed per client spec */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Mill Invoice & Transport</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">LR Number</label>
                <input type="text" value={lrNumber} onChange={(e) => setLrNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Number</label>
                <input type="text" value={vehicleNumber || tlp.truckNumber || ""} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Items section — per-item Invoice No + Dispatched qty (like GRN) */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Items — Per-Item Invoice & Dispatched Quantity
            </p>
            {!tlpDetail ? (
              <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading items…
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Item Code</th>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-44">Invoice No. <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Plan Wt (kg)</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-44">Dispatched (kg) <span className="text-red-500">*</span></th>
                      <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-amber-600 w-24" title="Close mill tracker after this dispatch (short delivery final)">Close?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tlpDetail.items.map((it, idx) => {
                      const planWt = it.weightKg ?? it.quantity ?? 0;
                      return (
                        <tr key={it.id} className="bg-white">
                          <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-900">{it.paper}</p>
                            <p className="text-[11px] text-gray-400">{it.gsm} GSM · {it.size}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={invoiceNoMap[it.id] ?? ""}
                              onChange={(e) =>
                                setInvoiceNoMap((prev) => ({ ...prev, [it.id]: e.target.value }))
                              }
                              placeholder="INV-2026-0001"
                              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">{planWt.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              value={qtyMap[it.id] ?? 0}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value) || 0;
                                setQtyMap((prev) => ({ ...prev, [it.id]: n }));
                              }}
                              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm font-semibold focus:border-blue-500 focus:outline-none"
                              min={0}
                            />
                          </td>
                          {/* Close-tracker toggle — one-click short-delivery
                              finalisation from the dispatch popup. When on,
                              the source mill tracker moves out of the default
                              MOT view + can't accumulate more balance. */}
                          <td className="px-3 py-2.5 text-center">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                                   title="Close the source mill tracker after this dispatch (short-delivery final)">
                              <input
                                type="checkbox"
                                checked={!!closeMap[it.id]}
                                onChange={(e) =>
                                  setCloseMap((prev) => ({ ...prev, [it.id]: e.target.checked }))
                                }
                                className="h-3.5 w-3.5 rounded border-gray-300 text-amber-500 focus:ring-1 focus:ring-amber-400"
                              />
                              <span className="text-[10px] font-medium text-amber-700">Close</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                    <tr>
                      <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold text-amber-700">Total Dispatched</td>
                      <td className="px-3 py-2.5 text-right text-sm font-bold text-amber-800 tabular-nums">{totalQty.toLocaleString()} kg</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!isValid || saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Dispatch
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── View Dispatch Modal ──────────────────────────────────────────────────────

function ViewDispatchModal({ receipt, onClose, onEdit }: { receipt: DispatchReceiptRow; onClose: () => void; onEdit?: () => void }) {
  const totalQty = useMemo(
    () => receipt.items.reduce((s, i) => s + (i.dispatchedQty ?? 0), 0),
    [receipt.items],
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{receipt.dispatchNumber}</h2>
              <p className="text-xs text-gray-500">{receipt.dispatchDate} · {receipt.invoiceNumber}</p>
            </div>
            <span className={`ml-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${getStatusColor(receipt.status)}`}>
              {receipt.status}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-4">
          {/* Header details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["Plan #", receipt.loadPlanNumber ?? "—"],
              ["Truck",  receipt.truckNumber ?? "—"],
              ["Transporter", receipt.transporterName ?? "—"],
              ["Origin", receipt.origin ?? "—"],
              ["Invoice Date", receipt.invoiceDate ?? "—"],
              ["Mill Challan", receipt.millChallanNumber ?? "—"],
              ["LR Number", receipt.lrNumber ?? "—"],
              ["Received By", receipt.receivedBy ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{k}</p>
                <p className="text-xs font-semibold text-gray-900 mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Items Dispatched</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Item Code</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Invoice No.</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Dispatched (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipt.items.map((it, idx) => (
                    <tr key={it.id} className="bg-white">
                      <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{it.paper ?? `Item #${it.materialId ?? "—"}`}</p>
                        {it.gsm && it.size && <p className="text-[11px] text-gray-400">{it.gsm} GSM · {it.size}</p>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{it.itemInvoiceNo ?? receipt.invoiceNumber ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{it.dispatchedQty.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-amber-50 border-t-2 border-amber-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-semibold text-amber-700">Total</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold text-amber-800 tabular-nums">{totalQty.toLocaleString()} kg</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {receipt.remarks && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase">Remarks</p>
              <p className="text-xs text-gray-700 mt-0.5">{receipt.remarks}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          {onEdit && receipt.status !== "GRN Done" && (
            <button onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-4 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Edit Dispatch Modal ──────────────────────────────────────────────────────

function EditDispatchModal({ receipt, onClose, onSaved, onError }: {
  receipt: DispatchReceiptRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const [dispatchDate,      setDispatchDate]      = useState(receipt.dispatchDate);
  const [invoiceNumber,     setInvoiceNumber]     = useState(receipt.invoiceNumber);
  const [invoiceDate,       setInvoiceDate]       = useState(receipt.invoiceDate ?? "");
  const [millChallanNumber, setMillChallanNumber] = useState(receipt.millChallanNumber ?? "");
  const [lrNumber,          setLrNumber]          = useState(receipt.lrNumber ?? "");
  const [vehicleNumber,     setVehicleNumber]     = useState(receipt.vehicleNumber ?? "");
  const [receivedBy,        setReceivedBy]        = useState(receipt.receivedBy ?? "");
  const [remarks,           setRemarks]           = useState(receipt.remarks ?? "");
  const [saving, setSaving] = useState(false);

  const isValid = !!invoiceNumber.trim() && !!dispatchDate;

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatchReceiptApi.update(receipt.id, {
        dispatchDate,
        sourceLoadPlanId: receipt.sourceLoadPlanId,
        invoiceNumber:    invoiceNumber.trim(),
        invoiceDate:      invoiceDate || undefined,
        millChallanNumber: millChallanNumber || undefined,
        lrNumber:         lrNumber || undefined,
        vehicleNumber:    vehicleNumber || undefined,
        receivedBy:       receivedBy || undefined,
        remarks:          remarks || undefined,
        items: receipt.items.map((it) => ({
          sourceTrackerId: it.sourceTrackerId ?? undefined,
          sourceTlpItemId: it.sourceTlpItemId ?? undefined,
          materialId:      it.materialId ?? undefined,
          dispatchedQty:   it.dispatchedQty,
          itemInvoiceNo:   it.itemInvoiceNo ?? undefined,
        })),
      });
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
              <Pencil className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Edit Dispatch — {receipt.dispatchNumber}</h2>
              <p className="text-xs text-gray-500">Item quantities are locked once dispatch is saved.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Mill Invoice Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dispatch Date <span className="text-red-500">*</span></label>
                <input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Invoice No. <span className="text-red-500">*</span></label>
                <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mill Challan No.</label>
                <input type="text" value={millChallanNumber} onChange={(e) => setMillChallanNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">LR Number</label>
                <input type="text" value={lrNumber} onChange={(e) => setLrNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Number</label>
                <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Received By</label>
                <input type="text" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </div>

        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3.5 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!isValid || saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Default export (wrapped in PermGuard) ────────────────────────────────────

export default function Page() {
  return <PermGuard perm="grn.read"><DispatchPage /></PermGuard>;
}
