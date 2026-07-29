import ClientTimeline from "@/components/dashboard/client/ClientTimeline";

/**
 * Thin adapter used by ClientDetailPage (overview + full timeline section).
 * Keeps the page API stable while ClientTimeline owns the rich UI.
 */
export default function ClientTimelineList({
  events,
  loading,
  error,
  emptyLabel,
  limit,
  compact = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  return (
    <ClientTimeline
      events={events}
      loading={loading}
      error={error}
      emptyLabel={emptyLabel}
      limit={limit}
      compact={compact}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      testId="client-timeline"
    />
  );
}
