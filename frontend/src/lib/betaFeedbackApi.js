import { apiFetch } from "@/lib/api";

export async function submitBetaFeedback({
  intent,
  blocker,
  suggestion,
  page,
  website = "",
  formStartedAt,
}) {
  const { res, data } = await apiFetch("/api/beta/feedback", {
    method: "POST",
    body: JSON.stringify({
      intent,
      blocker: blocker || "",
      suggestion: suggestion || "",
      page: page || undefined,
      website: website || "",
      formStartedAt,
    }),
  });
  if (!res.ok) {
    const message =
      data?.detail?.message || data?.message || "Impossible d'envoyer votre avis.";
    throw new Error(message);
  }
  return data;
}
