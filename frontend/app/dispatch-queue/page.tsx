"use client";

import { useMemo, useState, useCallback } from "react";
import { PickPlan, PickPlanLine, Challan, ChallanLine } from "@/data/mockData";
import { Truck, Clock, AlertTriangle, CheckCircle2, Package, ArrowRight, Sparkles } from "lucide-react";
import { useStock } from "@/context/StockContext";
import { useSalesOrder } from "@/context/SalesOrderContext";
import { useToast } from "@/context/ToastContext";

interface DispatchItem {
  soNumber: string;
  soId: string;
  lineId: string;
  lineNumber: number;
  customer: string;
  orderDate: string;
  expectedDelivery: string;
  paper: string;
  gsm: number;
  size: string;
  orderedQty: number;
  stockAllocated: number;
  daysUntilDelivery: number;
  priority: "Urgent" | "High" | "Normal";
  hasPickPlan: boolean;
}

interface StockBin {
  lotNumber: string;
  binLocation: string;
  availableQty: number;
  receivedDate: string;
  ageDays: number;
  selectedQty: number;
}

export default function DispatchQueuePage() {
  const { stockLots, allocateLot, pickPlans, addPickPlan, addChallan } = useStock();
  const { salesOrders } = useSalesOrder();
  const { success } = useToast();

  const [showPickPlanModal, setShowPickPlanModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DispatchItem | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"Direct To Customer" | "To Godown">("Direct To Customer");
  const [stockBins, setStockBins] = useState<StockBin[]>([]);

  const dispatchItems = useMemo<DispatchItem[]>(() => {
    const today = new Date();

    const items: DispatchItem[] = [];
    salesOrders
      .filter((so) => so.status !== "Completed" && so.status !== "Closed" && so.status !== "Cancelled" && so.status !== "Draft")
      .forEach((so) => {
        so.lines
          .filter((line) => (line.stockAllocated ?? 0) > 0 && line.status !== "Dispatched" && line.status !== "Delivered")
          .forEach((line) => {
            const deliveryDate = new Date(line.requiredDeliveryDate ?? today);
            const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const priority: DispatchItem["priority"] =
              daysUntilDelivery <= 0 ? "Urgent" : daysUntilDelivery <= 3 ? "High" : "Normal";
            const hasPickPlan = pickPlans.some((p) => p.soNumber === so.soNumber && p.lines.some((l) => l.soLineId === line.id));

            items.push({
              soNumber: so.soNumber,
              soId: so.id,
              lineId: line.id,
              lineNumber: line.lineNumber,
              customer: so.customer,
              orderDate: so.orderDate,
              expectedDelivery: line.requiredDeliveryDate ?? "",
              paper: line.materialCode || "",
              gsm: line.gsm || 0,
              size: line.size || "",
              orderedQty: line.orderedQty,
              stockAllocated: line.stockAllocated ?? 0,
              daysUntilDelivery,
              priority,
              hasPickPlan,
            });
          });
      });

    // Sort by priority: Urgent → High → Normal, then by delivery date
    return items.sort((a, b) => {
      const priorityOrder = { Urgent: 0, High: 1, Normal: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.expectedDelivery).getTime() - new Date(b.expectedDelivery).getTime();
    });
  }, [salesOrders, stockLots, pickPlans]);

  const kpis = useMemo(() => {
    const total = dispatchItems.length;
    const urgent = dispatchItems.filter((d) => d.priority === "Urgent").length;
    const high = dispatchItems.filter((d) => d.priority === "High").length;
    const normal = dispatchItems.filter((d) => d.priority === "Normal").length;
    const totalQty = dispatchItems.reduce((sum, d) => sum + d.stockAllocated, 0);
    return { total, urgent, high, normal, totalQty };
  }, [dispatchItems]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Urgent": return "bg-red-100 text-red-700 border border-red-200";
      case "High": return "bg-orange-100 text-orange-700 border border-orange-200";
      case "Normal": return "bg-green-100 text-green-700 border border-green-200";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getDaysLabel = (days: number) => {
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, cls: "text-red-600 font-semibold" };
    if (days === 0) return { text: "Today", cls: "text-red-600 font-semibold" };
    if (days === 1) return { text: "Tomorrow", cls: "text-orange-600 font-medium" };
    return { text: `In ${days}d`, cls: "text-gray-600" };
  };

  // Open Pick Plan modal
  const handleCreatePickPlan = useCallback((item: DispatchItem) => {
    setSelectedItem(item);

    // Find available stock lots for this material (FIFO sorted)
    const today = new Date();
    const matchingLots = stockLots
      .filter((lot) =>
        lot.paper === item.paper &&
        lot.gsm === item.gsm &&
        lot.size === item.size &&
        lot.availableQty > 0 &&
        (lot.status === "Available" || lot.status === "Allocated")
      )
      .map((lot) => {
        const ageDays = Math.floor(
          (today.getTime() - new Date(lot.receivedDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          lotNumber: lot.lotNumber,
          binLocation: lot.binLocation,
          availableQty: lot.availableQty,
          receivedDate: lot.receivedDate,
          ageDays,
          selectedQty: 0,
        };
      })
      .sort((a, b) => new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()); // FIFO

    setStockBins(matchingLots);
    setShowPickPlanModal(true);
  }, [stockLots]);

  // Auto allocate FIFO
  const handleAutoAllocateFIFO = () => {
    if (!selectedItem) return;

    let remaining = selectedItem.stockAllocated;
    const updatedBins = stockBins.map(bin => {
      if (remaining <= 0) return { ...bin, selectedQty: 0 };

      const toAllocate = Math.min(remaining, bin.availableQty);
      remaining -= toAllocate;
      return { ...bin, selectedQty: toAllocate };
    });

    setStockBins(updatedBins);
  };

  // Update individual bin quantity
  const handleBinQtyChange = (binLocation: string, qty: number) => {
    setStockBins(bins =>
      bins.map(bin =>
        bin.binLocation === binLocation
          ? { ...bin, selectedQty: Math.min(qty, bin.availableQty) }
          : bin
      )
    );
  };

  // Calculate pick summary
  const pickSummary = useMemo(() => {
    const totalRequired = selectedItem?.stockAllocated || 0;
    const totalSelected = stockBins.reduce((sum, bin) => sum + bin.selectedQty, 0);
    const balance = totalRequired - totalSelected;
    const isValid = balance === 0;
    const isOverpick = balance < 0;

    return { totalRequired, totalSelected, balance, isValid, isOverpick };
  }, [selectedItem, stockBins]);

  // Save Pick Plan — allocates lots in context + creates pick plan record
  const handleSavePickPlan = useCallback(() => {
    if (!selectedItem || !pickSummary.isValid) return;

    const selectedBins = stockBins.filter((b) => b.selectedQty > 0);
    const now = new Date();
    const planId = `pp_${Date.now()}`;
    const planNumber = `PP-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      Date.now() % 10000
    ).padStart(4, "0")}`;

    // Build PickPlanLines from selected bins
    const lines: PickPlanLine[] = selectedBins.map((bin, idx) => ({
      id: `${planId}_line_${idx + 1}`,
      soLineId: selectedItem.lineId,
      paper: selectedItem.paper,
      gsm: selectedItem.gsm,
      size: selectedItem.size,
      qtyToPick: bin.selectedQty,
      lotNumber: bin.lotNumber,
      binLocation: bin.binLocation,
      qtyFromThisLot: bin.selectedQty,
      pickSequence: idx + 1,
      picked: false,
    }));

    // Find the lot id for each bin and call allocateLot
    selectedBins.forEach((bin) => {
      const lot = stockLots.find((l) => l.lotNumber === bin.lotNumber);
      if (lot) allocateLot(lot.id, bin.selectedQty);
    });

    const warehouse = stockLots.find((l) => l.lotNumber === selectedBins[0]?.lotNumber)?.warehouse ?? "";

    const newPlan: PickPlan = {
      id: planId,
      pickPlanNumber: planNumber,
      soNumber: selectedItem.soNumber,
      customer: selectedItem.customer,
      warehouse,
      lines,
      totalQty: pickSummary.totalSelected,
      createdDate: now.toISOString().slice(0, 10),
      plannedPickDate: selectedItem.expectedDelivery,
      status: "Pending",
    };

    addPickPlan(newPlan);

    // Auto-create a Challan in "Ready" status from the pick plan
    const so = salesOrders.find((s) => s.soNumber === selectedItem.soNumber);
    const challanLines: ChallanLine[] = lines.map((l) => ({
      id: `${planId}_cl_${l.pickSequence}`,
      soLineId: l.soLineId,
      paper: l.paper,
      gsm: l.gsm,
      size: l.size,
      orderedQty: l.qtyToPick,
      pickedQty: l.qtyToPick,
      quantity: l.qtyToPick,
      lotNumber: l.lotNumber,
      binLocation: l.binLocation,
    }));
    const challanId = `ch_${Date.now()}`;
    const challanNumber = `CH-${now.getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`;
    const newChallan: Challan = {
      id: challanId,
      challanNumber,
      challanDate: now.toISOString().slice(0, 10),
      soNumber: selectedItem.soNumber,
      pickPlanNumber: planNumber,
      truckLoadPlanNumber: "TLP-TBD",
      customer: selectedItem.customer,
      customerAddress: so?.lines[0]?.deliveryAddress ?? "",
      deliveryMode: deliveryMode,
      warehouse,
      expectedDeliveryDate: selectedItem.expectedDelivery,
      lines: challanLines,
      totalQty: pickSummary.totalSelected,
      totalWeight: 0,
      truckNumber: "",
      driverName: "",
      driverPhone: "",
      transporterName: "",
      status: "Ready",
    };
    addChallan(newChallan);

    success(`Pick Plan ${planNumber} created for ${selectedItem.soNumber}.`);
    setShowPickPlanModal(false);
    setSelectedItem(null);
    setStockBins([]);
    setDeliveryMode("Direct To Customer");
  }, [selectedItem, pickSummary, stockBins, stockLots, allocateLot, addPickPlan, success]);

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending Dispatch</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.total}</p>
              <p className="mt-0.5 text-xs text-gray-500">SO lines</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Urgent</p>
              <p className="mt-1.5 text-2xl font-bold text-red-600">{kpis.urgent}</p>
              <p className="mt-0.5 text-xs text-red-500">Overdue / Today</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">High Priority</p>
              <p className="mt-1.5 text-2xl font-bold text-orange-600">{kpis.high}</p>
              <p className="mt-0.5 text-xs text-orange-500">Within 3 days</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Normal</p>
              <p className="mt-1.5 text-2xl font-bold text-green-600">{kpis.normal}</p>
              <p className="mt-0.5 text-xs text-green-500">Plenty of time</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Qty</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{(kpis.totalQty / 1000).toFixed(0)}K</p>
              <p className="mt-0.5 text-xs text-gray-500">Sheets to dispatch</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <Truck className="h-5 w-5 text-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Queue Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Dispatch Queue — Stock Ready Lines</h2>
          <p className="text-xs text-gray-400">Sorted by priority &amp; delivery date</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Priority</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">SO / Line</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Material</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">Allocated Qty</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Delivery Date</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">ETA</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dispatchItems.map((item) => {
                const { text, cls } = getDaysLabel(item.daysUntilDelivery);
                return (
                  <tr key={`${item.soNumber}-${item.lineNumber}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPriorityBadge(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-blue-600">{item.soNumber}</div>
                      <div className="text-xs text-gray-400">Line {item.lineNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.customer}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.paper}</div>
                      <div className="text-xs text-gray-500">{item.gsm} GSM &middot; {item.size}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                      {item.stockAllocated.toLocaleString()} sht
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{item.expectedDelivery}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cls}>{text}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleCreatePickPlan(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors"
                      >
                        Create Pick Plan <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {dispatchItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No items in dispatch queue. Stock-allocated SO lines will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pick Plan Modal */}
      {showPickPlanModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Create Pick Plan</h2>
              <p className="text-sm text-gray-500 mt-1">Select stock bins in FIFO order for warehouse picking</p>
            </div>

            <div className="p-6 space-y-6">
              {/* SECTION 1: SO Header Info (Read-Only) */}
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">Sales Order Information (Read-Only)</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-blue-700 font-medium">SO Number</p>
                    <p className="mt-1 font-semibold text-blue-900">{selectedItem.soNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Line #</p>
                    <p className="mt-1 font-semibold text-blue-900">{selectedItem.lineNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Customer</p>
                    <p className="mt-1 font-semibold text-blue-900">{selectedItem.customer}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Priority</p>
                    <span className={`inline-flex mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPriorityBadge(selectedItem.priority)}`}>
                      {selectedItem.priority}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-blue-700 font-medium">Material</p>
                    <p className="mt-1 font-semibold text-blue-900">{selectedItem.paper}</p>
                    <p className="text-xs text-blue-700">{selectedItem.gsm} GSM · {selectedItem.size}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Ordered Qty</p>
                    <p className="mt-1 font-semibold text-blue-900">{selectedItem.orderedQty.toLocaleString()} sht</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Allocated Qty</p>
                    <p className="mt-1 font-semibold text-green-600">{selectedItem.stockAllocated.toLocaleString()} sht</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-blue-700 font-medium">Delivery Date</p>
                    <p className="mt-1 font-semibold text-blue-900">{selectedItem.expectedDelivery}</p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Warehouse Stock Selection (FIFO) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Select Stock Bins (FIFO Order)</h3>
                  <button
                    onClick={handleAutoAllocateFIFO}
                    className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto Allocate FIFO
                  </button>
                </div>

                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Lot Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Bin Location</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Available Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Received Date</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Age (Days)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Pick Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stockBins.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                            No matching stock found for this material
                          </td>
                        </tr>
                      ) : (
                        stockBins.map((bin, index) => (
                          <tr key={bin.binLocation} className={index === 0 ? "bg-green-50" : "hover:bg-gray-50"}>
                            <td className="px-4 py-3 font-medium text-blue-600">{bin.lotNumber}</td>
                            <td className="px-4 py-3 font-mono text-sm text-gray-900">{bin.binLocation}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {bin.availableQty.toLocaleString()} sht
                            </td>
                            <td className="px-4 py-3 text-gray-600">{bin.receivedDate}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                                bin.ageDays > 60 ? 'bg-red-50 text-red-700' :
                                bin.ageDays > 30 ? 'bg-yellow-50 text-yellow-700' :
                                'bg-green-50 text-green-700'
                              }`}>
                                {bin.ageDays} days
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                max={bin.availableQty}
                                value={bin.selectedQty}
                                onChange={(e) => handleBinQtyChange(bin.binLocation, parseInt(e.target.value) || 0)}
                                className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="0"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {stockBins.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded bg-green-50 border border-green-200"></span>
                      Oldest stock (FIFO priority)
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION 3: Pick Summary */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Pick Summary</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-600">Total Required</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{pickSummary.totalRequired.toLocaleString()} sht</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Total Selected</p>
                    <p className="mt-1 text-lg font-bold text-blue-600">{pickSummary.totalSelected.toLocaleString()} sht</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Balance</p>
                    <p className={`mt-1 text-lg font-bold ${
                      pickSummary.balance === 0 ? 'text-green-600' :
                      pickSummary.balance > 0 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {pickSummary.balance === 0 ? '✓ Matched' :
                       pickSummary.balance > 0 ? `${pickSummary.balance} short` :
                       `${Math.abs(pickSummary.balance)} over`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Status</p>
                    <p className="mt-1">
                      {pickSummary.isValid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Invalid
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {pickSummary.isOverpick && (
                  <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    <strong>Warning:</strong> You cannot pick more than the allocated quantity. Please adjust.
                  </div>
                )}
              </div>

              {/* SECTION 4: Dispatch Mode Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Dispatch Mode</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDeliveryMode("Direct To Customer")}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      deliveryMode === "Direct To Customer"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full border-2 ${
                        deliveryMode === "Direct To Customer"
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}>
                        {deliveryMode === "Direct To Customer" && (
                          <div className="h-full w-full rounded-full bg-white scale-50"></div>
                        )}
                      </div>
                      <span className="font-semibold text-gray-900">Direct To Customer</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Will generate challan directly for customer delivery
                    </p>
                  </button>

                  <button
                    onClick={() => setDeliveryMode("To Godown")}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      deliveryMode === "To Godown"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full border-2 ${
                        deliveryMode === "To Godown"
                          ? "border-blue-500 bg-blue-500"
                          : "border-gray-300"
                      }`}>
                        {deliveryMode === "To Godown" && (
                          <div className="h-full w-full rounded-full bg-white scale-50"></div>
                        )}
                      </div>
                      <span className="font-semibold text-gray-900">To Godown</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Move to inter-warehouse transfer
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button
                onClick={() => {
                  setShowPickPlanModal(false);
                  setSelectedItem(null);
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePickPlan}
                disabled={!pickSummary.isValid}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Pick Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
