"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { companyConfigApi, CompanyConfigData } from "@/lib/api-services";

interface CompanySettingsCtx {
  config:     CompanyConfigData;
  allConfigs: CompanyConfigData[];
  loading:    boolean;
  reload:     () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsCtx>({
  config:     { id: 1 },
  allConfigs: [],
  loading:    false,
  reload:     async () => {},
});

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [config,     setConfig]     = useState<CompanyConfigData>({ id: 1 });
  const [allConfigs, setAllConfigs] = useState<CompanyConfigData[]>([]);
  const [loading,    setLoading]    = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await companyConfigApi.getAll();
      const list = Array.isArray(all) ? all : [all as CompanyConfigData];
      setAllConfigs(list);
      setConfig(list.find((c) => c.id === 1) ?? list[0] ?? { id: 1 });
    }
    catch { /* non-fatal — app still works without config */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <CompanySettingsContext.Provider value={{ config, allConfigs, loading, reload }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export const useCompanySettings = () => useContext(CompanySettingsContext);
