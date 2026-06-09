// @ts-check
const { expect } = require("@playwright/test");

// Go to the home screen and make sure no leftover draft is auto-restored into a
// workout session. A draft left by a previous test (the 30s heartbeat reliably
// persists drafts now) can re-open on load, leaving no START button and bleeding
// state into the next test. abandonWorkout() awaits deleteDraft(), so once the
// START button is back the draft is gone server-side.
async function ensureCleanHome(page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 15000 });
  // Let initial data (plans/sessions/draft) finish loading so the home cards stop
  // re-rendering — otherwise a START button can detach from the DOM mid-click.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  const moreBtn = page.locator("button", { hasText: "⋯" }).first();
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.getByRole("button", { name: "✕ Abandon" }).click();
    await page.getByRole("button", { name: "Abandon" }).click();
    await expect(page.getByRole("button", { name: "START" }).first()).toBeVisible({ timeout: 8000 });
  }
}

module.exports = { ensureCleanHome };
