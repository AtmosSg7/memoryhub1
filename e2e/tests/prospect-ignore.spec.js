const { test, expect } = require("@playwright/test");
const { loginAs } = require("../helpers/auth");
const { loginApi, e2eHealth, seedUnknown, getProspectCount, getActions } = require("../helpers/api");
const {
  openFirstPendingProspect,
  ignoreProspectFromDrawer,
  restoreIgnoredProspect,
  createClientFromDrawer,
  openProspectsPage,
  waitForProspectCard,
} = require("../helpers/prospects");
const { expectNoReplyToProspectAction, expectReplyToProspectAction } = require("../helpers/dashboard");
const { UNKNOWN } = require("../fixtures/journey");

test.describe.configure({ mode: "serial" });

test.describe("Ignore / restore prospect", () => {
  test.beforeEach(async ({ request }) => {
    await loginApi(request);
    await e2eHealth(request);
    await seedUnknown(request);
  });

  test("ignore removes from À traiter, restore brings back, then convert", async ({
    page,
    request,
  }) => {
    await loginAs(page);
    await openFirstPendingProspect(page);
    await ignoreProspectFromDrawer(page);

    await openProspectsPage(page);
    await expect(
      page.locator('[data-testid^="prospect-card-"]').filter({ hasText: UNKNOWN.fromEmail })
    ).toHaveCount(0, { timeout: 15_000 });

    const pending = await getProspectCount(request, "pending");
    expect(pending.total).toBe(0);

    await expectNoReplyToProspectAction(page);

    const actions = await getActions(request);
    const replyActions = (actions.items || []).filter((a) => a.type === "reply_to_prospect");
    expect(replyActions.length).toBe(0);

    await restoreIgnoredProspect(page);
    const pendingAfter = await getProspectCount(request, "pending");
    expect(pendingAfter.total).toBeGreaterThanOrEqual(1);

    await expectReplyToProspectAction(page);

    await openFirstPendingProspect(page);
    await createClientFromDrawer(page);
    await expect(page.getByTestId("client-detail-page")).toBeVisible();
    await expect(page.getByTestId("client-timeline")).toBeVisible();
  });
});
