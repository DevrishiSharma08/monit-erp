"use client";

import { PermGuard } from "@/components/PermGuard";

import { useMemo, useState } from "react";
import { InTransitTracking } from "@/data/mockData";
import { useStock } from "@/context/StockContext";
import { Truck, MapPin, Clock, CheckCircle, Upload, Edit3, AlertTriangle, FileText, Camera } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { fmtDateIN } from "@/lib/formatters";

function InTransitPage() {
  const { inTransitTrackings } = useStock();
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState<InTransitTracking | null>(null);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showDropDetailsModal, setShowDropDetailsModal] = useState(false);
  const [showPODUploadModal, setShowPODUploadModal] = useState(false);

  // Calculate days in transit
  const calculateDaysInTransit = (dispatchedDate: string) => {
    const dispatched = new Date(dispatchedDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - dispatched.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Check if overdue
  const isOverdue = (eta: string, status: string) => {
    if (status === "Received") return false;
    const etaDate = new Date(eta);
    const today = new Date();
    return etaDate < today;
  };

  const kpis = useMemo(() => {
    const total = inTransitTrackings.length;
    const dispatched = inTransitTrackings.filter((t) => t.status === "Dispatched").length;
    const reachedDest = inTransitTrackings.filter((t) => t.status === "Reached Destination").length;
    const received = inTransitTrackings.filter((t) => t.status === "Received").length;
    const overdue = inTransitTrackings.filter((t) => isOverdue(t.expectedArrival, t.status)).length;
    return { total, dispatched, reachedDest, received, overdue };
  }, [inTransitTrackings]);

  const statusOptions = useMemo(
    () => [
      { label: "Loading", value: "Loading" },
      { label: "Dispatched", value: "Dispatched" },
      { label: "Reached Destination", value: "Reached Destination" },
      { label: "Unloading", value: "Unloading" },
      { label: "Received", value: "Received" },
      { label: "Delayed", value: "Delayed" },
    ],
    []
  );

  const deliveryModeOptions = useMemo(
    () => [
      { label: "Direct To Customer", value: "Direct To Customer" },
      { label: "To Godown", value: "To Godown" },
    ],
    []
  );

  const columns: ColumnConfig<InTransitTracking>[] = useMemo(
    () => [
      {
        id: "trackingNumber",
        accessorKey: "trackingNumber",
        header: "Tracking #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 150,
        cell: (info) => (
          <span className="font-medium text-gray-900">{info.getValue() as string}</span>
        ),
      },
      {
        id: "truckNumber",
        accessorKey: "truckNumber",
        header: "Truck #",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-gray-900">{info.getValue() as string}</span>
        ),
      },
      {
        id: "challanNumber",
        accessorKey: "challanNumber",
        header: "Challan #",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => {
          const challan = info.getValue() as string | undefined;
          return challan ? (
            <span className="text-blue-600 font-medium">{challan}</span>
          ) : (
            <span className="text-gray-400">—</span>
          );
        },
      },
      {
        id: "route",
        accessorKey: "origin",
        header: "Route",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 250,
        cell: (info) => {
          const tracking = info.row.original;
          return (
            <div className="text-sm">
              <div className="font-medium text-gray-900">{tracking.origin}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <span>→</span>
                <span>{tracking.destination}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "deliveryMode",
        accessorKey: "deliveryMode",
        header: "Delivery Mode",
        filterType: "select",
        filterOptions: deliveryModeOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 160,
        cell: (info) => {
          const mode = info.getValue() as string;
          const colors = mode === "Direct To Customer"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-blue-50 text-blue-700 border-blue-200";
          return (
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colors}`}>
              {mode}
            </span>
          );
        },
      },
      {
        id: "dispatchedDate",
        accessorKey: "dispatchedDate",
        header: "Dispatched",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => <span className="tabular-nums">{fmtDateIN(info.getValue() as string)}</span>,
        exportValue: (r) => fmtDateIN((r as any).dispatchedDate),
      },
      {
        id: "expectedArrival",
        accessorKey: "expectedArrival",
        header: "ETA",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => {
          const raw = info.getValue() as string;
          const isOverdue = raw && new Date(raw) < new Date();
          return (
            <div className="text-sm">
              <div className={isOverdue ? "text-red-600 font-medium tabular-nums" : "text-gray-900 tabular-nums"}>
                {fmtDateIN(raw)}
              </div>
              {isOverdue && <div className="text-xs text-red-500">Delayed</div>}
            </div>
          );
        },
        exportValue: (r) => fmtDateIN((r as any).expectedArrival),
      },
      {
        id: "currentLocation",
        accessorKey: "currentLocation",
        header: "Current Location",
        filterType: "text",
        enableSorting: false,
        defaultVisible: true,
        size: 180,
        cell: (info) => {
          const location = info.getValue() as string | undefined;
          return location ? (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-gray-900">{location}</span>
            </div>
          ) : (
            <span className="text-gray-400 text-xs">No update</span>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: statusOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 160,
        cell: (info) => {
          const status = info.getValue() as string;
          const colors = {
            "Dispatched": "bg-blue-100 text-blue-700",
            "Reached Destination": "bg-purple-100 text-purple-700",
            "Received": "bg-green-100 text-green-700",
          };
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status as keyof typeof colors]}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: "daysInTransit",
        accessorKey: "dispatchedDate",
        header: "Days in Transit",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => {
          const days = calculateDaysInTransit(info.getValue() as string);
          const colorClass =
            days === 0 || days === 1
              ? "bg-green-50 text-green-700 border-green-200"
              : days === 2
              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
              : "bg-red-50 text-red-700 border-red-200";
          return (
            <span className={`inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold ${colorClass}`}>
              {days} {days === 1 ? "day" : "days"}
            </span>
          );
        },
      },
      {
        id: "_actions",
        accessorKey: "id",
        header: "Actions",
        filterType: "none",
        enableSorting: false,
        enableHiding: false,
        defaultVisible: true,
        size: 200,
        cell: (info) => {
          const tracking = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTracking(tracking);
                  setShowStatusUpdateModal(true);
                }}
                className="flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Update
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTracking(tracking);
                  setShowPODUploadModal(true);
                }}
                className="flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:bg-green-100 transition-colors"
                title="Upload POD"
              >
                <FileText className="h-3.5 w-3.5" />
                POD
              </button>
            </div>
          );
        },
      },
    ],
    [statusOptions, deliveryModeOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Shipments</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.total}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Truck className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Dispatched</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.dispatched}</p>
              <p className="mt-0.5 text-xs text-blue-600">Just started</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Reached</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.reachedDest}</p>
              <p className="mt-0.5 text-xs text-purple-600">At destination</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
              <MapPin className="h-5 w-5 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Received</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.received}</p>
              <p className="mt-0.5 text-xs text-green-600">Completed</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Overdue</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.overdue}</p>
              <p className="mt-0.5 text-xs text-red-600">Delayed shipments</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar with Bulk Update */}
      <div className="flex items-center justify-between gap-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 flex-1">
          <div className="flex gap-3">
            <Truck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold">Real-time Shipment Tracking</p>
              <p className="mt-1 text-blue-700">
                Track all shipments from dispatch to delivery. Update statuses, upload documents, and monitor transit times.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowBulkUpdateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-3 text-sm font-medium text-white hover:bg-purple-600 transition-colors shadow-md whitespace-nowrap"
        >
          <Upload className="h-4 w-4" />
          Bulk Update Status
        </button>
      </div>

      {/* Data Grid */}
      <DataGrid
        data={inTransitTrackings}
        columns={columns}
        tableName="in-transit"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        onRowClick={(tracking) => {
          setSelectedTracking(tracking);
          setShowDropDetailsModal(true);
        }}
        emptyMessage="No shipments in transit. Shipments appear here after challan dispatch."
      />

      {/* Status Update Modal */}
      {showStatusUpdateModal && selectedTracking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Update Status - {selectedTracking.trackingNumber}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <option value="Dispatched">Dispatched</option>
                  <option value="Reached Destination">Reached Destination</option>
                  <option value="Unloading">Unloading</option>
                  <option value="Received">Received</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Location</label>
                <input
                  type="text"
                  placeholder="e.g., Toll Plaza, NH-12"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Add any additional notes..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photo Upload (Optional)</label>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                    <Camera className="h-4 w-4" />
                    Choose Photo
                  </button>
                  <span className="text-xs text-gray-500">No file selected</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowStatusUpdateModal(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log("Update status for:", selectedTracking.trackingNumber);
                  // TODO: Update status logic
                  setShowStatusUpdateModal(false);
                }}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Bulk Status Update</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">Excel Format Required:</p>
                <p className="mt-1 text-xs text-blue-700">
                  Columns: Tracking No | Status | Location | Remarks | Date
                </p>
                <button className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700 underline">
                  Download Template
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel File</label>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex-1">
                    <Upload className="h-4 w-4" />
                    Choose Excel File (.xlsx, .xls)
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">No file selected</p>
              </div>

              <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> This will update multiple shipment statuses at once. Ensure the Excel data is accurate before uploading.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowBulkUpdateModal(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors">
                Upload & Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POD Upload Modal */}
      {showPODUploadModal && selectedTracking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Upload Documents - {selectedTracking.trackingNumber}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">POD (Proof of Delivery)</label>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex-1">
                    <FileText className="h-4 w-4" />
                    Upload POD
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">LR Copy</label>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex-1">
                    <FileText className="h-4 w-4" />
                    Upload LR Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Photos</label>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex-1">
                    <Camera className="h-4 w-4" />
                    Upload Photos
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                <p className="text-xs text-green-800">
                  <strong>Tip:</strong> Upload clear, readable documents for smooth delivery confirmation and record keeping.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowPODUploadModal(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors">
                Save Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Details Modal */}
      {showDropDetailsModal && selectedTracking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">Shipment Details - {selectedTracking.trackingNumber}</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500">Truck Number</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{selectedTracking.truckNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Driver</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{selectedTracking.driverName}</p>
                  <p className="text-xs text-gray-600">{selectedTracking.driverPhone}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Challan Number</p>
                  <p className="mt-1 text-sm font-semibold text-blue-600">{selectedTracking.challanNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Delivery Mode</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{selectedTracking.deliveryMode}</p>
                </div>
              </div>

              {/* Route */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Route</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900">{selectedTracking.origin}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-900">{selectedTracking.destination}</span>
                </div>
              </div>

              {/* Location Updates Timeline */}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-3">Location Updates</p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedTracking.locationUpdates.map((update, index) => (
                    <div key={index} className="flex gap-3 border-l-2 border-blue-200 pl-4 pb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <p className="text-sm font-medium text-gray-900">{update.location}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{update.timestamp}</p>
                        {update.remarks && <p className="text-xs text-gray-600 mt-1">{update.remarks}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowDropDetailsModal(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="logistics.read"><InTransitPage /></PermGuard>;
}
