import { API_BASE, apiFetch } from "@/lib/api";
import { apiUpload } from "@/lib/apiUpload";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

async function handleResponse(res, data, fallback) {
  if (!res.ok) {
    throw new Error(parseError(data, fallback));
  }
  return data;
}

export async function listDocuments(clientId) {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  const { res, data } = await apiFetch(`/api/documents${query}`);
  return handleResponse(res, data, "Failed to load documents.");
}

export async function getDocument(documentId) {
  const { res, data } = await apiFetch(`/api/documents/${documentId}`);
  return handleResponse(res, data, "Failed to load document.");
}

export async function uploadDocument(file, clientId) {
  const formData = new FormData();
  formData.append("file", file);
  if (clientId) {
    formData.append("clientId", clientId);
  }
  const { res, data } = await apiUpload("/api/documents/upload", formData);
  return handleResponse(res, data, "Failed to upload document.");
}

export async function updateDocument(documentId, payload) {
  const { res, data } = await apiFetch(`/api/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to update document.");
}

export async function deleteDocument(documentId) {
  const { res, data } = await apiFetch(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(parseError(data, "Failed to delete document."));
  }
}

export async function fetchDocumentBlob(documentId, mode = "download") {
  const path =
    mode === "preview"
      ? `/api/documents/${documentId}/preview`
      : `/api/documents/${documentId}/download`;
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(parseError(data, "Failed to fetch document."));
  }
  return res.blob();
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
