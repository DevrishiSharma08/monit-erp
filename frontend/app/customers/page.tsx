"use client";

import { useMemo, useState } from "react";
import { mockCustomers, Customer } from "@/data/mockData";
import { Plus, Eye, Edit, MoreVertical, Users, UserCheck, Wallet, TrendingUp } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { Modal } from "@/components/Modal";
import { CustomerForm } from "@/components/forms/CustomerForm";

export default function CustomersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: Partial<Customer>) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Customer data submitted:", data);
    setIsLoading(false);
    setIsModalOpen(false);
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const total = mockCustomers.length;
    const active = mockCustomers.filter((c) => c.status === "Active").length;
    const totalCredit = mockCustomers.reduce((sum, c) => sum + c.creditLimit, 0);
    const totalOutstanding = mockCustomers.reduce((sum, c) => sum + c.outstanding, 0);
    const avgUtilization = (
      mockCustomers.reduce(
        (sum, c) => sum + (c.outstanding / c.creditLimit) * 100,
        0
      ) / total
    ).toFixed(0);

    return { total, active, totalCredit, totalOutstanding, avgUtilization };
  }, []);

  const salesmenOptions = useMemo(() => {
    const unique = Array.from(new Set(mockCustomers.map((c) => c.salesman)));
    return unique.map((s) => ({ label: s, value: s }));
  }, []);

  const statusOptions = useMemo(
    () => [
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" },
      { label: "Blocked", value: "Blocked" },
    ],
    []
  );

  const columns: ColumnConfig<Customer>[] = useMemo(
    () => [
      {
        id: "customer",
        accessorKey: "name",
        header: "Customer",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 250,
        cell: (info) => {
          const customer = info.row.original;
          return (
            <div>
              <p className="font-medium text-gray-900">{customer.name}</p>
              <p className="text-xs text-gray-500">{customer.company}</p>
            </div>
          );
        },
      },
      {
        id: "consignees",
        accessorKey: "consignees",
        header: "Consignees",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 110,
        cell: (info) => {
          const count = (info.getValue() as unknown[])?.length ?? 0;
          return (
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
              {count} {count === 1 ? "party" : "parties"}
            </span>
          );
        },
      },
      {
        id: "deliveryAddresses",
        accessorKey: "deliveryAddresses",
        header: "Ship-To",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 100,
        cell: (info) => {
          const count = (info.getValue() as unknown[])?.length ?? 0;
          return (
            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {count} addr
            </span>
          );
        },
      },
      {
        id: "tallyLedgerName",
        accessorKey: "tallyLedgerName",
        header: "Tally Ledger",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 220,
        cell: (info) => (
          <span className="text-gray-700 text-xs">{info.getValue() as string}</span>
        ),
      },
      {
        id: "gst",
        accessorKey: "gst",
        header: "GST Number",
        filterType: "text",
        enableSorting: true,
        defaultVisible: false,
        size: 180,
      },
      {
        id: "pan",
        accessorKey: "pan",
        header: "PAN",
        filterType: "text",
        enableSorting: true,
        defaultVisible: false,
        size: 140,
        cell: (info) => (
          <span className="font-mono text-xs text-gray-700">{info.getValue() as string}</span>
        ),
      },
      {
        id: "state",
        accessorKey: "state",
        header: "State",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 150,
      },
      {
        id: "creditLimit",
        accessorKey: "creditLimit",
        header: "Credit Limit",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 150,
        cell: (info) => (
          <span className="font-medium text-gray-900">
            ₹{((info.getValue() as number) / 100000).toFixed(1)}L
          </span>
        ),
      },
      {
        id: "creditDays",
        accessorKey: "creditDays",
        header: "Credit Days",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
        cell: (info) => (
          <span className="font-medium text-blue-600">
            {info.getValue() as number} days
          </span>
        ),
      },
      {
        id: "outstanding",
        accessorKey: "outstanding",
        header: "Outstanding",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 150,
        cell: (info) => (
          <span className="font-medium text-gray-900">
            ₹{((info.getValue() as number) / 100000).toFixed(2)}L
          </span>
        ),
      },
      {
        id: "utilization",
        accessorKey: "outstanding",
        header: "Utilization",
        filterType: "none",
        enableSorting: true,
        defaultVisible: true,
        size: 150,
        cell: (info) => {
          const customer = info.row.original;
          const utilization =
            (customer.outstanding / customer.creditLimit) * 100;
          const utilizationColor =
            utilization > 90
              ? "text-red-600"
              : utilization > 70
              ? "text-orange-600"
              : "text-green-600";
          const barColor =
            utilization > 90
              ? "bg-red-600"
              : utilization > 70
              ? "bg-orange-600"
              : "bg-green-600";

          return (
            <div>
              <p className={`font-medium ${utilizationColor}`}>
                {utilization.toFixed(0)}%
              </p>
              <div className="mt-1 h-1.5 w-24 rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                ></div>
              </div>
            </div>
          );
        },
      },
      {
        id: "salesman",
        accessorKey: "salesman",
        header: "Salesman",
        filterType: "select",
        filterOptions: salesmenOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 150,
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
          return (
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                status === "Active"
                  ? "bg-green-100 text-green-700"
                  : status === "Blocked"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        id: "actions",
        accessorKey: "id",
        header: "Actions",
        filterType: "none",
        enableSorting: false,
        enableHiding: false,
        defaultVisible: true,
        size: 120,
        cell: (info) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log("View customer:", info.row.original.name);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="View customer"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log("Edit customer:", info.row.original.name);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Edit customer"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log("More actions:", info.row.original.name);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="More actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [salesmenOptions, statusOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Total Customers
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">
                {kpis.total}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Active
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">
                {kpis.active}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {kpis.total - kpis.active} inactive / blocked
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <UserCheck className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Total Credit
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">
                ₹{(kpis.totalCredit / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
              <Wallet className="h-5 w-5 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Outstanding
              </p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">
                ₹{(kpis.totalOutstanding / 100000).toFixed(1)}L
              </p>
              <p className="mt-0.5 text-xs text-orange-600">
                Avg {kpis.avgUtilization}% utilized
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* DataGrid */}
      <DataGrid
        data={mockCustomers}
        columns={columns}
        tableName="customers"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        onRowClick={(customer) => {
          console.log("Row clicked:", customer.name);
        }}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Customer"
        size="lg"
      >
        <CustomerForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          isLoading={isLoading}
        />
      </Modal>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/40 transition-transform hover:scale-105 hover:bg-blue-600 active:scale-95"
        aria-label="Add Customer"
        title="Add Customer"
      >
        <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}
