import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyDashboardThemeToDocument,
  applyDashboardThemeToElement,
  DASHBOARD_THEME_STORAGE_KEY,
  readStoredDashboardTheme,
  resolveDashboardTheme,
  writeStoredDashboardTheme,
} from "@/lib/dashboardTheme";
import { useShowcaseThemeIsolation } from "@/context/ShowcaseThemeIsolation";

const DashboardThemeContext = createContext(null);

export function DashboardThemeProvider({ children }) {
  const isolation = useShowcaseThemeIsolation();
  const storageKey = isolation?.storageKey || DASHBOARD_THEME_STORAGE_KEY;
  const applyToDocument = isolation?.applyToDocument !== false;
  const rootSelector = isolation?.rootSelector || null;

  const [theme, setThemeState] = useState(() => readStoredDashboardTheme(storageKey));
  const resolvedTheme = useMemo(() => resolveDashboardTheme(theme), [theme]);

  const setTheme = useCallback(
    (nextTheme) => {
      setThemeState(nextTheme);
      writeStoredDashboardTheme(nextTheme, storageKey);
    },
    [storageKey]
  );

  const toggleLightDark = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  useEffect(() => {
    if (applyToDocument) {
      applyDashboardThemeToDocument(resolvedTheme);
      return undefined;
    }

    const root = rootSelector ? document.querySelector(rootSelector) : null;
    applyDashboardThemeToElement(root, resolvedTheme);
    return undefined;
  }, [applyToDocument, resolvedTheme, rootSelector]);

  useEffect(() => {
    if (theme !== "system") return undefined;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const next = resolveDashboardTheme("system");
      if (applyToDocument) {
        applyDashboardThemeToDocument(next);
      } else {
        const root = rootSelector ? document.querySelector(rootSelector) : null;
        applyDashboardThemeToElement(root, next);
      }
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme, applyToDocument, rootSelector]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark: resolvedTheme === "dark",
      setTheme,
      toggleLightDark,
    }),
    [theme, resolvedTheme, setTheme, toggleLightDark]
  );

  return (
    <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>
  );
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext);
  if (!context) {
    throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  }
  return context;
}
