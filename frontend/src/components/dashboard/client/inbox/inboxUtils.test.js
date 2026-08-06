import {
  avatarTone,
  buildHybridThreadRows,
  dayBucket,
  formatFileSize,
  formatSmartTime,
  indexActionsByConversation,
  indexIntelFromTimeline,
  initialsFrom,
  isImageAttachment,
  primaryParticipant,
} from "./inboxUtils";

describe("inboxUtils", () => {
  it("builds initials from name and email", () => {
    expect(initialsFrom("Alice Martin")).toBe("AM");
    expect(initialsFrom("bob@example.com")).toBe("BO");
    expect(initialsFrom("")).toBe("?");
  });

  it("picks stable avatar tones", () => {
    expect(avatarTone("a@x.com")).toBe(avatarTone("a@x.com"));
    expect(avatarTone("a@x.com")).not.toBe(avatarTone("b@x.com"));
  });

  it("classifies day buckets", () => {
    const now = new Date("2026-08-06T15:00:00");
    expect(dayBucket(now.toISOString(), now)).toBe("today");
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(dayBucket(yesterday.toISOString(), now)).toBe("yesterday");
  });

  it("formats smart time for today", () => {
    const now = new Date("2026-08-06T15:00:00");
    const label = formatSmartTime("2026-08-06T09:30:00", "fr", now);
    expect(label).toMatch(/\d/);
  });

  it("formats file sizes and detects images", () => {
    expect(formatFileSize(2048)).toContain("Ko");
    expect(isImageAttachment({ mimeType: "image/png", filename: "a.png" })).toBe(true);
    expect(isImageAttachment({ mimeType: "application/pdf", filename: "a.pdf" })).toBe(false);
  });

  it("reads primary participant", () => {
    const p = primaryParticipant(
      [
        { role: "to", email: "me@x.com" },
        { role: "from", displayName: "Alex", email: "alex@x.com" },
      ],
      "Fallback",
    );
    expect(p.name).toBe("Alex");
    expect(p.email).toBe("alex@x.com");
  });

  it("builds hybrid thread with day separators and commercial events", () => {
    const rows = buildHybridThreadRows(
      [
        {
          id: "m1",
          createdAt: "2026-08-06T09:00:00.000Z",
          preview: "Bonjour",
          direction: "inbound",
        },
        {
          id: "m2",
          createdAt: "2026-08-06T14:00:00.000Z",
          preview: "Suite",
          direction: "outbound",
        },
      ],
      [
        {
          id: "q1",
          createdAt: "2026-08-06T11:00:00.000Z",
          category: "commercial",
          title: "Devis envoyé",
          type: "quote_sent",
        },
        {
          id: "e1",
          createdAt: "2026-08-06T10:00:00.000Z",
          category: "communications",
          title: "should skip",
        },
      ],
      {
        firstMessageAt: "2026-08-06T09:00:00.000Z",
        lastMessageAt: "2026-08-06T14:00:00.000Z",
      },
      "fr",
    );
    expect(rows.some((r) => r.kind === "day")).toBe(true);
    expect(rows.filter((r) => r.kind === "message")).toHaveLength(2);
    expect(rows.filter((r) => r.kind === "event")).toHaveLength(1);
    const kinds = rows.filter((r) => r.kind !== "day").map((r) => r.kind);
    expect(kinds).toEqual(["message", "event", "message"]);
  });

  it("indexes actions and intel by conversation", () => {
    const { byConv, byComm } = indexActionsByConversation([
      {
        id: "a1",
        communicationId: "c1",
        metadata: { conversationId: "conv1" },
      },
    ]);
    expect(byConv.get("conv1").id).toBe("a1");
    expect(byComm.get("c1").id).toBe("a1");

    const intel = indexIntelFromTimeline([
      {
        metadata: { conversationId: "conv1" },
        intelligence: { intent: "request_quote" },
      },
    ]);
    expect(intel.get("conv1").intent).toBe("request_quote");
  });
});
