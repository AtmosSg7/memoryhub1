import ClientTimelineV2 from "@/components/dashboard/client/ClientTimelineV2";

/**
 * Adapter used by ClientDetailPage (overview + full timeline section).
 * Timeline V2 is the product surface; page API stays stable.
 */
export default function ClientTimelineList({
  items,
  events,
  summary = null,
  loading,
  error,
  emptyLabel,
  limit,
  compact = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  category = "all",
  onCategoryChange,
  showSummary = true,
  showFilters = true,
  showOpenActions = true,
  clientId,
  onChanged,
  onSeeAllActions,
}) {
  // Backward compatible: accept legacy `events` (EventPublic[]) or V2 `items`.
  const resolvedItems = items || events || [];

  return (
    <ClientTimelineV2
      items={resolvedItems}
      summary={summary}
      loading={loading}
      error={error}
      emptyLabel={emptyLabel}
      limit={limit}
      compact={compact}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      category={category}
      onCategoryChange={onCategoryChange}
      showSummary={showSummary}
      showFilters={showFilters}
      showOpenActions={showOpenActions}
      clientId={clientId}
      onChanged={onChanged}
      onSeeAllActions={onSeeAllActions}
      testId="client-timeline"
    />
  );
}
