/**
 * Build Gmail counter rows for the Integrations card.
 * Uses cumulative DB stats from GET /api/integrations/gmail/status.
 */
export function buildGmailSummaryKeys(gmailStatus) {
  if (!gmailStatus?.connected || !gmailStatus?.stats) return [];
  const { linked = 0, ignored = 0, total = 0 } = gmailStatus.stats;
  return [
    ["linked", linked],
    ["ignored", ignored],
    ["total", total],
  ];
}
