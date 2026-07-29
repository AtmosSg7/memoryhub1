import { formatDateFilterFr, parseDateFilterParam } from "./parseDateFilterParam";

describe("parseDateFilterParam", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(parseDateFilterParam("2026-07-01")).toBe("2026-07-01");
  });

  it("ignores invalid values", () => {
    expect(parseDateFilterParam("")).toBe("");
    expect(parseDateFilterParam("not-a-date")).toBe("");
    expect(parseDateFilterParam("2026-13-01")).toBe("");
    expect(parseDateFilterParam("2026-02-30")).toBe("");
  });

  it("formats French dates", () => {
    const label = formatDateFilterFr("2026-07-01", "fr");
    expect(label).toMatch(/2026/);
    expect(label.toLowerCase()).toMatch(/juil/);
  });
});
