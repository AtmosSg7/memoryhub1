import {
  GROUPABLE_EVENT_TYPES,
  TIMELINE_CHANNELS,
  TIMELINE_GROUP_WINDOW_MS,
  buildTimelineRows,
  formatTimelineDateTime,
  getGroupedDocumentsRoute,
  getTimelineChannel,
  groupTimelineEvents,
  sortEventsNewestFirst,
} from "./clientTimeline";

function makeEvent(overrides = {}) {
  return {
    id: overrides.id || `e-${Math.random().toString(36).slice(2, 8)}`,
    type: "document_uploaded",
    entityType: "document",
    entityId: "doc-1",
    clientId: "client-1",
    metadata: { fileName: "a.pdf", source: "import", importSessionId: "imp-1" },
    createdAt: "2026-07-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("clientTimeline helpers", () => {
  it("exposes grouping window and groupable types", () => {
    expect(TIMELINE_GROUP_WINDOW_MS).toBe(5 * 60 * 1000);
    expect(GROUPABLE_EVENT_TYPES).toContain("document_uploaded");
  });

  it("sorts events newest first", () => {
    const events = [
      makeEvent({ id: "old", createdAt: "2026-07-01T10:00:00.000Z" }),
      makeEvent({ id: "new", createdAt: "2026-07-27T10:00:00.000Z" }),
    ];
    expect(sortEventsNewestFirst(events).map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("groups identical nearby document uploads", () => {
    const events = [
      makeEvent({ id: "1", createdAt: "2026-07-27T10:04:00.000Z", metadata: { fileName: "a.pdf", source: "import", importSessionId: "imp-1" } }),
      makeEvent({ id: "2", createdAt: "2026-07-27T10:02:00.000Z", metadata: { fileName: "b.pdf", source: "import", importSessionId: "imp-1" } }),
      makeEvent({ id: "3", createdAt: "2026-07-27T10:01:00.000Z", metadata: { fileName: "c.pdf", source: "import", importSessionId: "imp-1" } }),
      makeEvent({
        id: "4",
        type: "note_created",
        entityType: "note",
        entityId: "n1",
        createdAt: "2026-07-27T09:00:00.000Z",
        metadata: { noteTitle: "Appel" },
      }),
    ];

    const grouped = groupTimelineEvents(events);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].kind).toBe("group");
    expect(grouped[0].count).toBe(3);
    expect(grouped[0].type).toBe("document_uploaded");
    expect(grouped[1].kind).toBe("single");
    expect(grouped[1].event.type).toBe("note_created");
  });

  it("does not group events outside the time window", () => {
    const events = [
      makeEvent({ id: "1", createdAt: "2026-07-27T12:00:00.000Z" }),
      makeEvent({ id: "2", createdAt: "2026-07-27T11:00:00.000Z" }),
    ];
    const grouped = groupTimelineEvents(events);
    expect(grouped).toHaveLength(2);
    expect(grouped.every((item) => item.kind === "single")).toBe(true);
  });

  it("builds day separators and keeps chronological order", () => {
    const events = [
      makeEvent({ id: "1", createdAt: "2026-07-27T12:00:00.000Z", type: "note_created", entityType: "note", metadata: {} }),
      makeEvent({ id: "2", createdAt: "2026-07-26T12:00:00.000Z", type: "quote_created", entityType: "quote", metadata: { quoteNumber: "D-1" } }),
    ];
    const rows = buildTimelineRows(events, { lang: "fr" });
    expect(rows.filter((row) => row.kind === "day")).toHaveLength(2);
    const items = rows.filter((row) => row.kind !== "day");
    expect(items[0].event.id).toBe("1");
    expect(items[1].event.id).toBe("2");
  });

  it("formats date and time", () => {
    const dt = formatTimelineDateTime("2026-07-27T15:30:00.000Z", "fr");
    expect(dt.date).toBeTruthy();
    expect(dt.time).toBeTruthy();
    expect(dt.dayKey).toBe("2026-07-27");
  });

  it("maps import and future channels", () => {
    expect(getTimelineChannel(makeEvent())).toBe(TIMELINE_CHANNELS.IMPORT);
    expect(getTimelineChannel(makeEvent({ type: "call_logged", metadata: {} }))).toBe(TIMELINE_CHANNELS.CALL);
    expect(getTimelineChannel(makeEvent({ type: "note_created", metadata: {} }))).toBe(TIMELINE_CHANNELS.INTERNAL);
  });

  it("builds document group routes to the client files section", () => {
    const grouped = groupTimelineEvents([
      makeEvent({ id: "1", createdAt: "2026-07-27T10:02:00.000Z" }),
      makeEvent({ id: "2", createdAt: "2026-07-27T10:01:00.000Z" }),
    ])[0];
    expect(getGroupedDocumentsRoute(grouped)).toBe(
      "/dashboard/clients/client-1?section=documents",
    );
  });
});
