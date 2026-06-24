// @ts-check
// Muscles tab — "Volume by Muscle — Last 7 Days" bars. The tonnage bar used a hardcoded muscleMap
// while the set count used the richer muscleContributions resolver, so a lift absent from the map
// dumped its tonnage into the hidden "Other" bucket → that muscle's bar read "0k lbs" / no fill,
// and "Other" (also the scaling max) understated every other bar. Fix routes tonnage through the
// same resolver (primaryMoverGroup) and scales to displayed groups only.
//
// Seed: a today session whose only lift is "Dumbbell Lateral Raise" (absent from muscleMap →
// resolves to Shoulders); iron-test's 7-day window has no other Shoulders lift, isolating it.
// Mutation-check: revert muscleVolMapped to the hardcoded map → Shoulders tonnage orphans to
// "Other" and this assertion fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup muscles tonnage resolver", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed");

  test.beforeEach(async () => { await seedHistory.seedMuscles(); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("a lift absent from the legacy tonnage map still fills its muscle bar", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await page.getByRole("button", { name: "Muscles" }).click();
    await expect(page.getByText(/Volume by Muscle/i)).toBeVisible({ timeout: 10000 });

    // Dumbbell Lateral Raise → Shoulders. The Shoulders row shows NON-ZERO tonnage (so its bar
    // fills). Before the fix the tonnage orphaned to "Other" → "Shoulders … · 0k lbs" / no bar.
    await expect(page.getByText(/Shoulders[\d.]+ sets? · [1-9][\d.]*k lbs/)).toBeVisible({ timeout: 10000 });

    // The "{sets} sets" figures credit secondary movers at 0.5; that basis is disclosed here.
    await expect(page.getByText(/credit secondary-mover muscles at 0\.5/i)).toBeVisible({ timeout: 10000 });
  });
});
