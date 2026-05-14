"use client";

import { useMemo, useState } from "react";
import { mockBinLocations, BinLocation } from "@/data/mockData";
import { Warehouse, MapPin, CheckCircle, Wrench, AlertCircle } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";

export default function BinLocationsPage() {
  const kpis = useMemo(() => {
    const totalBins = mockBinLocations.length;
    const activeBins = mockBinLocations.filter((bin) => bin.status === "Active").length;
    const fullBins = mockBinLocations.filter((bin) => bin.status === "Full").length;
    const maintenanceBins = mockBinLocations.filter((bin) => bin.status === "Maintenance").length;
    const totalCapacity = mockBinLocations.reduce((sum, bin) => sum + bin.capacity, 0);
    const totalOccupied = mockBinLocations.reduce((sum, bin) => sum + bin.occupied, 0);
    const utilizationPct = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;
    return { totalBins, activeBins, fullBins, maintenanceBins, totalCapacity, totalOccupied, utilizationPct };
  }, []);

  const warehouseOptions = useMemo(
    () => [
      { label: "Lasudia", value: "Lasudia" },
      { label: "Sanwer", value: "Sanwer" },
      { label: "Pithampur", value: "Pithampur" },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { label: "Active", value: "Active" },
      { label: "Full", value: "Full" },
      { label: "Maintenance", value: "Maintenance" },
    ],
    []
  );

  const columns: ColumnConfig<BinLocation>[] = useMemo(
    () => [
      {
        id: "fullCode",
        accessorKey: "fullCode",
        header: "Bin Code",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 180,
        cell: (info) => (
          <span className="font-mono text-sm font-medium text-blue-600">{info.getValue() as string}</span>
        ),
      },
      {
        id: "warehouse",
        accessorKey: "warehouse",
        header: "Warehouse",
        filterType: "select",
        filterOptions: warehouseOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "zone",
        accessorKey: "zone",
        header: "Zone",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 80,
        cell: (info) => (
          <span className="inline-flex items-center justify-center rounded bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        id: "rack",
        accessorKey: "rack",
        header: "Rack",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 80,
        cell: (info) => (
          <span className="text-sm font-medium text-gray-700">{info.getValue() as string}</span>
        ),
      },
      {
        id: "rackNo",
        accessorKey: "rackNo",
        header: "Rack No",
        filterType: "none",
        enableSorting: true,
        defaultVisible: false,
        size: 90,
        cell: (info) => (
          <span className="font-mono text-sm text-gray-600">{info.getValue() as number}</span>
        ),
      },
      {
        id: "rowNo",
        accessorKey: "rowNo",
        header: "Row No",
        filterType: "none",
        enableSorting: true,
        defaultVisible: false,
        size: 90,
        cell: (info) => (
          <span className="font-mono text-sm text-gray-600">{info.getValue() as number}</span>
        ),
      },
      {
        id: "bin",
        accessorKey: "bin",
        header: "Bin",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 80,
        cell: (info) => (
          <span className="text-sm font-medium text-gray-700">{info.getValue() as string}</span>
        ),
      },
      {
        id: "capacity",
        accessorKey: "capacity",
        header: "Capacity",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => (
          <span className="text-gray-600">{(info.getValue() as number).toLocaleString()}</span>
        ),
      },
      {
        id: "occupied",
        accessorKey: "occupied",
        header: "Occupied",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => (
          <span className="font-medium text-gray-900">{(info.getValue() as number).toLocaleString()}</span>
        ),
      },
      {
        id: "available",
        accessorKey: "available",
        header: "Available",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => {
          const avail = info.getValue() as number;
          return (
            <span className={`font-semibold ${avail > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {avail.toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "utilization",
        accessorKey: "occupied",
        header: "Utilization",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 200,
        cell: (info) => {
          const bin = info.row.original;
          const pct = bin.capacity > 0 ? (bin.occupied / bin.capacity) * 100 : 0;
          const colorClass =
            pct >= 90
              ? "bg-rose-300"
              : pct >= 70
              ? "bg-amber-300"
              : "bg-green-300";
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colorClass} transition-all`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 w-12 text-right">
                {pct.toFixed(0)}%
              </span>
            </div>
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
        size: 120,
        cell: (info) => {
          const status = info.getValue() as string;
          const colors = {
            "Active": "bg-green-50 text-green-600",
            "Full": "bg-rose-50 text-rose-600",
            "Maintenance": "bg-amber-50 text-amber-600",
          };
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status as keyof typeof colors]}`}>
              {status}
            </span>
          );
        },
      },
    ],
    [warehouseOptions, statusOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Bins</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.totalBins}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Warehouse className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Active Bins</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.activeBins}</p>
              <p className="mt-0.5 text-xs text-green-600">Ready to use</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Full Bins</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.fullBins}</p>
              <p className="mt-0.5 text-xs text-red-600">At capacity</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Maintenance</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.maintenanceBins}</p>
              <p className="mt-0.5 text-xs text-yellow-600">Under repair</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
              <Wrench className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Overall Utilization</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.utilizationPct.toFixed(1)}%</p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  kpis.utilizationPct >= 90
                    ? "bg-rose-300"
                    : kpis.utilizationPct >= 70
                    ? "bg-amber-300"
                    : "bg-green-300"
                }`}
                style={{ width: `${Math.min(kpis.utilizationPct, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {kpis.totalOccupied.toLocaleString()} / {kpis.totalCapacity.toLocaleString()} sheets
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex gap-3">
          <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">Bin Location System</p>
            <p className="mt-1 text-blue-700">
              Each bin is identified by Warehouse-Zone-Rack-Bin (e.g., Lasudia-A-3-B2). This hierarchical system enables precise tracking and efficient picking operations.
            </p>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid
        data={mockBinLocations}
        columns={columns}
        tableName="bin-locations"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={15}
        emptyMessage="No bin locations found. Configure bin locations in the warehouse management system."
      />
    </div>
  );
}
