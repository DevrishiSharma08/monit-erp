"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
  useCallback,
} from "react";
import {
  StockLot, GRN, PickPlan, Challan, InTransitTracking,
  mockStockLots, mockGRNs, mockPickPlans, mockChallans, mockInTransitTrackings,
} from "@/data/mockData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockContextValue {
  // ── State ──────────────────────────────────────────────────────────────────
  stockLots: StockLot[];
  grns: GRN[];

  // ── GRN mutations ──────────────────────────────────────────────────────────
  addGRN: (grn: GRN) => void;
  updateGRN: (id: string, patch: Partial<GRN>) => void;
  deleteGRN: (id: string) => void;

  /**
   * Called when a GRN is approved (status → "Stock Updated").
   * Creates a new StockLot from the GRN and updates the GRN status.
   */
  addToStock: (grn: GRN) => void;

  // ── StockLot mutations ─────────────────────────────────────────────────────
  updateStockLot: (id: string, patch: Partial<StockLot>) => void;
  deleteStockLot: (id: string) => void;

  /**
   * Allocate `qty` units from a specific lot (SO reservation).
   * Increases allocatedQty, decreases availableQty.
   */
  allocateLot: (lotId: string, qty: number) => void;

  /**
   * Release a previous allocation (e.g. SO cancelled or reduced).
   */
  deallocateLot: (lotId: string, qty: number) => void;

  /**
   * Mark `qty` as dispatched — permanently removes from currentQty.
   */
  dispatchLot: (lotId: string, qty: number) => void;

  // ── Pick Plan mutations ────────────────────────────────────────────────────
  pickPlans: PickPlan[];
  addPickPlan: (plan: PickPlan) => void;
  updatePickPlan: (id: string, patch: Partial<PickPlan>) => void;

  // ── Challan mutations ──────────────────────────────────────────────────────
  challans: Challan[];
  addChallan: (challan: Challan) => void;
  updateChallan: (id: string, patch: Partial<Challan>) => void;

  // ── In-Transit mutations ───────────────────────────────────────────────────
  inTransitTrackings: InTransitTracking[];
  addInTransitTracking: (tracking: InTransitTracking) => void;
  updateInTransitTracking: (id: string, patch: Partial<InTransitTracking>) => void;

  // ── Queries ────────────────────────────────────────────────────────────────
  /** Sum of availableQty across all lots with the given materialId. */
  getAvailableByMaterial: (materialId: string) => number;

  /** All lots for a given materialId, sorted by receivedDate (FIFO). */
  getLotsByMaterial: (materialId: string) => StockLot[];

  /** KPI helpers */
  totalAvailableSheets: number;
  totalAllocatedSheets: number;
  totalStockValue: number; // placeholder (qty * 0 until rates linked)
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StockContext = createContext<StockContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StockProvider({ children }: { children: ReactNode }) {
  const [stockLots, setStockLots] = useState<StockLot[]>([...mockStockLots]);
  const [grns, setGRNs] = useState<GRN[]>([...mockGRNs]);
  const [pickPlans, setPickPlans] = useState<PickPlan[]>([...mockPickPlans]);
  const [challans, setChallans] = useState<Challan[]>([...mockChallans]);
  const [inTransitTrackings, setInTransitTrackings] = useState<InTransitTracking[]>([...mockInTransitTrackings]);

  // ── GRN mutations ──────────────────────────────────────────────────────────

  const addGRN = useCallback(
    (grn: GRN) => setGRNs((prev) => [grn, ...prev]),
    []
  );

  const updateGRN = useCallback(
    (id: string, patch: Partial<GRN>) =>
      setGRNs((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
      ),
    []
  );

  /**
   * Approve a GRN → create a StockLot and mark GRN as "Stock Updated".
   */
  const addToStock = useCallback((grn: GRN) => {
    const lotId = `lot_${Date.now()}`;
    const lotNumber = `LOT-${new Date().getFullYear()}-${String(
      Date.now() % 100000
    ).padStart(5, "0")}`;

    const newLot: StockLot = {
      id: lotId,
      lotNumber,
      paper: grn.paper,
      materialId: grn.materialId,
      gsm: grn.gsm,
      size: grn.size,
      mill: grn.mill,
      receivedQty: grn.receivedQty,
      currentQty: grn.receivedQty,
      allocatedQty: 0,
      availableQty: grn.receivedQty,
      receivedDate: grn.grnDate,
      grnNumber: grn.grnNumber,
      binLocation: grn.binLocation ?? "",
      warehouse: grn.warehouse,
      status: "Available",
      quality: grn.qualityGrade === "A Grade" ? "A Grade"
        : grn.qualityGrade === "B Grade" ? "B Grade"
        : "Damaged",
    };

    setStockLots((prev) => [newLot, ...prev]);
    setGRNs((prev) =>
      prev.map((g) =>
        g.id === grn.id ? { ...g, status: "Stock Updated" as GRN["status"] } : g
      )
    );
  }, []);

  const deleteGRN = useCallback(
    (id: string) => setGRNs((prev) => prev.filter((g) => g.id !== id)),
    []
  );

  // ── StockLot mutations ─────────────────────────────────────────────────────

  const updateStockLot = useCallback(
    (id: string, patch: Partial<StockLot>) =>
      setStockLots((prev) =>
        prev.map((lot) => (lot.id === id ? { ...lot, ...patch } : lot))
      ),
    []
  );

  const deleteStockLot = useCallback(
    (id: string) => setStockLots((prev) => prev.filter((l) => l.id !== id)),
    []
  );

  const allocateLot = useCallback((lotId: string, qty: number) => {
    setStockLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;
        const newAllocated = lot.allocatedQty + qty;
        const newAvailable = lot.currentQty - newAllocated;
        return {
          ...lot,
          allocatedQty: newAllocated,
          availableQty: Math.max(0, newAvailable),
          status: newAvailable <= 0 ? "Allocated" : "Allocated",
        };
      })
    );
  }, []);

  const deallocateLot = useCallback((lotId: string, qty: number) => {
    setStockLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;
        const newAllocated = Math.max(0, lot.allocatedQty - qty);
        const newAvailable = lot.currentQty - newAllocated;
        return {
          ...lot,
          allocatedQty: newAllocated,
          availableQty: newAvailable,
          status: newAllocated === 0 ? "Available" : "Allocated",
        };
      })
    );
  }, []);

  const dispatchLot = useCallback((lotId: string, qty: number) => {
    setStockLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;
        const newCurrent = Math.max(0, lot.currentQty - qty);
        const newAllocated = Math.max(0, lot.allocatedQty - qty);
        const newAvailable = newCurrent - newAllocated;
        return {
          ...lot,
          currentQty: newCurrent,
          allocatedQty: newAllocated,
          availableQty: Math.max(0, newAvailable),
          status: newCurrent === 0 ? "Depleted" : newAllocated > 0 ? "Allocated" : "Available",
        };
      })
    );
  }, []);

  // ── Pick Plan mutations ────────────────────────────────────────────────────

  const addPickPlan = useCallback(
    (plan: PickPlan) => setPickPlans((prev) => [plan, ...prev]),
    []
  );

  const updatePickPlan = useCallback(
    (id: string, patch: Partial<PickPlan>) =>
      setPickPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      ),
    []
  );

  // ── Challan mutations ──────────────────────────────────────────────────────

  const addChallan = useCallback(
    (challan: Challan) => setChallans((prev) => [challan, ...prev]),
    []
  );

  const updateChallan = useCallback(
    (id: string, patch: Partial<Challan>) =>
      setChallans((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      ),
    []
  );

  // ── In-Transit mutations ───────────────────────────────────────────────────

  const addInTransitTracking = useCallback(
    (tracking: InTransitTracking) =>
      setInTransitTrackings((prev) => [tracking, ...prev]),
    []
  );

  const updateInTransitTracking = useCallback(
    (id: string, patch: Partial<InTransitTracking>) =>
      setInTransitTrackings((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      ),
    []
  );

  // ── Queries ────────────────────────────────────────────────────────────────

  const getAvailableByMaterial = useCallback(
    (materialId: string) =>
      stockLots
        .filter((lot) => lot.materialId === materialId && lot.status !== "Depleted")
        .reduce((sum, lot) => sum + lot.availableQty, 0),
    [stockLots]
  );

  const getLotsByMaterial = useCallback(
    (materialId: string) =>
      stockLots
        .filter((lot) => lot.materialId === materialId)
        .sort(
          (a, b) =>
            new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()
        ),
    [stockLots]
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalAvailableSheets = useMemo(
    () =>
      stockLots
        .filter((l) => l.status !== "Depleted")
        .reduce((s, l) => s + l.availableQty, 0),
    [stockLots]
  );

  const totalAllocatedSheets = useMemo(
    () => stockLots.reduce((s, l) => s + l.allocatedQty, 0),
    [stockLots]
  );

  const totalStockValue = 0; // Will be computed once purchase rates are linked

  return (
    <StockContext.Provider
      value={{
        stockLots,
        grns,
        addGRN,
        updateGRN,
        deleteGRN,
        addToStock,
        updateStockLot,
        deleteStockLot,
        allocateLot,
        deallocateLot,
        dispatchLot,
        pickPlans,
        addPickPlan,
        updatePickPlan,
        challans,
        addChallan,
        updateChallan,
        inTransitTrackings,
        addInTransitTracking,
        updateInTransitTracking,
        getAvailableByMaterial,
        getLotsByMaterial,
        totalAvailableSheets,
        totalAllocatedSheets,
        totalStockValue,
      }}
    >
      {children}
    </StockContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStock() {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStock must be used within StockProvider");
  return ctx;
}
