// @ts-check
// Guard for the saveEdit rollback repair. On a partial DB failure (logged_sets insert fails
// after the session update + sets delete succeed), the rollback must restore the original. The
// pre-repair code called .catch() on the PostgREST builder — which has no .catch — so the
// rollback threw and never ran, leaving a partial write (and a false "original data unchanged"
// banner). Uses an IN-CAP session (in the loaded prop) so this is independent of the beyond-cap
// baseline fix. Mutation-check = reverting the .catch repair (the rollback throws again).
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup saveEdit rollback (.catch repair)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed fixtures");

  test.beforeAll(async () => { await seedHistory.seed({ bulk: 90 }); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("a failed in-cap edit rolls sets_data back to the original", async ({ page }) => {
    // Force ONLY the logged_sets INSERT to fail: the first POST 500s; the session PATCH, the
    // logged_sets DELETE, and the rollback's re-insert (a later POST) all succeed.
    let firstInsertFailed = false;
    await page.route(/\/rest\/v1\/logged_sets(\?|$)/, (route) => {
      if (route.request().method() === "POST" && !firstInsertFailed) {
        firstInsertFailed = true;
        return route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"forced insert failure"}' });
      }
      return route.continue();
    });

    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    // Default 3M view shows the recent in-cap row.
    await expect(page.getByText("AutoTest-InCap-Rollback")).toBeVisible({ timeout: 10000 });

    // Edit the Bench Press weight 100 -> 200; the save's logged_sets insert fails -> rollback.
    await page.getByText("AutoTest-InCap-Rollback").click();
    await page.getByRole("button", { name: /Edit/ }).first().click();
    await expect(page.getByText("✎ Edit Workout")).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder("lbs").fill("200");
    await page.getByRole("button", { name: /Save Changes/ }).click();
    await expect(page.getByText(/Save failed/)).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Cancel" }).click();

    // Reload to read the persisted DB state, re-open the edit modal: sets_data must be rolled
    // back to 100. Pre-repair the rollback throws (.catch is not a function) and 200 persists.
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByText("AutoTest-InCap-Rollback").click();
    await page.getByRole("button", { name: /Edit/ }).first().click();
    await expect(page.getByText("✎ Edit Workout")).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder("lbs")).toHaveValue("100");
  });
});
