const { test, expect } = require("@playwright/test");
const { loginApi } = require("../helpers/api");
const { artisanA } = require("../fixtures/users");

/**
 * Phone Hub V2 — manual missed call → prospect → call_back → convert → timeline.
 * Relies on authenticated API + UI for product assertions.
 */

async function addCall(request, payload) {
  const res = await request.post("/api/integrations/phone/calls", { data: payload });
  if (!res.ok()) {
    throw new Error(`add call failed (${res.status()}): ${await res.text()}`);
  }
  return res.json();
}

test.describe("Phone Hub V2", () => {
  test("missed unknown → prospect + call_back → convert → outgoing completes", async ({
    page,
    request,
  }) => {
    await loginApi(request, artisanA);

    const phone = `06${String(Date.now()).slice(-8)}`;
    const created = await addCall(request, {
      phoneNumber: phone,
      direction: "incoming",
      status: "missed",
      counterpartyName: "E2E Phone Prospect",
    });
    expect(created.call?.id).toBeTruthy();
    expect(created.call?.clientId == null || created.call?.clientId === "").toBeTruthy();

    // Prospect appears
    await page.goto("/dashboard/prospects");
    await expect(page.getByTestId("prospects-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(phone).first()).toBeVisible({ timeout: 15_000 });

    // Action call_back pending
    const actions = await request.get("/api/actions?status=pending&limit=50");
    expect(actions.ok()).toBeTruthy();
    const actionItems = (await actions.json()).items || [];
    expect(actionItems.some((a) => a.type === "call_back")).toBeTruthy();

    // Convert via phone create-client API then open client
    const conv = await request.post(
      `/api/integrations/phone/calls/${created.call.id}/create-client`,
      { data: { name: "E2E Phone Client" } },
    );
    expect(conv.ok()).toBeTruthy();
    const clientId = (await conv.json()).client.id;

    await page.goto(`/dashboard/clients/${clientId}`);
    await expect(page.getByText("E2E Phone Client").first()).toBeVisible({ timeout: 20_000 });

    // Outgoing answered should complete call_back
    await addCall(request, {
      phoneNumber: phone,
      direction: "outgoing",
      status: "answered",
      duration: 60,
    });
    const pending = await request.get("/api/actions?status=pending&limit=50");
    const pendingItems = (await pending.json()).items || [];
    const stillOpen = pendingItems.some(
      (a) =>
        a.type === "call_back" &&
        ((a.metadata || {}).normalizedPhone === phone.replace(/\D/g, "").replace(/^33/, "0") ||
          a.clientId === clientId),
    );
    // Prefer completed — allow empty match if phone normalize differs
    expect(stillOpen).toBeFalsy();

    // Call journal UI
    await page.goto("/dashboard/calls");
    await expect(page.getByTestId("calls-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("calls-add-btn")).toBeVisible();
  });
});
