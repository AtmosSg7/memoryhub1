import { isPhoneLikeQuery, normalizePhoneDigits, phonesMatchQuery } from "./phoneNormalize";

describe("phoneNormalize", () => {
  it("normalizes French local and international formats to the same digits", () => {
    expect(normalizePhoneDigits("06 12 34 56 78")).toBe("0612345678");
    expect(normalizePhoneDigits("0612345678")).toBe("0612345678");
    expect(normalizePhoneDigits("+33 6 12 34 56 78")).toBe("0612345678");
    expect(normalizePhoneDigits("+33612345678")).toBe("0612345678");
    expect(normalizePhoneDigits("0033 6 12 34 56 78")).toBe("0612345678");
    expect(normalizePhoneDigits("06.12.34.56.78")).toBe("0612345678");
    expect(normalizePhoneDigits("(06) 12-34-56-78")).toBe("0612345678");
  });

  it("returns empty for blank input", () => {
    expect(normalizePhoneDigits("")).toBe("");
    expect(normalizePhoneDigits(null)).toBe("");
    expect(normalizePhoneDigits(undefined)).toBe("");
  });

  it("detects phone-like queries", () => {
    expect(isPhoneLikeQuery("06 12")).toBe(true);
    expect(isPhoneLikeQuery("ab")).toBe(false);
    expect(isPhoneLikeQuery("martin")).toBe(false);
  });

  it("matches equivalent phone formats against a stored number", () => {
    const stored = "0612345678";
    expect(phonesMatchQuery(stored, "06 12 34 56 78")).toBe(true);
    expect(phonesMatchQuery(stored, "0612345678")).toBe(true);
    expect(phonesMatchQuery(stored, "+33 6 12 34 56 78")).toBe(true);
    expect(phonesMatchQuery(stored, "0033612345678")).toBe(true);
    expect(phonesMatchQuery(stored, "0612")).toBe(true);
    expect(phonesMatchQuery(stored, "0700000000")).toBe(false);
  });
});
