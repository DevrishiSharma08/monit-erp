"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { poApi, PORow, millTrackerApi, MillTrackerRow, truckLoadPlanApi, TruckLoadPlanApiDto } from "@/lib/api-services";

// These types are still used by pages that haven't migrated to the API row types yet
import {
  PurchaseOrder,
  MillOrderTracker,
  TruckLoadPlan,
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

  reload: () => void;

  /** Mill tracker rows that have readyQty still unDispatched — shown on TLP page */
  readyTrackers: MillOrderTracker[];
  /** TLPs with status "Dispatched" that haven't been fully GRN-ed yet */
  dispatchedTLPs: TruckLoadPlan[];
}

const PurchaseOrderContext = createContext<PurchaseOrderContextValue | null>(null);

// ── Shape mappers ─────────────────────────────────────────────────────────────

function toPurchaseOrder(r: PORow): PurchaseOrder {
  return {
    id:                   String(r.id),
    poNumber:             r.poNumber,
    mill:                 r.millName,
    millId:               String(r.millId),
    orderDate:            r.orderDate,
    expectedDeliveryDate: r.expectedDeliveryDate,
    status:               r.status as PurchaseOrder["status"],
    poType:               r.poType as PurchaseOrder["poType"],
    deliveryMode:         r.deliveryMode as PurchaseOrder["deliveryMode"],
    shipmentMode:         r.shipmentMode,
    blindShipment:        r.blindShipment,
    invoiceParty:         r.invoiceParty,
    invoicePartyId:       r.invoicePartyId != null ? String(r.invoicePartyId) : undefined,
    directCustomer:       r.directCustomer,
    directCustomerId:     r.directCustomerId != null ? String(r.directCustomerId) : undefined,
    directDeliveryAddress: r.directDeliveryAddress,
    millSONumber:         r.millSONumber,
    paymentTerms:         r.paymentTerms,
    gstPercentage:        r.gstPercentage,
    totalQuantity:        r.totalQuantity,
    totalValue:           r.totalValue,
    remarks:              r.remarks,
    specialInstructions:  r.specialInstructions,
    linkedSOId:           r.linkedSOId != null ? String(r.linkedSOId) : undefined,
    linkedSONumber:       r.linkedSONumber,
    items: r.items.map(i => ({
      id:              String(i.id),
      itemNumber:      i.lineNumber,
      materialId:      String(i.materialId),
      materialCode:    i.description ?? "",
      categoryName:    i.description,
      gsm:             i.gsm ?? 0,
      size:            i.size ?? "",
      unit:            i.unit,
      orderedQty:      i.quantity,
      receivedQty:     i.receivedQty,
      pendingQty:      i.pendingQty,
      rate:            i.rate,
      discount:        i.discount ?? 0,
      amount:          i.amount,
      linkedSOLineId:  i.linkedSOLineId != null ? String(i.linkedSOLineId) : undefined,
      soNumber:        undefined,
      remark:          i.remark,
      status:          "Pending" as const,
    })),
  } as PurchaseOrder;
}

function toMillTracker(r: MillTrackerRow): MillOrderTracker {
  return {
    id:                  String(r.id),
    poNumber:            r.poNumber,
    poItemId:            r.poItemId != null ? String(r.poItemId) : undefined,
    poDate:              r.poDate ?? "",
    mill:                r.mill,
    paper:               r.paper ?? "",
    gsm:                 r.gsm ?? 0,
    size:                r.size ?? "",
    orderedQty:          r.orderedQty,
    readyQty:            r.readyQty,
    dispatchedQty:       r.dispatchedQty,
    balanceQty:          r.balanceQty,
    rate:                r.rate,
    totalAmount:         r.totalAmount,
    productionStatus:    r.productionStatus as MillOrderTracker["productionStatus"],
    productionProgress:  r.productionProgress,
    expectedDelivery:    r.expectedDelivery ?? "",
    actualDispatchDate:  r.actualDispatchDate,
    lastUpdate:          r.lastUpdate ?? "",
    lastUpdatedBy:       r.lastUpdatedBy,
    delayDays:           r.delayDays,
    soNumber:            r.soNumber,
    deliveryMode:        r.deliveryMode as MillOrderTracker["deliveryMode"],
    customerName:        r.customerName,
    customerId:          r.customerId != null ? String(r.customerId) : undefined,
    millSONumber:        r.millSONumber,
    soDeliveryDate:      r.soDeliveryDate,
    directDeliveryAddress: r.directDeliveryAddress,
    remarks:             r.remarks,
    history:             (r.history ?? []).map(h => ({
      id: String(h.id), date: h.updatedAt, user: h.updatedBy,
      action: h.action, oldStatus: h.oldStatus, newStatus: h.newStatus,
      oldQty: h.oldQty, newQty: h.newQty, remarks: h.remarks,
    })),
    partialDeliveries:   (r.batches ?? []).map(b => ({
      id: String(b.id), batchNo: b.batchNo, date: b.deliveryDate ?? "",
      qty: b.quantity, truckNumber: b.truckNumber, millInvoiceNo: b.millInvoiceNo, remarks: b.remarks,
    })),
  } as MillOrderTracker;
}

