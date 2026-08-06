/** Timeline V2 helpers — filters, relative dates, presentation (no mock invent). */

export const TIMELINE_V2_FILTERS = Object.freeze([
  "all",
  "communications",
  "commercial",
  "actions",
  "notes",
  "documents",
]);

/** Future channel placeholders (not productized filters yet). */
export const TIMELINE_V2_FUTURE_CHANNELS = Object.freeze([
  "phone",
  "whatsapp",
  "sms",
  "calendar",
]);

export function formatRelativeDay(iso, lang = "fr", now = new Date()) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startToday - startThat) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return lang === "en" ? "Today" : "Aujourd'hui";
  if (diffDays === 1) return lang === "en" ? "Yesterday" : "Hier";

  const locale = lang === "en" ? "en-GB" : "fr-FR";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatCardTime(iso, lang = "fr") {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = lang === "en" ? "en-GB" : "fr-FR";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function dayKeyFromIso(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Build day-separated rows from V2 items (newest first).
 * @param {object[]} items
 * @param {string} [lang]
 */
export function buildTimelineV2Rows(items, lang = "fr") {
  const list = Array.isArray(items) ? items : [];
  const rows = [];
  let lastDay = null;
  for (const item of list) {
    const key = dayKeyFromIso(item.createdAt);
    if (key && key !== lastDay) {
      rows.push({
        kind: "day",
        id: `day-${key}`,
        dayKey: key,
        label: formatRelativeDay(item.createdAt, lang),
      });
      lastDay = key;
    }
    rows.push({ kind: "item", id: item.id, item });
  }
  return rows;
}

export function formatAmountCents(cents, lang = "fr") {
  if (cents == null || Number.isNaN(Number(cents))) return "";
  const euros = Number(cents) / 100;
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-GB" : "fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(euros);
  } catch {
    return `${euros} €`;
  }
}

export function timelineItemRoute(item, clientId) {
  if (!item) return null;
  const base = clientId ? `/dashboard/clients/${encodeURIComponent(clientId)}` : null;
  if (item.kind === "communication" || item.category === "communications") {
    const convId = item.metadata?.conversationId;
    if (base && convId) {
      return `${base}?section=emails&conversation=${encodeURIComponent(convId)}`;
    }
    if (convId) {
      return `/dashboard/communications?conversation=${encodeURIComponent(convId)}`;
    }
    const cid = item.metadata?.communicationId || item.entityId;
    if (cid) {
      return `/dashboard/communications?open=${encodeURIComponent(cid)}`;
    }
    return base ? `${base}?section=emails` : "/dashboard/communications";
  }
  if (item.entityType === "quote") {
    return base ? `${base}?section=quotes` : null;
  }
  if (item.entityType === "invoice") {
    return base ? `${base}?section=invoices` : null;
  }
  if (item.entityType === "note") {
    return base ? `${base}?section=notes` : null;
  }
  if (item.entityType === "document") {
    return base ? `${base}?section=documents` : null;
  }
  if (item.kind === "action") {
    return "/dashboard";
  }
  return base ? `${base}?section=timeline` : null;
}

/** Client-side search helper over loaded cards (global search still hits entities). */
export function filterTimelineItemsByQuery(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items || [];
  return (items || []).filter((item) => {
    const hay = item.searchableText || [item.title, item.summary, item.type].filter(Boolean).join(" ");
    return hay.toLowerCase().includes(q);
  });
}
