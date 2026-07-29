export function splitRemindAt(isoValue) {
  if (!isoValue) return { date: "", time: "08:00" };
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return { date: "", time: "08:00" };
  const pad = (n) => String(n).padStart(2, "0");
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return { date: datePart, time: timePart };
}

export function combineDateAndTimeToIso(datePart, timePart) {
  if (!datePart) return null;
  const time = timePart || "08:00";
  const local = new Date(`${datePart}T${time}`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

export function formatPersonalReminderSchedule(dateValue, lang = "fr", t) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  if (sameDay) {
    return t("personalReminder.schedule.today").replace("{time}", time);
  }
  if (isTomorrow) {
    return t("personalReminder.schedule.tomorrow").replace("{time}", time);
  }

  const day = date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  return t("personalReminder.schedule.onDate").replace("{date}", day).replace("{time}", time);
}

export function snoozeOneHourIso() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

export function snoozeTomorrowMorningIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date.toISOString();
}

export function personalReminderToDashboardAction(item, t, lang) {
  return {
    id: `personal_reminder:${item.id}`,
    type: "personal_reminder",
    priority: "high",
    title: t("personalReminder.dashboardLabel"),
    description: item.message,
    scheduleLabel: formatPersonalReminderSchedule(item.remindAt, lang, t),
    noteId: item.noteId,
    clientId: item.clientId,
    clientName: item.clientName,
    personalReminderId: item.id,
    date: item.remindAt,
    resolved: false,
  };
}
