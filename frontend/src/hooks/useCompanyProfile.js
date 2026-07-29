import { useEffect, useState } from "react";
import { fetchCompanyProfile } from "@/lib/companyProfileApi";

const FALLBACK_VAT_RATE = 20;

export function useCompanyProfile({ enabled = true } = {}) {
  const [defaultVatRate, setDefaultVatRate] = useState(FALLBACK_VAT_RATE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    setLoading(true);

    fetchCompanyProfile()
      .then((data) => {
        if (cancelled) return;
        setDefaultVatRate(data?.profile?.defaultVatRate ?? FALLBACK_VAT_RATE);
      })
      .catch(() => {
        if (!cancelled) setDefaultVatRate(FALLBACK_VAT_RATE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { defaultVatRate, loading };
}
