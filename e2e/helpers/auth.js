const { artisanA } = require("../fixtures/users");

/**
 * UI login — waits for dashboard after cookie session is established.
 */
async function loginAs(page, user = artisanA) {
  await page.goto("/login");
  await page.getByTestId("login-email-input").fill(user.email);
  await page.getByTestId("login-password-input").fill(user.password);
  await page.getByTestId("login-submit-button").click();
  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 30_000 });
  await page.getByTestId("dashboard-home").waitFor({ state: "visible", timeout: 30_000 });
}

module.exports = { loginAs };
