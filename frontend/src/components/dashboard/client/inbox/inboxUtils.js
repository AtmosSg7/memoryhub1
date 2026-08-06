/** Pure helpers for Client Inbox premium UX. */

export function initialsFrom(nameOrEmail) {
  const raw = String(nameOrEmail || "").trim();
  if (!raw) return "?";
  if (raw.includes("@")) {
    const local = raw.split("@")[0] || "?";
    return local.slice(0, 2).toUpperCase();
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

const AVATAR_TONES = [
  "bg-[#EEF2FF] text-[#3730A3]",
  "bg-[#ECFDF5] text-[#065F46]",
  "bg-[#FFF7ED] text-[#9A3412]",
  "bg-[#FDF2F8] text-[#9D174D]",
  "bg-[#F0F9FF] text-[#075985]",
  "bg-[#F5F3FF] text-[#5B21B6]",
];

export function avatarTone(seed) {
  const s = String(seed || "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function parseIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** @returns {'today'|'yesterday'|'this_week'|'older'} */
export function dayBucket(iso, now = new Date()) {
  const date = parseIso(iso);
  if (!date) return "older";
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startToday - startThat) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays > 1 && diffDays < 7) return "this_week";
  return "older";
}

export function formatSmartTime(iso, lang = "fr", now = new Date()) {
  const date = parseIso(iso);
  if (!date) return "";
  const locale = lang === "en" ? "en-GB" : "fr-FR";
  const bucket = dayBucket(iso, now);
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (bucket === "today") return time;
  if (bucket === "yesterday") return lang === "en" ? `Yesterday ${time}` : `Hier ${time}`;
  if (bucket === "this_week") {
    const weekday = date.toLocaleDateString(locale, { weekday: "short" });
    return `${weekday} ${time}`;
  }
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function isImageAttachment(att) {
  const mime = String(att?.mimeType || "").toLowerCase();
  const name = String(att?.filename || "").toLowerCase();
  return mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/.test(name);
}

export function primaryParticipant(participants, fallbackName) {
  const list = Array.isArray(participants) ? participants : [];
  const from = list.find((p) => p.role === "from") || list[0];
  return {
    name: from?.displayName || fallbackName || from?.email || "",
    email: from?.email || "",
    phone: from?.phone || "",
  };
}

export function messageAuthor(msg) {
  const from = (msg?.participants || []).find((p) => p.role === "from");
  if (from?.displayName || from?.email) {
    return { name: from.displayName || from.email, email: from.email || "" };
  }
  const meta = msg?.metadata || {};
  return {
    name: meta.fromName || meta.fromEmail || "",
    email: meta.fromEmail || "",
  };
}

/**
 * Build chronological thread rows: day separators, messages, commercial events.
 * @param {object[]} messages
 * @param {object[]} events timeline items (commercial / notes / docs)
 * @param {object} conversation
 * @param {string} lang
 */
export function buildHybridThreadRows(messages, events, conversation, lang = "fr") {
  const msgs = Array.isArray(messages) ? messages : [];
  const first = parseIso(conversation?.firstMessageAt) || parseIso(msgs[0]?.createdAt);
  const last = parseIso(conversation?.lastMessageAt) || parseIso(msgs[msgs.length - 1]?.createdAt);
  const padMs = 36 * 60 * 60 * 1000;
  const from = first ? new Date(first.getTime() - padMs) : null;
  const to = last ? new Date(last.getTime() + padMs) : null;

  const commercial = (Array.isArray(events) ? events : []).filter((ev) => {
    if (!ev) return false;
    if (ev.category === "communications") return false;
    if (ev.kind === "action" || ev.category === "actions") return false;
    const t = parseIso(ev.createdAt);
    if (!t) return false;
    if (from && t < from) return false;
    if (to && t > to) return false;
    return ["commercial", "notes", "documents"].includes(ev.category);
  });

  const items = [
    ...msgs.map((m) => ({ kind: "message", id: `msg-${m.id}`, at: m.createdAt, message: m })),
    ...commercial.map((e) => ({
      kind: "event",
      id: `evt-${e.id}`,
      at: e.createdAt,
      event: e,
    })),
  ].sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));

  const rows = [];
  let lastBucket = null;
  for (const item of items) {
    const bucket = dayBucket(item.at);
    if (bucket !== lastBucket) {
      rows.push({
        kind: "day",
        id: `day-${bucket}-${item.at || rows.length}`,
        bucket,
      });
      lastBucket = bucket;
    }
    rows.push(item);
  }
  return rows;
}

/** Index pending actions by conversationId / communicationId for list badges. */
export function indexActionsByConversation(actions, conversations) {
  const byConv = new Map();
  const byComm = new Map();
  for (const action of actions || []) {
    const convId = action?.metadata?.conversationId;
    if (convId) {
      if (!byConv.has(convId)) byConv.set(convId, action);
    }
    if (action?.communicationId) {
      byComm.set(action.communicationId, action);
    }
  }
  // Fallback: match communicationId against known conversation message sets is done at enrich time.
  return { byConv, byComm };
}

export function enrichConversation(
  conv,
  { actionsByConv, actionsByComm, intelByConv, client },
) {
  const action =
    actionsByConv?.get(conv.id) ||
    null;
  const intel = intelByConv?.get(conv.id) || null;
  const participant = primaryParticipant(conv.participants, conv.clientName || client?.name);
  return {
    ...conv,
    _participant: participant,
    _hasAction: Boolean(action),
    _action: action,
    _hasIntel: Boolean(intel?.suggestedActionTitle || intel?.intent || intel?.summary),
    _intel: intel,
    _isClient: Boolean(conv.clientId || client?.id),
    _isProspect: Boolean(!conv.clientId && !client?.id),
  };
}

export function indexIntelFromTimeline(items) {
  const map = new Map();
  for (const item of items || []) {
    const convId = item?.metadata?.conversationId;
    if (!convId) continue;
    if (item.intelligence) map.set(convId, item.intelligence);
  }
  return map;
}
