const TYPE_STYLES = {
  general: { bg: "bg-[#F3F4F6]", text: "text-[#4B5563]" },
  phone: { bg: "bg-[#EFF6FF]", text: "text-[#0A2540]" },
  meeting: { bg: "bg-[#ECFDF5]", text: "text-[#065F46]" },
  visit: { bg: "bg-[#EFF6FF]", text: "text-[#173A5E]" },
  reminder: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]" },
};

const TYPE_ALIASES = { site: "visit" };

export const NOTE_TYPES = ["general", "phone", "meeting", "visit", "reminder"];

const TYPE_LABELS = {
  fr: {
    general: "Générale",
    phone: "Appel",
    meeting: "Rendez-vous",
    visit: "Visite chantier",
    reminder: "Rappel",
  },
  en: {
    general: "General",
    phone: "Call",
    meeting: "Meeting",
    visit: "Site visit",
    reminder: "Reminder",
  },
};

export function normalizeNoteType(type) {
  if (!type) return "general";
  if (TYPE_ALIASES[type]) return TYPE_ALIASES[type];
  return NOTE_TYPES.includes(type) ? type : "general";
}

export function getNoteTypeStyle(type) {
  return TYPE_STYLES[normalizeNoteType(type)] || TYPE_STYLES.general;
}

export function getNoteTypeLabel(type, lang = "fr") {
  const key = normalizeNoteType(type);
  return TYPE_LABELS[lang]?.[key] || TYPE_LABELS.fr[key] || key;
}

export function getNoteDate(note) {
  return note?.noteDate || note?.createdAt || "";
}

export function formatNoteDate(dateValue, lang = "fr") {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function toDatetimeLocalValue(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeLocalToIso(localValue) {
  if (!localValue) return undefined;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function truncateContent(content, maxLength = 160) {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}…`;
}
