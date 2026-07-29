import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useCatalog } from "@/hooks/useCatalog";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { PageError, TableSkeleton } from "@/components/dashboard/PageFeedback";
import {
  LIST_TABLE_CONTAINER_CLASS,
  METRIC_CARD_CLASS,
  METRIC_LABEL_CLASS,
  METRIC_VALUE_CLASS,
  TABLE_BODY_CELL_CLASS,
  TABLE_BODY_ROW_CLASS,
  TABLE_HEAD_CELL_CLASS,
  TABLE_HEAD_ROW_CLASS,
} from "@/components/dashboard/detailModalLayout";
import SearchField from "@/components/dashboard/SearchField";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";

export default function CatalogPage() {
  const { t, lang } = useDashboardLang();
  usePageTitle("page.catalog.title");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { items, total, stats, loading, error } = useCatalog(search);

  return (
    <div className="space-y-6" data-testid="catalog-page">
      <PageHeader
        title={t("page.catalog.title")}
        subtitle={t("page.catalog.subtitle")}
        testId="catalog-header"
      />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={METRIC_CARD_CLASS}>
            <div className={METRIC_LABEL_CLASS}>{t("catalog.stats.items")}</div>
            <div className={METRIC_VALUE_CLASS}>{stats.totalItems}</div>
          </div>
          <div className={METRIC_CARD_CLASS}>
            <div className={METRIC_LABEL_CLASS}>{t("catalog.stats.usages")}</div>
            <div className={METRIC_VALUE_CLASS}>{stats.totalUsages}</div>
          </div>
          <div className={METRIC_CARD_CLASS}>
            <div className={METRIC_LABEL_CLASS}>{t("catalog.stats.average")}</div>
            <div className={METRIC_VALUE_CLASS}>{stats.averageUsagePerItem}</div>
          </div>
        </div>
      )}

      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("catalog.searchPlaceholder")}
        wrapperClassName="max-w-md"
        data-testid="catalog-search"
      />

      {loading ? (
        <TableSkeleton rows={8} columns={7} testId="catalog-loading" />
      ) : error ? (
        <PageError message={error} testId="catalog-error" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={search.trim() ? t("catalog.empty.filteredTitle") : t("catalog.empty.title")}
          description={search.trim() ? t("catalog.empty.filteredDesc") : t("catalog.empty.desc")}
          cta={search.trim() ? t("common.clearFilter") : t("catalog.empty.cta")}
          onCta={search.trim() ? () => setSearch("") : () => navigate("/dashboard/files")}
          testId="catalog-empty"
        />
      ) : (
        <div className={LIST_TABLE_CONTAINER_CLASS}>
          <div className="px-4 py-3 border-b border-[#F3F4F6] text-xs text-[#6B7280]">
            {items.length} / {total} {t("catalog.resultsLabel")}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  {[
                    t("catalog.col.description"),
                    t("catalog.col.usage"),
                    t("catalog.col.avgPrice"),
                    t("catalog.col.minPrice"),
                    t("catalog.col.maxPrice"),
                    t("catalog.col.vat"),
                    t("catalog.col.lastUsed"),
                  ].map((label) => (
                    <th key={label} className={TABLE_HEAD_CELL_CLASS}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={TABLE_BODY_ROW_CLASS}
                    data-testid={`catalog-row-${item.id}`}
                  >
                    <td className={`${TABLE_BODY_CELL_CLASS} font-medium text-[#111827]`}>{item.description}</td>
                    <td className={`${TABLE_BODY_CELL_CLASS} text-[#4B5563] tabular-nums`}>{item.usageCount}</td>
                    <td className={`${TABLE_BODY_CELL_CLASS} font-medium text-[#111827] tabular-nums`}>
                      {formatQuoteAmount(item.unitPriceHTAvg, lang)}
                    </td>
                    <td className={`${TABLE_BODY_CELL_CLASS} text-[#4B5563] tabular-nums`}>
                      {formatQuoteAmount(item.unitPriceHTMin, lang)}
                    </td>
                    <td className={`${TABLE_BODY_CELL_CLASS} text-[#4B5563] tabular-nums`}>
                      {formatQuoteAmount(item.unitPriceHTMax, lang)}
                    </td>
                    <td className={`${TABLE_BODY_CELL_CLASS} text-[#4B5563] tabular-nums`}>{item.defaultVatRate} %</td>
                    <td className={`${TABLE_BODY_CELL_CLASS} text-[#6B7280]`}>{formatQuoteDate(item.lastUsedAt, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
