"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "./AppShell";
import { useAuth } from "@/context/AuthContext";
import { InquiryProvider } from "@/context/InquiryContext";
import { SalesOrderProvider } from "@/context/SalesOrderContext";
import { StockProvider } from "@/context/StockContext";
import { PurchaseOrderProvider } from "@/context/PurchaseOrderContext";

const NO_SHELL_PATHS = ["/login"];

export function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noShell = NO_SHELL_PATHS.some((p) => pathname.startsWith(p));
  const { user, isLoading } = useAuth();

  if (noShell) return <>{children}</>;

  // Protected path. Until AuthProvider has resolved (either via cookie-refresh
  // or by confirming there's no session), render a clean splash so the
  // dashboard never flashes before the redirect-to-login effect fires.
  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

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
