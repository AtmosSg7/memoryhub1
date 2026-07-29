/**
 * Client timeline — grouping, channels, date/time helpers.
 *
 * Built on top of the append-only events ledger. Future channels
 * (call / email / WhatsApp / calendar / contacts) map through
 * TIMELINE_CHANNELS without requiring UI integrations yet.
 */

/** Collapse identical consecutive events within this window. */
export const TIMELINE_GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Event types that may collapse into a single timeline row. */
export const GROUPABLE_EVENT_TYPES = Object.freeze([
  "document_uploaded",
  "document_deleted",
]);

/**
 * Reserved channel ids for future integrations.
 * Only ``internal`` and ``import`` are productized today.
 */
export const TIMELINE_CHANNELS = Object.freeze({
  INTERNAL: "internal",
  IMPORT: "import",
  CALL: "call",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
  CALENDAR: "calendar",
  CONTACTS: "contacts",
});

const FUTURE_TYPE_CHANNELS = Object.freeze({
  call_logged: TIMELINE_CHANNELS.CALL,
  email_sent: TIMELINE_CHANNELS.EMAIL,
  email_received: TIMELINE_CHANNELS.EMAIL,
  whatsapp_message: TIMELINE_CHANNELS.WHATSAPP,
  calendar_event_synced: TIMELINE_CHANNELS.CALENDAR,
  contacts_synced: TIMELINE_CHANNELS.CONTACTS,
});

function parseMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function isImportMetadata(metadata) {
  return metadata?.source === "import" || Boolean(metadata?.importSessionId);
}

export function getTimelineChannel(event) {
  if (!event) return TIMELINE_CHANNELS.INTERNAL;
  if (FUTURE_TYPE_CHANNELS[event.type]) return FUTURE_TYPE_CHANNELS[event.type];
  if (isImportMetadata(event.metadata)) return TIMELINE_CHANNELS.IMPORT;
  return TIMELINE_CHANNELS.INTERNAL;
}

export function formatTimelineDateTime(createdAt, lang = "fr") {
  if (!createdAt) {
    return { date: "", time: "", dayKey: "", label: "" };
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return { date: String(createdAt), time: "", dayKey: "", label: String(createdAt) };
  }

  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const dateLabel = date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayKey = date.toISOString().slice(0, 10);

  return {
    date: dateLabel,
    time: timeLabel,
    dayKey,
    label: `${dateLabel} · ${timeLabel}`,
  };
}

function withinWindow(a, b, windowMs) {
  return Math.abs(parseMs(a) - parseMs(b)) <= windowMs;
}

function sameImportSession(a, b) {
  const sessionA = a?.metadata?.importSessionId;
  const sessionB = b?.metadata?.importSessionId;
  if (!sessionA && !sessionB) return true;
  if (sessionA && sessionB) return sessionA === sessionB;
  return true;
}

/**
 * Group identical consecutive events (newest-first list).
 * Returns items: { kind: 'single'|'group', ... }
 */
export function groupTimelineEvents(events, { windowMs = TIMELINE_GROUP_WINDOW_MS } = {}) {
  const list = Array.isArray(events) ? events : [];
  const items = [];
  let index = 0;

  while (index < list.length) {
    const current = list[index];
    const groupable = GROUPABLE_EVENT_TYPES.includes(current?.type);

    if (!groupable) {
      items.push({
        kind: "single",
        id: current.id,
        event: current,
        createdAt: current.createdAt,
        channel: getTimelineChannel(current),
      });
      index += 1;
      continue;
    }

    const group = [current];
    let cursor = index + 1;
    while (cursor < list.length) {
      const next = list[cursor];
      if (next?.type !== current.type) break;
      if (!withinWindow(current.createdAt, next.createdAt, windowMs)) break;
      if (!sameImportSession(current, next)) break;
      group.push(next);
      cursor += 1;
    }

    if (group.length === 1) {
      items.push({
        kind: "single",
        id: current.id,
        event: current,
        createdAt: current.createdAt,
        channel: getTimelineChannel(current),
      });
    } else {
      items.push({
        kind: "group",
        id: `group-${group.map((e) => e.id).join("-").slice(0, 64)}`,
        type: current.type,
        events: group,
        count: group.length,
        createdAt: group[0].createdAt,
        channel: getTimelineChannel(current),
      });
    }
    index = cursor;
  }

  return items;
}

/**
 * Build display rows with optional day separators (newest-first).
 * Each row is either { kind: 'day', dayKey, label } or a timeline item.
 */
export function buildTimelineRows(events, { lang = "fr", windowMs = TIMELINE_GROUP_WINDOW_MS } = {}) {
  const grouped = groupTimelineEvents(events, { windowMs });
  const rows = [];
  let lastDayKey = null;

  for (const item of grouped) {
    const dt = formatTimelineDateTime(item.createdAt, lang);
    if (dt.dayKey && dt.dayKey !== lastDayKey) {
      rows.push({
        kind: "day",
        id: `day-${dt.dayKey}`,
        dayKey: dt.dayKey,
        label: dt.date,
      });
      lastDayKey = dt.dayKey;
    }
    rows.push({ ...item, dateTime: dt });
  }

  return rows;
}

export function getGroupedDocumentsRoute(item) {
  const first = item?.events?.[0] || item?.event;
  if (first?.clientId) {
    return `/dashboard/clients/${first.clientId}?section=documents`;
  }
  return "/dashboard/files";
}

export function getGroupFileNames(item) {
  return (item?.events || [])
    .map((event) => event?.metadata?.fileName)
    .filter(Boolean);
}

/** Ensure chronological newest-first order (defensive). */
export function sortEventsNewestFirst(events) {
  return [...(events || [])].sort((a, b) => parseMs(b.createdAt) - parseMs(a.createdAt));
}
