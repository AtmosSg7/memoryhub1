// @ts-check
const { defineConfig, devices } = require("@playwright/test");

// Default matches scripts/e2e-start.* (port 3001) so Playwright never hits the local :3000 stack.
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
const mobileSpecs = /prospect-mobile\.spec\.js|artisan-mobile\.spec\.js/;

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: "fr-FR",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [mobileSpecs],
    },
    {
      name: "mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: mobileSpecs,
    },
    {
      name: "mobile-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: mobileSpecs,
    },
    {
      name: "mobile-412",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: mobileSpecs,
    },
    // Aliases kept for CI / nightly scripts
    {
      name: "mobile-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: mobileSpecs,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: [mobileSpecs, /accessibility\.spec\.js/],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: [mobileSpecs, /accessibility\.spec\.js/],
    },
    {
      name: "tablet",
      use: { ...devices["iPad Pro 11"] },
      testMatch: /prospect-mobile\.spec\.js/,
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
      testMatch: mobileSpecs,
    },
  ],
});
