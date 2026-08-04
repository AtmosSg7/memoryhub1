export const DASHBOARD_THEME_STORAGE_KEY = "memoryhub-dashboard-theme";

/** Theme preference scoped to the homepage interactive demo only. */
export const SHOWCASE_THEME_STORAGE_KEY = "memoryhub-showcase-theme";

export const DASHBOARD_THEME_OPTIONS = ["light", "dark", "system"];

/** @returns {'light' | 'dark' | 'system'} */
export function readStoredDashboardTheme(storageKey = DASHBOARD_THEME_STORAGE_KEY) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (DASHBOARD_THEME_OPTIONS.includes(stored)) {
      return stored;
    }
  } catch {
    /* localStorage unavailable */
  }
  return "system";
}

/** @returns {'light' | 'dark'} */
export function resolveDashboardTheme(theme) {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function isDashboardRoute(pathname = "") {
  return pathname.startsWith("/dashboard");
}

/**
 * Always set light|dark on <html> so portaled UI (Dialog, Dropdown, Select)
 * outside .dashboard-app still inherits --dash-* / popover tokens.
 */
export function applyDashboardThemeToDocument(resolvedTheme) {
  if (typeof document === "undefined") return;
  applyDashboardThemeToElement(document.documentElement, resolvedTheme);
}

/** Apply light|dark tokens on a local root (e.g. showcase frame). */
export function applyDashboardThemeToElement(element, resolvedTheme) {
  if (!element) return;
  element.dataset.dashboardTheme = resolvedTheme === "dark" ? "dark" : "light";
}

export function writeStoredDashboardTheme(theme, storageKey = DASHBOARD_THEME_STORAGE_KEY) {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    /* localStorage unavailable */
  }
}
