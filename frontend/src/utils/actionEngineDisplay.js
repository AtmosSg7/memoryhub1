import { ACTION_TYPES } from "@/constants/actionTypes";
import { commercialDocumentsPath } from "@/utils/commercialDocumentsPath";

/** @typedef {'urgent'|'high'|'normal'|'low'} EnginePriority */

export const ENGINE_PRIORITY_RANK = Object.freeze({
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
});

/** UI badge keys used by existing dash-badge styles */
export const ENGINE_TO_UI_PRIORITY = Object.freeze({
  urgent: "critical",
  high: "high",
  normal: "medium",
  low: "low",
});

export const ACTION_GROUP_ORDER = Object.freeze([
  "prospects",
  "client_replies",
  "invoices",
  "quotes",
  "calls",
  "other",
]);

const TYPE_TO_GROUP = Object.freeze({
  [ACTION_TYPES.REPLY_TO_PROSPECT]: "prospects",
  [ACTION_TYPES.READ_CLIENT_REPLY]: "client_replies",
  [ACTION_TYPES.FOLLOW_UP_OVERDUE_INVOICE]: "invoices",
  [ACTION_TYPES.CREATE_INVOICE_FROM_QUOTE]: "quotes",
  [ACTION_TYPES.CALL_BACK]: "calls",
});

/**
 * @param {import("@/lib/actionsApi").Action | object} action
 * @returns {string}
 */
export function actionEngineGroupKey(action) {
  return TYPE_TO_GROUP[action?.type] || "other";
}

/**
 * Primary navigation target for an Action Engine item.
 * @param {object} action
 * @returns {string|null}
 */
export function actionEngineLink(action) {
  if (!action) return null;
  const meta = action.metadata || {};
  const type = action.type;

  if (type === ACTION_TYPES.REPLY_TO_PROSPECT) {
    if (action.communicationId) {
      return `/dashboard/communications?open=${encodeURIComponent(action.communicationId)}`;
    }
    return "/dashboard/prospects";
  }

  if (type === ACTION_TYPES.READ_CLIENT_REPLY) {
    if (action.clientId) {
      return `/dashboard/clients/${encodeURIComponent(action.clientId)}`;
    }
    if (action.communicationId) {
      return `/dashboard/communications?open=${encodeURIComponent(action.communicationId)}`;
    }
    return "/dashboard/communications";
  }

  if (
    type === ACTION_TYPES.CALL_BACK ||
    type === ACTION_TYPES.SCHEDULE_APPOINTMENT ||
    type === ACTION_TYPES.HANDLE_COMPLAINT ||
    type === ACTION_TYPES.ANSWER_QUESTION ||
    type === ACTION_TYPES.FOLLOW_UP_COMMUNICATION ||
    type === ACTION_TYPES.REVIEW_PAYMENT ||
    type === ACTION_TYPES.REVIEW_DOCUMENT
  ) {
    if (action.communicationId) {
      return `/dashboard/communications?open=${encodeURIComponent(action.communicationId)}`;
    }
    if (action.clientId) {
      return `/dashboard/clients/${encodeURIComponent(action.clientId)}`;
    }
    return "/dashboard/communications";
  }

  if (type === ACTION_TYPES.FOLLOW_UP_OVERDUE_INVOICE) {
    const invoiceId = meta.invoiceId || meta.invoice_id;
    return commercialDocumentsPath({
      kind: "invoice",
      status: "overdue",
      open: invoiceId || undefined,
      clientId: action.clientId || undefined,
    });
  }

  if (type === ACTION_TYPES.CREATE_INVOICE_FROM_QUOTE || type === ACTION_TYPES.PREPARE_QUOTE) {
    return "/dashboard/documents?import=1";
  }

  if (action.clientId) {
    return `/dashboard/clients/${encodeURIComponent(action.clientId)}`;
  }
  return null;
}

/**
 * Secondary navigation (client / prospects hub).
 * @param {object} action
 * @returns {{ labelKey: string, path: string }|null}
 */
export function actionEngineSecondaryNav(action) {
  if (!action) return null;
  if (action.type === ACTION_TYPES.REPLY_TO_PROSPECT) {
    return { labelKey: "dashboardV2.engine.openProspects", path: "/dashboard/prospects" };
  }
  if (action.clientId) {
    return {
      labelKey: "dashboardV2.engine.openClient",
      path: `/dashboard/clients/${encodeURIComponent(action.clientId)}`,
    };
  }
  return null;
}

