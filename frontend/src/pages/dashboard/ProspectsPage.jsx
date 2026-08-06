import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useProspects } from "@/hooks/useProspects";
import PageHeader from "@/components/dashboard/PageHeader";
import ProspectsInbox from "@/components/prospects/ProspectsInbox";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";
import { Input } from "@/components/ui/input";

const TABS = [
  { key: "pending", status: "pending" },
  { key: "ignored", status: "ignored" },
  { key: "treated", status: "treated" },
  { key: "automatic", status: "automatic" },
];

export default function ProspectsPage() {
  const { t } = useDashboardLang();
  usePageTitle("page.prospects.title");
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const tab = useMemo(() => {
    const raw = searchParams.get("tab") || "pending";
    return TABS.some((item) => item.key === raw) ? raw : "pending";
  }, [searchParams]);

  const {
    items,
    total,
    pendingCount,
    loading,
    loadingMore,
    error,
    hasMore,
    refetch,
    loadMore,
  } = useProspects(tab);

  const openId = searchParams.get("open") || null;

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === "pending") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const clearOpen = () => {
    const params = new URLSearchParams(searchParams);
    if (!params.has("open")) return;
    params.delete("open");
    setSearchParams(params, { replace: true });
  };

  const emptyByTab = {
    pending: { title: t("prospects.emptyTitle"), description: t("prospects.empty") },
    ignored: { title: t("prospects.emptyIgnoredTitle"), description: t("prospects.emptyIgnored") },
    treated: { title: t("prospects.emptyTreatedTitle"), description: t("prospects.emptyTreated") },
    automatic: {
      title: t("prospects.emptyAutomaticTitle"),
      description: t("prospects.emptyAutomatic"),
    },
  };

  return (
    <div className="space-y-6" data-testid="prospects-page">
      <PageHeader
        title={t("page.prospects.title")}
        subtitle={t("page.prospects.subtitle")}
        testId="prospects-header"
        trailing={
          pendingCount > 0 ? (
            <span
              className="inline-flex items-center rounded-full bg-dash-accent-soft text-dash-accent text-xs font-semibold px-2.5 py-1"
              data-testid="prospects-pending-badge"
            >
              {t("prospects.pendingBadge").replace("{count}", String(pendingCount))}
            </span>
          ) : null
        }
      />

      <div className="bg-dash-surface border border-dash-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-dash-border-soft space-y-3">
          <div className="flex flex-wrap gap-1.5" data-testid="prospects-tabs">
            {TABS.map(({ key }) => {
              const active = tab === key;
              const label =
                key === "pending" && pendingCount > 0
                  ? `${t(`prospects.tabs.${key}`)} (${pendingCount})`
                  : t(`prospects.tabs.${key}`);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={[
                    FILTER_PILL_CLASS.base,
                    "text-xs py-1",
                    active ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
                  ].join(" ")}
                  data-testid={`prospects-tab-${key}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dash-text-subtle" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("prospects.searchPlaceholder")}
              className="pl-8 h-10"
              data-testid="prospects-search"
            />
          </div>
        </div>

        <ProspectsInbox
          items={items}
          total={total}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onChanged={refetch}
          query={query}
          tab={tab}
          initialOpenId={openId}
          onDetailClose={clearOpen}
          emptyTitle={emptyByTab[tab]?.title}
          emptyDescription={emptyByTab[tab]?.description}
        />
      </div>
    </div>
  );
}
