import { filterCommercialDocumentRows } from "./commercialDocumentsDisplay";

describe("filterCommercialDocumentRows", () => {
  const rows = [
    { kind: "quote", status: "sent", clientId: "a" },
    { kind: "quote", status: "accepted", clientId: "b" },
    { kind: "invoice", status: "paid", clientId: "a" },
    { kind: "invoice", status: "in_progress", clientId: "c" },
    { kind: "invoice", status: "draft", clientId: "c" },
  ];

  it("filters by kind only", () => {
    expect(filterCommercialDocumentRows(rows, "quote")).toHaveLength(2);
    expect(filterCommercialDocumentRows(rows, "invoice")).toHaveLength(3);
  });

  it("filters by quote status", () => {
    expect(filterCommercialDocumentRows(rows, "quote", "sent")).toEqual([
      { kind: "quote", status: "sent", clientId: "a" },
    ]);
  });

  it("filters invoices with normalized status", () => {
    expect(filterCommercialDocumentRows(rows, "invoice", "in_progress")).toEqual([
      { kind: "invoice", status: "in_progress", clientId: "c" },
      { kind: "invoice", status: "draft", clientId: "c" },
    ]);
    expect(filterCommercialDocumentRows(rows, "invoice", "paid")).toHaveLength(1);
  });
});
