"use client";

import { useMemo } from "react";
import { PermGuard } from "@/components/PermGuard";
import { PickPlan } from "@/data/mockData";
import { useStock } from "@/context/StockContext";
import { ClipboardList, CheckSquare, Square, PackageSearch } from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";

function PickPlanPage() {
  const { pickPlans } = useStock();

  const kpis = useMemo(() => {
    const totalPlans = pickPlans.length;
    const pendingPicking = pickPlans.filter((plan) => plan.status === "Pending").length;
    const inProgress = pickPlans.filter((plan) => plan.status === "In Progress").length;
    const completed = pickPlans.filter((plan) => plan.status === "Completed").length;

    const totalLines = pickPlans.reduce((sum, plan) => sum + plan.lines.length, 0);
    const pickedLines = pickPlans.reduce(
      (sum, plan) => sum + plan.lines.filter(line => line.picked).length,
      0
    );

    return { totalPlans, pendingPicking, inProgress, completed, totalLines, pickedLines };
  }, []);

  const statusOptions = useMemo(
    () => [
      { label: "Pending", value: "Pending" },
      { label: "In Progress", value: "In Progress" },
      { label: "Completed", value: "Completed" },
    ],
    []
  );

  const columns: ColumnConfig<PickPlan>[] = useMemo(
    () => [
      {
        id: "pickPlanNumber",
        accessorKey: "pickPlanNumber",
        header: "Pick Plan #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 140,
        cell: (info) => (
          <span className="font-medium text-gray-900">{info.getValue() as string}</span>
        ),
      },
      {
        id: "createdDate",
        accessorKey: "createdDate",
        header: "Created",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 120,
      },
      {
        id: "soNumber",
        accessorKey: "soNumber",
        header: "SO Number",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 140,
        cell: (info) => (
          <span className="text-blue-600 font-medium">{info.getValue() as string}</span>
        ),
      },
      {
        id: "customer",
        accessorKey: "customer",
        header: "Customer",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 200,
      },
      {
        id: "pickingLines",
        accessorKey: "lines",
        header: "Picking Lines",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 250,
        cell: (info) => {
          const plan = info.row.original;
          const totalLines = plan.lines.length;
          const pickedCount = plan.lines.filter(line => line.picked).length;
          const firstLine = plan.lines[0];

          return (
            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-900">
                {firstLine.paper} {firstLine.gsm}GSM - {firstLine.size}
                {totalLines > 1 && <span className="text-gray-500"> +{totalLines - 1} more</span>}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${(pickedCount / totalLines) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  {pickedCount}/{totalLines}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "warehouse",
        accessorKey: "warehouse",
        header: "Warehouse",
        filterType: "select",
        filterOptions: [
          { label: "Lasudia", value: "Lasudia" },
          { label: "Sanwer", value: "Sanwer" },
          { label: "Pithampur", value: "Pithampur" },
        ],
        enableSorting: true,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "assignedTo",
        accessorKey: "assignedTo",
        header: "Assigned To",
        filterType: "text",
        enableSorting: true,
        defaultVisible: true,
        size: 140,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: statusOptions,
        enableSorting: true,
        defaultVisible: true,
        size: 130,
        cell: (info) => {
          const status = info.getValue() as string;
          const colors = {
            "Pending": "bg-yellow-100 text-yellow-700",
            "In Progress": "bg-blue-100 text-blue-700",
            "Completed": "bg-green-100 text-green-700",
          };
          return (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status as keyof typeof colors]}`}>
              {status}
            </span>
          );
        },
      },
      {
        id: "plannedPickDate",
        accessorKey: "plannedPickDate",
        header: "Planned Pick",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 130,
      },
    ],
    [statusOptions]
  );

  return (
    <div className="space-y-6 pb-24">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total Plans</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.totalPlans}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.pendingPicking}</p>
              <p className="mt-0.5 text-xs text-yellow-600">Not started</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50">
              <Square className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">In Progress</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.inProgress}</p>
              <p className="mt-0.5 text-xs text-blue-600">Being picked</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <PackageSearch className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Completed</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{kpis.completed}</p>
              <p className="mt-0.5 text-xs text-green-600">Ready for dispatch</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <CheckSquare className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Lines Progress</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">
              {kpis.pickedLines}/{kpis.totalLines}
            </p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${kpis.totalLines > 0 ? (kpis.pickedLines / kpis.totalLines) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {kpis.totalLines > 0 ? ((kpis.pickedLines / kpis.totalLines) * 100).toFixed(0) : 0}% picked
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex gap-3">
          <PackageSearch className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">FIFO Picking Instructions</p>
            <p className="mt-1 text-blue-700">
              Pick plans are generated based on FIFO (First In, First Out) logic. Always pick from the oldest stock lots first to maintain product freshness. Each line shows the specific lot number and bin location.
            </p>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <DataGrid
        data={pickPlans}
        columns={columns}
        tableName="pick-plans"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={true}
        enableColumnVisibility={true}
        initialPageSize={10}
        onRowClick={(plan) => {
          console.log("View pick plan details:", plan.pickPlanNumber);
          // TODO: Open modal with detailed picking instructions
        }}
        emptyMessage="No pick plans found. Pick plans are automatically generated when sales orders are allocated."
      />
    </div>
  );
}

export default function Page() {
  return <PermGuard perm="logistics.read"><PickPlanPage /></PermGuard>;
}
