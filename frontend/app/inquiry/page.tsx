"use client";

import { useMemo, useState } from "react";
import { CustomerInquiry } from "@/data/mockData";
import {
  MessageSquare, CheckCircle, XCircle, Clock,
  Clock3, Plus,
} from "lucide-react";
import { DataGrid } from "@/components/data-grid/DataGrid";
import { ColumnConfig } from "@/components/data-grid/types/grid.types";
import { fmtDateIN, fmtNumIN } from "@/lib/formatters";
import { InquiryForm } from "@/components/forms/InquiryForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/Modal";
import { InquiryActionCell } from "@/components/inquiry/InquiryActions";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useInquiry } from "@/context/InquiryContext";
import { UploadedFile } from "@/components/ui/FileUploader";

// ─── Filter options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { label: "Draft",                    value: "Draft" },
  { label: "Stock Checked",            value: "Stock Checked" },
  { label: "Waiting Mill Confirmation",value: "Waiting Mill Confirmation" },
  { label: "Mill Confirmed",           value: "Mill Confirmed" },
  { label: "Customer Confirmed",       value: "Customer Confirmed" },
  { label: "Confirmed",                value: "Confirmed" },
  { label: "On Hold",                  value: "On Hold" },
  { label: "Rejected",                 value: "Rejected" },
  { label: "Converted",                value: "Converted" },
  { label: "Lost",                     value: "Lost" },
];

