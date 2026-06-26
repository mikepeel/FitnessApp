// @ts-check
// Longest weekly CONSISTENCY streak (plan-agnostic) shown beside the current streak. Reads FULL
// uncapped history — a run older than the most-recent-100 sessions must still count.
//
// Seed (seedLongest): the longest run = 12 consecutive weeks placed BEYOND the 100-session cap;
// recent history has only short runs (~4); plus a PARTIAL adjacent to the old run that would bridge
// it to 13 if partials weren't excluded. So exactly "12" proves BOTH the full-history source
// (capped → ~4) AND partial-exclusion (→ 13). Mutation-check: cap the fetch → it reads ~4 → fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup longest weekly consistency streak", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedLongest(); await seedHistory.setStreakTracking(true); });
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.setStreakTracking(true); });

  test("renders the full-history longest beside current; hidden when streakTracking off", async ({ page }) => {
    await ensureCleanHome(page);
    // Exactly 12 = the old run from FULL history. Capped source would show ~4; counting the partial
    // would show 13. So 12 is the load-bearing anti-cap + partial-exclusion assertion.
    await expect(page.getByText(/Best: 12 wk/)).toBeVisible({ timeout: 15000 });

    // Hidden when streakTracking is off (same gate as current streak).
    await seedHistory.setStreakTracking(false);
    await ensureCleanHome(page);
    await expect(page.getByText(/Best: \d+ wk/)).toHaveCount(0);
  });
});
