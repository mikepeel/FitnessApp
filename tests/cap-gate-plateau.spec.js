// @ts-check
// COMMIT 2 — gate A: the Plateaus card AND the drill-down Projection card render only when
// showPlateaus && showCoaching. detectPlateaus / analyzeRealized / projectExercise still compute.
//
// The Projection card is the deterministically-seedable surface (seedDrill → a lift with 2+
// sessions → the drill-down Chart view always renders "Projection"); a real plateau isn't reliably
// seedable, but the Plateaus card carries the identical gate expression. Visibility is driven from
// the DB (setCoaching) + a reload, since the Settings round-trip itself is proven in COMMIT 1.
// Mutation-check: remove the gate → the OFF case still shows "Projection" → the toHaveCount(0) fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

async function gotoProjection(page) {
  await ensureCleanHome(page); // re-navigates → loads the current coaching settings fresh
  await page.getByRole("button", { name: /Stats/i }).click();
  await page.getByRole("button", { name: "Progress" }).click();
  await page.locator("select").first().selectOption("AutoTest-Drill");
  await page.getByRole("button", { name: /Chart/i }).click(); // drill defaults to Table → switch to Chart for the Projection card
}

test.describe("cap-cleanup gate A — plateau/projection (showPlateaus)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedDrill(); await seedHistory.resetCoaching(); });
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.resetCoaching(); });

  test("Projection hides when showPlateaus off, reappears when on, master overrides", async ({ page }) => {
    // ON → visible
    await gotoProjection(page);
    await expect(page.getByText("Projection", { exact: true })).toBeVisible({ timeout: 10000 });

    // showPlateaus OFF → hidden
    await seedHistory.setCoaching({ show_plateaus: false });
    await gotoProjection(page);
    await expect(page.getByText("Projection", { exact: true })).toHaveCount(0);

    // back ON → REAPPEARS (projectExercise still ran → the gate hides, doesn't stop the engine)
    await seedHistory.setCoaching({ show_plateaus: true });
    await gotoProjection(page);
    await expect(page.getByText("Projection", { exact: true })).toBeVisible({ timeout: 10000 });

    // master OFF overrides the sub-toggle ON
    await seedHistory.setCoaching({ show_plateaus: true, show_coaching: false });
    await gotoProjection(page);
    await expect(page.getByText("Projection", { exact: true })).toHaveCount(0);
  });
});
