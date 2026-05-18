"use client";

import { useState, useRef, useEffect } from "react";
import {
  Eye, Pencil, MoreHorizontal,
  CheckCircle2, PauseCircle, XCircle,
  Calendar, Phone, MapPin, Package,
  User, Tag, Clock,
} from "lucide-react";
import { CustomerInquiry } from "@/data/mockData";
import { useInquiry } from "@/context/InquiryContext";
import { useToast } from "@/context/ToastContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Status Popover  (Confirm / Hold / Reject)
// ─────────────────────────────────────────────────────────────────────────────

interface StatusPopoverProps {
  inquiry: CustomerInquiry;
  onClose: () => void;
}

const adminActions = [
  {
    status: "Confirmed" as const,
    label: "Confirm",
    icon: CheckCircle2,
    cls: "text-green-600 hover:bg-green-50",
    iconCls: "text-green-500",
    badge: "bg-green-50 text-green-600",
  },
  {
    status: "On Hold" as const,
    label: "Put On Hold",
    icon: PauseCircle,
    cls: "text-amber-600 hover:bg-amber-50",
    iconCls: "text-amber-500",
    badge: "bg-amber-50 text-amber-600",
  },
  {
    status: "Rejected" as const,
    label: "Reject",
    icon: XCircle,
    cls: "text-rose-600 hover:bg-rose-50",
    iconCls: "text-rose-500",
    badge: "bg-rose-50 text-rose-600",
  },
];

