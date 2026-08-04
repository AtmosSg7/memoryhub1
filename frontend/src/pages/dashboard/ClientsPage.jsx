import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users } from "lucide-react";

import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAddClient } from "@/context/AddClientContext";
import { useClients } from "@/hooks/useClients";
import { useListPagination } from "@/hooks/useListPagination";

import ListCollectionFooter from "@/components/dashboard/ListCollectionFooter";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import SearchEmptyState from "@/components/dashboard/SearchEmptyState";
import SearchField from "@/components/dashboard/SearchField";
import { PageError } from "@/components/dashboard/PageFeedback";
import { Skeleton } from "@/components/ui/skeleton";
import ClientListCard from "@/components/dashboard/ClientListCard";
import ClientListFilter from "@/components/dashboard/ClientListFilter";
import ClientListSort from "@/components/dashboard/ClientListSort";

import {
  CLIENT_LIST_FILTERS,
  CLIENT_LIST_SORTS,
  filterAndSortClients,
} from "@/utils/clientList";

export default function ClientsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.clients.title");
  const navigate = useNavigate();
  const { openAddClient } = useAddClient();
  const { clients, total, loading, error } = useClients();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(CLIENT_LIST_FILTERS.ALL);
  const [sort, setSort] = useState(CLIENT_LIST_SORTS.LAST_ACTIVITY);

  const filteredClients = useMemo(
    () => filterAndSortClients(clients, { query, filter, sort }),
    [clients, query, filter, sort],
  );

  const {
    pageItems: pageClients,
    page,
    setPage,
    totalPages,
    rangeStart,
    rangeEnd,
    totalItems,
  } = useListPagination(filteredClients, {
    pageSize: 24,
    resetKey: `${query}:${filter}:${sort}`,
  });

  const hasActiveControls = Boolean(query.trim()) || filter !== CLIENT_LIST_FILTERS.ALL;

  return (
    <div className="space-y-6" data-testid="clients-page">
      <PageHeader
        title={t("page.clients.title")}
        subtitle={t("page.clients.subtitle")}
        primaryLabel={t("actions.createClient")}
        primaryIcon={Plus}
        onPrimary={openAddClient}
        testId="clients-header"
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="clients-loading" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-dash-surface border border-dash-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg shrink-0 bg-dash-surface-muted" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 bg-dash-surface-muted" />
                  <Skeleton className="h-3 w-1/2 bg-dash-border" />
                </div>
              </div>
              <Skeleton className="h-3 w-full bg-dash-border" />
              <Skeleton className="h-3 w-2/3 bg-dash-border" />
            </div>
          ))}
        </div>
      ) : error ? (
        <PageError message={error} testId="clients-error" />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("empty.noClients.title")}
          description={t("empty.noClients.desc")}
          cta={t("empty.noClients.cta")}
          onCta={openAddClient}
          testId="empty-clients"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full max-w-md">
              <SearchField
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("page.clients.searchPlaceholder")}
                data-testid="clients-search-input"
                aria-label={t("page.clients.searchPlaceholder")}
              />
            </div>
            <ClientListSort value={sort} onChange={setSort} />
          </div>

          <ClientListFilter value={filter} onChange={setFilter} />

          {filteredClients.length === 0 ? (
            <SearchEmptyState
              message={
                query.trim()
                  ? t("page.clients.searchEmpty").replace("{query}", query.trim())
                  : t("page.clients.filterEmpty")
              }
              testId="clients-search-empty"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pageClients.map((client) => (
                <ClientListCard
                  key={client.id}
                  client={client}
                  lang={lang}
                  t={t}
                  onClick={() => navigate(`/dashboard/clients/${client.id}`)}
                />
              ))}
            </div>
          )}

          <ListCollectionFooter
            t={t}
            loadedCount={totalItems}
            total={hasActiveControls ? totalItems : total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            testId="clients-list-footer"
          />
        </div>
      )}
    </div>
  );
}
