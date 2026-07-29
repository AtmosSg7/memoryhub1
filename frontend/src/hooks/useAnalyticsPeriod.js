import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DEFAULT_ANALYTICS_PERIOD,
  buildAnalyticsPeriodSearchParams,
  parseAnalyticsPeriodParams,
  resolveAnalyticsTimezone,
} from "@/utils/analyticsPeriod";

/**
 * Sync analytics period from URL searchParams (period, from, to).
 * Default period=30d. Updates URL when period changes.
 */
export function useAnalyticsPeriod() {
  const [searchParams, setSearchParams] = useSearchParams();

  const { period, from, to } = useMemo(
    () => parseAnalyticsPeriodParams(searchParams),
    [searchParams]
  );

  const timezone = useMemo(() => resolveAnalyticsTimezone(), []);

  const applyPeriod = useCallback(
    (next) => {
      const params = buildAnalyticsPeriodSearchParams(next, searchParams);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setPeriod = useCallback(
    (nextPeriod) => {
      if (nextPeriod === "custom") {
        applyPeriod({
          period: "custom",
          from: from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
          to: to || new Date().toISOString().slice(0, 10),
        });
        return;
      }
      applyPeriod({ period: nextPeriod || DEFAULT_ANALYTICS_PERIOD, from: "", to: "" });
    },
    [applyPeriod, from, to]
  );

  const setCustomRange = useCallback(
    (nextFrom, nextTo) => {
      applyPeriod({ period: "custom", from: nextFrom, to: nextTo });
    },
    [applyPeriod]
  );

  return {
    period,
    from,
    to,
    timezone,
    setPeriod,
    setCustomRange,
  };
}
