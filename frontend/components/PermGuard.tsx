"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface Props {
  perm: string;
  children: React.ReactNode;
}

export function PermGuard({ perm, children }: Props) {
  const { hasPerm, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!hasPerm(perm)) router.replace("/");
  }, [isLoading, hasPerm, perm, router]);

  if (isLoading) return null;
  if (!hasPerm(perm)) return null;

  return <>{children}</>;
}
