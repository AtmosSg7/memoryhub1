const { UNKNOWN } = require("../fixtures/journey");

async function openProspectsPage(page) {
  await page.goto("/dashboard/prospects");
  await page.getByTestId("prospects-page").waitFor({ state: "visible" });
}

async function waitForProspectCard(page, { email = UNKNOWN.fromEmail, timeout = 25_000 } = {}) {
  const card = page.locator('[data-testid^="prospect-card-"]').filter({
    hasText: email,
  });
  await card.first().waitFor({ state: "visible", timeout });
  return card.first();
}

async function openFirstPendingProspect(page) {
  await openProspectsPage(page);
  const card = await waitForProspectCard(page);
  const treat = card.locator('[data-testid^="prospect-treat-"]');
  await treat.click();
  await page.getByTestId("prospect-detail-drawer").waitFor({ state: "visible" });
  return page.getByTestId("prospect-detail-drawer");
}

async function analyzeAndAcceptCi(page) {
  const drawer = page.getByTestId("prospect-detail-drawer");
  const analyze = drawer.locator('[data-testid$="-analyze"]').first();
  await analyze.waitFor({ state: "visible", timeout: 15_000 });
  await analyze.click();
  const accept = drawer.locator('[data-testid$="-accept"]').first();
  await accept.waitFor({ state: "visible", timeout: 20_000 });
  // Summary from mock CI should mention the subject/preview
  await expectSummaryVisible(drawer);
  await accept.click();
  await drawer.locator('[data-testid$="-done"]').first().waitFor({ state: "visible", timeout: 15_000 });
}

async function analyzeAndRejectCi(page) {
  const drawer = page.getByTestId("prospect-detail-drawer");
  const analyze = drawer.locator('[data-testid$="-analyze"]').first();
  await analyze.waitFor({ state: "visible", timeout: 15_000 });
  await analyze.click();
  const reject = drawer.locator('[data-testid$="-reject"]').first();
  await reject.waitFor({ state: "visible", timeout: 20_000 });
  await reject.click();
  await drawer.locator('[data-testid$="-done"]').first().waitFor({ state: "visible", timeout: 15_000 });
}

async function expectSummaryVisible(drawer) {
  await drawer.getByText(/Devis terrasse|terrasse|Lyon/i).first().waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

async function createClientFromDrawer(page, { name = UNKNOWN.clientName } = {}) {
  await page.getByTestId("prospect-detail-create").click();
  await page.getByTestId("create-client-from-email-modal").waitFor({ state: "visible" });
  const nameInput = page.getByTestId("create-from-email-name");
  await nameInput.fill(name);
  await page.getByTestId("create-from-email-confirm").click();
  await page.waitForURL(/\/dashboard\/clients\/[^/]+/, { timeout: 30_000 });
  await page.getByTestId("client-detail-page").waitFor({ state: "visible", timeout: 20_000 });
  // Overview embeds Timeline V2 as data-testid="client-timeline"
  await page.getByTestId("client-timeline").waitFor({ state: "visible", timeout: 30_000 });
}

async function ignoreProspectFromDrawer(page) {
  await page.getByTestId("prospect-detail-ignore").click();
  await page.getByTestId("prospect-ignore-confirm").waitFor({ state: "visible" });
  await page.getByTestId("prospect-ignore-confirm-btn").click();
  await page.getByTestId("prospect-detail-drawer").waitFor({ state: "hidden", timeout: 15_000 });
}

async function restoreIgnoredProspect(page, email = UNKNOWN.fromEmail) {
  await page.goto("/dashboard/prospects?tab=ignored");
  await page.getByTestId("prospects-page").waitFor({ state: "visible" });
  const card = page.locator('[data-testid^="prospect-card-"]').filter({ hasText: email });
  await card.first().waitFor({ state: "visible", timeout: 20_000 });
  await card.locator('[data-testid^="prospect-restore-"]').click();
  await page.getByTestId("prospects-tab-pending").click();
  await waitForProspectCard(page, { email });
}

module.exports = {
  openProspectsPage,
  waitForProspectCard,
  openFirstPendingProspect,
  analyzeAndAcceptCi,
  analyzeAndRejectCi,
  createClientFromDrawer,
  ignoreProspectFromDrawer,
  restoreIgnoredProspect,
};
