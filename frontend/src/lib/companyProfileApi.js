import { API_BASE } from "@/lib/api";

function parseError(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return fallback;
}

export async function fetchCompanyProfile() {
  const res = await fetch(`${API_BASE}/api/company-profile`, { credentials: "include" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(parseError(data, "Failed to load company profile."));
  return data;
}

export async function updateCompanyProfile(payload) {
  const res = await fetch(`${API_BASE}/api/company-profile`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(parseError(data, "Failed to update company profile."));
  return data;
}

export async function uploadCompanyLogo(file, kind = "logo") {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/company-profile/logo?kind=${kind}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(parseError(data, "Failed to upload logo."));
  return data;
}

export function resolveAssetUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}
