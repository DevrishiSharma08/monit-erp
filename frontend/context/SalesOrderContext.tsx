"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { salesOrderApi, SalesOrderRow } from "@/lib/api-services";

// Shape the context exposes — keep field names compatible with the rest of the app.
// Integer ids from the API are converted to strings so pages that still
// reference mock data (coverage, dispatch-queue, challan …) are unaffected.

export interface SOLine {
  id: string;
  lineNumber: number;
  materialId: string;
  materialCode: string;
  gsm?: number;
  size?: string;
  unit?: string;
  orderedQty: number;
  weightKg?: number;
  qty?: number;
  rate: number;
  discount: number;
  finalPrice?: number;
  amount: number;
  deliveryAddress?: string;
  requiredDeliveryDate?: string;
  remarks?: string;
  status: string;
  allocatedQty: number;
  pendingQty: number;
  stockAllocated?: number;
  purchaseAllocated?: number;
  transitAllocated?: number;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  contactPersonId?: string;
  salesmanId?: string;
  deliveryPartyId?: string;
  customer: string;
  contactPerson?: string;
  customerPhone?: string;
  customerEmail?: string;
  salesman: string;
  deliveryParty?: string;
  deliveryPartyAddress?: string;
  orderDate: string;
  requiredDeliveryDate?: string;
  status: string;
  deliveryMode?: string;
  deliveryTerms?: string;
  paymentTerms: string;
  remarks?: string;
  insurancePolicyNo?: string;
  totalValue: number;
  lines: SOLine[];
  linkedPoIds?: string[];
}

function toSO(r: SalesOrderRow): SalesOrder {
  return {
    id:               String(r.id),
    soNumber:         r.soNumber,
    customerId:       String(r.customerId),
    contactPersonId:  r.contactPersonId != null ? String(r.contactPersonId) : undefined,
    salesmanId:       r.salesmanId != null ? String(r.salesmanId) : undefined,
    deliveryPartyId:  r.deliveryPartyId != null ? String(r.deliveryPartyId) : undefined,
    customer:         r.customer,
    contactPerson:    r.contactPerson,
    customerPhone:    r.customerPhone,
    customerEmail:    r.customerEmail,
    salesman:         r.salesman ?? "",
    deliveryParty:    r.deliveryParty,
    deliveryPartyAddress: r.deliveryPartyAddress,
    orderDate:        r.orderDate,
    requiredDeliveryDate: r.requiredDeliveryDate,
    status:           r.status,
    deliveryMode:     r.deliveryMode,
    deliveryTerms:    r.deliveryTerms,
    paymentTerms:     r.paymentTerms ?? "",
    remarks:          r.remarks,
    insurancePolicyNo: r.insurancePolicyNo,
    totalValue:       r.totalValue,
    lines: r.lines.map(l => ({
      id:               String(l.id),
      lineNumber:       l.lineNumber,
      materialId:       String(l.materialId),
      materialCode:     l.materialCode,
      gsm:              l.gsm,
      size:             l.size,
      unit:             l.unit,
      orderedQty:       l.orderedQty,
      weightKg:         l.weightKg,
      qty:              l.qty,
      rate:             l.rate,
      discount:         l.discount,
      finalPrice:       l.finalPrice,
      amount:           l.amount,
      deliveryAddress:  l.deliveryAddress,
      requiredDeliveryDate: l.requiredDeliveryDate,
      status:           l.status,
      allocatedQty:     l.allocatedQty,
      pendingQty:       l.pendingQty,
    })),
  };
}

interface SalesOrderContextValue {
  salesOrders:      SalesOrder[];
  loading:          boolean;
  reload:           () => void;
  addSalesOrder:    (so: SalesOrder) => void;
  updateSalesOrder: (id: string, patch: Partial<SalesOrder>) => void;
  deleteSalesOrder: (id: string) => Promise<void>;
  linkPO:           (soId: string, poNumber: string) => void;
  pendingPoSOs:     SalesOrder[];
}

const SalesOrderContext = createContext<SalesOrderContextValue | null>(null);

export function SalesOrderProvider({ children }: { children: ReactNode }) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tick, setTick]               = useState(0);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    salesOrderApi.list({ pageSize: 200 })
      .then(res  => { if (!stale) setSalesOrders(res.items.map(toSO)); })
      .catch(() => {})
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [tick]);

  const addSalesOrder = useCallback((so: SalesOrder) =>
    setSalesOrders(prev => [so, ...prev]), []);

  const updateSalesOrder = useCallback((id: string, patch: Partial<SalesOrder>) =>
    setSalesOrders(prev => prev.map(so => so.id === id ? { ...so, ...patch } : so)), []);

  const deleteSalesOrder = useCallback(async (id: string) => {
    await salesOrderApi.remove(Number(id));
    setSalesOrders(prev => prev.filter(so => so.id !== id));
  }, []);

  const linkPO = useCallback((soId: string, poNumber: string) =>
    setSalesOrders(prev =>
      prev.map(so =>
        so.id === soId
          ? { ...so, linkedPoIds: [...(so.linkedPoIds ?? []), poNumber] }
          : so
      )
    ), []);

  const pendingPoSOs = useMemo(
    () => salesOrders.filter(
      so => !["Cancelled", "Closed"].includes(so.status) &&
            (!so.linkedPoIds || so.linkedPoIds.length === 0)
    ),
    [salesOrders]
  );

  return (
    <SalesOrderContext.Provider
      value={{ salesOrders, loading, reload, addSalesOrder, updateSalesOrder, deleteSalesOrder, linkPO, pendingPoSOs }}
    >
      {children}
    </SalesOrderContext.Provider>
  );
}

export function useSalesOrder() {
  const ctx = useContext(SalesOrderContext);
  if (!ctx) throw new Error("useSalesOrder must be used within SalesOrderProvider");
  return ctx;
}
