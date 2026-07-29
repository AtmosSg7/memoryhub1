import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLang } from "@/context/LanguageContext";
import { usePortal } from "@/hooks/usePortal";
import PortalLayout, { PortalError, PortalNetworkError, PortalSkeleton } from "@/layouts/PortalLayout";
import PortalClientHeader from "@/components/portal/PortalClientHeader";
import PortalDocumentSection from "@/components/portal/PortalDocumentSection";
import { ActionButton } from "@/components/dashboard/ActionButton";

export default function ClientPortalPage() {
  const { token } = useParams();
  const { t, lang, setLang } = useLang();
  const { data, loading, error, reload, patchQuote } = usePortal(token);

  useEffect(() => {
    document.title = `${t("portal.pageTitle")} | MemoryHub`;
    return () => {
      document.title = "MemoryHub";
    };
  }, [t]);

  const layoutProps = {
    subtitle: t("portal.subtitle"),
    footerLabel: t("portal.secureFooter"),
    lang,
    setLang,
  };

  if (loading) {
    return (
      <PortalLayout {...layoutProps}>
        <PortalSkeleton />
        <p className="sr-only">{t("portal.loading")}</p>
      </PortalLayout>
    );
  }

  if (error || !data) {
    const isNotFound = error === "missing_token" || error?.includes("not found") || error?.includes("expired");
    const message = isNotFound ? t("portal.notFound") : t("portal.networkError");
    const title = isNotFound ? t("portal.notFoundTitle") : t("portal.networkErrorTitle");
    const ErrorComponent = isNotFound ? PortalError : PortalNetworkError;

    return (
      <PortalLayout {...layoutProps}>
        <div className="space-y-4">
          <ErrorComponent title={title} message={message} />
          {isNotFound ? (
            <p className="text-center text-sm text-[#6B7280] leading-relaxed max-w-md mx-auto">
              {t("portal.errorHint")}
            </p>
          ) : (
            <div className="flex justify-center">
              <ActionButton variant="secondary" onClick={reload}>
                {t("portal.retry")}
              </ActionButton>
            </div>
          )}
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout
      {...layoutProps}
      title={t("portal.pageTitle")}
      brandName={data.artisan.companyName}
    >
      <div className="space-y-8" data-testid="client-portal-page">
        <PortalClientHeader client={data.client} artisan={data.artisan} t={t} />
        <PortalDocumentSection
          token={token}
          quotes={data.quotes}
          invoices={data.invoices}
          canAcceptQuotes={data.capabilities?.quoteAcceptance}
          canRejectQuotes={data.capabilities?.quoteRejection !== false}
          lang={lang}
          t={t}
          onQuoteAccepted={patchQuote}
        />
      </div>
    </PortalLayout>
  );
}
