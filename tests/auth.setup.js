// @ts-check
const { test: setup, expect } = require("@playwright/test");
const path = require("path");
const AUTH_FILE = path.join(__dirname, ".auth/state.json");

setup("authenticate as test user", async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_EMAIL and TEST_PASSWORD must be set in .env.test.local");
  }

  await page.goto("/");
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Your password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for nav bar (auth succeeded) then wait for plan data to load
  await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 20000 });

  // After login, a draft may be restored and the workout session may open automatically.
  // Wait for either the home page START button or the workout session ⋯ button.
  const startBtn = page.getByRole("button", { name: "START" }).first();
  const moreBtn = page.locator("button", { hasText: "⋯" }).first();
  await expect(startBtn.or(moreBtn)).toBeVisible({ timeout: 15000 });

  // If a draft was restored, abandon it so the home page is clean for tests
  if (await moreBtn.isVisible()) {
    await moreBtn.click();
    await page.getByRole("button", { name: "✕ Abandon" }).click();
    await page.getByRole("button", { name: "Abandon" }).click();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
  }

  await page.context().storageState({ path: AUTH_FILE });
});
