import {
  ANALYTICS_PERIOD_KEYS,
  DEFAULT_ANALYTICS_PERIOD,
  buildAnalyticsPeriodSearchParams,
  isValidAnalyticsPeriod,
  isValidIsoDate,
  parseAnalyticsPeriodParams,
} from "./analyticsPeriod";

describe("analyticsPeriod", () => {
  it("validates known period keys", () => {
    expect(ANALYTICS_PERIOD_KEYS).toContain("30d");
    expect(isValidAnalyticsPeriod("30d")).toBe(true);
    expect(isValidAnalyticsPeriod("custom")).toBe(true);
    expect(isValidAnalyticsPeriod("forever")).toBe(false);
  });

  it("validates ISO dates", () => {
    expect(isValidIsoDate("2026-07-01")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("07-01-2026")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });

  it("defaults invalid period to 30d", () => {
    const params = new URLSearchParams("period=nope");
    expect(parseAnalyticsPeriodParams(params)).toEqual({
      period: DEFAULT_ANALYTICS_PERIOD,
      from: "",
      to: "",
    });
  });

  it("keeps custom range when from/to are valid", () => {
    const params = new URLSearchParams("period=custom&from=2026-01-01&to=2026-01-31");
    expect(parseAnalyticsPeriodParams(params)).toEqual({
      period: "custom",
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("falls back when custom range is invalid", () => {
    const params = new URLSearchParams("period=custom&from=2026-02-01&to=2026-01-01");
    expect(parseAnalyticsPeriodParams(params)).toEqual({
      period: DEFAULT_ANALYTICS_PERIOD,
      from: "",
      to: "",
    });
  });

  it("builds search params for preset and custom periods", () => {
    const preset = buildAnalyticsPeriodSearchParams({ period: "7d" }, "foo=1&from=2026-01-01");
    expect(preset.get("period")).toBe("7d");
    expect(preset.get("foo")).toBe("1");
    expect(preset.get("from")).toBeNull();

    const custom = buildAnalyticsPeriodSearchParams(
      { period: "custom", from: "2026-03-01", to: "2026-03-15" },
      ""
    );
    expect(custom.get("period")).toBe("custom");
    expect(custom.get("from")).toBe("2026-03-01");
    expect(custom.get("to")).toBe("2026-03-15");
  });
});
