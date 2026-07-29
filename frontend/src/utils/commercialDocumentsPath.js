/**
 * Canonical dashboard path for commercial documents.
 * Supports kind, status, clientId, from, to (YYYY-MM-DD), open.
 */
export function commercialDocumentsPath({
  kind,
  open,
  status,
  clientId,
  from,
  to,
  ...extra
} = {}) {
  const params = new URLSearchParams();
  if (kind === "quote" || kind === "invoice") {
    params.set("kind", kind);
  }
  if (status != null && status !== "") {
    params.set("status", String(status));
  }
  if (clientId != null && clientId !== "") {
    params.set("clientId", String(clientId));
  }
  if (from != null && from !== "") {
    params.set("from", String(from));
  }
  if (to != null && to !== "") {
    params.set("to", String(to));
  }
  if (open) {
    params.set("open", open);
  }
  Object.entries(extra).forEach(([key, value]) => {
    if (value != null && value !== "") {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return `/dashboard/documents${qs ? `?${qs}` : ""}`;
}
