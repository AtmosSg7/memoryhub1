import { buildPhoneSummaryKeys } from "./phoneIntegrationSummary";

describe("buildPhoneSummaryKeys", () => {
  test("returns empty when no stats", () => {
    expect(buildPhoneSummaryKeys(null)).toEqual([]);
    expect(buildPhoneSummaryKeys({})).toEqual([]);
  });

  test("maps journal stats keys", () => {
    const keys = buildPhoneSummaryKeys({
      stats: { linked: 2, total: 5, missed: 1, unmatched: 3 },
    });
    expect(keys).toEqual([
      ["linked", 2],
      ["total", 5],
      ["missed", 1],
      ["unmatched", 3],
    ]);
  });
});
