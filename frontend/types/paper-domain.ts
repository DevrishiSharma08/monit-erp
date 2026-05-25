// Shared domain interfaces used across mill-tracker and truck-load-plan pages.
// Types that originated in mockData.ts are migrated here so pages can import
// without pulling in the entire mock dataset.

export interface PartialDelivery {
  id: string;
  batchNo: number;
  date: string;
  qty: number;
  truckNumber?: string;
  millInvoiceNo?: string;
  remarks?: string;
}

export interface MillTrackerHistoryLog {
  id: string;
  date: string;
  user: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  oldQty?: number;
  newQty?: number;
  remarks?: string;
}

export interface MillOrderTracker {
  id: string;
  poNumber: string;
  poItemId?: string;
  poDate: string;
  mill: string;
  millAddress?: string;
  millUnitId?: number;
  millUnitName?: string;

  paper: string;
  gsm: number;
  size: string;

  orderedQty: number;
  readyQty: number;
  dispatchedQty: number;
  balanceQty: number;

  rate: number;
  totalAmount: number;

  productionStatus: "Order Placed" | "In Production" | "Partial Ready" | "Ready" | "Dispatched" | "Delayed" | "Cancelled";
  productionProgress: number;

  expectedDelivery: string;
  actualDispatchDate?: string;
  lastUpdate: string;
  lastUpdatedBy?: string;

  delayDays?: number;

  soNumber?: string;
  deliveryMode?: "Direct To Customer" | "To Godown";
  millInvoiceNo?: string;

  history?: MillTrackerHistoryLog[];
  remarks?: string;

  customerName?: string;
  soCustomerName?: string;
  customerId?: string;
  millSONumber?: string;
  soDeliveryDate?: string;
  directDeliveryAddress?: string;

  partialDeliveries?: PartialDelivery[];
}

export interface TruckLoadPlanItem {
  id: string;
  trackerSourceId?: string;
  poNumber: string;
  poItemId?: string;
  soNumber?: string;
  soLineId?: string;

  paper: string;
  gsm: number;
  size: string;

  quantity: number;
  weightKg?: number;
  loadOrder: number;

  customerName?: string;
  deliveryLocation?: string;
  deliveryAddress?: string;

  millInvoiceNo?: string;
  deliveryBillNo?: string;
}

export interface TruckLoadPlan {
  id: string;
  planNumber: string;
  planDate: string;

  truckNumber?: string;
  truckType?: string;
  driverName?: string;
  driverPhone?: string;
  transporterName?: string;
  truckCapacityKg?: number;
  freightAmount?: number;

  origin: string;
  deliveryMode: "Direct To Customer" | "To Godown" | "Multi-Stop";

  plannedLoadDate: string;
  plannedDeliveryDate: string;
  actualLoadDate?: string;
  actualDeliveryDate?: string;

  items: TruckLoadPlanItem[];
  status: "Planned" | "Loading" | "Dispatched" | "Received";

  inTransitTrackerId?: string;
}
