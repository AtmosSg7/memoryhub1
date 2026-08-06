import {
  CALL_FILTERS,
  callDisplayName,
  callStatusTone,
  formatCallDate,
  formatCallDuration,
  formatCallTime,
} from "./callJournalFormat";

describe("callJournalFormat", () => {
  test("formats duration", () => {
    expect(formatCallDuration(0)).toBe("0s");
    expect(formatCallDuration(45)).toBe("45s");
    expect(formatCallDuration(90)).toBe("1 min 30s");
    expect(formatCallDuration(null)).toBe("—");
  });

  test("formats date and time parts", () => {
    const iso = "2026-08-06T14:30:00.000Z";
    expect(formatCallDate(iso, "fr")).not.toBe("—");
    expect(formatCallTime(iso, "fr")).not.toBe("—");
    expect(formatCallDate(null)).toBe("—");
    expect(formatCallTime(null)).toBe("—");
  });

  test("display name prefers client then counterparty then phone", () => {
    expect(callDisplayName({ clientName: "Dupont", phoneNumber: "06" })).toBe("Dupont");
    expect(callDisplayName({ counterpartyName: "Alice", phoneNumber: "06" })).toBe("Alice");
    expect(callDisplayName({ phoneNumber: "0612345678" })).toBe("0612345678");
  });

  test("status tone", () => {
    expect(callStatusTone("missed")).toBe("danger");
    expect(callStatusTone("voicemail")).toBe("warn");
    expect(callStatusTone("spam")).toBe("muted");
    expect(callStatusTone("answered")).toBe("ok");
  });

  test("filters include required keys", () => {
    expect(CALL_FILTERS).toEqual(
      expect.arrayContaining(["all", "missed", "callback", "clients", "unknowns", "today", "7d", "30d"]),
    );
  });
});