function StatusPopover({ inquiry, onClose }: StatusPopoverProps) {
  const { setAdminStatus } = useInquiry();
  const { success } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handle = (status: "Confirmed" | "On Hold" | "Rejected") => {
    setAdminStatus(inquiry.id, status);
    success(
      status === "Confirmed"
        ? `Inquiry ${inquiry.inquiryNumber} confirmed — will appear in Sales Orders.`
        : status === "On Hold"
        ? `Inquiry ${inquiry.inquiryNumber} put on hold.`
        : `Inquiry ${inquiry.inquiryNumber} rejected.`
    );
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-gray-100 bg-white p-1 shadow-xl shadow-gray-200/60 animate-fade-in"
    >
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Admin Action
      </p>
      {adminActions.map(({ status, label, icon: Icon, cls, iconCls }) => (
        <button
          key={status}
          onClick={() => handle(status)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
            cls,
            inquiry.status === status && "opacity-50 pointer-events-none"
          )}
        >
          <Icon className={cn("h-4 w-4 flex-shrink-0", iconCls)} />
          {label}
          {inquiry.status === status && (
            <span className="ml-auto text-[10px]">current</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inquiry View Modal
// ─────────────────────────────────────────────────────────────────────────────

interface InquiryViewModalProps {
  inquiry: CustomerInquiry;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  isAdmin?: boolean;
}

export function InquiryViewModal({
  inquiry,
  isOpen,
  onClose,
  onEdit,
  isAdmin = false,
}: InquiryViewModalProps) {
  const { setAdminStatus } = useInquiry();
  const { success } = useToast();

  const handleAdminAction = (status: "Confirmed" | "On Hold" | "Rejected") => {
    setAdminStatus(inquiry.id, status);
    success(
      status === "Confirmed"
        ? `Confirmed — will appear in Sales Orders.`
        : status === "On Hold"
        ? "Put on hold."
        : "Rejected."
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inquiry — ${inquiry.inquiryNumber}`} size="xl">
      <div className="space-y-5">

        {/* Status + Priority row */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={inquiry.status} variant="inquiry" />
          <StatusBadge value={inquiry.priority} variant="priority" rounded="md" />
          <StatusBadge value={inquiry.source} variant="source" />
          {inquiry.linkedSoNumber && (
            <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
              SO: {inquiry.linkedSoNumber}
            </span>
          )}
        </div>

        {/* Customer + Contact */}
        <div className="grid grid-cols-2 gap-4">
          <InfoRow icon={User} label="Customer" value={inquiry.customer} />
          <InfoRow icon={User} label="Contact Person" value={inquiry.contactPerson} />
          <InfoRow icon={Phone} label="Phone" value={inquiry.phone || "—"} />
          <InfoRow icon={Calendar} label="Inquiry Date" value={inquiry.inquiryDate} />
          {inquiry.salesman && (
            <InfoRow icon={Tag} label="Salesman" value={inquiry.salesman} />
          )}
          {inquiry.adminActionAt && (
            <InfoRow
              icon={Clock}
              label="Admin Action"
              value={new Date(inquiry.adminActionAt).toLocaleString("en-IN")}
            />
          )}
        </div>

        {/* Requirements */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Requirements ({inquiry.requirements.length})
          </p>
          <div className="space-y-2">
            {inquiry.requirements.map((req, i) => (
              <div
                key={req.id}
                className="rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {req.materialCode || req.materialId || `Item ${i + 1}`}
                    </p>
                    {req.gsm && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {req.gsm} GSM · {req.size} · {req.packingType}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {req.quantity.toLocaleString("en-IN")} {req.unit}
                    </p>
                    <p className="text-[10px] text-gray-400">{req.urgency}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    By {req.requiredDeliveryDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {req.deliveryLocation}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {inquiry.notes && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</p>
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">{inquiry.notes}</p>
          </div>
        )}

        {/* Admin action buttons inside view modal */}
        {isAdmin && !["Converted", "Rejected"].includes(inquiry.status) && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Admin Action</p>
            <div className="flex gap-2">
              {adminActions.map(({ status, label, icon: Icon, iconCls, badge }) => (
                <button
                  key={status}
                  onClick={() => { handleAdminAction(status); onClose(); }}
                  disabled={inquiry.status === status}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
                    badge
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", iconCls)} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-4 mt-4">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
        {onEdit && !["Converted", "Rejected"].includes(inquiry.status) && (
          <button
            onClick={() => { onClose(); onEdit(); }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Buttons cell — View / Edit / Status
// ─────────────────────────────────────────────────────────────────────────────

interface InquiryActionCellProps {
  inquiry: CustomerInquiry;
  isAdmin: boolean;
  canEdit: boolean;
  onEdit: (inquiry: CustomerInquiry) => void;
}

export function InquiryActionCell({
  inquiry,
  isAdmin,
  canEdit,
  onEdit,
}: InquiryActionCellProps) {
  const [viewOpen, setViewOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1">
      {/* View */}
      <button
        type="button"
        title="View details"
        onClick={(e) => { e.stopPropagation(); setStatusOpen(false); setViewOpen(true); }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>

      {/* Edit */}
      {canEdit && (
        <button
          type="button"
          title="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit(inquiry); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Admin status toggle */}
      {isAdmin && (
        <button
          type="button"
          title="Set status"
          onClick={(e) => { e.stopPropagation(); setViewOpen(false); setStatusOpen((v) => !v); }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
            inquiry.status === "Confirmed"
              ? "bg-green-50 text-green-600"
              : inquiry.status === "On Hold"
              ? "bg-amber-50 text-amber-600"
              : inquiry.status === "Rejected"
              ? "bg-rose-50 text-rose-500"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          )}
        >
          {inquiry.status === "Confirmed" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : inquiry.status === "On Hold" ? (
            <PauseCircle className="h-3.5 w-3.5" />
          ) : inquiry.status === "Rejected" ? (
            <XCircle className="h-3.5 w-3.5" />
          ) : (
            <MoreHorizontal className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {/* Status popover */}
      {statusOpen && (
        <StatusPopover inquiry={inquiry} onClose={() => setStatusOpen(false)} />
      )}

      {/* View modal */}
      {viewOpen && (
        <InquiryViewModal
          inquiry={inquiry}
          isOpen={viewOpen}
          onClose={() => setViewOpen(false)}
          onEdit={canEdit ? () => { setViewOpen(false); onEdit(inquiry); } : undefined}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helper
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
        <Icon className="h-3.5 w-3.5 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}
