/**
 * Light highlight of query tokens in a string — never invents matches.
 */

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitHighlightParts(text, query) {
  const source = text == null ? "" : String(text);
  const q = (query || "").trim();
  if (!source || !q || q.length < 2) {
    return [{ text: source, match: false }];
  }
  const tokens = q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (!tokens.length) {
    return [{ text: source, match: false }];
  }
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "ig");
  const parts = [];
  let last = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) {
      parts.push({ text: source.slice(last, match.index), match: false });
    }
    parts.push({ text: match[0], match: true });
    last = match.index + match[0].length;
  }
  if (last < source.length) {
    parts.push({ text: source.slice(last), match: false });
  }
  return parts.length ? parts : [{ text: source, match: false }];
}
