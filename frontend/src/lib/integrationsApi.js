import { API_BASE, apiFetch } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

export async function fetchGoogleContactsStatus() {
  const { res, data } = await apiFetch("/api/integrations/google-contacts/status");
  if (!res.ok) throw new Error(parseError(data, "Failed to load Google Contacts status."));
  return data;
}

export async function startGoogleContactsConnect() {
  const { res, data } = await apiFetch("/api/integrations/google-contacts/connect", {
    method: "POST",
  });
  if (!res.ok) throw new Error(parseError(data, "Failed to start Google connection."));
  return data;
}

export async function previewGoogleContacts() {
  const { res, data } = await apiFetch("/api/integrations/google-contacts/preview");
  if (!res.ok) throw new Error(parseError(data, "Failed to preview Google contacts."));
  return data;
}

export async function importGoogleContacts() {
  const { res, data } = await apiFetch("/api/integrations/google-contacts/import", {
    method: "POST",
    timeoutMs: 120_000,
  });
  if (!res.ok) throw new Error(parseError(data, "Failed to import Google contacts."));
  return data;
}

export async function syncGoogleContacts() {
  const { res, data } = await apiFetch("/api/integrations/google-contacts/sync", {
    method: "POST",
    timeoutMs: 120_000,
  });
  if (!res.ok) throw new Error(parseError(data, "Failed to sync Google contacts."));
  return data;
}

export async function disconnectGoogleContacts() {
  const { res, data } = await apiFetch("/api/integrations/google-contacts/disconnect", {
    method: "POST",
  });
  if (!res.ok) throw new Error(parseError(data, "Failed to disconnect Google Contacts."));
  return data;
}

export async function fetchGmailStatus() {
  const { res, data } = await apiFetch("/api/integrations/gmail/status");
  if (!res.ok) throw new Error(parseError(data, "Failed to load Gmail status."));
  return data;
}

export async function startGmailConnect() {
  const { res, data } = await apiFetch("/api/integrations/gmail/connect", { method: "POST" });
  if (!res.ok) throw new Error(parseError(data, "Failed to start Gmail connection."));
  return data;
}

export async function previewGmail() {
  const { res, data } = await apiFetch("/api/integrations/gmail/preview");
  if (!res.ok) throw new Error(parseError(data, "Failed to preview Gmail messages."));
  return data;
}

export async function syncGmail() {
  const { res, data } = await apiFetch("/api/integrations/gmail/sync", {
    method: "POST",
    timeoutMs: 120_000,
  });
  if (!res.ok) throw new Error(parseError(data, "Failed to sync Gmail."));
  return data;
}

export async function disconnectGmail() {
  const { res, data } = await apiFetch("/api/integrations/gmail/disconnect", { method: "POST" });
  if (!res.ok) throw new Error(parseError(data, "Failed to disconnect Gmail."));
  return data;
}

export async function fetchClientEmails(clientId, { limit = 50 } = {}) {
  const { res, data } = await apiFetch(
    `/api/integrations/gmail/clients/${encodeURIComponent(clientId)}/emails?limit=${limit}`,
  );
  if (!res.ok) throw new Error(parseError(data, "Failed to load client emails."));
  return data;
}

export async function fetchPhoneStatus() {
  const { res, data } = await apiFetch("/api/integrations/phone/status");
  if (!res.ok) throw new Error(parseError(data, "Failed to load Phone status."));
  return data;
}

export async function startPhoneConnect() {
  const { res, data } = await apiFetch("/api/integrations/phone/connect", { method: "POST" });
  if (!res.ok) throw new Error(parseError(data, "Failed to connect Phone."));
  return data;
}

export async function previewPhone() {
  const { res, data } = await apiFetch("/api/integrations/phone/preview");
  if (!res.ok) throw new Error(parseError(data, "Failed to preview Phone calls."));
  return data;
}

export async function syncPhone() {
  const { res, data } = await apiFetch("/api/integrations/phone/sync", {
    method: "POST",
    timeoutMs: 120_000,
  });
  if (!res.ok) throw new Error(parseError(data, "Failed to sync Phone."));
  return data;
}

export async function disconnectPhone() {
  const { res, data } = await apiFetch("/api/integrations/phone/disconnect", { method: "POST" });
  if (!res.ok) throw new Error(parseError(data, "Failed to disconnect Phone."));
  return data;
}

export { API_BASE };
