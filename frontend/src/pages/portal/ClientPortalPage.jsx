import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLang } from "@/context/LanguageContext";
import { usePortal } from "@/hooks/usePortal";
import PortalLayout, { PortalError, PortalLoader } from "@/layouts/PortalLayout";
import PortalClientHeader from "@/components/portal/PortalClientHeader";
import PortalDocumentSection from "@/components/portal/PortalDocumentSection";

export default function ClientPortalPage() {
  const { token } = useParams();
  const { t, lang } = useLang();
  const { data, loading, error, patchQuote } = usePortal(token);

  useEffect(() => {
    document.title = `${t("portal.pageTitle")} | MemoryHub`;
    return () => {
      document.title = "MemoryHub";
    };
  }, [t]);

  if (loading) {
    return (
      <PortalLayout subtitle={t("portal.subtitle")}>
        <PortalLoader />
      </PortalLayout>
    );
  }

  if (error || !data) {
    return (
      <PortalLayout subtitle={t("portal.subtitle")}>
        <PortalError message={t("portal.notFound")} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout subtitle={t("portal.subtitle")} title={t("portal.pageTitle")}>
      <div className="space-y-6" data-testid="client-portal-page">
        <PortalClientHeader client={data.client} artisan={data.artisan} t={t} />
        <PortalDocumentSection
          token={token}
          quotes={data.quotes}
          invoices={data.invoices}
          canAcceptQuotes={data.capabilities?.quoteAcceptance}
          lang={lang}
          t={t}
          onQuoteAccepted={patchQuote}
        />
      </div>
    </PortalLayout>
  );
}
