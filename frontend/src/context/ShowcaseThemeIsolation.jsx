import { createContext, useContext } from "react";
import { SHOWCASE_THEME_STORAGE_KEY } from "@/lib/dashboardTheme";

const ShowcaseThemeIsolationContext = createContext(null);

/**
 * When mounted, DashboardThemeProvider scopes theme to the showcase root
 * instead of mutating the marketing page <html> theme.
 */
export function ShowcaseThemeIsolation({ children }) {
  return (
    <ShowcaseThemeIsolationContext.Provider
      value={{
        applyToDocument: false,
        storageKey: SHOWCASE_THEME_STORAGE_KEY,
        rootSelector: '[data-testid="showcase-app"]',
      }}
    >
      {children}
    </ShowcaseThemeIsolationContext.Provider>
  );
}

export function useShowcaseThemeIsolation() {
  return useContext(ShowcaseThemeIsolationContext);
}

/** True when the tree is mounted inside the homepage interactive demo. */
export function useIsShowcaseDemo() {
  return useShowcaseThemeIsolation() != null;
}
