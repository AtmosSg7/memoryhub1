/**
 * Client display & contact adapters.
 *
 * Flat scalars (`email`, `phone`, `address`) remain the primary UI contract.
 * Nested arrays (`emails`, `phones`, `addresses`) are preferred when present
 * (schema v2+). Helpers below keep both shapes working.
 */

import { defaultContactSyncFields, hydrateContactsSync } from "./contactSync";

const COLORS = ["#0A2540", "#173A5E", "#0066FF", "#4B5563", "#065F46"];

function primaryOrFirst(items = []) {
  if (!Array.isArray(items) || !items.length) return null;
  return items.find((item) => item?.isPrimary) || items[0] || null;
}

/** Ensure nested contact collections exist (client-side hydrate). */
export function normalizeClient(client) {
  if (!client) return client;

  const emails =
    Array.isArray(client.emails) && client.emails.length
      ? client.emails
      : client.email
        ? [
            {
              id: "legacy-email",
              value: client.email,
              label: "main",
              isPrimary: true,
              ...defaultContactSyncFields({ source: "manual" }),
            },
          ]
        : [];

  const phones =
    Array.isArray(client.phones) && client.phones.length
      ? client.phones
      : client.phone
        ? [
            {
              id: "legacy-phone",
              value: client.phone,
              label: "main",
              isPrimary: true,
              ...defaultContactSyncFields({ source: "manual" }),
            },
          ]
        : [];

  const addresses =
    Array.isArray(client.addresses) && client.addresses.length
      ? client.addresses
      : client.address || client.city || client.postalCode
        ? [
            {
              id: "legacy-address",
              line1: client.address || null,
              line2: null,
              city: client.city || null,
              postalCode: client.postalCode || null,
              country: client.country || "FR",
              label: "main",
              isPrimary: true,
              ...defaultContactSyncFields({ source: "manual" }),
            },
          ]
        : [];

  return {
    ...client,
    emails: hydrateContactsSync(emails),
    phones: hydrateContactsSync(phones),
    addresses: hydrateContactsSync(addresses),
    tags: Array.isArray(client.tags) ? client.tags : [],
    isFavorite: Boolean(client.isFavorite),
    schemaVersion:
      client.schemaVersion ||
      (emails.length || phones.length || addresses.length ? 3 : 1),
  };
}

export function getPrimaryEmail(client) {
  if (!client) return "";
  const normalized = normalizeClient(client);
  return primaryOrFirst(normalized.emails)?.value || client.email || "";
}

export function getPrimaryPhone(client) {
  if (!client) return "";
  const normalized = normalizeClient(client);
  return primaryOrFirst(normalized.phones)?.value || client.phone || "";
}

export function getPrimaryAddress(client) {
  if (!client) return null;
  const normalized = normalizeClient(client);
  return primaryOrFirst(normalized.addresses);
}

export function formatClientLocation(client, { fallback = "" } = {}) {
  const address = getPrimaryAddress(client);
  if (!address) {
    const city = client?.city?.trim();
    const line = client?.address?.trim();
    if (city && line) return `${city}, ${line}`;
    return city || line || fallback;
  }
  const parts = [
    address.line1,
    [address.postalCode, address.city].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(" · ") || fallback;
}

export function getClientTags(client) {
  return Array.isArray(client?.tags) ? client.tags : [];
}

export function isClientFavorite(client) {
  return Boolean(client?.isFavorite);
}

export function getClientInitials(client) {
  const company = client.company?.trim();
  const name = (client.contactName || client.name)?.trim();

  if (company) {
    const parts = company.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return company.slice(0, 2).toUpperCase();
  }

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  return "??";
}

export function getClientColor(clientId) {
  let hash = 0;
  for (let i = 0; i < clientId.length; i += 1) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function getDisplayCompany(client) {
  return client.company?.trim() || client.name;
}

export function getDisplayName(client) {
  return client.contactName?.trim() || client.name;
}

export function formatLastInteraction(updatedAt, lang = "fr") {
  if (!updatedAt) {
    return lang === "fr" ? "Jamais" : "Never";
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return updatedAt;
  }

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    if (lang === "fr") {
      return diffMins <= 1 ? "À l'instant" : `Il y a ${diffMins} min`;
    }
    return diffMins <= 1 ? "Just now" : `${diffMins} min ago`;
  }

  if (diffHours < 24) {
    return lang === "fr" ? `Il y a ${diffHours} h` : `${diffHours} h ago`;
  }

  if (diffDays === 1) {
    return lang === "fr" ? "Hier" : "Yesterday";
  }

  if (diffDays < 30) {
    return lang === "fr" ? `Il y a ${diffDays} jours` : `${diffDays} days ago`;
  }

  return date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US");
}
