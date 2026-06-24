// @ts-check
// Muscles tab — the old "Strength Score by Muscle" card showed a Beginner..Elite LEVEL from
// getStrengthScore (absolute-lbs benchmarks, no bodyweight/sex normalization — never
// decision-grade) over an arbitrary insertion-order first-8 of per-LIFT PRs. Made honest:
// retitled "Personal Records", no level, the 8 most-recently-achieved PRs shown with their date.
// Recency ordering is covered by the pure recentPRs test; this asserts the visible honesty changes.
// Mutation-check: reverting the card (level + old title) makes the title/level assertions fail.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup muscles PR card (honest, no strength level)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed");

  test.beforeEach(async () => { await seedHistory.seedRecentPR(); });
  test.afterAll(async () => { await seedHistory.cleanupPRs(); });

  test("PR card is retitled, shows per-lift PRs with dates, and no strength level", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await page.getByRole("button", { name: "Muscles" }).click();

    // Accurate title; the old mislabel is gone.
    await expect(page.getByText("Personal Records")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Strength Score by Muscle")).toHaveCount(0);

    // The seeded (most-recent) PR shows with weight + date.
    await expect(page.getByText("AutoTest-PRLift")).toBeVisible();
    await expect(page.getByText(/137 lbs · /)).toBeVisible();

    // No Beginner..Elite level anywhere on the Muscles tab.
    for (const lvl of ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"]) {
      await expect(page.getByText(lvl, { exact: true })).toHaveCount(0);
    }
  });
});
