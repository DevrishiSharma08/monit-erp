"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MQGRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/masters/rates"); }, [router]);
  return null;
}
