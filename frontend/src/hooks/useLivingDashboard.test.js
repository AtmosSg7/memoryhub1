import { isToday } from "./useLivingDashboard";

describe("useLivingDashboard helpers", () => {
  it("isToday accepts today's ISO timestamps", () => {
    const now = new Date();
    expect(isToday(now.toISOString())).toBe(true);
  });

  it("isToday rejects other days and invalid values", () => {
    expect(isToday("2020-01-01T12:00:00.000Z")).toBe(false);
    expect(isToday("")).toBe(false);
    expect(isToday(null)).toBe(false);
    expect(isToday("not-a-date")).toBe(false);
  });
});
