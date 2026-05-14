"use client";

import { useMemo, useCallback } from "react";
import { SalesOrder, SalesOrderLine } from "@/data/mockData";
import { Shield, AlertTriangle, CheckCircle2, Package, Truck, TrendingUp } from "lucide-react";
import { useStock } from "@/context/StockContext";
import { useSalesOrder } from "@/context/SalesOrderContext";
import { useToast } from "@/context/ToastContext";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";

interface CoverageLine {
  id: string;
  lineId: string;
  soNumber: string;
  customer: string;
  orderDate: string;
  expectedDelivery: string;
  lineNumber: number;
  paper: string;
  gsm: number;
  size: string;
  orderedQty: number;
  physicalStock: number;
  transitStock: number;
  purchaseAllocated: number;
  coveredQty: number;
  coveragePct: number;
  shortfall: number;
  deliveryFeasible: boolean;
  soStatus: SalesOrder["status"];
  lineStatus: SalesOrderLine["status"];
}

export default function CoveragePage() {
  const { stockLots, allocateLot } = useStock();
  const { salesOrders, updateSalesOrder } = useSalesOrder();
  const { success, error } = useToast();

  // Allocate FIFO stock lots against an SO line
  const handleAllocate = useCallback((line: CoverageLine) => {
    const so = salesOrders.find((s) => s.soNumber === line.soNumber);
    if (!so) return;

    const matchingLots = stockLots
      .filter(
        (lot) =>
          lot.paper === line.paper &&
          lot.gsm === line.gsm &&
          lot.size === line.size &&
          lot.availableQty > 0
      )
      .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()); // FIFO

    const needed = line.orderedQty - line.coveredQty;
    if (needed <= 0) { error("Already fully covered."); return; }
    if (matchingLots.length === 0) { error("No available stock for this material."); return; }

    let remaining = needed;
    for (const lot of matchingLots) {
      if (remaining <= 0) break;
      const toAlloc = Math.min(remaining, lot.availableQty);
      allocateLot(lot.id, toAlloc);
      remaining -= toAlloc;
    }

    const allocated = needed - remaining;
    const updatedLines = so.lines.map((l) =>
      l.id === line.lineId
        ? { ...l, stockAllocated: (l.stockAllocated ?? 0) + allocated }
        : l
    );
    updateSalesOrder(so.id, { lines: updatedLines });
    success(`Allocated ${allocated.toLocaleString()} sheets (FIFO) to ${line.soNumber} - Line ${line.lineNumber}.`);
    if (remaining > 0) error(`Short by ${remaining.toLocaleString()} sheets — raise a PO for the deficit.`);
  }, [stockLots, salesOrders, allocateLot, updateSalesOrder, success, error]);

  const coverageLines = useMemo<CoverageLine[]>(() => {
    const openOrders = salesOrders.filter(
      (so) => so.status !== "Completed" && so.status !== "Closed" && so.status !== "Cancelled"
    );

    return openOrders.flatMap((so) =>
      so.lines.map((line) => {
        const matchingLots = stockLots.filter(
          (lot) =>
            lot.paper === line.materialCode &&
            lot.gsm === (line.gsm || 0) &&
            lot.size === (line.size || "") &&
            (lot.status === "Available" || lot.status === "Allocated")
        );
        const physicalStock = matchingLots.reduce((sum, lot) => sum + lot.availableQty, 0);
        const purchaseAllocated = line.purchaseAllocated ?? 0;
        const stockAllocated = line.stockAllocated ?? 0;
        const transitStock = line.transitAllocated ?? 0;
        const coveredQty = stockAllocated + purchaseAllocated + transitStock;
        const coveragePct = line.orderedQty > 0 ? Math.min(100, Math.round((coveredQty / line.orderedQty) * 100)) : 0;
        const shortfall = Math.max(0, line.orderedQty - coveredQty);
        const today = new Date();
        const deliveryDate = new Date(line.requiredDeliveryDate);
        const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const deliveryFeasible = daysUntilDelivery >= 3;

        return {
          id: `${so.soNumber}-${line.lineNumber}`,
          lineId: line.id,
          soNumber: so.soNumber,
          customer: so.customer,
          orderDate: so.orderDate,
          expectedDelivery: line.requiredDeliveryDate,
          lineNumber: line.lineNumber,
          paper: line.materialCode || "",
          gsm: line.gsm || 0,
          size: line.size || "",
          orderedQty: line.orderedQty,
          physicalStock,
          transitStock,
          purchaseAllocated,
          coveredQty,
          coveragePct,
          shortfall,
          deliveryFeasible,
          soStatus: so.status,
          lineStatus: line.status,
        };
      })
    );
  }, [salesOrders, stockLots]);

  const kpis = useMemo(() => {
    const total = coverageLines.length;
    const fullyCovered = coverageLines.filter((l) => l.coveragePct >= 100).length;
    const partiallyCovered = coverageLines.filter((l) => l.coveragePct > 0 && l.coveragePct < 100).length;
    const uncovered = coverageLines.filter((l) => l.coveragePct === 0).length;
    const infeasible = coverageLines.filter((l) => !l.deliveryFeasible).length;
    const avgCoverage = total > 0 ? Math.round(coverageLines.reduce((s, l) => s + l.coveragePct, 0) / total) : 0;
    return { total, fullyCovered, partiallyCovered, uncovered, infeasible, avgCoverage };
  }, [coverageLines]);

  const getCoverageColor = (pct: number) => {
    if (pct >= 100) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getCoverageBg = (pct: number) => {
    if (pct >= 100) return "bg-green-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const columns: ColumnConfig<CoverageLine>[] = useMemo(() => [
    {
      id: "soNumber",
      accessorKey: "soNumber",
      header: "SO / Line",
      filterType: "text",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div>
            <div className="font-semibold text-blue-600">{row.soNumber}</div>
            <div className="text-xs text-gray-400">Line {row.lineNumber}</div>
          </div>
        );
      },
    },
    {
      id: "customer",
      accessorKey: "customer",
      header: "Customer",
      filterType: "text",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div>
            <div className="text-gray-900">{row.customer}</div>
            <div className="text-xs text-gray-400">{row.expectedDelivery}</div>
          </div>
        );
      },
    },
    {
      id: "paper",
      accessorKey: "paper",
      header: "Material",
      filterType: "text",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div>
            <div className="font-medium text-gray-900 text-xs">{row.paper}</div>
            <div className="text-xs text-gray-500">{row.gsm} GSM · {row.size}</div>
          </div>
        );
      },
    },
    {
      id: "orderedQty",
      accessorKey: "orderedQty",
      header: "Ordered",
      filterType: "none",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => (
        <span className="font-medium text-gray-900">{(info.getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: "physicalStock",
      accessorKey: "physicalStock",
      header: "Physical",
      filterType: "none",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const val = info.getValue() as number;
        return (
          <span className={val > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
            {val.toLocaleString()}
          </span>
        );
      },
    },
    {
      id: "transitStock",
      accessorKey: "transitStock",
      header: "Transit",
      filterType: "none",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const val = info.getValue() as number;
        return (
          <span className={val > 0 ? "text-blue-600 font-medium" : "text-gray-400"}>
            {val > 0 ? val.toLocaleString() : "—"}
          </span>
        );
      },
    },
    {
      id: "purchaseAllocated",
      accessorKey: "purchaseAllocated",
      header: "Purchase",
      filterType: "none",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const val = info.getValue() as number;
        return (
          <span className={val > 0 ? "text-purple-600 font-medium" : "text-gray-400"}>
            {val > 0 ? val.toLocaleString() : "—"}
          </span>
        );
      },
    },
    {
      id: "coveragePct",
      accessorKey: "coveragePct",
      header: "Coverage %",
      filterType: "none",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const pct = info.getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 rounded-full bg-gray-200 h-1.5 flex-shrink-0">
              <div
                className={`h-1.5 rounded-full ${getCoverageBg(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-sm font-semibold ${getCoverageColor(pct)}`}>
              {pct}%
            </span>
          </div>
        );
      },
    },
    {
      id: "shortfall",
      accessorKey: "shortfall",
      header: "Shortfall",
      filterType: "none",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const val = info.getValue() as number;
        return val > 0 ? (
          <span className="text-red-600 font-medium">{val.toLocaleString()}</span>
        ) : (
          <span className="text-green-600">—</span>
        );
      },
    },
    {
      id: "deliveryFeasible",
      accessorKey: "deliveryFeasible",
      header: "Delivery",
      filterType: "none",
      enableSorting: true,
      defaultVisible: true,
      cell: (info) => {
        const feasible = info.getValue() as boolean;
        return feasible ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Feasible
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> At Risk
          </span>
        );
      },
    },
    {
      id: "actions",
      accessorKey: "id",
      header: "Actions",
      filterType: "none",
      enableSorting: false,
      defaultVisible: true,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="flex items-center gap-1.5">
            {row.shortfall > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); }}
                className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Raise PO
              </button>
            )}
            {row.physicalStock > 0 && row.coveragePct < 100 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAllocate(row); }}
                className="rounded-lg bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 active:scale-95 transition-all"
              >
                Allocate
              </button>
            )}
          </div>
        );
      },
    },
  ], [handleAllocate]);

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Lines</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.total}</p>
              <p className="mt-0.5 text-xs text-gray-500">Open SO lines</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Avg Coverage</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.avgCoverage}%</p>
              <p className="mt-0.5 text-xs text-gray-500">Across all lines</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Fully Covered</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.fullyCovered}</p>
              <p className="mt-0.5 text-xs text-green-600">100% allocated</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Partial</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.partiallyCovered}</p>
              <p className="mt-0.5 text-xs text-yellow-600">Needs more coverage</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
              <Package className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Uncovered</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.uncovered}</p>
              <p className="mt-0.5 text-xs text-red-600">0% allocation</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Delivery Risk</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.infeasible}</p>
              <p className="mt-0.5 text-xs text-red-600">Date at risk</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <Truck className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Coverage DataGrid */}
      <DataGrid
        data={coverageLines}
        columns={columns}
        tableName="coverage"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={15}
        emptyMessage="No open sales order lines found."
      />
    </div>
  );
}
