import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";

export function useOpenDocumentFromUrl({ loading, fetchDocument, onOpen }) {
  const { t } = useDashboardLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef(null);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || loading) return;
    if (handledRef.current === openId) return;

    handledRef.current = openId;
    let active = true;

    fetchDocument(openId)
      .then((doc) => {
        if (active) onOpen(doc);
      })
      .catch((err) => {
        if (active) {
          toast.error(err.message || t("dashboardV2.today.loadError"));
        }
      })
      .finally(() => {
        if (!active) return;
        const next = new URLSearchParams(searchParams);
        next.delete("open");
        setSearchParams(next, { replace: true });
        handledRef.current = null;
      });

    return () => {
      active = false;
    };
  }, [searchParams, loading, fetchDocument, onOpen, setSearchParams, t]);
}
