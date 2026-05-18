"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import { CustomerInquiry, mockInquiries } from "@/data/mockData";

// ─── Types ────────────────────────────────────────────────────────────────────

type InquiryAdminStatus = "Confirmed" | "On Hold" | "Rejected";

interface InquiryContextValue {
  inquiries: CustomerInquiry[];
  /** Add a new inquiry */
  addInquiry: (inquiry: CustomerInquiry) => void;
  /** Update an existing inquiry (merges partial) */
  updateInquiry: (id: string, patch: Partial<CustomerInquiry>) => void;
  /** Admin action: Confirm / Hold / Reject */
  setAdminStatus: (id: string, status: InquiryAdminStatus) => void;
  /** Inquiries that are Confirmed and not yet converted to SO */
  confirmedPending: CustomerInquiry[];
  /** Mark a confirmed inquiry as converted to SO */
  markConverted: (id: string, soNumber: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const InquiryContext = createContext<InquiryContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function InquiryProvider({ children }: { children: ReactNode }) {
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([...mockInquiries]);

  const addInquiry = useCallback((inquiry: CustomerInquiry) => {
    setInquiries((prev) => [inquiry, ...prev]);
  }, []);

  const updateInquiry = useCallback((id: string, patch: Partial<CustomerInquiry>) => {
    setInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
  }, []);

  const setAdminStatus = useCallback(
    (id: string, status: InquiryAdminStatus) => {
      setInquiries((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status, adminActionAt: new Date().toISOString() }
            : i
        )
      );
    },
    []
  );

  const markConverted = useCallback((id: string, soNumber: string) => {
    setInquiries((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "Converted", linkedSoNumber: soNumber, convertedToSO: soNumber }
          : i
      )
    );
  }, []);

  const confirmedPending = inquiries.filter(
    (i) => i.status === "Confirmed" && !i.linkedSoNumber
  );

  return (
    <InquiryContext.Provider
      value={{ inquiries, addInquiry, updateInquiry, setAdminStatus, confirmedPending, markConverted }}
    >
      {children}
    </InquiryContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInquiry() {
  const ctx = useContext(InquiryContext);
  if (!ctx) throw new Error("useInquiry must be used inside InquiryProvider");
  return ctx;
}
