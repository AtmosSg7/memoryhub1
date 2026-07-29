import {
  CONTACT_SOURCES,
  CONTACT_SYNC_STATUSES,
  contactSourceLabelKey,
  defaultContactSyncFields,
  detectUserModification,
  hydrateContactSync,
  isExternalContactSource,
  markContactUserModified,
  prepareConflictResolution,
} from "./contactSync";
import { normalizeClient } from "./clientDisplay";
import { createEmptyEmail, prepareContactsForSave } from "./clientContacts";

describe("contactSync helpers", () => {
  it("exposes connector-agnostic enums", () => {
    expect(CONTACT_SOURCES).toContain("manual");
    expect(CONTACT_SOURCES).toContain("google_contacts");
    expect(CONTACT_SOURCES).toContain("whatsapp");
    expect(CONTACT_SYNC_STATUSES).toEqual(["synced", "pending", "conflict", "disconnected"]);
  });

  it("hydrates missing sync metadata on legacy contacts", () => {
    const hydrated = hydrateContactSync({ id: "e1", value: "a@example.com", isPrimary: true });
    expect(hydrated.source).toBe("manual");
    expect(hydrated.syncStatus).toBe("synced");
    expect(hydrated.version).toBe(1);
    expect(hydrated.isUserModified).toBe(false);
  });

  it("detects and marks user modifications without losing source identity", () => {
    const previous = hydrateContactSync({
      id: "p1",
      value: "0600000000",
      label: "main",
      isPrimary: true,
      source: "google_contacts",
      sourceId: "gc-1",
      syncStatus: "synced",
      version: 2,
    });
    const current = { ...previous, value: "0611111111" };
    expect(detectUserModification(previous, current, { kind: "phone" })).toBe(true);

    const stamped = markContactUserModified(current, { actor: "user" });
    expect(stamped.isUserModified).toBe(true);
    expect(stamped.version).toBe(3);
    expect(stamped.source).toBe("google_contacts");
    expect(stamped.sourceId).toBe("gc-1");
    expect(stamped.syncStatus).toBe("conflict");
  });

  it("prepares conflict resolution preferring local user edits", () => {
    const local = markContactUserModified(
      hydrateContactSync({
        id: "e1",
        value: "local@example.com",
        source: "gmail",
        sourceId: "gm-1",
      }),
    );
    const remote = hydrateContactSync({
      id: "e1",
      value: "remote@example.com",
      source: "gmail",
      sourceId: "gm-1",
    });
    const resolution = prepareConflictResolution(local, remote, { kind: "email" });
    expect(resolution.status).toBe("conflict");
    expect(resolution.prefer).toBe("local");
  });

  it("hides manual source labels and shows external ones", () => {
    expect(contactSourceLabelKey({ source: "manual" })).toBeNull();
    expect(isExternalContactSource({ source: "manual" })).toBe(false);
    expect(contactSourceLabelKey({ source: "gmail" })).toBe("clientContacts.sources.gmail");
    expect(isExternalContactSource({ source: "ai_import" })).toBe(true);
  });

  it("normalizes legacy clients with sync defaults", () => {
    const normalized = normalizeClient({
      id: "c1",
      name: "Legacy",
      email: "legacy@example.com",
      phone: "0600000000",
    });
    expect(normalized.emails[0].source).toBe("manual");
    expect(normalized.phones[0].syncStatus).toBe("synced");
    expect(normalized.schemaVersion).toBeGreaterThanOrEqual(3);
  });

  it("creates empty contacts with sync defaults and keeps them on save", () => {
    const empty = createEmptyEmail();
    expect(empty.source).toBe("manual");
    expect(defaultContactSyncFields().syncStatus).toBe("synced");
    const prepared = prepareContactsForSave([
      { ...empty, value: "new@example.com", isPrimary: true },
    ]);
    expect(prepared[0].source).toBe("manual");
    expect(prepared[0].version).toBeGreaterThanOrEqual(1);
  });
});
