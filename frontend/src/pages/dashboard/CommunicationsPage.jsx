import { useNavigate, useSearchParams } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useClients } from "@/hooks/useClients";
import { useCommunications } from "@/hooks/useCommunications";
import { useUnlinkedEmails } from "@/hooks/useUnlinkedEmails";
import PageHeader from "@/components/dashboard/PageHeader";
import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";
import EmailIntegrationBanner from "@/components/communications/EmailIntegrationBanner";
import CommunicationTimeline, { CommunicationCategoryPills } from "@/components/communications/CommunicationTimeline";
import UnlinkedEmailsInbox from "@/components/communications/UnlinkedEmailsInbox";
import ClientFilterSelect from "@/components/dashboard/ClientFilterSelect";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";

const LINK_SCOPES = [
  { key: "activity", linkStatus: null },
  { key: "all", linkStatus: "all" },
  { key: "linked", linkStatus: "linked" },
  { key: "unlinked", linkStatus: "unlinked" },
];

export default function CommunicationsPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.communications.title");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get("clientId") || "";
  const category = searchParams.get("category") || "";
  const scope = searchParams.get("scope") || "activity";
  const { clients, loading: clientsLoading } = useClients();

  const showEmailInbox = scope === "all" || scope === "linked" || scope === "unlinked";
  const linkStatus = scope === "linked" ? "linked" : scope === "all" ? "all" : "unlinked";

  const { items, total, loading, error, emailIntegrationReady } = useCommunications({
    clientId,
    category,
    limit: 100,
  });

  const {
    items: emailItems,
    total: emailTotal,
    unlinkedCount,
    loading: emailsLoading,
    loadingMore,
    error: emailsError,
    hasMore,
    refetch: refetchEmails,
    loadMore,
  } = useUnlinkedEmails(linkStatus, { enabled: showEmailInbox });

  const updateFilters = (nextClientId, nextCategory, nextScope = scope) => {
    const params = {};
    if (nextClientId) params.clientId = nextClientId;
    if (nextCategory) params.category = nextCategory;
    if (nextScope && nextScope !== "activity") params.scope = nextScope;
    setSearchParams(params, { replace: true });
  };

  const isTruncated = !showEmailInbox && total > items.length;

  return (
    <div className="space-y-6" data-testid="communications-page">
      <PageHeader
        title={t("page.communications.title")}
        subtitle={t("page.communications.subtitle")}
        testId="communications-header"
      />

      {emailIntegrationReady === false ? <EmailIntegrationBanner /> : null}

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F3F4F6] space-y-3">
          <div className="flex flex-wrap gap-1.5" data-testid="communication-link-scopes">
            {LINK_SCOPES.map(({ key }) => {
              const active = scope === key;
              const label =
                key === "unlinked" && unlinkedCount > 0
                  ? `${t(`unlinkedEmails.scope.${key}`)} (${unlinkedCount})`
                  : t(`unlinkedEmails.scope.${key}`);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateFilters(clientId, category, key)}
                  className={[
                    FILTER_PILL_CLASS.base,
                    "text-xs py-1",
                    active ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
                  ].join(" ")}
                  data-testid={`communication-scope-${key}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {!showEmailInbox ? (
            <div className="flex flex-col lg:flex-row lg:items-start gap-3">
              <ClientFilterSelect
                clients={clients}
                value={clientId}
                onChange={(next) => updateFilters(next, category, scope)}
                disabled={clientsLoading}
                className="w-full lg:w-64"
                testId="communications-client-filter"
              />

              <CommunicationCategoryPills
                value={category}
                onChange={(next) => updateFilters(clientId, next, scope)}
              />
            </div>
          ) : null}

          {!showEmailInbox ? (
            <p className="text-[11px] text-[#9CA3AF]">
              {t("communications.count")
                .replace("{count}", String(items.length))
                .replace("{total}", String(total))}
            </p>
          ) : null}

          {unlinkedCount > 0 && scope === "activity" ? (
            <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs text-[#0A2540] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>
                {t("unlinkedEmails.banner").replace("{count}", String(unlinkedCount))}
              </span>
              <ActionButton
                variant="accent"
                className="shrink-0"
                onClick={() => updateFilters("", "", "unlinked")}
                data-testid="communications-open-unlinked"
              >
                {t("unlinkedEmails.bannerCta")}
              </ActionButton>
            </div>
          ) : null}

          {isTruncated ? (
            <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>{t("communications.truncatedHint")}</span>
              {!clientId ? (
                <ActionButton
                  variant="quick"
                  className="h-8 text-xs shrink-0"
                  onClick={() => navigate("/dashboard/clients")}
                >
                  {t("communications.filterByClientCta")}
                </ActionButton>
              ) : null}
            </div>
          ) : null}
        </div>

        {showEmailInbox ? (
          <UnlinkedEmailsInbox
            items={emailItems}
            total={emailTotal}
            loading={emailsLoading}
            loadingMore={loadingMore}
            error={emailsError}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onChanged={async () => {
              await refetchEmails();
            }}
            emptyLabel={
              scope === "linked"
                ? t("unlinkedEmails.emptyLinked")
                : scope === "all"
                  ? t("unlinkedEmails.emptyAll")
                  : t("unlinkedEmails.empty")
            }
          />
        ) : loading ? (
          <PageLoader label={t("communications.loading")} compact testId="communications-loading" />
        ) : error ? (
          <div className="p-4">
            <PageError message={error} testId="communications-error" />
          </div>
        ) : (
          <CommunicationTimeline
            items={items}
            loading={false}
            error={null}
            emptyLabel={t("communications.empty")}
            emptyCta={t("communications.emptyCta")}
            onEmptyCta={() => navigate("/dashboard/clients")}
          />
        )}
      </div>
    </div>
  );
}