const PRIORITY_OPTIONS = [
  { label: "Low",    value: "Low" },
  { label: "Medium", value: "Medium" },
  { label: "High",   value: "High" },
  { label: "Urgent", value: "Urgent" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InquiryPage() {
  const { user, isCustomer, isAdmin, isSalesman } = useAuth();
  const { success } = useToast();
  const { inquiries, addInquiry, updateInquiry } = useInquiry();

  const [showForm, setShowForm]     = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<Partial<CustomerInquiry> | undefined>();

  // ── Visibility: customer sees only their own ───────────────────────────────
  const visibleInquiries = useMemo(() => {
    if (isCustomer && user?.customerName) {
      return inquiries.filter((i) => i.customer === user.customerName);
    }
    return inquiries;
  }, [inquiries, isCustomer, user]);

  // ── KPIs (based on visible slice) ────────────────────────────────────────
  const kpis = useMemo(() => {
    const src = visibleInquiries;
    return {
      total:     src.length,
      confirmed: src.filter((i) => i.status === "Confirmed" || i.status === "Converted").length,
      inProgress:src.filter((i) => !["Confirmed","Converted","Lost","Rejected"].includes(i.status)).length,
      lost:      src.filter((i) => i.status === "Lost" || i.status === "Rejected").length,
    };
  }, [visibleInquiries]);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnConfig<CustomerInquiry>[] = useMemo(() => {
    const canEdit = (inq: CustomerInquiry) =>
      isAdmin ||
      isSalesman ||
      (isCustomer && inq.status === "Draft");

    return [
      {
        id: "inquiryNumber",
        accessorKey: "inquiryNumber",
        header: "Inquiry #",
        filterType: "text",
        enableSorting: true,
        enableHiding: false,
        defaultVisible: true,
        size: 130,
      },
      {
        id: "inquiryDate",
        accessorKey: "inquiryDate",
        header: "Date",
        filterType: "dateRange",
        enableSorting: true,
        defaultVisible: true,
        size: 110,
        cell: (info) => <span className="tabular-nums">{fmtDateIN(info.getValue() as string)}</span>,
        exportValue: (r) => fmtDateIN((r as any).inquiryDate),
      },
      // Customer column — hidden for customer role
      ...(!isCustomer
        ? [{
            id: "customer",
            accessorKey: "customer" as keyof CustomerInquiry,
            header: "Customer",
            filterType: "text" as const,
            enableSorting: true,
            defaultVisible: true,
            size: 180,
          }]
        : []),
      {
        id: "source",
        accessorKey: "source",
        header: "Source",
        filterType: "select",
        filterOptions: [
          { label: "Phone",    value: "Phone" },
          { label: "WhatsApp", value: "WhatsApp" },
          { label: "Email",    value: "Email" },
          { label: "Visit",    value: "Visit" },
        ],
        enableSorting: false,
        defaultVisible: true,
        size: 100,
        cell: (info) => <StatusBadge value={info.getValue() as string} variant="source" />,
      },
      {
        id: "requirements",
        accessorKey: "requirements",
        header: "Requirements",
        filterType: "none",
        enableSorting: false,
        defaultVisible: true,
        size: 200,
        exportColumns: [
          {
            header: "Materials",
            value: (r) => (r as any).requirements?.map((req: any, i: number) => `${i + 1}. ${req.materialCode || req.materialId || "—"}`).join("\n") ?? "—",
          },
          {
            header: "Qty",
            value: (r) => (r as any).requirements?.map((req: any) => `${fmtNumIN(req.quantity)} ${req.unit || ""}`).join("\n") ?? "—",
          },
          {
            header: "Delivery Location",
            value: (r) => (r as any).requirements?.map((req: any) => req.deliveryLocation || "—").join("\n") ?? "—",
          },
        ],
        cell: (info) => {
          const reqs = info.getValue() as CustomerInquiry["requirements"];
          if (!reqs?.length) return <span className="text-gray-300">—</span>;
          const qty = reqs.reduce((s, r) => s + r.quantity, 0);
          const locs = new Set(reqs.map((r) => r.deliveryLocation)).size;
          return (
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {reqs.length} {reqs.length === 1 ? "Item" : "Items"}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs font-medium text-gray-600">
                {fmtNumIN(qty)} {reqs[0].unit}
              </span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500">{locs} Loc{locs !== 1 ? "s" : ""}</span>
            </div>
          );
        },
      },
      {
        id: "priority",
        accessorKey: "priority",
        header: "Priority",
        filterType: "select",
        filterOptions: PRIORITY_OPTIONS,
        enableSorting: true,
        defaultVisible: true,
        size: 100,
        cell: (info) => (
          <StatusBadge value={info.getValue() as string} variant="priority" rounded="md" />
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        filterType: "select",
        filterOptions: STATUS_OPTIONS,
        enableSorting: true,
        defaultVisible: true,
        size: 160,
        cell: (info) => {
          const status = info.getValue() as string;
          // Extended badge colors for new statuses
          const extra: Record<string, string> = {
            Confirmed: "bg-green-50 text-green-700",
            "On Hold": "bg-amber-50 text-amber-700",
            Rejected:  "bg-rose-50 text-rose-700",
          };
          if (extra[status]) {
            return (
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${extra[status]}`}>
                {status}
              </span>
            );
          }
          return <StatusBadge value={status} variant="inquiry" />;
        },
      },
      // Salesman — admin/salesman only
      ...(isAdmin || isSalesman
        ? [{
            id: "salesman",
            accessorKey: "salesman" as keyof CustomerInquiry,
            header: "Salesman",
            filterType: "text" as const,
            enableSorting: true,
            defaultVisible: true,
            size: 130,
          }]
        : []),
      // Actions column
      {
        id: "actions",
        accessorKey: "id",
        header: "Actions",
        filterType: "none",
        enableSorting: false,
        enableHiding: false,
        defaultVisible: true,
        size: isAdmin ? 100 : 70,
        cell: (info) => {
          const inq = info.row.original as CustomerInquiry;
          return (
            <InquiryActionCell
              inquiry={inq}
              isAdmin={isAdmin}
              canEdit={canEdit(inq)}
              onEdit={handleEdit}
            />
          );
        },
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer, isAdmin, isSalesman]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingInquiry(
      isCustomer && user
        ? { customer: user.customerName ?? "", source: "Email" }
        : undefined
    );
    setShowForm(true);
  };

  const handleEdit = (inquiry: CustomerInquiry) => {
    setEditingInquiry(inquiry);
    setShowForm(true);
  };

  const handleSubmit = (data: Partial<CustomerInquiry>, _files: UploadedFile[]) => {
    if (data.id) {
      updateInquiry(data.id, data);
      success("Inquiry updated.");
    } else {
      const newInquiry: CustomerInquiry = {
        id:            `inq_${Date.now()}`,
        inquiryNumber: `INQ-2026-${String(inquiries.length + 1).padStart(4, "0")}`,
        inquiryDate:   data.inquiryDate ?? new Date().toISOString().split("T")[0],
        status:        "Draft",
        priority:      data.priority ?? "Medium",
        requirements:  data.requirements ?? [],
        salesman:      isCustomer ? "Auto Assigned" : "Current User",
        customer:      data.customer ?? "",
        contactPerson: data.contactPerson ?? "",
        phone:         data.phone ?? "",
        source:        data.source ?? "Phone",
        notes:         data.notes,
      };
      addInquiry(newInquiry);
      success(
        isCustomer
          ? "Inquiry submitted! Our team will review it shortly."
          : "Inquiry created."
      );
    }
    setShowForm(false);
    setEditingInquiry(undefined);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingInquiry(undefined);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">

      {/* ── Action row ───────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-600 active:scale-[0.97] transition-all"
        >
          <Plus className="h-4 w-4" /> New Inquiry
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Inquiries"
          value={kpis.total}
          subtitle="All time"
          icon={MessageSquare}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
        />
        <KpiCard
          title="Confirmed"
          value={kpis.confirmed}
          subtitle="Admin confirmed"
          subtitleColor="green"
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-500"
        />
        <KpiCard
          title="In Progress"
          value={kpis.inProgress}
          subtitle="Awaiting action"
          subtitleColor="amber"
          icon={Clock}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-500"
        />
        <KpiCard
          title="Rejected / Lost"
          value={kpis.lost}
          subtitle="Not proceeding"
          subtitleColor="red"
          icon={XCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
        />
      </div>

      {/* Table */}
      <DataGrid
        data={visibleInquiries}
        columns={columns}
        tableName="customer-inquiry"
        enableFilters={true}
        enablePagination={true}
        enableColumnReordering={isAdmin || isSalesman}
        enableColumnVisibility={isAdmin || isSalesman}
        initialPageSize={10}
        onRowClick={undefined}   /* row click disabled — use action icons */
        emptyState={
          <EmptyState
            icon={Clock3}
            title={isCustomer ? "No inquiries yet" : "No inquiries found"}
            description={
              isCustomer
                ? "Submit your first inquiry and our team will get back to you."
                : "No inquiries match the current filters."
            }
            action={{ label: "Create Inquiry", onClick: handleAdd }}
          />
        }
      />

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleCancel}
        title={editingInquiry?.id ? "Edit Inquiry" : "New Inquiry"}
        size="2xl"
      >
        <InquiryForm
          initialData={editingInquiry}
          onSubmit={handleSubmit}
          isCustomerMode={isCustomer}
        />
      </Modal>
    </div>
  );
}
