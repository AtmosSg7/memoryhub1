import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { toastApiError } from "@/utils/apiErrors";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { getQuote } from "@/lib/quotesApi";
import { getInvoice } from "@/lib/invoicesApi";

export function useOpenCommercialDocumentFromUrl({ loading, onOpenQuote, onOpenInvoice }) {
  const { t } = useDashboardLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef(null);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || loading) return;
    if (handledRef.current === openId) return;

    handledRef.current = openId;
    let active = true;

    const openDocument = async () => {
      try {
        const quote = await getQuote(openId);
        if (active) onOpenQuote(quote);
        return;
      } catch {
        // try invoice next
      }

      try {
        const invoice = await getInvoice(openId);
        if (active) onOpenInvoice(invoice);
      } catch (err) {
        if (active) {
          toastApiError(err, t, "dashboardV2.today.loadError");
        }
      }
    };

    openDocument().finally(() => {
      if (!active) return;
      const next = new URLSearchParams(searchParams);
      next.delete("open");
      setSearchParams(next, { replace: true });
      handledRef.current = null;
    });

    return () => {
      active = false;
    };
  }, [searchParams, loading, onOpenQuote, onOpenInvoice, setSearchParams, t]);
}
