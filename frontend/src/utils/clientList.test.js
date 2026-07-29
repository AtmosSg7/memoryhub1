import {
  CLIENT_LIST_FILTERS,
  CLIENT_LIST_SORTS,
  FOLLOW_UP_INACTIVITY_DAYS,
  filterAndSortClients,
  getClientLastActivityAt,
  matchesClientFilter,
  matchesClientSearch,
  needsFollowUp,
  sortClients,
} from "./clientList";

const baseClient = {
  id: "c1",
  name: "Martin",
  company: "Martin Plomberie",
  contactName: "Jean Martin",
  email: "jean@martin.fr",
  phone: "0612345678",
  city: "Lyon",
  siret: "12345678901234",
  tags: ["plomberie", "fidèle"],
  isFavorite: false,
  documentsCount: 0,
  notesCount: 0,
  totalRevenue: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  lastActivityAt: "2026-07-01T00:00:00.000Z",
};

describe("clientList helpers", () => {
  it("exposes a tunable follow-up inactivity window", () => {
    expect(FOLLOW_UP_INACTIVITY_DAYS).toBe(90);
  });

  it("searches name, company, phone, email, tags, city and SIRET", () => {
    expect(matchesClientSearch(baseClient, "martin")).toBe(true);
    expect(matchesClientSearch(baseClient, "0612")).toBe(true);
    expect(matchesClientSearch(baseClient, "jean@martin")).toBe(true);
    expect(matchesClientSearch(baseClient, "fidèle")).toBe(true);
    expect(matchesClientSearch(baseClient, "lyon")).toBe(true);
    expect(matchesClientSearch(baseClient, "12345678901234")).toBe(true);
    expect(matchesClientSearch(baseClient, "inconnu")).toBe(false);
  });

  it("matches phone search across spaced, compact and +33 formats", () => {
    expect(matchesClientSearch(baseClient, "06 12 34 56 78")).toBe(true);
    expect(matchesClientSearch(baseClient, "0612345678")).toBe(true);
    expect(matchesClientSearch(baseClient, "+33 6 12 34 56 78")).toBe(true);
    expect(matchesClientSearch(baseClient, "+33612345678")).toBe(true);
    expect(matchesClientSearch(baseClient, "0033 6 12 34 56 78")).toBe(true);
  });

  it("searches nested emails, phones and address cities", () => {
    const client = {
      ...baseClient,
      phone: "",
      emails: [{ id: "e1", value: "billing@martin.fr", isPrimary: true }],
      phones: [{ id: "p1", value: "07 00 00 00 00", isPrimary: true }],
      addresses: [{ id: "a1", city: "Bordeaux", isPrimary: true }],
      companyInfo: { siret: "99887766554433" },
    };
    expect(matchesClientSearch(client, "billing@")).toBe(true);
    expect(matchesClientSearch(client, "+33 7 00 00 00 00")).toBe(true);
    expect(matchesClientSearch(client, "bordeaux")).toBe(true);
    expect(matchesClientSearch(client, "998877")).toBe(true);
  });

  it("filters favorites, follow-up and document presence", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");
    const favorite = { ...baseClient, isFavorite: true };
    const withDocs = { ...baseClient, documentsCount: 2 };
    const stale = {
      ...baseClient,
      updatedAt: "2026-07-20T00:00:00.000Z",
      lastActivityAt: "2026-01-01T00:00:00.000Z",
    };
    const fresh = {
      ...baseClient,
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastActivityAt: "2026-07-20T00:00:00.000Z",
    };

    expect(matchesClientFilter(favorite, CLIENT_LIST_FILTERS.FAVORITES)).toBe(true);
    expect(matchesClientFilter(baseClient, CLIENT_LIST_FILTERS.FAVORITES)).toBe(false);
    expect(matchesClientFilter(withDocs, CLIENT_LIST_FILTERS.WITH_DOCUMENTS)).toBe(true);
    expect(matchesClientFilter(baseClient, CLIENT_LIST_FILTERS.WITHOUT_DOCUMENTS)).toBe(true);
    expect(matchesClientFilter(stale, CLIENT_LIST_FILTERS.FOLLOW_UP, { now })).toBe(true);
    expect(matchesClientFilter(fresh, CLIENT_LIST_FILTERS.FOLLOW_UP, { now })).toBe(false);
  });

  it("uses lastActivityAt for follow-up badge and activity getters", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");
    const client = {
      updatedAt: "2026-07-20T00:00:00.000Z",
      lastActivityAt: "2026-01-01T00:00:00.000Z",
    };
    expect(getClientLastActivityAt(client)).toBe("2026-01-01T00:00:00.000Z");
    expect(needsFollowUp(client, { now })).toBe(true);
    expect(needsFollowUp({ lastActivityAt: "2026-07-01T00:00:00.000Z" }, { now })).toBe(false);
    expect(needsFollowUp({}, { now })).toBe(true);
  });

  it("sorts by lastActivityAt, revenue, name and created date", () => {
    const a = {
      ...baseClient,
      id: "a",
      company: "Alpha",
      totalRevenue: 100,
      updatedAt: "2026-07-20T00:00:00.000Z",
      lastActivityAt: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-02-01T00:00:00.000Z",
    };
    const b = {
      ...baseClient,
      id: "b",
      company: "Beta",
      totalRevenue: 500,
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastActivityAt: "2026-07-20T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    expect(sortClients([a, b], CLIENT_LIST_SORTS.LAST_ACTIVITY).map((c) => c.id)).toEqual(["b", "a"]);
    expect(sortClients([a, b], CLIENT_LIST_SORTS.REVENUE).map((c) => c.id)).toEqual(["b", "a"]);
    expect(sortClients([b, a], CLIENT_LIST_SORTS.NAME).map((c) => c.id)).toEqual(["a", "b"]);
    expect(sortClients([a, b], CLIENT_LIST_SORTS.CREATED_AT).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("combines search, filter and sort", () => {
    const now = new Date("2026-07-27T12:00:00.000Z");
    const clients = [
      { ...baseClient, id: "1", company: "Alpha", isFavorite: true, totalRevenue: 10, lastActivityAt: "2026-07-10T00:00:00.000Z" },
      { ...baseClient, id: "2", company: "Beta", isFavorite: true, totalRevenue: 90, lastActivityAt: "2026-07-20T00:00:00.000Z" },
      { ...baseClient, id: "3", company: "Gamma", isFavorite: false, totalRevenue: 1000 },
    ];
    const result = filterAndSortClients(clients, {
      query: "a",
      filter: CLIENT_LIST_FILTERS.FAVORITES,
      sort: CLIENT_LIST_SORTS.REVENUE,
      now,
    });
    expect(result.map((c) => c.id)).toEqual(["2", "1"]);
  });
});
