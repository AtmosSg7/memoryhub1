import { buildPhoneSummaryKeys } from "./phoneIntegrationSummary";

describe("buildPhoneSummaryKeys", () => {
  it("returns empty when no stats", () => {
    expect(buildPhoneSummaryKeys(null)).toEqual([]);
    expect(buildPhoneSummaryKeys({})).toEqual([]);
  });

  it("maps phone mailbox stats", () => {
    expect(
      buildPhoneSummaryKeys({
        stats: { linked: 2, unmatched: 1, total: 3, missed: 1 },
      }),
    ).toEqual([
      ["linked", 2],
      ["total", 3],
      ["missed", 1],
      ["unmatched", 1],
    ]);
  });
});
