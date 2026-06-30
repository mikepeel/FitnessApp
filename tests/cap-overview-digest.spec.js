// @ts-check
// Stats Overview is now a JUDGMENT DIGEST: an always-on adherence line ("X of Y this week") plus
// situational judgment lines (positive-first, capped, deduped). The bare volume-% delta and the
// un-normalized strength LEVEL are removed. The ordering/dedup/cap is mutation-checked in the pure
// overviewDigest.test.js; this proves the real Overview renders the digest and the two removals stuck.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup Stats Overview judgment digest", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedRecentPR(); }); // a recent PR -> a digest line
  test.afterAll(async () => { await seedHistory.cleanupPRs(); });

  test("renders adherence + a seeded PR; volume-% and strength-level are gone", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();

    // ALWAYS-ON adherence line (plan with training days -> "X of Y this week ...").
    await expect(page.getByText(/of \d+ this week/i)).toBeVisible({ timeout: 10000 });
    // The seeded recent PR surfaces as a digest line.
    await expect(page.getByText(/New PR: AutoTest-PRLift/)).toBeVisible({ timeout: 10000 });

    // REMOVED: the bare volume-% comparison card.
    await expect(page.getByText("Last 28 days vs prior 28")).toHaveCount(0);
    // REMOVED: the un-normalized strength level (Beginner..Elite) from the Overview PR board.
    for (const lvl of ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"]) {
      await expect(page.getByText(lvl, { exact: true })).toHaveCount(0);
    }
  });
});
