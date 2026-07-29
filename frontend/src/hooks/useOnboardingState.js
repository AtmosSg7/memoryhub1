import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeFirstWin,
  getOnboardingState,
  markClient360Viewed,
  updateChecklist,
  updateWizard,
} from "@/lib/onboardingApi";

export function useOnboardingState({ enabled = true } = {}) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const next = await getOnboardingState();
      setState(next);
      return next;
    } catch (err) {
      setError(err?.message || "Impossible de charger l'onboarding.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  const patchWizard = useCallback(async (body) => {
    const next = await updateWizard(body);
    setState(next);
    return next;
  }, []);

  const dismissChecklist = useCallback(async () => {
    const next = await updateChecklist({ dismissed: true });
    setState(next);
    return next;
  }, []);

  const ackFirstWin = useCallback(async (id) => {
    const next = await acknowledgeFirstWin(id);
    setState(next);
    return next;
  }, []);

  const mark360 = useCallback(async () => {
    const next = await markClient360Viewed();
    setState(next);
    return next;
  }, []);

  const pendingFirstWin = state?.firstWins?.find((w) => w.achieved && !w.celebratedAt) || null;

  return {
    state,
    loading,
    error,
    refresh,
    patchWizard,
    dismissChecklist,
    ackFirstWin,
    mark360,
    pendingFirstWin,
    maturity: state?.maturity || null,
    showWizard: Boolean(state?.showWizard),
    showChecklist: Boolean(state?.showChecklist),
    demoAllowed: Boolean(state?.demoAllowed),
  };
}
