"use client";

import { useMemo, useState } from "react";
import { mockLocations, Location } from "@/data/mockData";
import { Plus } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { LocationForm } from "@/components/forms/LocationForm";

export default function LocationMasterPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: Partial<Location>) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Location data submitted:", data);
    setIsLoading(false);
    setIsModalOpen(false);
  };

  const typeOptions = useMemo(
    () => [
      { label: "Warehouse", value: "Warehouse" },
      { label: "Mill", value: "Mill" },
      { label: "Customer Site", value: "Customer Site" },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" },
    ],
    []
  );

  const columns: ColumnConfig<Location>[] = useMemo(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Location Name",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 200,
        cell: (info) => (
          <span className="font-medium text-gray-900">{info.getValue() as string}</span>
        ),
      },
      {
        id: "type",
        accessorKey: "type",
        header: "Type",
        filterType: "select",
        filterOptions: typeOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => (
          <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        id: "isMainGodown",
        accessorKey: "isMainGodown",
        header: "Main Godown",
        filterType: "select",
        filterOptions: [
          { label: "Yes", value: "true" },
          { label: "No", value: "false" },
        ],
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => {
          const isMain = info.getValue() as boolean;
          return isMain ? (
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
              Yes
            </span>
          ) : (
            <span className="text-gray-400 text-xs">No</span>
          );
        },
      },
      {
        id: "address",
        accessorKey: "address",
        header: "Address",
        filterType: "text",
        enableSorting: false,
        defaultVisible: true,
        size: 250,
      },
      {
        id: "city",
        accessorKey: "city",
        header: "City",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "state",
        accessorKey: "state",
        header: "State",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "pincode",
        accessorKey: "pincode",
        header: "Pincode",
        filterType: "text",
        enableSorting: false,
        defaultVisible: true,
        size: 100,
      },
      {
        id: "capacity",
        accessorKey: "capacity",
        header: "Capacity",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => {
          const capacity = info.getValue() as number | undefined;
          return capacity ? (
            <span className="font-medium text-gray-900">
              {(capacity / 1000).toFixed(0)}K sheets
            </span>
          ) : (
            <span className="text-gray-400 text-xs">—</span>
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
        size: 110,
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                status === "Active"
                  ? "bg-green-50 text-green-600"
                  : "bg-gray-50 text-gray-600"
              }`}
            >
              {status}
            </span>
          );
        },
      },
    ],
    [typeOptions, statusOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* DataGrid */}
      <DataGrid
        data={mockLocations}
        columns={columns}
        tableName="locations"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        onRowClick={(location) => {
          console.log("Row clicked:", location.name);
        }}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Location"
        size="lg"
      >
        <LocationForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isLoading}
        />
      </Modal>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/40 transition-transform hover:scale-105 hover:bg-blue-600 active:scale-95"
        aria-label="Add Location"
        title="Add Location"
      >
        <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}
