import { useCallback, useEffect, useState } from "react";
import { Phone, Plus, Upload, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import PageHeader from "@/components/dashboard/PageHeader";
import { PageError, PageLoader } from "@/components/dashboard/PageFeedback";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { FILTER_PILL_CLASS } from "@/components/dashboard/detailModalLayout";
import { Input } from "@/components/ui/input";
import CallCard from "@/components/calls/CallCard";
import AddCallModal from "@/components/calls/AddCallModal";
import ImportCsvModal from "@/components/calls/ImportCsvModal";
import CallDetailSheet from "@/components/calls/CallDetailSheet";
import { fetchPhoneCalls } from "@/lib/phoneApi";
import { CALL_FILTERS } from "@/utils/callJournalFormat";

const PAGE_SIZE = 30;

export default function CallsPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.calls.title");
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = searchParams.get("filter") || "all";
  const openId = searchParams.get("open") || null;
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(searchParams.get("add") === "1");
  const [importOpen, setImportOpen] = useState(searchParams.get("import") === "1");

  const load = useCallback(
    async ({ reset = true, nextOffset = 0 } = {}) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError("");
      try {
        const data = await fetchPhoneCalls({
          filter,
          q: query || undefined,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setTotal(data.total || 0);
        setOffset(nextOffset);
        setItems((prev) => (reset ? data.items || [] : [...prev, ...(data.items || [])]));
      } catch (err) {
        setError(err.message || t("calls.loadError"));
        if (reset) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, query, t],
  );

  useEffect(() => {
    load({ reset: true, nextOffset: 0 });
  }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(handle);
  }, [q]);

  const setFilter = (next) => {
    const params = new URLSearchParams(searchParams);
    if (!next || next === "all") params.delete("filter");
    else params.set("filter", next);
    setSearchParams(params, { replace: true });
  };

  const setOpen = (id) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("open", id);
    else params.delete("open");
    setSearchParams(params, { replace: true });
  };

  const hasMore = items.length < total;

  return (
    <div
      className="space-y-4 pb-[max(5rem,env(safe-area-inset-bottom))]"
      data-testid="calls-page"
    >
      <PageHeader
        title={t("page.calls.title")}
        subtitle={t("page.calls.subtitle")}
        testId="calls-header"
        trailing={
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="secondary"
              className="min-h-11 gap-1.5"
              onClick={() => setImportOpen(true)}
              data-testid="calls-import-btn"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{t("calls.actions.import")}</span>
            </ActionButton>
            <ActionButton
              variant="primary"
              className="min-h-11 gap-1.5"
              onClick={() => setAddOpen(true)}
              data-testid="calls-add-btn"
            >
              <Plus className="w-4 h-4" />
              {t("calls.actions.add")}
            </ActionButton>
          </div>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dash-text-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("calls.searchPlaceholder")}
          className="pl-9 min-h-11"
          data-testid="calls-search"
        />
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
        data-testid="calls-filters"
      >
        {CALL_FILTERS.map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={[
                FILTER_PILL_CLASS.base,
                "text-xs py-1.5 whitespace-nowrap shrink-0 min-h-9",
                active ? FILTER_PILL_CLASS.active : FILTER_PILL_CLASS.inactive,
              ].join(" ")}
              data-testid={`calls-filter-${key}`}
            >
              {t(`calls.filters.${key}`)}
            </button>
          );
        })}
      </div>

      {loading ? <PageLoader /> : null}
      {!loading && error ? <PageError message={error} onRetry={() => load({ reset: true })} /> : null}

      {!loading && !error && items.length === 0 ? (
        <div
          className="rounded-xl border border-dash-border bg-dash-surface px-6 py-12 text-center space-y-3"
          data-testid="calls-empty"
        >
          <Phone className="w-8 h-8 text-dash-primary mx-auto" />
          <p className="text-sm font-medium text-dash-text">{t("calls.emptyTitle")}</p>
          <p className="text-sm text-dash-text-muted">{t("calls.empty")}</p>
          <ActionButton
            variant="primary"
            className="min-h-11"
            onClick={() => setAddOpen(true)}
            data-testid="calls-empty-add"
          >
            {t("calls.actions.add")}
          </ActionButton>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="space-y-2" data-testid="calls-list">
          {items.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              t={t}
              lang={lang}
              onOpen={(c) => setOpen(c.id)}
              onCallBack={(c) => {
                const num = c.phoneNumber || c.normalizedPhone;
                if (num) window.location.href = `tel:${num}`;
              }}
            />
          ))}
          <p className="text-xs text-dash-text-subtle text-center pt-1" data-testid="calls-count">
            {t("calls.count")
              .replace("{shown}", String(items.length))
              .replace("{total}", String(total))}
          </p>
          {hasMore ? (
            <ActionButton
              variant="secondary"
              className="w-full min-h-11"
              disabled={loadingMore}
              onClick={() => load({ reset: false, nextOffset: offset + PAGE_SIZE })}
              data-testid="calls-load-more"
            >
              {loadingMore ? t("calls.loadingMore") : t("calls.loadMore")}
            </ActionButton>
          ) : null}
        </div>
      ) : null}

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="md:hidden fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-dash-primary text-white shadow-lg bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))]"
        data-testid="calls-fab-add"
        aria-label={t("calls.actions.add")}
      >
        <Plus className="w-6 h-6" />
      </button>

      <AddCallModal
        open={addOpen}
        onOpenChange={setAddOpen}
        t={t}
        onCreated={() => {
          toast.success(t("calls.add.success"));
          load({ reset: true });
        }}
      />
      <ImportCsvModal
        open={importOpen}
        onOpenChange={setImportOpen}
        t={t}
        onImported={() => {
          toast.success(t("calls.import.success"));
          load({ reset: true });
        }}
      />
      <CallDetailSheet
        open={Boolean(openId)}
        callId={openId}
        onClose={() => setOpen(null)}
        t={t}
        lang={lang}
        onChanged={() => load({ reset: true })}
      />
    </div>
  );
}