function parseTs(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * @param {object} action
 * @param {Date} [now]
 */
export function isActionOverdue(action, now = new Date()) {
  const due = parseTs(action?.dueAt);
  if (due == null) return false;
  return due < now.getTime();
}

/**
 * Sort: priority → dueAt (soonest / overdue first) → createdAt newest.
 * @param {object[]} actions
 * @param {Date} [now]
 */
export function sortActionEngineItems(actions, now = new Date()) {
  const list = Array.isArray(actions) ? [...actions] : [];
  list.sort((a, b) => {
    const pa = ENGINE_PRIORITY_RANK[a?.priority] ?? 9;
    const pb = ENGINE_PRIORITY_RANK[b?.priority] ?? 9;
    if (pa !== pb) return pa - pb;

    const da = parseTs(a?.dueAt);
    const db = parseTs(b?.dueAt);
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;

    const ca = parseTs(a?.createdAt) ?? 0;
    const cb = parseTs(b?.createdAt) ?? 0;
    return cb - ca;
  });
  return list;
}

/**
 * @param {object[]} actions
 */
export function summarizeActionPriorities(actions) {
  const summary = { urgent: 0, high: 0, normal: 0, low: 0, overdue: 0, total: 0 };
  const now = new Date();
  for (const action of actions || []) {
    summary.total += 1;
    const p = action?.priority;
    if (p && summary[p] != null) summary[p] += 1;
    if (isActionOverdue(action, now)) summary.overdue += 1;
  }
  return summary;
}

/**
 * @param {object[]} actions
 * @returns {{ key: string, items: object[] }[]}
 */
export function groupActionEngineItems(actions) {
  const sorted = sortActionEngineItems(actions);
  const buckets = new Map();
  for (const action of sorted) {
    const key = actionEngineGroupKey(action);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(action);
  }
  return ACTION_GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    items: buckets.get(key),
  }));
}

/**
 * Map API action → dashboard row model.
 * @param {object} action
 * @param {(key: string) => string} [t]
 */
export function mapActionEngineItem(action, t) {
  if (!action) return null;
  const meta = action.metadata || {};
  const party =
    meta.clientName ||
    meta.fromEmail ||
    meta.fromName ||
    null;
  const link = actionEngineLink(action);
  const secondary = actionEngineSecondaryNav(action);
  const overdue = isActionOverdue(action);

  return {
    id: action.id,
    type: action.type,
    ruleId: action.type,
    kind: "action_engine",
    priority: action.priority || "normal",
    uiPriority: ENGINE_TO_UI_PRIORITY[action.priority] || "medium",
    title: action.title || "",
    reason: action.description || "",
    description: action.description || "",
    date: action.dueAt || action.createdAt || null,
    dueAt: action.dueAt || null,
    createdAt: action.createdAt || null,
    snoozedUntil: action.snoozedUntil || null,
    source: action.source || "system",
    clientId: action.clientId || null,
    communicationId: action.communicationId || null,
    clientName: party,
    partyLabel: party,
    link,
    secondaryNav: secondary,
    overdue,
    metadata: meta,
    primaryLabelKey: primaryLabelKeyForType(action.type),
    groupKey: actionEngineGroupKey(action),
  };
}

function primaryLabelKeyForType(type) {
  switch (type) {
    case ACTION_TYPES.REPLY_TO_PROSPECT:
      return "dashboardV2.engine.cta.reply";
    case ACTION_TYPES.READ_CLIENT_REPLY:
      return "dashboardV2.engine.cta.read";
    case ACTION_TYPES.CALL_BACK:
    case ACTION_TYPES.SCHEDULE_APPOINTMENT:
      return "dashboardV2.engine.cta.call";
    case ACTION_TYPES.FOLLOW_UP_OVERDUE_INVOICE:
      return "dashboardV2.engine.cta.followUpInvoice";
    case ACTION_TYPES.CREATE_INVOICE_FROM_QUOTE:
    case ACTION_TYPES.PREPARE_QUOTE:
      return "dashboardV2.engine.cta.importDocument";
    case ACTION_TYPES.HANDLE_COMPLAINT:
    case ACTION_TYPES.ANSWER_QUESTION:
    case ACTION_TYPES.FOLLOW_UP_COMMUNICATION:
    case ACTION_TYPES.REVIEW_PAYMENT:
    case ACTION_TYPES.REVIEW_DOCUMENT:
      return "dashboardV2.engine.cta.open";
    default:
      return "dashboardV2.engine.cta.open";
  }
}

/**
 * Banner headline helpers.
 * @param {{ total: number, urgent: number, high: number, normal: number, overdue: number }} summary
 * @param {(key: string, vars?: object) => string} t
 */
export function actionEngineBannerText(summary, t) {
  const total = summary?.total || 0;
  if (total === 0) {
    return t("dashboardV2.engine.bannerEmpty");
  }
  return t("dashboardV2.engine.bannerCount").replace("{count}", String(total));
}
