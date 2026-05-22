"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface Props {
  perm: string;
  children: React.ReactNode;
}

export function PermGuard({ perm, children }: Props) {
  const { hasPermission, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!hasPermission(perm)) router.replace("/");
  }, [isLoading, hasPermission, perm, router]);

  if (isLoading) return null;
  if (!hasPermission(perm)) return null;

  return <>{children}</>;
}
