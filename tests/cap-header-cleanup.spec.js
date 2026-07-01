// @ts-check
// Workout (Today) tab header decluttered: the "Custom PPL · WEEK X OF Y" plan/week pill, the current
// "{n} session streak!" chip, and the "Best: N wk" chip are removed (plan-context belongs on the Plan
// tab; consistency stats now live on Stats → Overview). The streak COMPUTATIONS are preserved — the
// Overview digest's adherence line still carries the current streak (proving the value flow survived).
//
// Robustness: the absence checks run AFTER a round-trip through Stats. Seeing the digest's
// "-session streak" proves complianceStreak/longestStreak are resolved in app state, so when we return
// to Workout any header chip would mount synchronously — a naive count-0 check on first paint could
// otherwise pass before an async-mounted chip appears (and miss a regression / the mutation).
// Mutation-check: re-add a chip to the Workout header -> its absence assertion fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup Workout header decluttered (pill + streak chips removed)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedStreakBanner(); }); // complianceStreak>0 + longestStreak>0
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.setStreakTracking(true); });

  test("Workout header drops pill + streak chips; streak still flows to the Overview digest", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await ensureCleanHome(page); // Workout tab (default)

    // Value flow survived: the Overview digest's adherence line carries the current streak. This also
    // guarantees the async streak data is fully resolved before we assert the Workout header's absences.
    await page.getByRole("button", { name: /Stats/i }).click();
    await expect(page.getByText(/-session streak/)).toBeVisible({ timeout: 15000 });

    // Back to Workout — streak data is now in app state, so any header chip renders synchronously.
    await page.getByRole("button", { name: /Workout/i }).click();
    await expect(page.getByText(/Hello,/)).toBeVisible({ timeout: 10000 }); // Row 1 (the surviving header)

    // The three removed elements are GONE from the Workout header.
    await expect(page.getByText(/WEEK \d+ OF \d+/)).toHaveCount(0); // plan/week pill
    await expect(page.getByText(/session streak/i)).toHaveCount(0); // current-streak chip ("N session streak!")
    await expect(page.getByText(/Best: \d+ wk/)).toHaveCount(0);    // Best chip
  });
});
