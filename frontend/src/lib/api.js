import { reportApiFailure } from "@/lib/sentry";

const API_BASE = process.env.REACT_APP_API_URL || "";
const DEFAULT_TIMEOUT_MS = 30_000;

function fetchSignal(timeoutMs = DEFAULT_TIMEOUT_MS, externalSignal) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    if (!externalSignal) return timeoutSignal;
    if (typeof AbortSignal.any === "function") {
      return AbortSignal.any([timeoutSignal, externalSignal]);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }
  controller.signal.addEventListener(
    "abort",
    () => clearTimeout(timeoutId),
    { once: true },
  );
  return controller.signal;
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...fetchOptions } = options;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      },
      ...fetchOptions,
      signal: fetchSignal(timeoutMs, externalSignal),
    });

    const data = await parseJson(res);
    if (!res.ok && res.status >= 500) {
      reportApiFailure(path, res.status, data);
    }
    return { res, data };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Check that the backend is running.");
    }
    reportApiFailure(path, 0, null, error);
    throw error;
  }
}

export { API_BASE };
