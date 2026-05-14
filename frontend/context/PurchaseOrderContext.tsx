"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import {
  PurchaseOrder,
  MillOrderTracker,
  TruckLoadPlan,
  mockPurchaseOrders,
  mockMillTrackers,
  mockTruckLoadPlans,
} from "@/data/mockData";

interface PurchaseOrderContextValue {
  purchaseOrders: PurchaseOrder[];
  addPurchaseOrder: (po: PurchaseOrder) => void;
  updatePurchaseOrder: (id: string, patch: Partial<PurchaseOrder>) => void;

  millTrackers: MillOrderTracker[];
  addMillTracker: (tracker: MillOrderTracker) => void;
  updateMillTracker: (id: string, patch: Partial<MillOrderTracker>) => void;

  truckLoadPlans: TruckLoadPlan[];
  addTruckLoadPlan: (tlp: TruckLoadPlan) => void;
  updateTruckLoadPlan: (id: string, patch: Partial<TruckLoadPlan>) => void;
  deleteTruckLoadPlan: (id: string) => void;

  /** Mill tracker rows that have readyQty still unDispatched — shown on TLP page */
  readyTrackers: MillOrderTracker[];
  /** TLPs with status "In Transit" that haven't been fully GRN-ed yet */
  dispatchedTLPs: TruckLoadPlan[];
}

const PurchaseOrderContext = createContext<PurchaseOrderContextValue | null>(null);

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([...mockPurchaseOrders]);
  const [millTrackers, setMillTrackers] = useState<MillOrderTracker[]>([...mockMillTrackers]);
  const [truckLoadPlans, setTruckLoadPlans] = useState<TruckLoadPlan[]>([...mockTruckLoadPlans]);

  // ── Purchase Order mutations ───────────────────────────────────────────────

  const addPurchaseOrder = useCallback((po: PurchaseOrder) => {
    setPurchaseOrders((prev) => [po, ...prev]);

    // Auto-create MillOrderTracker entries per PO item
    const today = new Date().toISOString().split("T")[0];
    const newTrackers: MillOrderTracker[] = po.items.map((item, idx) => ({
      id: `${po.id}_tracker_${idx}`,
      poNumber: po.poNumber,
      poItemId: item.id,
      poDate: po.orderDate,
      mill: po.mill,
      paper: item.categoryName ?? item.materialCode ?? `Item ${item.itemNumber}`,
      gsm: item.gsm,
      size: item.size,
      orderedQty: item.orderedQty,
      readyQty: 0,
      dispatchedQty: 0,
      balanceQty: item.orderedQty,
      rate: item.rate,
      totalAmount: item.amount,
      productionStatus: "Order Placed" as const,
      productionProgress: 0,
      expectedDelivery: po.expectedDeliveryDate,
      lastUpdate: today,
      soNumber: item.soNumber,
      deliveryMode: po.deliveryMode,
      customerName: po.directCustomer || undefined,
    }));

    if (newTrackers.length > 0) {
      setMillTrackers((prev) => [...newTrackers, ...prev]);
    }
  }, []);

  const updatePurchaseOrder = useCallback(
    (id: string, patch: Partial<PurchaseOrder>) =>
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === id ? { ...po, ...patch } : po))
      ),
    []
  );

  // ── Mill Tracker mutations ─────────────────────────────────────────────────

  const addMillTracker = useCallback(
    (tracker: MillOrderTracker) =>
      setMillTrackers((prev) => [tracker, ...prev]),
    []
  );

  const updateMillTracker = useCallback(
    (id: string, patch: Partial<MillOrderTracker>) =>
      setMillTrackers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      ),
    []
  );

  // ── Truck Load Plan mutations ──────────────────────────────────────────────

  const addTruckLoadPlan = useCallback((tlp: TruckLoadPlan) => {
    setTruckLoadPlans((prev) => [tlp, ...prev]);
    // Update dispatched qty on each tracker referenced by the plan's items
    const today = new Date().toISOString().split("T")[0];
    tlp.items.forEach((item) => {
      setMillTrackers((prev) =>
        prev.map((t) => {
          const matchById = item.trackerSourceId && t.id === item.trackerSourceId;
          const matchByPO = !item.trackerSourceId && t.poNumber === item.poNumber;
          if (!matchById && !matchByPO) return t;
          const newDispatched = t.dispatchedQty + item.quantity;
          const newBalance = Math.max(0, t.orderedQty - newDispatched);
          const allDispatched = newDispatched >= t.readyQty;
          return {
            ...t,
            dispatchedQty: newDispatched,
            balanceQty: newBalance,
            productionStatus: allDispatched ? ("Dispatched" as const) : t.productionStatus,
            actualDispatchDate: today,
          };
        })
      );
    });
  }, []);

  const deleteTruckLoadPlan = useCallback(
    (id: string) =>
      setTruckLoadPlans((prev) => prev.filter((t) => t.id !== id)),
    []
  );

  const updateTruckLoadPlan = useCallback(
    (id: string, patch: Partial<TruckLoadPlan>) => {
      setTruckLoadPlans((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      // When TLP moves to In Transit / Delivered, update each referenced PO's status
      if (patch.status === "In Transit" || patch.status === "Delivered") {
        setTruckLoadPlans((prev) => {
          const tlp = prev.find((t) => t.id === id);
          if (!tlp?.items.length) return prev;
          const poNumbers = [...new Set(tlp.items.map((item) => item.poNumber))];
          const newStatus = patch.status === "Delivered" ? "Part Received" : "In Transit";
          setPurchaseOrders((pos) =>
            pos.map((po) =>
              poNumbers.includes(po.poNumber)
                ? { ...po, status: newStatus as PurchaseOrder["status"] }
                : po
            )
          );
          return prev;
        });
      }
    },
    []
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const readyTrackers = useMemo(
    () =>
      millTrackers.filter(
        (t) =>
          t.readyQty > t.dispatchedQty &&
          ["Ready", "Partial Ready"].includes(t.productionStatus)
      ),
    [millTrackers]
  );

  const dispatchedTLPs = useMemo(
    () => truckLoadPlans.filter((t) => t.status === "In Transit"),
    [truckLoadPlans]
  );

  return (
    <PurchaseOrderContext.Provider
      value={{
        purchaseOrders,
        addPurchaseOrder,
        updatePurchaseOrder,
        millTrackers,
        addMillTracker,
        updateMillTracker,
        truckLoadPlans,
        addTruckLoadPlan,
        updateTruckLoadPlan,
        deleteTruckLoadPlan,
        readyTrackers,
        dispatchedTLPs,
      }}
    >
      {children}
    </PurchaseOrderContext.Provider>
  );
}

export function usePurchaseOrder() {
  const ctx = useContext(PurchaseOrderContext);
  if (!ctx) throw new Error("usePurchaseOrder must be used within PurchaseOrderProvider");
  return ctx;
}
