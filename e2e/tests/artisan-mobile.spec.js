/**
 * Artisan one-handed mobile journey across priority screens.
 * Runs on mobile viewport projects (360 / 390 / 412).
 */
const { test, expect } = require("@playwright/test");
const { loginAs } = require("../helpers/auth");
const { loginApi, e2eHealth, seedUnknown, getActions } = require("../helpers/api");
const { artisanA } = require("../fixtures/users");
const {
  openMobileBottom,
  openMobileNav,
  expectNoHorizontalOverflow,
  expectReplyToProspectAction,
  searchFor,
  expectSearchHit,
} = require("../helpers/dashboard");

test.describe("Artisan mobile daily path", () => {
  test.beforeEach(async ({ request }) => {
    await loginApi(request);
    await e2eHealth(request);
    await seedUnknown(request);
  });

  test("dashboard, action, search, clients, note form, documents, more nav", async ({
    page,
    request,
  }) => {
    await loginAs(page);
    await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
    await expect(page.getByTestId("dashboard-home")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Treat an action — open secondary “Clients potentiels” (stable on mobile)
    const action = await expectReplyToProspectAction(page);
    const secondary = action.locator('[data-testid^="action-secondary-"]').first();
    if (await secondary.count()) {
      await secondary.click();
      await page.waitForURL(/\/dashboard\/prospects/, { timeout: 20_000 });
    } else {
      const primary = action.locator('[data-testid^="action-primary-"]').first();
      await primary.click();
      await page.waitForURL(/\/dashboard\/(prospects|clients)/, { timeout: 20_000 });
    }
    await expectNoHorizontalOverflow(page);

    // Back to dashboard via bottom nav
    await openMobileBottom(page, "dashboard");
    await page.getByTestId("dashboard-home").waitFor({ state: "visible" });

    // Universal search
    await searchFor(page, artisanA.existingClientName.split(" ")[0] || "Dupont");
    await expectSearchHit(page, /Dupont|Client E2E/i);
    await expectNoHorizontalOverflow(page);

    // Clients list
    await openMobileBottom(page, "clients");
    await page.getByTestId("clients-page").waitFor({ state: "visible" });
    await page.getByTestId("clients-search-input").fill("Dupont");
    const card = page.locator('[data-testid^="client-card-"]').first();
    await card.waitFor({ state: "visible", timeout: 20_000 });
    await card.click();
    await page.getByTestId("client-detail-page").waitFor({ state: "visible" });
    await expect(page.getByTestId("client-timeline")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Call / email if present (href presence)
    const call = page.getByTestId("client-quick-call");
    if (await call.count()) {
      await expect(call).toBeVisible();
    }
    const emailBtn = page.getByTestId("client-quick-email");
    if (await emailBtn.count()) {
      await expect(emailBtn).toBeVisible();
    }

    // Add note — open modal, fill, cancel (simulate keyboard form)
    await page.getByTestId("client-create-note").click();
    await page.getByTestId("add-note-modal").waitFor({ state: "visible", timeout: 15_000 });
    await page.getByTestId("note-form-content").fill("Note mobile E2E artisan");
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await page.getByTestId("add-note-modal").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});

    // Documents (commercial hub at /dashboard/documents)
    await openMobileBottom(page, "documents");
    await page.getByTestId("commercial-documents-page").waitFor({ state: "visible", timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    // Plus sheet
    await page.getByTestId("mobile-bottom-plus").click();
    await page.getByTestId("mobile-plus-sheet").waitFor({ state: "visible" });
    await expect(page.getByTestId("mobile-plus-client")).toBeVisible();
    await page.keyboard.press("Escape");

    // More (hamburger) secondary pages
    await openMobileNav(page);
    await expect(page.getByTestId("mobile-nav-settings")).toBeVisible();
    await expect(page.getByTestId("mobile-nav-communications")).toBeVisible();
    await page.getByTestId("mobile-nav-communications").click();
    await page.getByTestId("communications-page").waitFor({ state: "visible", timeout: 20_000 });
    await expectNoHorizontalOverflow(page);

    // Actions still listed via API (sanity)
    const actions = await getActions(request);
    expect(Array.isArray(actions.items)).toBeTruthy();
  });
});
