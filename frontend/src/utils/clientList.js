/**
 * Clients list — search, filters, sort, follow-up badge.
 * Pure helpers; easy to evolve without touching the page.
 */

import {
  getDisplayCompany,
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
} from "./clientDisplay";
import { isPhoneLikeQuery, phonesMatchQuery } from "./phoneNormalize";

/** Days without activity before showing the "À relancer" badge. Change here later. */
export const FOLLOW_UP_INACTIVITY_DAYS = 90;

export const CLIENT_LIST_FILTERS = Object.freeze({
  ALL: "all",
  FAVORITES: "favorites",
  FOLLOW_UP: "follow_up",
  WITH_DOCUMENTS: "with_documents",
  WITHOUT_DOCUMENTS: "without_documents",
});

export const CLIENT_LIST_SORTS = Object.freeze({
  LAST_ACTIVITY: "last_activity",
  REVENUE: "revenue",
  NAME: "name",
  CREATED_AT: "created_at",
});

function parseDateMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Prefer API lastActivityAt; fall back to updatedAt for older payloads. */
export function getClientLastActivityAt(client) {
  return client?.lastActivityAt || client?.updatedAt || client?.createdAt || null;
}

export function getClientDocumentsCount(client) {
  return Math.max(0, Number(client?.documentsCount) || 0);
}

export function getClientNotesCount(client) {
  return Math.max(0, Number(client?.notesCount) || 0);
}

export function getClientTotalRevenue(client) {
  return Math.max(0, Number(client?.totalRevenue) || 0);
}

/** True when last activity is older than FOLLOW_UP_INACTIVITY_DAYS (or missing). */
export function needsFollowUp(client, { now = new Date(), days = FOLLOW_UP_INACTIVITY_DAYS } = {}) {
  const lastAt = getClientLastActivityAt(client);
  if (!lastAt) return true;
  const lastMs = parseDateMs(lastAt);
  if (!lastMs) return true;
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return now.getTime() - lastMs >= thresholdMs;
}

function collectClientPhones(client) {
  const phones = [];
  if (client?.phone) phones.push(client.phone);
  for (const item of client?.phones || []) {
    if (item?.value) phones.push(item.value);
  }
  return phones;
}

function buildSearchHaystack(client) {
  const nestedEmails = (client.emails || []).map((item) => item?.value).filter(Boolean);
  const nestedPhones = (client.phones || []).map((item) => item?.value).filter(Boolean);
  const nestedCities = (client.addresses || []).map((item) => item?.city).filter(Boolean);
  const companyInfo = client.companyInfo || {};

  return [
    client.name,
    client.company,
    client.contactName,
    client.email,
    client.phone,
    client.city,
    client.siret,
    companyInfo.siret,
    companyInfo.legalName,
    companyInfo.tradeName,
    getPrimaryEmail(client),
    getPrimaryPhone(client),
    ...(client.tags || []),
    ...nestedEmails,
    ...nestedPhones,
    ...nestedCities,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesClientSearch(client, query) {
  const term = (query || "").trim().toLowerCase();
  if (!term) return true;
  if (buildSearchHaystack(client).includes(term)) return true;
  if (isPhoneLikeQuery(term) && phonesMatchQuery(collectClientPhones(client), term)) {
    return true;
  }
  return false;
}

export function matchesClientFilter(client, filter, { now = new Date() } = {}) {
  switch (filter) {
    case CLIENT_LIST_FILTERS.FAVORITES:
      return Boolean(client?.isFavorite);
    case CLIENT_LIST_FILTERS.FOLLOW_UP:
      return needsFollowUp(client, { now });
    case CLIENT_LIST_FILTERS.WITH_DOCUMENTS:
      return getClientDocumentsCount(client) > 0;
    case CLIENT_LIST_FILTERS.WITHOUT_DOCUMENTS:
      return getClientDocumentsCount(client) === 0;
    case CLIENT_LIST_FILTERS.ALL:
    default:
      return true;
  }
}

function compareByName(a, b) {
  const nameA = (getDisplayCompany(a) || getDisplayName(a) || "").toLowerCase();
  const nameB = (getDisplayCompany(b) || getDisplayName(b) || "").toLowerCase();
  return nameA.localeCompare(nameB, "fr", { sensitivity: "base" });
}

export function sortClients(clients, sortKey = CLIENT_LIST_SORTS.LAST_ACTIVITY) {
  const list = [...(clients || [])];
  switch (sortKey) {
    case CLIENT_LIST_SORTS.REVENUE:
      return list.sort((a, b) => {
        const diff = getClientTotalRevenue(b) - getClientTotalRevenue(a);
        return diff !== 0 ? diff : compareByName(a, b);
      });
    case CLIENT_LIST_SORTS.NAME:
      return list.sort(compareByName);
    case CLIENT_LIST_SORTS.CREATED_AT:
      return list.sort((a, b) => {
        const diff = parseDateMs(b.createdAt) - parseDateMs(a.createdAt);
        return diff !== 0 ? diff : compareByName(a, b);
      });
    case CLIENT_LIST_SORTS.LAST_ACTIVITY:
    default:
      return list.sort((a, b) => {
        const diff = parseDateMs(getClientLastActivityAt(b)) - parseDateMs(getClientLastActivityAt(a));
        return diff !== 0 ? diff : compareByName(a, b);
      });
  }
}

export function filterAndSortClients(
  clients,
  { query = "", filter = CLIENT_LIST_FILTERS.ALL, sort = CLIENT_LIST_SORTS.LAST_ACTIVITY, now = new Date() } = {},
) {
  const filtered = (clients || []).filter(
    (client) => matchesClientSearch(client, query) && matchesClientFilter(client, filter, { now }),
  );
  return sortClients(filtered, sort);
}
