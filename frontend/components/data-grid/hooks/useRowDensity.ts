"use client";

import { useState, useEffect } from "react";

export type RowDensity = "compact" | "normal" | "comfortable";

const VALID: RowDensity[] = ["compact", "normal", "comfortable"];

export function useRowDensity(tableName: string): [RowDensity, (d: RowDensity) => void] {
  const key = `${tableName}-row-density`;
  const [density, setDensityState] = useState<RowDensity>("normal");

  useEffect(() => {
    const stored = localStorage.getItem(key) as RowDensity | null;
    if (stored && VALID.includes(stored)) setDensityState(stored);
  }, [key]);

  const setDensity = (d: RowDensity) => {
    setDensityState(d);
    localStorage.setItem(key, d);
  };

  return [density, setDensity];
}
