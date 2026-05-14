"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";
import { InquiryProvider } from "@/context/InquiryContext";
import { SalesOrderProvider } from "@/context/SalesOrderContext";
import { StockProvider } from "@/context/StockContext";
import { PurchaseOrderProvider } from "@/context/PurchaseOrderContext";

const NO_SHELL_PATHS = ["/login"];

export function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noShell = NO_SHELL_PATHS.some((p) => pathname.startsWith(p));

  if (noShell) return <>{children}</>;
  return (
    <InquiryProvider>
      <SalesOrderProvider>
        <PurchaseOrderProvider>
          <StockProvider>
            <AppShell>{children}</AppShell>
          </StockProvider>
        </PurchaseOrderProvider>
      </SalesOrderProvider>
    </InquiryProvider>
  );
}
