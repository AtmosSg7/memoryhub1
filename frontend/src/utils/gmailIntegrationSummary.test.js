import { buildGmailSummaryKeys } from "./gmailIntegrationSummary";

describe("buildGmailSummaryKeys", () => {
  it("returns empty when disconnected", () => {
    expect(buildGmailSummaryKeys({ connected: false, stats: { linked: 1, ignored: 0, total: 1 } })).toEqual(
      [],
    );
  });

  it("maps DB stats to linked / ignored / total", () => {
    expect(
      buildGmailSummaryKeys({
        connected: true,
        stats: { linked: 12, ignored: 3, total: 100 },
        lastSync: { created: 0, skipped: 95, total: 0 },
      }),
    ).toEqual([
      ["linked", 12],
      ["ignored", 3],
      ["total", 100],
    ]);
  });

  it("does not fall back to lastSync deltas", () => {
    expect(
      buildGmailSummaryKeys({
        connected: true,
        stats: { linked: 5, ignored: 0, total: 100 },
        lastSync: { created: 0, skipped: 0, total: 0 },
      }),
    ).toEqual([
      ["linked", 5],
      ["ignored", 0],
      ["total", 100],
    ]);
  });
});
