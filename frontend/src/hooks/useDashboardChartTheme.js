import { useMemo } from "react";
import { useDashboardTheme } from "@/context/DashboardThemeContext";

function readDashVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const host = document.querySelector(".dashboard-app");
  if (!host) return fallback;
  const value = getComputedStyle(host).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Dedicated chart series palette + shared stroke/grid/tooltip tokens.
 * Order: premium blue → cyan → violet → green → orange.
 */
export function useDashboardChartTheme() {
  const { resolvedTheme } = useDashboardTheme();

  return useMemo(() => {
    const isDark = resolvedTheme === "dark";
    const primary = readDashVar("--dash-chart-primary", isDark ? "#8b9cff" : "#2563EB");
    const secondary = readDashVar("--dash-chart-secondary", isDark ? "#38bdf8" : "#0891B2");
    const tertiary = readDashVar("--dash-chart-tertiary", isDark ? "#a78bfa" : "#7C3AED");
    const quaternary = readDashVar("--dash-chart-quaternary", isDark ? "#34d399" : "#059669");
    const warning = readDashVar("--dash-chart-warning", isDark ? "#fb923c" : "#D97706");
    const canvas = readDashVar("--dash-bg", isDark ? "#0f1115" : "#F9FAFB");
    const series = [primary, secondary, tertiary, quaternary, warning];

    return {
      grid: readDashVar("--dash-chart-grid", isDark ? "rgba(255,255,255,0.028)" : "#EEF0F4"),
      axis: readDashVar("--dash-chart-axis", isDark ? "#7a8494" : "#9CA3AF"),
      tooltip: {
        background: readDashVar("--dash-chart-tooltip-bg", isDark ? "#1c212b" : "#FFFFFF"),
        border: `1px solid ${readDashVar("--dash-chart-tooltip-border", isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB")}`,
        borderRadius: 12,
        boxShadow: isDark
          ? "0 12px 32px -10px rgba(0,0,0,0.6)"
          : "0 8px 24px -12px rgba(10,37,64,0.18)",
        fontSize: 12,
        padding: "10px 12px",
        color: readDashVar("--dash-text", "#111827"),
      },
      tooltipLabel: {
        color: readDashVar("--dash-chart-tooltip-text", "#6B7280"),
        marginBottom: 4,
      },
      axisTick: {
        fill: readDashVar("--dash-chart-axis", "#9CA3AF"),
        fontSize: 11,
        fontFamily: "Satoshi, Manrope, sans-serif",
      },
      primary,
      secondary,
      tertiary,
      quaternary,
      warning,
      cyan: secondary,
      violet: tertiary,
      green: quaternary,
      orange: warning,
      series,
      strokeWidth: 3,
      areaOpacity: isDark ? 0.24 : 0.16,
      gridDash: "3 10",
      /** Soft halo so curves never sink into the canvas */
      lineGlow: isDark ? "drop-shadow(0 0 6px rgba(139,156,255,0.35))" : "none",
      activeDot: {
        r: 5,
        strokeWidth: 2,
        stroke: canvas,
        fill: primary,
      },
      isDark,
    };
  }, [resolvedTheme]);
}
