// @ts-check
// History → tap an exercise → land on Stats → Progress → that lift's drill-down TABLE view (the
// compressed "{lift} — Session History" table). Cross-tab deep-link via a one-shot pendingDrill:
// History sets it + switches tab; StatsTab consumes it on mount (setStatsView progress + setSelEx),
// then clears it so a normal Stats entry starts at overview (not re-hijacked).
// Load-bearing: the landed drill is the EXACT tapped lift name (same-field exercise_name match).
// Mutation-check: break the consume (don't setSelEx) → lands on Progress/overview, not the lift → fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup History → drill-down deep-link", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedDrillLink(); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("tapping a History exercise lands on that exact lift's Progress drill-down Table; once-only", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByRole("button", { name: "1M" }).click(); // loaded-prop view (synchronous, holds the seeded session)

    // Expand the seeded session.
    await page.getByText("AutoTest-DrillLink").first().click();
    const exRow = page.getByText("AutoTest-DrillLift", { exact: true });
    await expect(exRow).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Progress").first()).toBeVisible(); // the tappable affordance

    // Tap the exercise → deep-link.
    await exRow.click();

    // Landed on Stats → Progress → the EXACT lift's drill-down TABLE (correct-lift + name-exact + table).
    await expect(page.getByText("AutoTest-DrillLift — Session History")).toBeVisible({ timeout: 10000 });

    // Once-only: leave Stats and return → back at Overview, NOT re-hijacked to the drill.
    await page.getByRole("button", { name: /Workout/i }).click();
    await page.getByRole("button", { name: /Stats/i }).click();
    await expect(page.getByText(/this week/i).first()).toBeVisible({ timeout: 10000 }); // Overview digest is showing
    await expect(page.getByText("AutoTest-DrillLift — Session History")).toHaveCount(0); // not re-opened
  });
});
