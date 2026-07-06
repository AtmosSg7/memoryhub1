import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useClients } from "@/hooks/useClients";
import { useCommunications } from "@/hooks/useCommunications";
import PageHeader from "@/components/dashboard/PageHeader";
import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";
import EmailIntegrationBanner from "@/components/communications/EmailIntegrationBanner";
import CommunicationTimeline, { CommunicationCategoryPills } from "@/components/communications/CommunicationTimeline";
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS, FORM_SELECT_CONTENT_CLASS } from "@/components/dashboard/detailModalLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getDisplayCompany } from "@/utils/clientDisplay";

export default function CommunicationsPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.communications.title");
  const [searchParams] = useSearchParams();
  const { clients, loading: clientsLoading } = useClients();
  const [clientId, setClientId] = useState(searchParams.get("clientId") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");

  const { items, total, loading, error } = useCommunications({
    clientId,
    category,
    limit: 100,
  });

  const clientOptions = useMemo(
    () =>
      [...clients].sort((a, b) => getDisplayCompany(a).localeCompare(getDisplayCompany(b), "fr")),
    [clients]
  );

  const scopeLabel = clientId
    ? getDisplayCompany(clientOptions.find((c) => c.id === clientId) || {})
    : t("communications.allClients");

  return (
    <div className="space-y-6" data-testid="communications-page">
      <PageHeader
        title={t("page.communications.title")}
        subtitle={t("page.communications.subtitle")}
        testId="communications-header"
      />

      <EmailIntegrationBanner />

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 md:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("communications.clientFilter")}</Label>
            <Select
              value={clientId || "all"}
              onValueChange={(value) => setClientId(value === "all" ? "" : value)}
              disabled={clientsLoading}
            >
              <SelectTrigger className={FORM_FIELD_CLASS} data-testid="communications-client-filter">
                <SelectValue placeholder={t("communications.allClients")} />
              </SelectTrigger>
              <SelectContent className={FORM_SELECT_CONTENT_CLASS}>
                <SelectItem value="all">{t("communications.allClients")}</SelectItem>
                {clientOptions.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {getDisplayCompany(client)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={FORM_LABEL_CLASS}>{t("communications.scope")}</Label>
            <p className="h-10 flex items-center text-sm text-[#374151]">{scopeLabel}</p>
          </div>
        </div>

        <CommunicationCategoryPills value={category} onChange={setCategory} />

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F3F4F6]">
          <p className="text-xs text-[#6B7280]">
            {t("communications.count").replace("{count}", String(items.length)).replace("{total}", String(total))}
          </p>
        </div>

        {loading ? (
          <PageLoader label={t("communications.loading")} />
        ) : error ? (
          <PageError message={error} />
        ) : (
          <CommunicationTimeline items={items} loading={false} error={null} emptyLabel={t("communications.empty")} />
        )}
      </div>
    </div>
  );
}
