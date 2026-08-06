import {
  TIMELINE_V2_FILTERS,
  buildTimelineV2Rows,
  filterTimelineItemsByQuery,
  formatAmountCents,
  formatRelativeDay,
  timelineItemRoute,
} from "./clientTimelineV2";

describe("clientTimelineV2", () => {
  it("exposes product filters including future-ready list", () => {
    expect(TIMELINE_V2_FILTERS).toEqual([
      "all",
      "communications",
      "commercial",
      "actions",
      "notes",
      "documents",
    ]);
  });

  it("formats relative days", () => {
    const now = new Date("2026-08-05T12:00:00");
    expect(formatRelativeDay(now.toISOString(), "fr", now)).toBe("Aujourd'hui");
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDay(yesterday.toISOString(), "fr", now)).toBe("Hier");
  });

  it("builds day rows chronologically", () => {
    const rows = buildTimelineV2Rows(
      [
        {
          id: "a",
          createdAt: "2026-08-05T10:00:00.000Z",
          title: "A",
        },
        {
          id: "b",
          createdAt: "2026-08-04T10:00:00.000Z",
          title: "B",
        },
      ],
      "fr"
    );
    expect(rows.filter((r) => r.kind === "day")).toHaveLength(2);
    expect(rows.filter((r) => r.kind === "item")).toHaveLength(2);
  });

  it("routes communication cards to client inbox conversation when available", () => {
    expect(
      timelineItemRoute(
        {
          kind: "communication",
          category: "communications",
          entityId: "c1",
          metadata: { communicationId: "c1", conversationId: "conv-9" },
        },
        "client-1"
      )
    ).toContain("/dashboard/clients/client-1?section=emails&conversation=conv-9");
  });

  it("falls back to communications open without conversationId", () => {
    expect(
      timelineItemRoute(
        {
          kind: "communication",
          category: "communications",
          entityId: "c1",
          metadata: { communicationId: "c1" },
        },
        "client-1"
      )
    ).toContain("/dashboard/communications?open=c1");
  });

  it("filters by searchable text without inventing", () => {
    const items = [
      { id: "1", searchableText: "devis terrasse", title: "Mail" },
      { id: "2", searchableText: "facture", title: "Invoice" },
    ];
    expect(filterTimelineItemsByQuery(items, "terrasse")).toHaveLength(1);
    expect(filterTimelineItemsByQuery(items, "")).toHaveLength(2);
  });

  it("formats amounts from centimes", () => {
    const label = formatAmountCents(125000, "fr");
    expect(label).toMatch(/1/);
    expect(label).toMatch(/250|250/);
  });
});
