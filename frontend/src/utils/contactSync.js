/**
 * Generic contact sync metadata — connector-agnostic helpers.
 * Mirrors backend/contact_sync.py. No external sync is productized yet.
 */

export const CONTACT_SOURCES = Object.freeze([
  "manual",
  "google_contacts",
  "gmail",
  "outlook",
  "whatsapp",
  "calendar",
  "ai_import",
  "invoice_import",
  "quote_import",
]);

export const CONTACT_SYNC_STATUSES = Object.freeze([
  "synced",
  "pending",
  "conflict",
  "disconnected",
]);

const EMAIL_PHONE_VALUE_KEYS = ["value", "label", "isPrimary"];
const ADDRESS_VALUE_KEYS = ["line1", "line2", "city", "postalCode", "country", "label", "isPrimary"];

export function normalizeContactSource(value) {
  const raw = String(value || "manual").trim().toLowerCase();
  return CONTACT_SOURCES.includes(raw) ? raw : "manual";
}

export function normalizeContactSyncStatus(value) {
  const raw = String(value || "synced").trim().toLowerCase();
  return CONTACT_SYNC_STATUSES.includes(raw) ? raw : "synced";
}

export function defaultContactSyncFields({
  source = "manual",
  sourceId = null,
  syncStatus = "synced",
  actor = null,
  lastSyncedAt = null,
  isUserModified = false,
  version = 1,
} = {}) {
  return {
    source: normalizeContactSource(source),
    sourceId,
    syncStatus: normalizeContactSyncStatus(syncStatus),
    lastSyncedAt,
    createdBy: actor,
    updatedBy: actor,
    isUserModified: Boolean(isUserModified),
    version: Math.max(1, Number(version) || 1),
  };
}

export function hydrateContactSync(item, { actor = null } = {}) {
  if (!item || typeof item !== "object") {
    return defaultContactSyncFields({ actor });
  }
  const defaults = defaultContactSyncFields({
    source: item.source || "manual",
    sourceId: item.sourceId ?? null,
    syncStatus: item.syncStatus || "synced",
    actor: item.createdBy || actor,
    lastSyncedAt: item.lastSyncedAt ?? null,
    isUserModified: Boolean(item.isUserModified),
    version: item.version || 1,
  });
  return {
    ...item,
    ...defaults,
    source: normalizeContactSource(item.source ?? defaults.source),
    syncStatus: normalizeContactSyncStatus(item.syncStatus ?? defaults.syncStatus),
    sourceId: item.sourceId ?? defaults.sourceId,
    lastSyncedAt: item.lastSyncedAt ?? defaults.lastSyncedAt,
    createdBy: item.createdBy ?? defaults.createdBy,
    updatedBy: item.updatedBy ?? defaults.updatedBy,
    isUserModified: Boolean(item.isUserModified ?? defaults.isUserModified),
    version: Math.max(1, Number(item.version ?? defaults.version) || 1),
  };
}

export function hydrateContactsSync(items = [], options = {}) {
  return (items || []).map((item) => hydrateContactSync(item, options));
}

function contentFingerprint(item, kind = "email") {
  const keys = kind === "address" ? ADDRESS_VALUE_KEYS : EMAIL_PHONE_VALUE_KEYS;
  return keys.map((key) => {
    const value = item?.[key];
    if (typeof value === "string") {
      return key === "country" ? value.trim().toUpperCase() : value.trim().toLowerCase();
    }
    if (typeof value === "boolean") return value;
    return value || "";
  });
}

export function detectUserModification(previous, current, { kind = "email" } = {}) {
  if (!previous && current) return true;
  if (!previous || !current) return false;
  const left = contentFingerprint(previous, kind).join("|");
  const right = contentFingerprint(current, kind).join("|");
  return left !== right;
}

export function markContactUserModified(item, { actor = "user" } = {}) {
  const hydrated = hydrateContactSync(item, { actor });
  const next = {
    ...hydrated,
    isUserModified: true,
    updatedBy: actor || hydrated.updatedBy || "user",
    version: (Number(hydrated.version) || 1) + 1,
  };
  if (hydrated.source === "manual") {
    next.syncStatus = "synced";
  } else if (hydrated.syncStatus === "synced") {
    // Local edit on a connector-backed value — conflict until resolved later
    next.syncStatus = "conflict";
  }
  return next;
}

export function prepareConflictResolution(local, remote, { kind = "email" } = {}) {
  const localH = hydrateContactSync(local);
  const remoteH = hydrateContactSync(remote);
  const diverged = detectUserModification(localH, remoteH, { kind });
  return {
    status: diverged || localH.isUserModified ? "conflict" : "synced",
    kind,
    local: localH,
    remote: remoteH,
    prefer: localH.isUserModified ? "local" : "remote",
    detectedAt: new Date().toISOString(),
  };
}

/** Discrete source label key for UI (null when manual — keep UX quiet). */
export function contactSourceLabelKey(item) {
  const source = normalizeContactSource(item?.source);
  if (source === "manual") return null;
  return `clientContacts.sources.${source}`;
}

export function isExternalContactSource(item) {
  return normalizeContactSource(item?.source) !== "manual";
}
