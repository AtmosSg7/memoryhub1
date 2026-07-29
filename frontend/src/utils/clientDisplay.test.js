import {
  formatClientLocation,
  getPrimaryEmail,
  getPrimaryPhone,
  normalizeClient,
} from "./clientDisplay";

describe("clientDisplay adapters", () => {
  it("normalizes legacy flat clients into nested contacts", () => {
    const normalized = normalizeClient({
      id: "1",
      name: "Dupont",
      email: "a@example.com",
      phone: "0600000000",
      address: "1 rue",
      city: "Paris",
    });
    expect(normalized.emails[0].value).toBe("a@example.com");
    expect(normalized.phones[0].value).toBe("0600000000");
    expect(normalized.addresses[0].city).toBe("Paris");
    expect(normalized.tags).toEqual([]);
    expect(normalized.isFavorite).toBe(false);
  });

  it("prefers nested primary contacts", () => {
    const client = {
      id: "2",
      name: "Martin",
      email: "old@example.com",
      emails: [
        { id: "e1", value: "billing@example.com", isPrimary: true },
        { id: "e2", value: "perso@example.com", isPrimary: false },
      ],
      phones: [{ id: "p1", value: "0700000000", isPrimary: true }],
    };
    expect(getPrimaryEmail(client)).toBe("billing@example.com");
    expect(getPrimaryPhone(client)).toBe("0700000000");
  });

  it("formats location from nested address", () => {
    const location = formatClientLocation({
      addresses: [
        {
          id: "a1",
          line1: "10 rue du Port",
          postalCode: "33000",
          city: "Bordeaux",
          isPrimary: true,
        },
      ],
    });
    expect(location).toContain("Bordeaux");
    expect(location).toContain("10 rue du Port");
  });
});
