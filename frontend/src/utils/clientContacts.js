/**
 * Helpers for Client v2/v3 multi-contact editing.
 * Keeps a single primary per category and stable label keys.
 * Attaches generic sync metadata for future connectors.
 */

import {
  defaultContactSyncFields,
  hydrateContactSync,
  hydrateContactsSync,
} from "./contactSync";

export const CONTACT_LABEL_KEYS = ["main", "mobile", "work", "personal", "other"];

export function newContactId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ensureSinglePrimary(items = [], preferredId = null) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const targetId =
    preferredId && items.some((item) => item.id === preferredId)
      ? preferredId
      : items.find((item) => item.isPrimary)?.id || items[0].id;
  return items.map((item) =>
    hydrateContactSync({
      ...item,
      isPrimary: item.id === targetId,
    }),
  );
}

export function prepareContactsForSave(items = [], { actor = "user" } = {}) {
  const cleaned = (items || [])
    .map((item) => {
      const hydrated = hydrateContactSync(item, { actor });
      const id =
        !hydrated?.id || String(hydrated.id).startsWith("legacy-")
          ? newContactId()
          : hydrated.id;
      return hydrateContactSync({ ...hydrated, id }, { actor });
    })
    .filter(Boolean);
  return ensureSinglePrimary(cleaned);
}

export function normalizeContactLabel(label) {
  const raw = (label || "main").toString().trim().toLowerCase();
  if (CONTACT_LABEL_KEYS.includes(raw)) return raw;
  if (raw === "principal" || raw === "primary") return "main";
  if (raw === "travail" || raw === "office" || raw === "pro") return "work";
  if (raw === "personnel" || raw === "home" || raw === "perso") return "personal";
  if (raw === "autre") return "other";
  return CONTACT_LABEL_KEYS.includes(raw) ? raw : "other";
}

export function contactLabelKey(item) {
  return normalizeContactLabel(item?.label);
}

export function removeContactItem(items, id) {
  const next = (items || []).filter((item) => item.id !== id);
  return ensureSinglePrimary(next);
}

export function setPrimaryContact(items, id) {
  return ensureSinglePrimary(items || [], id);
}

export function upsertContactItem(items, nextItem) {
  const list = Array.isArray(items) ? [...items] : [];
  const index = list.findIndex((item) => item.id === nextItem.id);
  if (index >= 0) {
    list[index] = hydrateContactSync({ ...list[index], ...nextItem });
  } else {
    list.push(hydrateContactSync(nextItem));
  }
  const preferredId = nextItem.isPrimary ? nextItem.id : null;
  return ensureSinglePrimary(list, preferredId);
}

export function createEmptyPhone() {
  return hydrateContactSync({
    id: newContactId(),
    value: "",
    label: "main",
    isPrimary: false,
    ...defaultContactSyncFields({ source: "manual", actor: "user" }),
  });
}

export function createEmptyEmail() {
  return hydrateContactSync({
    id: newContactId(),
    value: "",
    label: "main",
    isPrimary: false,
    ...defaultContactSyncFields({ source: "manual", actor: "user" }),
  });
}

export function createEmptyAddress() {
  return hydrateContactSync({
    id: newContactId(),
    line1: "",
    line2: "",
    city: "",
    postalCode: "",
    country: "FR",
    label: "main",
    isPrimary: false,
    ...defaultContactSyncFields({ source: "manual", actor: "user" }),
  });
}

export function formatAddressLine(address) {
  if (!address) return "";
  const parts = [
    address.line1,
    address.line2,
    [address.postalCode, address.city].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(" · ");
}

export function isAddressEmpty(address) {
  return !String(address?.line1 || "").trim() && !String(address?.city || "").trim();
}

export function normalizeTagInput(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

export function addUniqueTag(tags, raw) {
  const tag = normalizeTagInput(raw);
  if (!tag) return { tags: tags || [], added: false };
  const current = Array.isArray(tags) ? tags : [];
  if (current.includes(tag)) return { tags: current, added: false };
  return { tags: [...current, tag].slice(0, 40), added: true };
}

export { hydrateContactsSync };
