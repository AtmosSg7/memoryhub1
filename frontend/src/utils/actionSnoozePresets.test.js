import {
  formatPostponedUntil,
  postponeCustomIso,
  postponeInThreeDaysIso,
  postponeLaterTodayIso,
  postponeNextWeekIso,
  postponeTomorrowMorningIso,
  POSTPONE_PRESETS,
} from "./actionSnoozePresets";

describe("actionSnoozePresets", () => {
  const fixed = new Date("2026-08-05T10:15:00");

  it("exposes four quick presets", () => {
    expect(POSTPONE_PRESETS.map((p) => p.id)).toEqual([
      "laterToday",
      "tomorrowMorning",
      "inThreeDays",
      "nextWeek",
    ]);
  });

  it("later today is ~3 hours ahead", () => {
    const iso = postponeLaterTodayIso(fixed);
    const delta = new Date(iso).getTime() - fixed.getTime();
    expect(delta).toBe(3 * 60 * 60 * 1000);
  });

  it("tomorrow morning is next local day at 08:00", () => {
    const d = new Date(postponeTomorrowMorningIso(fixed));
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(0);
    const expected = new Date(fixed);
    expected.setDate(expected.getDate() + 1);
    expect(d.getDate()).toBe(expected.getDate());
  });

  it("in three days is +3 local days at 09:00", () => {
    const d = new Date(postponeInThreeDaysIso(fixed));
    expect(d.getHours()).toBe(9);
    const expected = new Date(fixed);
    expected.setDate(expected.getDate() + 3);
    expect(d.getDate()).toBe(expected.getDate());
  });

  it("next week is +7 local days at 09:00", () => {
    const d = new Date(postponeNextWeekIso(fixed));
    expect(d.getHours()).toBe(9);
    const expected = new Date(fixed);
    expected.setDate(expected.getDate() + 7);
    expect(d.getDate()).toBe(expected.getDate());
  });

  it("custom date uses local timezone", () => {
    const iso = postponeCustomIso("2026-08-10", "14:30");
    expect(iso).toBeTruthy();
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it("custom date returns null without date part", () => {
    expect(postponeCustomIso("", "09:00")).toBeNull();
  });

  it("formats postponed until in local locale", () => {
    const label = formatPostponedUntil("2026-08-10T12:00:00.000Z", "fr");
    expect(label.length).toBeGreaterThan(0);
  });
});
