import { ACTION_TYPES } from "@/constants/actionTypes";
import {
  actionEngineBannerText,
  actionEngineGroupKey,
  actionEngineLink,
  groupActionEngineItems,
  isActionOverdue,
  mapActionEngineItem,
  sortActionEngineItems,
  summarizeActionPriorities,
} from "./actionEngineDisplay";

const t = (key) => {
  if (key === "dashboardV2.engine.bannerCount") return "{count} actions à traiter aujourd'hui";
  if (key === "dashboardV2.engine.bannerEmpty") return "Rien à traiter pour le moment";
  return key;
};

function action(overrides = {}) {
  return {
    id: overrides.id || "a1",
    type: ACTION_TYPES.REPLY_TO_PROSPECT,
    priority: "normal",
    title: "Répondre",
    description: "Nouveau message",
    createdAt: "2026-08-05T10:00:00.000Z",
    dueAt: null,
    source: "communication",
    metadata: {},
    ...overrides,
  };
}

describe("actionEngineDisplay", () => {
  it("maps snoozedUntil for postponed display", () => {
    const mapped = mapActionEngineItem(
      action({ snoozedUntil: "2026-08-10T08:00:00Z" }),
      t
    );
    expect(mapped.snoozedUntil).toBe("2026-08-10T08:00:00Z");
  });

  it("maps links for each supported action type", () => {
    expect(
      actionEngineLink(
        action({
          type: ACTION_TYPES.REPLY_TO_PROSPECT,
          communicationId: "c1",
        })
      )
    ).toContain("/dashboard/communications?open=c1");

    expect(
      actionEngineLink(
        action({
          type: ACTION_TYPES.READ_CLIENT_REPLY,
          clientId: "client-1",
        })
      )
    ).toBe("/dashboard/clients/client-1");

    expect(
      actionEngineLink(
        action({
          type: ACTION_TYPES.FOLLOW_UP_OVERDUE_INVOICE,
          metadata: { invoiceId: "inv-9" },
        })
      )
    ).toContain("kind=invoice");

    expect(
      actionEngineLink(
        action({
          type: ACTION_TYPES.CREATE_INVOICE_FROM_QUOTE,
          metadata: { quoteId: "q-9" },
        })
      )
    ).toBe("/dashboard/documents?import=1");

    expect(
      actionEngineLink(
        action({
          type: ACTION_TYPES.PREPARE_QUOTE,
          clientId: "client-9",
        })
      )
    ).toBe("/dashboard/documents?import=1");

    expect(
      actionEngineLink(
        action({
          type: ACTION_TYPES.CALL_BACK,
          clientId: "client-2",
        })
      )
    ).toBe("/dashboard/clients/client-2");
  });

  it("sorts by priority then due date then createdAt", () => {
    const sorted = sortActionEngineItems([
      action({ id: "n", priority: "normal", createdAt: "2026-08-05T12:00:00.000Z" }),
      action({
        id: "u",
        priority: "urgent",
        dueAt: "2026-08-06T10:00:00.000Z",
        createdAt: "2026-08-05T09:00:00.000Z",
      }),
      action({
        id: "h-soon",
        priority: "high",
        dueAt: "2026-08-05T08:00:00.000Z",
      }),
      action({
        id: "h-later",
        priority: "high",
        dueAt: "2026-08-07T08:00:00.000Z",
      }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["u", "h-soon", "h-later", "n"]);
  });

  it("groups only non-empty categories in product order", () => {
    const groups = groupActionEngineItems([
      action({ id: "1", type: ACTION_TYPES.CREATE_INVOICE_FROM_QUOTE }),
      action({ id: "2", type: ACTION_TYPES.REPLY_TO_PROSPECT }),
      action({
        id: "3",
        type: ACTION_TYPES.FOLLOW_UP_OVERDUE_INVOICE,
        priority: "urgent",
      }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["prospects", "invoices", "quotes"]);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  it("summarizes priorities and overdue without inventing counts", () => {
    const summary = summarizeActionPriorities([
      action({ priority: "urgent", dueAt: "2020-01-01T00:00:00.000Z" }),
      action({ priority: "high" }),
      action({ priority: "normal" }),
      action({ priority: "low" }),
    ]);
    expect(summary).toEqual({
      urgent: 1,
      high: 1,
      normal: 1,
      low: 1,
      overdue: 1,
      total: 4,
    });
    expect(isActionOverdue(action({ dueAt: null }))).toBe(false);
  });

  it("maps dashboard row fields without mock/fallback content", () => {
    const row = mapActionEngineItem(
      action({
        type: ACTION_TYPES.READ_CLIENT_REPLY,
        clientId: "c1",
        title: "Lire la réponse",
        description: "Suite devis",
        metadata: { clientName: "Dupont" },
        priority: "high",
      }),
      t
    );
    expect(row.title).toBe("Lire la réponse");
    expect(row.partyLabel).toBe("Dupont");
    expect(row.uiPriority).toBe("high");
    expect(row.link).toBe("/dashboard/clients/c1");
    expect(row.kind).toBe("action_engine");
    expect(row.ruleId).toBe(ACTION_TYPES.READ_CLIENT_REPLY);
    expect(actionEngineGroupKey(row)).toBe("client_replies");
  });

  it("builds banner text from real totals only", () => {
    expect(actionEngineBannerText({ total: 0 }, t)).toBe("Rien à traiter pour le moment");
    expect(actionEngineBannerText({ total: 5 }, t)).toBe("5 actions à traiter aujourd'hui");
  });

  it("does not duplicate ids across groups", () => {
    const items = [
      action({ id: "a", type: ACTION_TYPES.REPLY_TO_PROSPECT }),
      action({ id: "b", type: ACTION_TYPES.READ_CLIENT_REPLY, clientId: "x" }),
    ];
    const groups = groupActionEngineItems(items);
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
