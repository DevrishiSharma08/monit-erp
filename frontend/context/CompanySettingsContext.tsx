"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { companyConfigApi, CompanyConfigData } from "@/lib/api-services";

interface CompanySettingsCtx {
  config:  CompanyConfigData;
  loading: boolean;
  reload:  () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsCtx>({
  config:  {},
  loading: false,
  reload:  async () => {},
});

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [config,  setConfig]  = useState<CompanyConfigData>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setConfig(await companyConfigApi.get()); }
    catch { /* non-fatal — app still works without config */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <CompanySettingsContext.Provider value={{ config, loading, reload }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export const useCompanySettings = () => useContext(CompanySettingsContext);
