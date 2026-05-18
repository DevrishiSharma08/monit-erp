"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
interface ThemeCtx { theme: Theme; toggle: () => void; isDark: boolean; }

const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {}, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Sync React state with what the inline script already applied
    const applied = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(applied);
  }, []);

  const toggle = () => {
    setTheme((t) => {
      const next: Theme = t === "light" ? "dark" : "light";
      localStorage.setItem("monit-theme", next);

      // Briefly enable transitions only during theme swap
      document.documentElement.setAttribute("data-theme-changing", "");
      document.documentElement.classList.toggle("dark", next === "dark");
      setTimeout(() => document.documentElement.removeAttribute("data-theme-changing"), 350);

      return next;
    });
  };

  return (
    <Ctx.Provider value={{ theme, toggle, isDark: theme === "dark" }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
