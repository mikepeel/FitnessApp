// @ts-check
// COMMIT 4 — gate C: the Stats "✦ Coach" sub-tab is dropped from the nav (and its content guarded)
// when showCoach && showCoaching is off. loadTrainerInsight only runs on tap regardless, so there's
// no passive engine to stop — the re-show simply proves the tab returns. Other sub-tabs stay, so
// only Coach is gated, not the Stats nav. Driven from the DB (setCoaching) + reload.
// Mutation-check: remove the array filter → the Coach tab shows when off → the toHaveCount(0) fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

async function gotoStats(page) {
  await ensureCleanHome(page); // re-navigates → loads current coaching settings fresh
  await page.getByRole("button", { name: /Stats/i }).click();
  await expect(page.getByRole("button", { name: "Muscles" })).toBeVisible({ timeout: 10000 }); // nav rendered
}

test.describe("cap-cleanup gate C — Coach tab (showCoach)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.resetCoaching(); });
  test.afterAll(async () => { await seedHistory.resetCoaching(); });

  test("Coach sub-tab drops when off, returns when on, master overrides; other tabs stay", async ({ page }) => {
    // ON → present
    await gotoStats(page);
    await expect(page.getByRole("button", { name: /✦ Coach/ })).toBeVisible({ timeout: 10000 });

    // showCoach OFF → Coach tab gone, but the other sub-tabs remain (only Coach is gated)
    await seedHistory.setCoaching({ show_coach: false });
    await gotoStats(page);
    await expect(page.getByRole("button", { name: /✦ Coach/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Muscles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();

    // back ON → returns
    await seedHistory.setCoaching({ show_coach: true });
    await gotoStats(page);
    await expect(page.getByRole("button", { name: /✦ Coach/ })).toBeVisible({ timeout: 10000 });

    // master OFF overrides the sub-toggle ON
    await seedHistory.setCoaching({ show_coach: true, show_coaching: false });
    await gotoStats(page);
    await expect(page.getByRole("button", { name: /✦ Coach/ })).toHaveCount(0);
  });
});
