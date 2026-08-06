const { test, expect } = require("@playwright/test");
const { loginAs } = require("../helpers/auth");
const { loginApi, e2eHealth, seedUnknown } = require("../helpers/api");
const {
  waitForProspectCard,
  openFirstPendingProspect,
  createClientFromDrawer,
} = require("../helpers/prospects");
const {
  openMobileBottom,
  expectNoHorizontalOverflow,
  expectProspectsBadge,
} = require("../helpers/dashboard");
const { UNKNOWN } = require("../fixtures/journey");

test.describe("Parcours principal mobile", () => {
  test.beforeEach(async ({ request }) => {
    await loginApi(request);
    await e2eHealth(request);
    await seedUnknown(request);
  });

  test("bottom nav → prospects drawer → convert → fiche without overflow", async ({ page }) => {
    await loginAs(page);
    await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
    await expectProspectsBadge(page, { min: 1 });
    await openMobileBottom(page, "prospects");

    await page.getByTestId("prospects-page").waitFor({ state: "visible" });
    await waitForProspectCard(page);
    await expectNoHorizontalOverflow(page);

    await openFirstPendingProspect(page);
    await expect(page.getByTestId("prospect-detail-drawer")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await createClientFromDrawer(page, { name: UNKNOWN.clientName });
    await expect(page.getByTestId("client-detail-page")).toBeVisible();
    await expect(page.getByTestId("client-timeline")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
