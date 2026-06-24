// @ts-check
// Progress drill-down — the old "Session History" table showed only DATE · MAX · EST 1RM, hiding
// reps and set count (a fixed-weight rep progression read 175→175→175). Replaced with a compressed
// work log: one row per session, sets grouped → "N×reps @ weight", split in performed order when
// reps/weight differ within a session. The drill-down now defaults to the Table (not Chart).
//
// Seed: two AutoTest-Drill sessions — OLDER uniform 4×7 @175, NEWER mixed 8,8,6 @185.
// Mutation-check: revert the table body to the per-day liftSeriesFromSets render → the compressed
// "2×8 @ 185, 1×6 @ 185" / "4×7 @ 175" rows disappear and these assertions fail.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup drill-down compressed work log", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed");

  test.beforeEach(async () => { await seedHistory.seedDrill(); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("drill-down defaults to Table and shows compressed set/rep/weight rows (mixed splits, not collapsed)", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await page.getByRole("button", { name: "Progress" }).click();

    // Pick the lift; do NOT touch the Chart/Table toggle — the drill-down must default to Table.
    await page.locator("select").first().selectOption("AutoTest-Drill");
    await expect(page.getByText(/Session History/)).toBeVisible({ timeout: 10000 });
    // Default is the work log, not the chart: the "— Max Weight" chart heading is absent.
    await expect(page.getByText(/Max Weight/)).toHaveCount(0);

    // Newest session is MIXED → split in performed order (non-happy path: NOT collapsed to 3×).
    await expect(page.getByText("2×8 @ 185, 1×6 @ 185")).toBeVisible({ timeout: 10000 });
    // Older session is uniform → one compressed group.
    await expect(page.getByText("4×7 @ 175")).toBeVisible();

    // The mixed session must never collapse into a single group, and reps must not be hidden.
    await expect(page.getByText("3×8 @ 185")).toHaveCount(0);
    await expect(page.getByText("3×6 @ 185")).toHaveCount(0);
  });
});
