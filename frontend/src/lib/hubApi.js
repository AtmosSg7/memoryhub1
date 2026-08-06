import { apiFetch } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

export async function fetchHubProviders() {
  const { res, data } = await apiFetch("/api/hub/providers");
  if (!res.ok) throw new Error(parseError(data, "Failed to load hub providers."));
  return data;
}

export async function fetchHubConversations(params = {}) {
  const qs = new URLSearchParams();
  if (params.clientId) qs.set("clientId", params.clientId);
  if (params.channel) qs.set("channel", params.channel);
  if (params.lifecycleStatus) qs.set("lifecycleStatus", params.lifecycleStatus);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs}` : "";
  const { res, data } = await apiFetch(`/api/hub/conversations${suffix}`);
  if (!res.ok) throw new Error(parseError(data, "Failed to load conversations."));
  return data;
}

export async function fetchHubConversation(conversationId, { markRead = false } = {}) {
  const qs = markRead ? "?markRead=true" : "";
  const { res, data } = await apiFetch(
    `/api/hub/conversations/${encodeURIComponent(conversationId)}${qs}`,
  );
  if (!res.ok) throw new Error(parseError(data, "Failed to load conversation."));
  return data;
}

export async function fetchClientInbox(clientId, { limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const { res, data } = await apiFetch(
    `/api/hub/clients/${encodeURIComponent(clientId)}/inbox?${qs}`,
  );
  if (!res.ok) throw new Error(parseError(data, "Failed to load client inbox."));
  return data;
}

export async function updateCommunicationLifecycle(communicationId, lifecycleStatus) {
  const { res, data } = await apiFetch(
    `/api/hub/communications/${encodeURIComponent(communicationId)}/lifecycle`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifecycleStatus }),
    },
  );
  if (!res.ok) throw new Error(parseError(data, "Failed to update lifecycle."));
  return data;
}

export async function migrateHub(limit = 2000) {
  const { res, data } = await apiFetch(`/api/hub/migrate?limit=${limit}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(parseError(data, "Failed to migrate hub data."));
  return data;
}
