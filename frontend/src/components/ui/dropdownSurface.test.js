import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");

describe("dropdown surface tokens", () => {
  it("defines opaque popover CSS variables on :root", () => {
    const css = fs.readFileSync(path.join(root, "index.css"), "utf8");
    expect(css).toMatch(/--popover:\s*0 0% 100%/);
    expect(css).toMatch(/--popover-foreground:\s*222/);
    expect(css).toMatch(/--border:\s*214/);
    expect(css).toMatch(/\.dark\s*\{[\s\S]*--popover:/);
  });

  it("keeps shared DropdownMenu content above dialogs with an opaque surface", () => {
    const source = fs.readFileSync(
      path.join(root, "components/ui/dropdown-menu.jsx"),
      "utf8"
    );
    expect(source).toMatch(/z-\[200\]/);
    expect(source).toMatch(/bg-popover/);
    expect(source).toMatch(/border-border/);
    expect(source).toMatch(/shadow-\[var\(--dash-panel-shadow/);
    expect(source).not.toMatch(/["']z-50 /);
  });

  it("lets dialogs ignore outside interactions from portaled menus", () => {
    const source = fs.readFileSync(path.join(root, "components/ui/dialog.jsx"), "utf8");
    expect(source).toMatch(/isPortaledOverlayTarget/);
    expect(source).toMatch(/data-radix-dropdown-menu-content/);
    expect(source).toMatch(/onInteractOutside/);
    expect(source).toMatch(/onPointerDownOutside/);
  });
});
