import { commercialDocumentsPath } from "./commercialDocumentsPath";

describe("commercialDocumentsPath", () => {
  it("returns the documents hub root", () => {
    expect(commercialDocumentsPath()).toBe("/dashboard/documents");
  });

  it("adds kind filters for quotes and invoices", () => {
    expect(commercialDocumentsPath({ kind: "quote" })).toBe("/dashboard/documents?kind=quote");
    expect(commercialDocumentsPath({ kind: "invoice" })).toBe(
      "/dashboard/documents?kind=invoice"
    );
  });

  it("ignores all/empty kinds", () => {
    expect(commercialDocumentsPath({ kind: "all" })).toBe("/dashboard/documents");
    expect(commercialDocumentsPath({ kind: "" })).toBe("/dashboard/documents");
  });

  it("preserves open and extra query params", () => {
    expect(commercialDocumentsPath({ kind: "quote", open: "q1" })).toBe(
      "/dashboard/documents?kind=quote&open=q1"
    );
    expect(commercialDocumentsPath({ kind: "invoice", open: "i1", foo: "bar" })).toBe(
      "/dashboard/documents?kind=invoice&open=i1&foo=bar"
    );
  });

  it("supports status and clientId explicitly", () => {
    expect(commercialDocumentsPath({ kind: "quote", status: "sent" })).toBe(
      "/dashboard/documents?kind=quote&status=sent"
    );
    expect(
      commercialDocumentsPath({ kind: "invoice", status: "in_progress", clientId: "c1" })
    ).toBe("/dashboard/documents?kind=invoice&status=in_progress&clientId=c1");
  });

  it("omits empty status and clientId", () => {
    expect(commercialDocumentsPath({ kind: "quote", status: "", clientId: null })).toBe(
      "/dashboard/documents?kind=quote"
    );
  });

  it("supports from/to period filters", () => {
    expect(
      commercialDocumentsPath({
        kind: "invoice",
        status: "paid",
        from: "2026-01-01",
        to: "2026-12-31",
      })
    ).toBe("/dashboard/documents?kind=invoice&status=paid&from=2026-01-01&to=2026-12-31");
  });
});
