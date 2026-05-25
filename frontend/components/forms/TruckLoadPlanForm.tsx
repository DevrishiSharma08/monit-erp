"use client";

import { useState, useMemo } from "react";
import { TruckLoadPlan, mockTransporters, mockMillTrackers, mockStockLots, mockCustomers, mockPurchaseOrders } from "@/data/mockData";
import { Truck, MapPin, Calendar, Package, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

interface TruckLoadPlanFormProps {
  initialData?: Partial<TruckLoadPlan>;
  onSubmit: (data: Partial<TruckLoadPlan>) => void;
  onCancel: () => void;
}

interface LoadItem {
  id: string;
  source: 'mill' | 'stock';
  sourceId: string;
  poNumber?: string;
  soNumber?: string;
  material: string;
  gsm: number;
  size: string;
  availableQty: number;
  selectedQty: number;
  destination: string;
  selected: boolean;
}

export function TruckLoadPlanForm({ initialData, onSubmit, onCancel }: TruckLoadPlanFormProps) {
  const [showMill, setShowMill] = useState(true);
  const [showStock, setShowStock] = useState(false);
  const sourceType = showMill ? 'mill' : 'stock'; // backward compat for submit
  const [formData, setFormData] = useState<Partial<TruckLoadPlan>>({
    planDate: new Date().toISOString().split('T')[0],
    status: 'Planned',
    deliveryMode: 'To Godown',
    ...initialData,
  });
  const [loadItems, setLoadItems] = useState<LoadItem[]>([]);
  const [truckCapacity, setTruckCapacity] = useState<number>(10); // MT

  // Get available items from both sources
  const availableItems = useMemo(() => {
    const items: LoadItem[] = [];

    if (showMill) {
      mockMillTrackers
        .filter((tracker) => tracker.readyQty > 0 && tracker.productionStatus === 'Ready')
        .forEach((tracker) => {
          items.push({
            id: `mill-${tracker.id}`,
            source: 'mill',
            sourceId: tracker.id,
            poNumber: tracker.poNumber,
            soNumber: tracker.soNumber,
            material: `${tracker.paper} ${tracker.gsm} GSM ${tracker.size}`,
            gsm: tracker.gsm,
            size: tracker.size,
            availableQty: tracker.readyQty,
            selectedQty: 0,
            destination: tracker.deliveryMode === 'Direct To Customer' ? 'Customer Address' : 'Godown',
            selected: false,
          });
        });
    }

    if (showStock) {
      mockStockLots
        .filter((lot) => lot.availableQty > 0)
        .forEach((lot) => {
          items.push({
            id: `stock-${lot.id}`,
            source: 'stock',
            sourceId: lot.id,
            soNumber: undefined,
            material: `${lot.paper} ${lot.gsm} GSM ${lot.size}`,
            gsm: lot.gsm,
            size: lot.size,
            availableQty: lot.availableQty,
            selectedQty: 0,
            destination: 'Customer Address',
            selected: false,
          });
        });
    }

    return items;
  }, [showMill, showStock]);

  const handleItemSelection = (itemId: string, checked: boolean) => {
    setLoadItems((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (checked) {
        if (existing) return prev;
        const item = availableItems.find((i) => i.id === itemId);
        if (!item) return prev;
        return [...prev, { ...item, selected: true, selectedQty: item.availableQty }];
      } else {
        return prev.filter((i) => i.id !== itemId);
      }
    });
  };

  const handleQtyChange = (itemId: string, qty: number) => {
    setLoadItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selectedQty: Math.min(qty, item.availableQty) } : item
      )
    );
  };

  const handleDestinationChange = (itemId: string, destination: string) => {
    setLoadItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, destination } : item))
    );
  };

  // Detect blind shipment POs among selected items
  const hasBlindShipment = useMemo(() => {
    return loadItems.some((item) => {
      if (!item.poNumber) return false;
      const po = mockPurchaseOrders.find((p) => p.poNumber === item.poNumber);
      return po?.shipmentMode === "Blind" || po?.blindShipment === true;
    });
  }, [loadItems]);

  const blindShipmentPOs = useMemo(() => {
    const poNums = new Set<string>();
    loadItems.forEach((item) => {
      if (!item.poNumber) return;
      const po = mockPurchaseOrders.find((p) => p.poNumber === item.poNumber);
      if (po?.shipmentMode === "Blind" || po?.blindShipment) poNums.add(item.poNumber);
    });
    return [...poNums];
  }, [loadItems]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalSheets = loadItems.reduce((sum, item) => sum + item.selectedQty, 0);
    // Approximate weight calculation (70 GSM, 24x36 = ~5kg per 1000 sheets)
    const totalWeightMT = loadItems.reduce((sum, item) => {
      const weightPerSheet = (item.gsm * parseFloat(item.size.split('x')[0]) * parseFloat(item.size.split('x')[1])) / 10000000;
      return sum + (item.selectedQty * weightPerSheet);
    }, 0);
    const loadUtilization = truckCapacity > 0 ? Math.round((totalWeightMT / truckCapacity) * 100) : 0;
    const uniqueDestinations = new Set(loadItems.map((i) => i.destination)).size;

    return { totalSheets, totalWeightMT, loadUtilization, uniqueDestinations };
  }, [loadItems, truckCapacity]);

  // Generate drop points from selected items
  const dropPoints = useMemo(() => {
    const grouped = loadItems.reduce((acc, item) => {
      if (!acc[item.destination]) {
        acc[item.destination] = { destination: item.destination, qty: 0, items: [] };
      }
      acc[item.destination].qty += item.selectedQty;
      acc[item.destination].items.push(item);
      return acc;
    }, {} as Record<string, { destination: string; qty: number; items: LoadItem[] }>);

    return Object.values(grouped);
  }, [loadItems]);

  const handleChange = (field: keyof TruckLoadPlan, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill truck details when transporter is selected
  const handleTransporterChange = (transporterName: string) => {
    const transporter = mockTransporters.find((t) => t.name === transporterName);
    setFormData((prev) => ({
      ...prev,
      transporterName,
      truckNumber: transporter?.numberPlate || prev.truckNumber || '',
      driverName: transporter?.contactPerson || prev.driverName || '',
      driverPhone: transporter?.phone || prev.driverPhone || '',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (loadItems.length === 0) {
      alert('Please select at least one item to load');
      return;
    }

    // Calculate aggregated values
    const totalQty = loadItems.reduce((sum, item) => sum + item.selectedQty, 0);
    const firstItem = loadItems[0];

    const planData: Partial<TruckLoadPlan> = {
      ...formData,
      origin: sourceType === 'mill' ? (loadItems[0]?.poNumber ? 'Mill' : 'Unknown') : 'Godown',
      deliveryMode: dropPoints.length > 1 ? 'Multi-Stop' : 'Direct To Customer',
      items: loadItems.map((item, idx) => ({
        id: `item_${Date.now()}_${idx}`,
        poNumber: item.poNumber ?? '',
        soNumber: item.soNumber,
        paper: item.material.split(' ')[0],
        gsm: item.gsm,
        size: item.size,
        quantity: item.selectedQty,
        loadOrder: loadItems.length - idx,
        deliveryLocation: dropPoints[idx]?.destination ?? dropPoints[0]?.destination ?? '',
        deliveryAddress: dropPoints[idx]?.destination ?? dropPoints[0]?.destination ?? '',
      })),
    };

    console.log('Plan Data:', planData);
    console.log('Load Items:', loadItems);
    // TODO: Update Mill Tracker dispatched qty, Stock Lots, and create In-Transit records

    onSubmit(planData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* SECTION A: Source Selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Package className="h-5 w-5 text-blue-500" />
          <h3 className="text-base font-semibold text-gray-900">Source Selection</h3>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Load Source(s) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMill}
                  onChange={(e) => { setShowMill(e.target.checked); setLoadItems([]); }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Mill Ready</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStock}
                  onChange={(e) => { setShowStock(e.target.checked); setLoadItems([]); }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Godown Stock</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">Select one or both sources to mix items from multiple mills and godown</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Plan Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.planDate || ''}
              onChange={(e) => handleChange('planDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={formData.status || 'Planned'}
              onChange={(e) => handleChange('status', e.target.value as TruckLoadPlan['status'])}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Planned">Planned</option>
              <option value="Loading">Loading</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Received">Received</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION B: Item Selection Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Package className="h-5 w-5 text-green-500" />
          <h3 className="text-base font-semibold text-gray-900">
            Select Items to Load
            {showMill && showStock ? ' (Mill + Godown)' : showMill ? ' (Mill Ready)' : showStock ? ' (Godown Stock)' : ''}
          </h3>
        </div>

        {availableItems.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {!showMill && !showStock
                ? 'Select at least one source (Mill Ready or Godown Stock)'
                : 'No items available from selected source(s)'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 w-12">Select</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">PO</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">SO</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Material</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Ready Qty</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Select Qty</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {availableItems.map((item) => {
                    const selected = loadItems.find((i) => i.id === item.id);
                    return (
                      <tr key={item.id} className={selected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={(e) => handleItemSelection(item.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.source === 'mill' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.source === 'mill' ? 'Mill' : 'Godown'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const poNum = 'poNumber' in item ? item.poNumber : undefined;
                            if (!poNum) return <span className="text-gray-400">—</span>;
                            const isBlind = mockPurchaseOrders.find((p) => p.poNumber === poNum)?.blindShipment;
                            return (
                              <span className="flex items-center gap-1.5">
                                <span className="font-medium text-blue-600">{poNum}</span>
                                {isBlind && (
                                  <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700">
                                    Blind
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-purple-600">{item.soNumber || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.material}</td>
                        <td className="px-4 py-3 text-gray-600">{item.availableQty.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {selected ? (
                            <input
                              type="number"
                              value={selected.selectedQty}
                              onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value) || 0)}
                              min="1"
                              max={item.availableQty}
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {selected ? (
                            <input
                              type="text"
                              value={selected.destination}
                              onChange={(e) => handleDestinationChange(item.id, e.target.value)}
                              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Enter address"
                            />
                          ) : (
                            <span className="text-gray-400">{item.destination}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* BLIND SHIPMENT — Invoice Swap Warning */}
      {hasBlindShipment && (
        <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
              <RefreshCw className="h-4.5 w-4.5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800">
                📄 Invoice Swap Required on Delivery
              </p>
              <p className="mt-0.5 text-xs text-orange-700">
                This truck load includes <strong>Blind Shipment</strong> PO(s):{" "}
                <span className="font-mono font-semibold">{blindShipmentPOs.join(", ")}</span>.
                The mill invoice shows <strong>Monit</strong> as the buyer — swap with the customer invoice before handover.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 font-medium text-orange-700">
                  🏭 Mill Invoice: Mill → Monit
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">
                  🧾 Customer Invoice: Monit → Customer
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
                  ⚠️ Do NOT hand mill invoice to customer
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION C: Truck Capacity Check */}
      {loadItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <Truck className="h-5 w-5 text-purple-500" />
            <h3 className="text-base font-semibold text-gray-900">Truck Capacity Check</h3>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Truck Capacity (MT)</label>
              <input
                type="number"
                value={truckCapacity}
                onChange={(e) => setTruckCapacity(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                step="0.1"
              />
            </div>

            <div className="col-span-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Sheets</p>
                    <p className="text-lg font-bold text-gray-900">{totals.totalSheets.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Approx Weight</p>
                    <p className="text-lg font-bold text-gray-900">{totals.totalWeightMT.toFixed(2)} MT</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Load Utilization</p>
                    <p className={`text-lg font-bold ${
                      totals.loadUtilization > 100 ? 'text-red-600' :
                      totals.loadUtilization < 70 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {totals.loadUtilization}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Drop Points</p>
                    <p className="text-lg font-bold text-gray-900">{totals.uniqueDestinations}</p>
                  </div>
                </div>

                {totals.loadUtilization > 100 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Overloaded by {(totals.totalWeightMT - truckCapacity).toFixed(2)} MT</span>
                  </div>
                )}

                {totals.loadUtilization < 70 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Underloaded by {(truckCapacity - totals.totalWeightMT).toFixed(2)} MT</span>
                  </div>
                )}

                {totals.loadUtilization >= 70 && totals.loadUtilization <= 100 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">Optimal load</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: Route & Drop Points */}
      {dropPoints.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
            <MapPin className="h-5 w-5 text-orange-500" />
            <h3 className="text-base font-semibold text-gray-900">Route & Drop Points</h3>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Drop No</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Destination</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dropPoints.map((drop, index) => (
                  <tr key={index} className="bg-white">
                    <td className="px-4 py-3 font-medium text-gray-900">Drop {index + 1}</td>
                    <td className="px-4 py-3 text-gray-600">{drop.destination}</td>
                    <td className="px-4 py-3 text-gray-600">{drop.qty.toLocaleString()} sheets</td>
                    <td className="px-4 py-3 text-gray-500">{drop.items.length} items</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION E: Truck & Transport Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Truck className="h-5 w-5 text-indigo-500" />
          <h3 className="text-base font-semibold text-gray-900">Truck & Transport Details</h3>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {/* Transporter — first, drives other fields */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Transporter <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.transporterName || ''}
              onChange={(e) => handleTransporterChange(e.target.value)}
              className="w-full rounded-lg border border-indigo-300 bg-indigo-50/30 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              <option value="">Select Transporter</option>
              {mockTransporters.filter((t) => t.status === 'Active').map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
            {/* Show transporter details below once selected */}
            {formData.transporterName && (() => {
              const t = mockTransporters.find((t) => t.name === formData.transporterName);
              if (!t) return null;
              return (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>Area: <span className="text-gray-700">{t.areaCovered}</span></span>
                  <span>Vehicles: <span className="text-gray-700">{t.vehicleTypes}</span></span>
                  <span>Rate: <span className="text-gray-700">₹{t.ratePerMT}/MT</span></span>
                  {'⭐'.repeat(t.serviceRating)}
                </div>
              );
            })()}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Truck Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.truckNumber || ''}
              onChange={(e) => handleChange('truckNumber', e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Auto-filled from Transporter Master"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Driver / Contact Person</label>
            <input
              type="text"
              value={formData.driverName || ''}
              onChange={(e) => handleChange('driverName', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Auto-filled from Transporter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Driver Phone</label>
            <input
              type="tel"
              value={formData.driverPhone || ''}
              onChange={(e) => handleChange('driverPhone', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Auto-filled from Transporter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Planned Load Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.plannedLoadDate || ''}
              onChange={(e) => handleChange('plannedLoadDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Planned Delivery Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.plannedDeliveryDate || ''}
              onChange={(e) => handleChange('plannedDeliveryDate', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          {formData.status === 'Dispatched' || formData.status === 'Received' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">LR Number</label>
                <input
                  type="text"
                  value={formData.inTransitTrackerId || ''}
                  onChange={(e) => handleChange('inTransitTrackerId', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="LR-12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Actual Load Date</label>
                <input
                  type="date"
                  value={formData.actualLoadDate || ''}
                  onChange={(e) => handleChange('actualLoadDate', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </>
          ) : null}

          {formData.status === 'Received' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Actual Received Date</label>
              <input
                type="date"
                value={formData.actualDeliveryDate || ''}
                onChange={(e) => handleChange('actualDeliveryDate', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loadItems.length === 0}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {initialData?.id ? 'Update Plan' : 'Create Plan'}
        </button>
      </div>
    </form>
  );
}
