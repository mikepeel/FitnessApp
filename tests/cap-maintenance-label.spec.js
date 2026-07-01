// @ts-check
// Muscles tab → "Volume vs Targets": a HIGH-EVIDENCE muscle that is HOLDING (above the maintenance
// floor, below the productive low — e.g. chest ~8/wk vs [10,20], floor 6) must read as
// "maintenance / holding", NOT the harsh "under" it used to (rollupGroups folded maintenance into
// under at the group headline). seedMaintenanceVolume drives chest to ~8/wk (maintenance); no other
// group lands there, so the holding copy uniquely identifies chest.
// Mutation-check: collapse maintenance back into "under" in rollupGroups → the holding copy is gone
// (chest shows "under") → the assertion fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

async function gotoMuscles(page) {
  await ensureCleanHome(page);
  await page.getByRole("button", { name: /Stats/i }).click();
  await page.getByRole("button", { name: "Muscles" }).click();
}

test.describe("cap-cleanup maintenance is labeled holding, not under", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedMaintenanceVolume(); }); // chest ~8/wk + coaching on
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.resetCoaching(); });

  test("a holding (maintenance) muscle reads as maintenance/holding, not 'under'", async ({ page }) => {
    await gotoMuscles(page);

    // The interpretive card loaded (sufficient history) and chest is present as a flagged group.
    await expect(page.getByText(/Volume vs Targets/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Chest", { exact: true }).first()).toBeVisible({ timeout: 10000 });

    // The HOLDING copy — produced only by a maintenance group (chest is the only one here). This is the
    // fix: before it, chest collapsed to "under" and this line was the harsh "Below the productive range".
    await expect(page.getByText(/at maintenance volume/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/not building/i)).toBeVisible();
  });
});
