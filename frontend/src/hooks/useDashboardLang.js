import { useCallback } from "react";
import { useLang } from "@/context/LanguageContext";

/**
 * Adapter for dashboard components migrated from memoryhub-dashboard.
 * Maps flat keys like `nav.dashboard` → `dashboardApp.nav.dashboard`.
 */
export function useDashboardLang() {
  const { lang, setLang, t: tBase } = useLang();

  const t = useCallback(
    (key) => tBase(`dashboardApp.${key}`),
    [tBase]
  );

  return { lang, setLang, t };
}
