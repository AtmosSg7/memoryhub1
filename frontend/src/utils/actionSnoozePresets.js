import { combineDateAndTimeToIso } from "@/utils/personalReminderDisplay";

/**
 * Local-timezone presets for postponing Action Engine items ("Reporter").
 * All helpers return ISO-8601 UTC strings suitable for POST /api/actions/{id}/snooze.
 */

/** Later today: +3 hours from now (local clock → ISO UTC). */
export function postponeLaterTodayIso(now = new Date()) {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

/** Tomorrow morning at 08:00 local. */
export function postponeTomorrowMorningIso(now = new Date()) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

/** In 3 days at 09:00 local. */
export function postponeInThreeDaysIso(now = new Date()) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 3);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** Next week ( +7 days ) at 09:00 local. */
export function postponeNextWeekIso(now = new Date()) {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export const POSTPONE_PRESETS = Object.freeze([
  { id: "laterToday", until: postponeLaterTodayIso },
  { id: "tomorrowMorning", until: postponeTomorrowMorningIso },
  { id: "inThreeDays", until: postponeInThreeDaysIso },
  { id: "nextWeek", until: postponeNextWeekIso },
]);

/** Custom local date + time → ISO, or null if invalid. */
export function postponeCustomIso(datePart, timePart = "09:00") {
  return combineDateAndTimeToIso(datePart, timePart || "09:00");
}

/**
 * Human-readable postponed-until label (local TZ).
 * @param {string|null|undefined} iso
 * @param {'fr'|'en'} [lang]
 */
export function formatPostponedUntil(iso, lang = "fr") {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = lang === "en" ? "en-GB" : "fr-FR";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "";
  }
}
