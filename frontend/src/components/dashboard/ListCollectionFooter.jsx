import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { ActionButton } from "@/components/dashboard/ActionButton";

function formatListText(template, vars) {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export default function ListCollectionFooter({
  t,
  loadedCount,
  total,
  rangeStart,
  rangeEnd,
  page,
  totalPages,
  onPageChange,
  testId = "list-collection-footer",
}) {
  const isTruncated = total > loadedCount;
  const showPagination = totalPages > 1;

  if (!isTruncated && !showPagination && loadedCount === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3"
      data-testid={testId}
    >
      <div className="space-y-1.5 min-w-0">
        {loadedCount > 0 ? (
          <p className="text-sm text-[#6B7280]" data-testid={`${testId}-range`}>
            {formatListText(t("list.showing"), {
              from: rangeStart,
              to: rangeEnd,
              loaded: loadedCount,
            })}
          </p>
        ) : null}
        {isTruncated ? (
          <p
            className="inline-flex items-start gap-1.5 text-xs text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2"
            data-testid={`${testId}-truncated`}
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {formatListText(t("list.truncated"), { total, loaded: loadedCount })}
            </span>
          </p>
        ) : null}
      </div>

      {showPagination ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[#9CA3AF] hidden sm:inline">
            {formatListText(t("list.page"), { page, pages: totalPages })}
          </span>
          <ActionButton
            variant="quick"
            className="h-8"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label={t("list.previous")}
            data-testid={`${testId}-prev`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t("list.previous")}</span>
          </ActionButton>
          <ActionButton
            variant="quick"
            className="h-8"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label={t("list.next")}
            data-testid={`${testId}-next`}
          >
            <span className="hidden sm:inline">{t("list.next")}</span>
            <ChevronRight className="w-4 h-4" />
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
