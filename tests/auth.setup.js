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

  // A restored draft may auto-open a workout session; abandon it so tests start clean. Don't require a
  // START button here — on a REST day (today's slot is rest) the home shows a rest quote and no START,
  // which is a valid logged-in state. The nav check above already proves auth; per-test ensureCleanHome
  // also re-handles drafts, so this cleanup is best-effort.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  const moreBtn = page.locator("button", { hasText: "⋯" }).first();
  if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await moreBtn.click();
    await page.getByRole("button", { name: "✕ Abandon" }).click();
    await page.getByRole("button", { name: "Abandon" }).click();
  }

  await page.context().storageState({ path: AUTH_FILE });
});
