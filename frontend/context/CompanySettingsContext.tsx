"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { companyConfigApi, CompanyConfigData } from "@/lib/api-services";

interface CompanySettingsCtx {
  config:     CompanyConfigData;
  loading:    boolean;
  error:      string | null;
  reload:     () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsCtx>({
  config:  {},
  loading: false,
  error:   null,
  reload:  async () => {},
});

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [config,  setConfig]  = useState<CompanyConfigData>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConfig(await companyConfigApi.get());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load company settings.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <CompanySettingsContext.Provider value={{ config, loading, error, reload }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export const useCompanySettings = () => useContext(CompanySettingsContext);
