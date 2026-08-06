import { apiFetch } from "@/lib/api";
import { apiUpload } from "@/lib/apiUpload";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function fetchPhoneCalls({
  filter = "all",
  q,
  limit = 30,
  offset = 0,
} = {}) {
  const { res, data } = await apiFetch(
    `/api/integrations/phone/calls${toQuery({ filter, q, limit, offset })}`,
  );
  if (!res.ok) throw new Error(parseError(data, "Impossible de charger le journal d'appels."));
  return data;
}

export async function fetchPhoneCall(id) {
  const { res, data } = await apiFetch(`/api/integrations/phone/calls/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(parseError(data, "Appel introuvable."));
  return data;
}

export async function createPhoneCall(body) {
  const { res, data } = await apiFetch("/api/integrations/phone/calls", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(parseError(data, "Impossible d'enregistrer l'appel."));
  return data;
}

export async function associatePhoneCall(communicationId, clientId) {
  const { res, data } = await apiFetch(
    `/api/integrations/phone/calls/${encodeURIComponent(communicationId)}/associate`,
    { method: "POST", body: JSON.stringify({ clientId }) },
  );
  if (!res.ok) throw new Error(parseError(data, "Association impossible."));
  return data;
}

export async function createClientFromPhoneCall(communicationId, body = {}) {
  const { res, data } = await apiFetch(
    `/api/integrations/phone/calls/${encodeURIComponent(communicationId)}/create-client`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(parseError(data, "Création client impossible."));
  return data;
}

export async function markPhoneCallSpam(communicationId) {
  const { res, data } = await apiFetch(
    `/api/integrations/phone/calls/${encodeURIComponent(communicationId)}/spam`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(parseError(data, "Marquage spam impossible."));
  return data;
}

export async function previewPhoneCsv(file) {
  const form = new FormData();
  form.append("file", file);
  const { res, data } = await apiUpload("/api/integrations/phone/import/preview", form, {
    timeoutMs: 60_000,
  });
  if (!res.ok) throw new Error(parseError(data, "Prévisualisation CSV impossible."));
  return data;
}

export async function importPhoneCsv(file, { dryRun = false } = {}) {
  const form = new FormData();
  form.append("file", file);
  const { res, data } = await apiUpload(
    `/api/integrations/phone/import${toQuery({ dryRun })}`,
    form,
    { timeoutMs: 120_000 },
  );
  if (!res.ok) throw new Error(parseError(data, "Import CSV impossible."));
  return data;
}

export async function fetchPhoneDashboardStats() {
  const { res, data } = await apiFetch("/api/integrations/phone/stats");
  if (!res.ok) throw new Error(parseError(data, "Stats téléphone indisponibles."));
  return data;
}
