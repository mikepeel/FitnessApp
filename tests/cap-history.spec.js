// @ts-check
// Regression guards for the cap-cleanup HISTORY INTERACTIONS (step 5): date-range window
// switching, "all" pagination, partial-session display, and the post-mutation re-fetch.
// Self-seeds (beforeAll) ~90 completed sessions aged into the 6m-but-not-3m band + one recent
// partial, so the "all" view exceeds the 100-row first page and older rows appear only in
// wider windows; cleans up afterAll. Skips when no service key is available to seed.
//
// Mutation-verified locally (E2E_BASE_URL=http://localhost:3000) — see report. Each guard,
// when reverted, fails its test:
//   - window: filteredSorted=historyWindow(displaySessions,historyFilter) → forced "all"
//   - partial: historyWindow's `s.completedAt || s.startedAt` → `s.completedAt`
//   - delete: deleteSession's `setReloadNonce(n=>n+1)` removed
//   - load more: loadMore's append → no-op
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup history interactions", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed history fixtures");

  test.beforeAll(async () => { await seedHistory.seed({ bulk: 90 }); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("window switching: ~100-day-old sessions appear only in wider windows", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await expect(page.getByText(/\d+ sessions/).first()).toBeVisible({ timeout: 10000 });

    // 1M = last 30 days only: the seeded ~100-day-old sessions must NOT appear.
    await page.getByRole("button", { name: "1M" }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText("AutoTest-Bulk").first()).not.toBeVisible();

    // 6M reaches back far enough: they appear (the date-range fetch returns them).
    await page.getByRole("button", { name: "6M" }).click();
    await expect(page.getByText("AutoTest-Bulk").first()).toBeVisible({ timeout: 10000 });
  });

  test("a partial (in-progress) session appears in the list with a Partial pill", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByRole("button", { name: "1M" }).click(); // partial is recent → within 1m (prop path)

    await expect(page.getByText("AutoTest-Partial").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Partial", { exact: true }).first()).toBeVisible(); // the pill, not the label
  });

  test("deleting a session refreshes the visible (fetched) window", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();

    // Create a manual session (dated today → within the default 3M fetched window).
    const label = `AutoTest-Del-${Date.now()}`;
    await page.getByRole("button", { name: /^\+ Log$/i }).click();
    await expect(page.getByText("Log a Workout")).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder("e.g. Chest & Triceps").fill(label);
    await page.getByPlaceholder("Exercise name").fill("Test Press");
    await page.getByRole("button", { name: "Save Session" }).click();
    await expect(page.getByText(label)).toBeVisible({ timeout: 10000 });

    // Reload so the new session is loaded into the prop with its DB id (deleteSession looks the
    // session up there). It's then shown from the 3M fetched window, so a successful delete
    // must re-fetch that window for the card to disappear.
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await expect(page.getByText(label)).toBeVisible({ timeout: 10000 });

    // Delete it: expand the card → Delete → confirm.
    await page.getByText(label).click();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByText("Delete this workout?")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Delete" }).last().click();

    // The fetched 3M window re-fetches (reloadNonce) → the session is gone from the list.
    await expect(page.getByText(label)).not.toBeVisible({ timeout: 10000 });
  });

  test("'all' paginates: the first page caps at 100 and Load more appends the rest", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByRole("button", { name: "ALL" }).click();

    const header = page.getByText(/\d+ sessions · all time/).first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // First page is the 100-row range; with >100 total seeded it caps exactly at 100.
    await expect
      .poll(async () => { const m = ((await header.textContent()) || "").match(/(\d+) sessions/); return m ? parseInt(m[1], 10) : 0; }, { timeout: 8000 })
      .toBe(100);

    // Load more appends the next page → count climbs past 100.
    await page.getByRole("button", { name: /Load more/i }).click();
    await expect
      .poll(async () => { const m = ((await header.textContent()) || "").match(/(\d+) sessions/); return m ? parseInt(m[1], 10) : 0; }, { timeout: 8000 })
      .toBeGreaterThan(100);
  });
});
