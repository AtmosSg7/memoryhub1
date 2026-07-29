/**
 * Phone number normalization for search matching.
 * Display stays unchanged — this only affects comparison.
 */

/** Strip to digits, normalizing FR international prefixes to local 0… form. */
export function normalizePhoneDigits(value) {
  if (value == null) return "";
  let raw = String(value).trim();
  if (!raw) return "";

  // Keep digits and a leading + for prefix detection, drop spaces/dots/dashes/( )
  raw = raw.replace(/[^\d+]/g, "");

  if (raw.startsWith("+33")) {
    raw = `0${raw.slice(3)}`;
  } else if (raw.startsWith("0033")) {
    raw = `0${raw.slice(4)}`;
  } else if (raw.startsWith("33") && raw.replace(/\D/g, "").length >= 11) {
    raw = `0${raw.slice(2)}`;
  }

  return raw.replace(/\D/g, "");
}

/** True when the query looks like a phone fragment (enough digits to search). */
export function isPhoneLikeQuery(value, { minDigits = 3 } = {}) {
  return normalizePhoneDigits(value).length >= minDigits;
}

/**
 * Match query against one or more stored phone values.
 * Supports 06…, 06 12…, +33 6…, 0033… against the same stored number.
 */
export function phonesMatchQuery(phones, query) {
  const queryDigits = normalizePhoneDigits(query);
  if (queryDigits.length < 3) return false;

  const values = Array.isArray(phones) ? phones : [phones];
  return values.some((phone) => {
    const stored = normalizePhoneDigits(phone);
    if (!stored) return false;
    return stored.includes(queryDigits) || queryDigits.includes(stored);
  });
}
