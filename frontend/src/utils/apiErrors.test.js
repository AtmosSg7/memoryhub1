import { translateApiError } from "@/utils/apiErrors";

function t(key) {
  return `T:${key}`;
}

describe("translateApiError", () => {
  it("maps known backend messages", () => {
    expect(translateApiError("Failed to load clients.", t)).toBe("T:errors.loadClients");
  });

  it("maps technical network messages", () => {
    expect(translateApiError("Network Error", t)).toBe("T:errors.network");
  });

  it("maps 500 dumps", () => {
    expect(translateApiError("500 Internal Server Error", t)).toBe("T:errors.server");
  });

  it("maps request failed", () => {
    expect(translateApiError("Request failed with status code 502", t)).toBe(
      "T:errors.loadGeneric"
    );
  });

  it("keeps unknown friendly messages", () => {
    expect(translateApiError("Montant trop élevé pour ce devis.", t)).toBe(
      "Montant trop élevé pour ce devis."
    );
  });
});
