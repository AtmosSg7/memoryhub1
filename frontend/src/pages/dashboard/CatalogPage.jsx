import { useState } from "react";
import { Loader2, Search, Layers } from "lucide-react";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { useCatalog } from "@/hooks/useCatalog";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { formatQuoteAmount, formatQuoteDate } from "@/utils/quoteDisplay";
import { Input } from "@/components/ui/input";

export default function CatalogPage() {
  const { t, lang } = useDashboardLang();
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
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs text-[#6B7280] mb-2">{t("catalog.stats.items")}</div>
            <div className="font-cabinet text-2xl font-bold text-[#111827]">{stats.totalItems}</div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs text-[#6B7280] mb-2">{t("catalog.stats.usages")}</div>
            <div className="font-cabinet text-2xl font-bold text-[#111827]">{stats.totalUsages}</div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <div className="text-xs text-[#6B7280] mb-2">{t("catalog.stats.average")}</div>
            <div className="font-cabinet text-2xl font-bold text-[#111827]">{stats.averageUsagePerItem}</div>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("catalog.searchPlaceholder")}
          className="h-10 pl-9 rounded-xl border border-[#E7E9EE] bg-white"
          data-testid="catalog-search"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#6B7280]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t("catalog.loading")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={search.trim() ? t("catalog.empty.filteredTitle") : t("catalog.empty.title")}
          description={search.trim() ? t("catalog.empty.filteredDesc") : t("catalog.empty.desc")}
          testId="catalog-empty"
        />
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F3F4F6] text-xs text-[#6B7280]">
            {items.length} / {total} {t("catalog.resultsLabel")}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[880px]">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#F3F4F6]">
                  {[
                    t("catalog.col.description"),
                    t("catalog.col.usage"),
                    t("catalog.col.avgPrice"),
                    t("catalog.col.minPrice"),
                    t("catalog.col.maxPrice"),
                    t("catalog.col.vat"),
                    t("catalog.col.lastUsed"),
                  ].map((label) => (
                    <th
                      key={label}
                      className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]"
                    data-testid={`catalog-row-${item.id}`}
                  >
                    <td className="px-4 py-3 font-medium text-[#111827]">{item.description}</td>
                    <td className="px-4 py-3 text-[#4B5563] tabular-nums">{item.usageCount}</td>
                    <td className="px-4 py-3 font-medium text-[#111827] tabular-nums">
                      {formatQuoteAmount(item.unitPriceHTAvg, lang)}
                    </td>
                    <td className="px-4 py-3 text-[#4B5563] tabular-nums">
                      {formatQuoteAmount(item.unitPriceHTMin, lang)}
                    </td>
                    <td className="px-4 py-3 text-[#4B5563] tabular-nums">
                      {formatQuoteAmount(item.unitPriceHTMax, lang)}
                    </td>
                    <td className="px-4 py-3 text-[#4B5563] tabular-nums">{item.defaultVatRate} %</td>
                    <td className="px-4 py-3 text-[#6B7280]">{formatQuoteDate(item.lastUsedAt, lang)}</td>
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
