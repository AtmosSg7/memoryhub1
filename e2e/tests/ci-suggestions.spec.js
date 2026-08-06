const { test, expect } = require("@playwright/test");
const { loginAs } = require("../helpers/auth");
const { loginApi, e2eHealth, seedUnknown, getActions } = require("../helpers/api");
const {
  openFirstPendingProspect,
  analyzeAndAcceptCi,
  analyzeAndRejectCi,
} = require("../helpers/prospects");
const { UNKNOWN } = require("../fixtures/journey");

test.describe.configure({ mode: "serial" });

function pendingForUnknown(actions) {
  return (actions.items || []).filter((a) => {
    const from = (a.metadata && a.metadata.fromEmail) || "";
    return from.toLowerCase() === UNKNOWN.fromEmail.toLowerCase() && a.status === "pending";
  });
}

test.describe("Communication Intelligence suggestions", () => {
  test("accept creates one action and supersedes reply_to_prospect", async ({ page, request }) => {
    await loginApi(request);
    await e2eHealth(request);
    await seedUnknown(request);

    const before = pendingForUnknown(await getActions(request));
    expect(before.some((a) => a.type === "reply_to_prospect")).toBeTruthy();

    await loginAs(page);
    await openFirstPendingProspect(page);
    await analyzeAndAcceptCi(page);

    const after = pendingForUnknown(await getActions(request));
    expect(after.filter((a) => a.type === "reply_to_prospect").length).toBe(0);
    expect(after.length).toBe(1);
  });

  test("reject creates no additional action", async ({ page, request }) => {
    await loginApi(request);
    await e2eHealth(request);
    await seedUnknown(request);

    const before = pendingForUnknown(await getActions(request));
    const beforeCount = before.length;
    expect(beforeCount).toBeGreaterThanOrEqual(1);

    await loginAs(page);
    await openFirstPendingProspect(page);
    await analyzeAndRejectCi(page);

    const after = pendingForUnknown(await getActions(request));
    expect(after.length).toBe(beforeCount);
    expect(after.filter((a) => a.type === "reply_to_prospect").length).toBeGreaterThanOrEqual(1);
  });
});
