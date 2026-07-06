import { useEffect } from "react";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export function usePageTitle(titleKey) {
  const { t } = useDashboardLang();

  useEffect(() => {
    if (!titleKey) return undefined;
    document.title = `${t(titleKey)} | MemoryHub`;
    return () => {
      document.title = "MemoryHub";
    };
  }, [t, titleKey]);
}
