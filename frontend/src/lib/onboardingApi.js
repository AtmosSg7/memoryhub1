import { apiFetch } from "@/lib/api";

async function parseOnboarding(path, options) {
  const { res, data } = await apiFetch(path, options);
  if (!res.ok) {
    const message = data?.detail?.message || data?.message || "Impossible de charger l'onboarding.";
    throw new Error(message);
  }
  return data;
}

export function getOnboardingState() {
  return parseOnboarding("/api/onboarding/state");
}

export function getAccountMaturity() {
  return parseOnboarding("/api/onboarding/maturity");
}

export function updateWizard(body) {
  return parseOnboarding("/api/onboarding/wizard", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function updateChecklist(body) {
  return parseOnboarding("/api/onboarding/checklist", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function markClient360Viewed() {
  return parseOnboarding("/api/onboarding/checklist/viewed-client-360", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function acknowledgeFirstWin(id) {
  return parseOnboarding("/api/onboarding/first-win/ack", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}
