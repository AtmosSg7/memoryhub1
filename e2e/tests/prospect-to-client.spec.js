const { test, expect } = require("@playwright/test");
const { loginAs } = require("../helpers/auth");
const {
  loginApi,
  e2eHealth,
  seedUnknown,
  appendReply,
  getProspectCount,
  getActions,
  countCommsForEmail,
} = require("../helpers/api");
const {
  openFirstPendingProspect,
  analyzeAndAcceptCi,
  createClientFromDrawer,
  waitForProspectCard,
  openProspectsPage,
} = require("../helpers/prospects");
const {
  expectProspectsBadge,
  expectReplyToProspectAction,
  searchFor,
  expectSearchHit,
} = require("../helpers/dashboard");
const { UNKNOWN } = require("../fixtures/journey");

test.describe.configure({ mode: "serial" });

test.describe("Parcours principal: inconnu → prospect → client → réponse liée", () => {
  test.beforeEach(async ({ request }) => {
    await loginApi(request);
    await e2eHealth(request);
    await seedUnknown(request);
  });

  test("unknown email becomes client with linked reply and searchable timeline", async ({
    page,
    request,
  }) => {
    await loginAs(page);

    // Prospects badge + inbox
    await expectProspectsBadge(page, { min: 1 });
    await openProspectsPage(page);
    await waitForProspectCard(page);

    // Dashboard action
    await expectReplyToProspectAction(page);

    // Prospect detail + CI accept
    await openFirstPendingProspect(page);
    await analyzeAndAcceptCi(page);

    // After CI accept: at most one pending action for this comm (prepare_quote supersedes reply)
    const actionsAfterCi = await getActions(request);
    const pendingForUnknown = (actionsAfterCi.items || []).filter((a) => {
      const from = (a.metadata && a.metadata.fromEmail) || "";
      return from.toLowerCase() === UNKNOWN.fromEmail.toLowerCase();
    });
    expect(pendingForUnknown.length).toBeLessThanOrEqual(1);
    expect(
      pendingForUnknown.filter((a) => a.type === "reply_to_prospect").length
    ).toBe(0);

    // Convert → client fiche + Timeline V2
    await createClientFromDrawer(page, { name: UNKNOWN.clientName });
    await expect(page.getByTestId("client-detail-page")).toBeVisible();
    await expect(page.getByTestId("client-timeline")).toBeVisible();
    await expect(page.getByText(UNKNOWN.subject, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });

    const clientUrl = page.url();
    const clientId = clientUrl.match(/\/clients\/([^/?#]+)/)?.[1];
    expect(clientId).toBeTruthy();

    // Action attached to client
    const actionsOnClient = await getActions(request, { clientId });
    const clientPending = actionsOnClient.items || [];
    expect(clientPending.length).toBeGreaterThanOrEqual(1);
    expect(clientPending.every((a) => a.clientId === clientId)).toBeTruthy();

    // Universal search
    await searchFor(page, UNKNOWN.clientName);
    await expectSearchHit(page, UNKNOWN.clientName);
    await searchFor(page, "terrasse Lyon");
    await expectSearchHit(page, /terrasse|Devis/i);

    // New reply from same sender → auto-linked, no prospect duplicate
    const beforeComms = await countCommsForEmail(request, UNKNOWN.fromEmail);
    const beforeCount = beforeComms.length;
    const reply = await appendReply(request);
    expect(reply.communicationIds?.length || 0).toBeGreaterThanOrEqual(1);
    expect(reply.details?.clientId || reply.details?.summary).toBeTruthy();

    const afterComms = await countCommsForEmail(request, UNKNOWN.fromEmail);
    expect(afterComms.length).toBe(beforeCount + 1);
    expect(afterComms.every((c) => c.clientId === clientId)).toBeTruthy();

    const pendingProspects = await getProspectCount(request, "pending");
    expect(pendingProspects.total).toBe(0);

    await page.goto(`/dashboard/clients/${clientId}`);
    await page.getByTestId("client-timeline").waitFor({ state: "visible" });
    await expect(page.getByText(UNKNOWN.replySubject, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
