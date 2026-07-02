// @ts-check
// Recency-aware RANKING (demote dormant, don't hide). Two ranked surfaces:
//  • Progress "All Lifts": was alphabetical → "AutoTest-Dormant" (D) sorted above "AutoTest-Recent" (R)
//    despite being 27d idle. Now recent-first → Recent's card ranks above Dormant's; both still listed.
//  • Overview "Personal Records" board: was max_weight DESC → the dormant 300 headlined over recent
//    work. Now active-tier-first → a recent 175 PR ranks above the dormant 300, which is demoted to the
//    bottom of the top-5 but still shown.
// seedRecencyRank arms both (AutoTest-Recent: recent session, no PR; AutoTest-Dormant: 27d-idle + 300 PR).
// Mutation-check: remove the recency ordering in lib/recencyRank → dormant leads again → these fail.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup recency-aware ranking — dormant demoted, not hidden", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedRecencyRank(); });
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.cleanupPRs(); });

  test("Progress All-Lifts: recent lift's card ranks ABOVE the dormant lift's card (both present)", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await page.getByRole("button", { name: "Progress" }).click();

    // Target the card name spans (the drill-down <option>s hold the names too but are hidden).
    const recent = page.locator("span").filter({ hasText: /^AutoTest-Recent$/ }).first();
    const dormant = page.locator("span").filter({ hasText: /^AutoTest-Dormant$/ }).first();
    await expect(recent).toBeVisible({ timeout: 15000 });
    await expect(dormant).toBeVisible(); // demote, not hide — the dormant lift is STILL listed

    const ry = (await recent.boundingBox()).y, dy = (await dormant.boundingBox()).y;
    expect(ry).toBeLessThan(dy); // recent above dormant (was alphabetical → Dormant first)
  });

  test("Overview PR board: a recent (active) PR ranks ABOVE the dormant heavy PR, which stays present", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click(); // Overview is the default sub-tab

    // The dormant 300 PR is still on the board (demote, not hide) — but no longer at the top.
    await expect(page.getByText("300 lbs")).toBeVisible({ timeout: 15000 });
    const active = page.getByText("175 lbs").first(); // a recent (active) baseline PR, lighter than the dormant 300
    await expect(active).toBeVisible();

    const ay = (await active.boundingBox()).y, dy = (await page.getByText("300 lbs").boundingBox()).y;
    expect(ay).toBeLessThan(dy); // recent-lighter above dormant-heavier (was weight DESC → 300 headlined)
  });
});
