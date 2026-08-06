const { artisanA } = require("../fixtures/users");
const { UNKNOWN } = require("../fixtures/journey");

/**
 * Authenticated API helpers against the CRA proxy (same-origin cookies).
 * Prefer UI for product assertions; use API for seed/reset/counts.
 */

async function loginApi(request, user = artisanA) {
  const res = await request.post("/api/auth/login", {
    data: {
      email: user.email,
      password: user.password,
      website: "",
    },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`E2E login failed (${res.status()}): ${body}`);
  }
  return res.json();
}

async function e2eHealth(request) {
  const res = await request.get("/api/e2e/health");
  if (!res.ok()) {
    throw new Error(
      `E2E harness unavailable (${res.status()}). Set ALLOW_E2E_SEED=1 and INTEGRATIONS_GMAIL_PROVIDER=mock.`
    );
  }
  return res.json();
}

async function seedUnknown(request, overrides = {}) {
  const payload = {
    fromEmail: UNKNOWN.fromEmail,
    fromName: UNKNOWN.fromName,
    subject: UNKNOWN.subject,
    preview: UNKNOWN.preview,
    resetFirst: true,
    ...overrides,
  };
  const res = await request.post("/api/e2e/scenario/seed-unknown", { data: payload });
  if (!res.ok()) {
    throw new Error(`seed-unknown failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

async function appendReply(request, overrides = {}) {
  const payload = {
    fromEmail: UNKNOWN.fromEmail,
    fromName: UNKNOWN.fromName,
    subject: UNKNOWN.replySubject,
    preview: UNKNOWN.replyPreview,
    ...overrides,
  };
  const res = await request.post("/api/e2e/scenario/append-reply", { data: payload });
  if (!res.ok()) {
    throw new Error(`append-reply failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

async function syncAgain(request) {
  const res = await request.post("/api/e2e/scenario/sync", { data: {} });
  if (!res.ok()) {
    throw new Error(`sync failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

async function resetJourney(request) {
  const res = await request.post("/api/e2e/scenario/reset", {
    data: { fromEmail: UNKNOWN.fromEmail, resetFirst: true },
  });
  if (!res.ok()) {
    throw new Error(`reset failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

async function getProspects(request, status = "pending") {
  const res = await request.get(`/api/prospects?status=${encodeURIComponent(status)}&limit=50`);
  if (!res.ok()) throw new Error(`prospects failed: ${await res.text()}`);
  return res.json();
}

async function getProspectCount(request, status = "pending") {
  const res = await request.get(`/api/prospects/count?status=${encodeURIComponent(status)}`);
  if (!res.ok()) throw new Error(`prospects count failed: ${await res.text()}`);
  return res.json();
}

async function getActions(request, params = {}) {
  const qs = new URLSearchParams({ status: "pending", limit: "50", ...params }).toString();
  const res = await request.get(`/api/actions?${qs}`);
  if (!res.ok()) throw new Error(`actions failed: ${await res.text()}`);
  return res.json();
}

async function getCommunications(request, params = {}) {
  const qs = new URLSearchParams({ limit: "50", ...params }).toString();
  const res = await request.get(`/api/communications?${qs}`);
  if (!res.ok()) throw new Error(`communications failed: ${await res.text()}`);
  return res.json();
}

async function countCommsForEmail(request, email) {
  const data = await getCommunications(request, { limit: "100" });
  const items = data.items || data.communications || [];
  const needle = email.toLowerCase();
  return items.filter((c) => {
    const meta = c.metadata || {};
    return (meta.fromEmail || "").toLowerCase() === needle;
  });
}

module.exports = {
  loginApi,
  e2eHealth,
  seedUnknown,
  appendReply,
  syncAgain,
  resetJourney,
  getProspects,
  getProspectCount,
  getActions,
  getCommunications,
  countCommsForEmail,
};
