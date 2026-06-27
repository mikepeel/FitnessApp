// @ts-check
// Active plan resolves from user_metadata (the store every write targets), not the stale
// profiles.active_plan_key. Fixture: two plans X/Y + profiles pointed at a VALID-BUT-STALE key (X) —
// the multi-plan re-arm case that the old profiles-preferred read got wrong. The test switches to Y
// in-app (which writes metadata and refreshes the session token), then reloads: the fix must resolve
// Y from metadata even though profiles still says X.
// Mutation-check: revert the read to profiles-preferred -> reload resolves X -> the AutoYDay assertion fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup active-plan resolves from metadata, not stale profiles", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedPlanResolution(); });
  test.afterAll(async () => { await seedHistory.restorePlanResolution(); }); // back to iron-test baseline

  test("after switching plans, a reload resolves the metadata plan (profiles holds a valid-but-stale key)", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();

    // Switch to Plan Y in-app → persistActivePlanKey writes user_metadata + refreshes the token.
    await page.getByRole("button", { name: "AutoTest Plan Y" }).click();
    await expect.poll(async () => (await seedHistory.getUserMeta())?.active_plan_key, { timeout: 8000 }).toBe("AutoTest-PlanY");

    // Reload. profiles still points to PlanX (valid, stale). The fix resolves PlanY from metadata.
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await expect(page.getByText(/AutoYDay/).first()).toBeVisible({ timeout: 10000 }); // PlanY is active (its day shows)
    await expect(page.getByText(/AutoXDay/)).toHaveCount(0);                           // not the stale PlanX
  });
});
