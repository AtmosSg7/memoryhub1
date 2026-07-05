import { apiFetch } from "@/lib/api";

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

export async function listNotes({ clientId, type } = {}) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", clientId);
  if (type) params.set("type", type);
  const query = params.toString() ? `?${params.toString()}` : "";
  const { res, data } = await apiFetch(`/api/notes${query}`);
  return handleResponse(res, data, "Failed to load notes.");
}

export async function getNote(noteId) {
  const { res, data } = await apiFetch(`/api/notes/${noteId}`);
  return handleResponse(res, data, "Failed to load note.");
}

export async function createNote(payload) {
  const { res, data } = await apiFetch("/api/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to create note.");
}

export async function updateNote(noteId, payload) {
  const { res, data } = await apiFetch(`/api/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return handleResponse(res, data, "Failed to update note.");
}

export async function deleteNote(noteId) {
  const { res, data } = await apiFetch(`/api/notes/${noteId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(parseError(data, "Failed to delete note."));
  }
}
