import { splitHighlightParts } from "./searchHighlight";
import { resolveSearchNavigation } from "./searchNavigation";

describe("searchHighlight", () => {
  it("highlights matching tokens without inventing", () => {
    const parts = splitHighlightParts("Devis terrasse Lyon", "terrasse");
    expect(parts.some((p) => p.match && /terrasse/i.test(p.text))).toBe(true);
    expect(splitHighlightParts("Hello", "").every((p) => !p.match)).toBe(true);
  });
});

describe("searchNavigation", () => {
  it("routes each type to a usable destination", () => {
    expect(resolveSearchNavigation({ type: "client", id: "c1" })).toContain("/clients/c1");
    expect(resolveSearchNavigation({ type: "prospect", id: "p1" })).toContain("open=p1");
    expect(resolveSearchNavigation({ type: "quote", id: "q1" })).toContain("open=q1");
    expect(resolveSearchNavigation({ type: "invoice", id: "i1" })).toContain("open=i1");
    expect(
      resolveSearchNavigation({ type: "email", id: "e1", clientId: null })
    ).toContain("communications?open=e1");
    expect(
      resolveSearchNavigation({ type: "action", sourceId: "e1" })
    ).toContain("communications?open=e1");
    expect(
      resolveSearchNavigation({ type: "note", clientId: "c1" })
    ).toContain("section=notes");
  });

  it("prefers navigationTarget when present", () => {
    expect(
      resolveSearchNavigation({
        type: "client",
        navigationTarget: "/dashboard/custom",
      })
    ).toBe("/dashboard/custom");
  });
});
