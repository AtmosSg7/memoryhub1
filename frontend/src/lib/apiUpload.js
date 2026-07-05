import { API_BASE } from "@/lib/api";

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiUpload(path, formData, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    method: options.method || "POST",
    body: formData,
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  const data = await parseJson(res);
  return { res, data };
}
