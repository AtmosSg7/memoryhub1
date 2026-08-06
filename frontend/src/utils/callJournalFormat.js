/** Helpers for Phone Hub V2 call journal UI. */

export function formatCallDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const total = Math.max(0, Math.floor(Number(seconds)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m} min ${String(s).padStart(2, "0")}s`;
}

export function formatCallWhen(iso, lang = "fr") {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function callDisplayName(call) {
  return (
    call?.clientName?.trim() ||
    call?.counterpartyName?.trim() ||
    call?.phoneNumber?.trim() ||
    call?.normalizedPhone?.trim() ||
    "—"
  );
}

export function callStatusTone(status) {
  const key = String(status || "").toLowerCase();
  if (key === "missed" || key === "rejected") return "danger";
  if (key === "voicemail") return "warn";
  if (key === "spam" || key === "blocked") return "muted";
  if (key === "answered" || key === "outgoing" || key === "incoming") return "ok";
  return "neutral";
}

export const CALL_FILTERS = [
  "all",
  "missed",
  "callback",
  "clients",
  "unknowns",
  "today",
  "7d",
  "30d",
];
