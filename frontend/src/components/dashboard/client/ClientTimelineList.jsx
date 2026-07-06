import CommercialTimeline from "@/components/dashboard/CommercialTimeline";

export default function ClientTimelineList({
  events,
  loading,
  error,
  emptyLabel,
  limit,
  compact = false,
}) {
  return (
    <CommercialTimeline
      events={events}
      loading={loading}
      error={error}
      limit={limit}
      compact={compact}
      emptyLabel={emptyLabel}
      testIdPrefix="client-timeline"
    />
  );
}
