// @ts-check
// Regression for finding ①: a plan edit made offline must NOT silently vanish. It shows a banner,
// is queued, retries automatically on reconnect, and persists. Fixture: the throwaway
// "AutoTest Picker Plan" with an empty "AutoPickerDay" (seedPickerDay), active.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

test.describe("cap-plan-save offline resilience", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seed.seedPickerDay(); });
  test.afterAll(async () => { await seed.restorePicker(); });

  const EX = "Face Pull";
  const BANNER = /back online|Couldn't save/i; // matches the PLAN save banner (not the workouts-offline one)

  async function openDay(page) {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await page.getByRole("button", { name: "AutoTest Picker Plan" }).click();
    const dayCard = page.getByText(/AutoPickerDay/).first();
    await expect(dayCard).toBeVisible({ timeout: 12000 });
    await dayCard.click();
  }

  test("offline edit → banner → auto-retry on reconnect → persists", async ({ page, context }) => {
    await openDay(page);

    // Go offline, then add an exercise. The optimistic UI shows it; the write can't land.
    await context.setOffline(true);
    await page.getByRole("button", { name: /\+ Exercise/i }).click();
    await expect(page.getByText("Add Exercises")).toBeVisible({ timeout: 8000 });
    await page.getByPlaceholder(/Search .* exercises/i).fill(EX);
    await page.getByText(EX, { exact: true }).last().click();
    await page.getByRole("button", { name: /Done/i }).first().click();

    // The plan-save banner appears (the change is queued, not lost).
    await expect(page.getByText(BANNER)).toBeVisible({ timeout: 8000 });

    // Reconnect → the queued save flushes automatically and the banner clears.
    await context.setOffline(false);
    await expect(page.getByText(BANNER)).toHaveCount(0, { timeout: 15000 });

    // Let the flush commit, then reload → the offline edit persisted.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await openDay(page);
    await expect(page.getByText(EX, { exact: true })).toHaveCount(1, { timeout: 8000 });
  });
});
