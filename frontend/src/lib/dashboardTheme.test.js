import {
  applyDashboardThemeToDocument,
  applyDashboardThemeToElement,
  DASHBOARD_THEME_OPTIONS,
  DASHBOARD_THEME_STORAGE_KEY,
  SHOWCASE_THEME_STORAGE_KEY,
  resolveDashboardTheme,
} from "@/lib/dashboardTheme";

describe("dashboardTheme", () => {
  it("resolves explicit light and dark themes", () => {
    expect(resolveDashboardTheme("light")).toBe("light");
    expect(resolveDashboardTheme("dark")).toBe("dark");
  });

  it("falls back to light when system prefers light", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    expect(resolveDashboardTheme("system")).toBe("light");
  });

  it("uses dark when system prefers dark", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    expect(resolveDashboardTheme("system")).toBe("dark");
  });

  it("exports stable storage key and options", () => {
    expect(DASHBOARD_THEME_STORAGE_KEY).toBe("memoryhub-dashboard-theme");
    expect(SHOWCASE_THEME_STORAGE_KEY).toBe("memoryhub-showcase-theme");
    expect(DASHBOARD_THEME_OPTIONS).toEqual(["light", "dark", "system"]);
  });

  it("always sets data-dashboard-theme on html for portal token inheritance", () => {
    applyDashboardThemeToDocument("dark");
    expect(document.documentElement.dataset.dashboardTheme).toBe("dark");
    applyDashboardThemeToDocument("light");
    expect(document.documentElement.dataset.dashboardTheme).toBe("light");
  });

  it("can scope theme to a local element without touching html", () => {
    const previous = document.documentElement.dataset.dashboardTheme;
    document.documentElement.dataset.dashboardTheme = "light";
    const el = document.createElement("div");
    applyDashboardThemeToElement(el, "dark");
    expect(el.dataset.dashboardTheme).toBe("dark");
    expect(document.documentElement.dataset.dashboardTheme).toBe("light");
    document.documentElement.dataset.dashboardTheme = previous;
  });
});
