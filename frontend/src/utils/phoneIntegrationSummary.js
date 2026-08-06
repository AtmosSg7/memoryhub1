/** Build summary key/value pairs for Phone Hub status card. */

export function buildPhoneSummaryKeys(status) {
  const stats = status?.stats;
  if (!stats) return [];
  return [
    ["linked", stats.linked ?? 0],
    ["total", stats.total ?? 0],
    ["missed", stats.missed ?? 0],
    ["unmatched", stats.unmatched ?? 0],
  ];
}
