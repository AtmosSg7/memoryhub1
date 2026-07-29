import {
  addUniqueTag,
  ensureSinglePrimary,
  prepareContactsForSave,
  removeContactItem,
  setPrimaryContact,
  upsertContactItem,
} from "./clientContacts";

describe("clientContacts helpers", () => {
  it("keeps a single primary when setting primary", () => {
    const items = [
      { id: "a", value: "1", isPrimary: true },
      { id: "b", value: "2", isPrimary: false },
    ];
    const next = setPrimaryContact(items, "b");
    expect(next.find((item) => item.id === "b").isPrimary).toBe(true);
    expect(next.find((item) => item.id === "a").isPrimary).toBe(false);
  });

  it("promotes another item when primary is removed", () => {
    const items = [
      { id: "a", value: "1", isPrimary: true },
      { id: "b", value: "2", isPrimary: false },
    ];
    const next = removeContactItem(items, "a");
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("b");
    expect(next[0].isPrimary).toBe(true);
  });

  it("upserts and can force primary", () => {
    const items = [{ id: "a", value: "1", isPrimary: true, label: "main" }];
    const next = upsertContactItem(items, {
      id: "b",
      value: "2",
      label: "mobile",
      isPrimary: true,
    });
    expect(next).toHaveLength(2);
    expect(next.find((item) => item.id === "b").isPrimary).toBe(true);
    expect(next.find((item) => item.id === "a").isPrimary).toBe(false);
  });

  it("replaces legacy ids on save", () => {
    const prepared = prepareContactsForSave([
      { id: "legacy-phone", value: "0600000000", label: "main", isPrimary: true },
    ]);
    expect(prepared[0].id).not.toMatch(/^legacy-/);
    expect(prepared[0].isPrimary).toBe(true);
  });

  it("ensures primary on empty-primary lists", () => {
    const next = ensureSinglePrimary([
      { id: "a", value: "1", isPrimary: false },
      { id: "b", value: "2", isPrimary: false },
    ]);
    expect(next.filter((item) => item.isPrimary)).toHaveLength(1);
  });

  it("adds unique normalized tags", () => {
    expect(addUniqueTag(["vip"], " VIP ").tags).toEqual(["vip"]);
    expect(addUniqueTag(["vip"], "chantier").tags).toEqual(["vip", "chantier"]);
  });
});
