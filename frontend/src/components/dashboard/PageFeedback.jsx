import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardLang } from "@/hooks/useDashboardLang";
import { translateApiError } from "@/utils/apiErrors";
import { Skeleton } from "@/components/ui/skeleton";
import { LIST_TABLE_CONTAINER_CLASS, METRIC_CARD_CLASS } from "@/components/dashboard/detailModalLayout";

export function InlineLoader({ label, className, testId = "inline-loading" }) {
  return (
    <div
      className={cn("flex items-center justify-center py-10 text-sm text-[#6B7280]", className)}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0" aria-hidden="true" />
      {label}
    </div>
  );
}

export function PageLoader({ label, testId = "page-loading", compact = false }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center text-[#6B7280]",
        compact ? "py-10" : "py-16"
      )}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-5 h-5 animate-spin mr-2 shrink-0" aria-hidden="true" />
      {label}
    </div>
  );
}

export function PageError({ message, testId = "page-error" }) {
  const { t } = useDashboardLang();
  return (
    <div
      className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#991B1B]"
      data-testid={testId}
      role="alert"
    >
      {translateApiError(message, t)}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 6, testId = "table-skeleton" }) {
  return (
    <div className={LIST_TABLE_CONTAINER_CLASS} data-testid={testId} aria-hidden="true">
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={`head-${index}`} className="h-3 flex-1 bg-[#E5E7EB]" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Skeleton key={`row-${rowIndex}`} className="h-11 w-full bg-[#F3F4F6]" />
        ))}
      </div>
    </div>
  );
}

export function MetricCardsSkeleton({ count = 3, testId = "metric-skeleton" }) {
  const cols =
    count >= 8
      ? "grid-cols-2 md:grid-cols-4"
      : count >= 4
        ? "grid-cols-2 xl:grid-cols-4"
        : count === 2
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-1 sm:grid-cols-3";
  return (
    <div className={`grid ${cols} gap-3`} data-testid={testId} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={METRIC_CARD_CLASS}>
          <Skeleton className="h-3 w-24 mb-3 bg-[#E5E7EB]" />
          <Skeleton className="h-8 w-16 bg-[#F3F4F6]" />
        </div>
      ))}
    </div>
  );
}

export function DashboardOverviewSkeleton({ testId = "dashboard-overview-skeleton" }) {
  return (
    <div className="space-y-4" data-testid={testId} aria-hidden="true">
      <div className={LIST_TABLE_CONTAINER_CLASS}>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full bg-[#F3F4F6]" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full bg-[#F3F4F6]" />
        ))}
      </div>
    </div>
  );
}
