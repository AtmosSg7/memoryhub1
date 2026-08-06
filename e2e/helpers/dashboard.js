const { UNKNOWN } = require("../fixtures/journey");

async function expectProspectsBadge(page, { min = 1 } = {}) {
  // Prefer the visible badge (bottom nav on mobile; sidebar is md+ only).
  const bottomNav = page.getByTestId("mobile-bottom-nav");
  const useMobile = await bottomNav.isVisible().catch(() => false);
  const badge = useMobile
    ? page.getByTestId("mobile-bottom-prospects-badge")
    : page.getByTestId("sidebar-prospects-badge");
  await badge.waitFor({ state: "visible", timeout: 20_000 });
  const text = (await badge.textContent()) || "";
  const n = parseInt(text.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n < min) {
    throw new Error(`Expected prospects badge >= ${min}, got "${text}"`);
  }
}

async function expectReplyToProspectAction(page) {
  await page.goto("/dashboard");
  await page.getByTestId("dashboard-home").waitFor({ state: "visible" });
  const item = page.getByTestId("action-item-reply_to_prospect");
  await item.waitFor({ state: "visible", timeout: 25_000 });
  await item.getByText(/Répondre au prospect/i).waitFor({ state: "visible" });
  return item;
}

async function expectNoReplyToProspectAction(page) {
  await page.goto("/dashboard");
  await page.getByTestId("dashboard-home").waitFor({ state: "visible" });
  await page
    .getByTestId("action-item-reply_to_prospect")
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {});
  const count = await page.getByTestId("action-item-reply_to_prospect").count();
  if (count > 0) {
    throw new Error("Expected no active reply_to_prospect action");
  }
}

async function searchFor(page, query) {
  await page.goto(`/dashboard/search?q=${encodeURIComponent(query)}`);
  await page.getByTestId("search-page").waitFor({ state: "visible", timeout: 20_000 });
  await page.getByTestId("search-page-results").waitFor({ state: "visible", timeout: 20_000 });
}

async function expectSearchHit(page, text) {
  const results = page.getByTestId("search-page-results").or(page.getByTestId("search-dropdown"));
  await results.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 20_000 });
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  if (overflow) {
    throw new Error("Horizontal overflow detected on viewport");
  }
}

async function openMobileNav(page) {
  await page.getByTestId("topbar-mobile-menu").click();
  await page.getByTestId("mobile-nav-sheet").waitFor({ state: "visible" });
}

async function openMobileBottom(page, key) {
  await page.getByTestId(`mobile-bottom-${key}`).click();
}

module.exports = {
  expectProspectsBadge,
  expectReplyToProspectAction,
  expectNoReplyToProspectAction,
  searchFor,
  expectSearchHit,
  expectNoHorizontalOverflow,
  openMobileNav,
  openMobileBottom,
  UNKNOWN,
};
