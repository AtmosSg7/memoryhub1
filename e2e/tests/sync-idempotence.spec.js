const { test, expect } = require("@playwright/test");
const {
  loginApi,
  e2eHealth,
  seedUnknown,
  syncAgain,
  getProspectCount,
  getActions,
  countCommsForEmail,
} = require("../helpers/api");
const { UNKNOWN } = require("../fixtures/journey");

test.describe("Gmail mock sync idempotence", () => {
  test("second sync creates no duplicate communication, prospect, or action", async ({
    request,
  }) => {
    await loginApi(request);
    await e2eHealth(request);
    const seed = await seedUnknown(request);
    expect(seed.communicationIds?.length).toBe(1);

    const firstComms = await countCommsForEmail(request, UNKNOWN.fromEmail);
    const firstProspects = await getProspectCount(request, "pending");
    const firstActions = await getActions(request);
    const firstReply = (firstActions.items || []).filter(
      (a) =>
        a.type === "reply_to_prospect" &&
        ((a.metadata && a.metadata.fromEmail) || "").toLowerCase() === UNKNOWN.fromEmail.toLowerCase()
    );

    expect(firstComms.length).toBe(1);
    expect(firstProspects.total).toBe(1);
    expect(firstReply.length).toBe(1);

    const second = await syncAgain(request);
    expect(second.synced).toBe(0);

    const secondComms = await countCommsForEmail(request, UNKNOWN.fromEmail);
    const secondProspects = await getProspectCount(request, "pending");
    const secondActions = await getActions(request);
    const secondReply = (secondActions.items || []).filter(
      (a) =>
        a.type === "reply_to_prospect" &&
        ((a.metadata && a.metadata.fromEmail) || "").toLowerCase() === UNKNOWN.fromEmail.toLowerCase()
    );

    expect(secondComms.length).toBe(1);
    expect(secondProspects.total).toBe(1);
    expect(secondReply.length).toBe(1);
  });
});