function toTruckLoadPlan(r: TruckLoadPlanApiDto): TruckLoadPlan {
  return {
    id:                   String(r.id),
    planNumber:           r.planNumber,
    planDate:             r.planDate,
    truckNumber:          r.truckNumber,
    truckType:            r.truckType,
    transporterName:      r.transporterName,
    driverName:           r.driverName,
    driverPhone:          r.driverPhone,
    truckCapacityKg:      r.truckCapacityKg,
    freightAmount:        r.freightAmount,
    origin:               r.origin,
    deliveryMode:         r.deliveryMode as TruckLoadPlan["deliveryMode"],
    millInvoiceNo:        r.millInvoiceNo,
    deliveryBillNo:       r.deliveryBillNo,
    plannedLoadDate:      r.plannedLoadDate,
    plannedDeliveryDate:  r.plannedDeliveryDate,
    actualLoadDate:       r.actualLoadDate,
    actualDeliveryDate:   r.actualDeliveryDate,
    status:               r.status as TruckLoadPlan["status"],
    remarks:              r.remarks,
    items: r.items.map(i => ({
      id:               String(i.id),
      trackerSourceId:  i.trackerId != null ? String(i.trackerId) : undefined,
      poNumber:         i.poNumber ?? "",
      soNumber:         i.soNumber,
      paper:            i.paper ?? "",
      gsm:              i.gsm ?? 0,
      size:             i.size ?? "",
      customerName:     i.customerName,
      mill:             i.mill,
      quantity:         i.quantity,
      weightKg:         i.weightKg,
      loadOrder:        i.loadOrder,
      deliveryLocation: i.deliveryLocation,
      deliveryAddress:  i.deliveryAddress,
      millInvoiceNo:    i.millInvoiceNo,
      deliveryBillNo:   i.deliveryBillNo,
    })),
  } as TruckLoadPlan;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [millTrackers,   setMillTrackers]   = useState<MillOrderTracker[]>([]);
  const [truckLoadPlans, setTruckLoadPlans] = useState<TruckLoadPlan[]>([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      poApi.list({ pageSize: 200 }).catch(() => null),
      millTrackerApi.list({ pageSize: 200 }).catch(() => null),
      truckLoadPlanApi.list({ pageSize: 200 }).catch(() => null),
    ]).then(([pos, trackers, tlps]) => {
      if (cancelled) return;
      if (pos)      setPurchaseOrders(pos.items.map(toPurchaseOrder));
      if (trackers) setMillTrackers(trackers.items.map(toMillTracker));
      if (tlps)     setTruckLoadPlans(tlps.items.map(toTruckLoadPlan));
    });
    return () => { cancelled = true; };
  }, [tick]);

  // ── Purchase Order mutations ───────────────────────────────────────────────

  const addPurchaseOrder = useCallback((po: PurchaseOrder) => {
    setPurchaseOrders(prev => [po, ...prev]);
  }, []);

  const updatePurchaseOrder = useCallback(
    (id: string, patch: Partial<PurchaseOrder>) =>
      setPurchaseOrders(prev => prev.map(po => po.id === id ? { ...po, ...patch } : po)),
    []
  );

  // ── Mill Tracker mutations ─────────────────────────────────────────────────

  const addMillTracker = useCallback(
    (tracker: MillOrderTracker) => setMillTrackers(prev => [tracker, ...prev]),
    []
  );

  const updateMillTracker = useCallback(
    (id: string, patch: Partial<MillOrderTracker>) =>
      setMillTrackers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t)),
    []
  );

  // ── Truck Load Plan mutations ──────────────────────────────────────────────

  const addTruckLoadPlan = useCallback((tlp: TruckLoadPlan) => {
    setTruckLoadPlans(prev => [tlp, ...prev]);
  }, []);

  const deleteTruckLoadPlan = useCallback(
    (id: string) => setTruckLoadPlans(prev => prev.filter(t => t.id !== id)),
    []
  );

  const updateTruckLoadPlan = useCallback(
    (id: string, patch: Partial<TruckLoadPlan>) =>
      setTruckLoadPlans(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t)),
    []
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const readyTrackers = useMemo(
    () => millTrackers.filter(
      t => t.readyQty > t.dispatchedQty && ["Ready", "Partial Ready"].includes(t.productionStatus)
    ),
    [millTrackers]
  );

  const dispatchedTLPs = useMemo(
    () => truckLoadPlans.filter(t => t.status === "Dispatched"),
    [truckLoadPlans]
  );

  return (
    <PurchaseOrderContext.Provider
      value={{
        purchaseOrders, addPurchaseOrder, updatePurchaseOrder,
        millTrackers, addMillTracker, updateMillTracker,
        truckLoadPlans, addTruckLoadPlan, updateTruckLoadPlan, deleteTruckLoadPlan,
        reload,
        readyTrackers, dispatchedTLPs,
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
