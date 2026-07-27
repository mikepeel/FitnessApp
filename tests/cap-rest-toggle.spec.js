// @ts-check
// Rest-day toggle + the rest/training invariant. Reuses the copy-day fixture (7-day plan, 5 non-rest
// days → weeklyAdherence target 5). "Filled" is a training day with one exercise; "RestDay" is isRest:true.
//
// Verifies: marking a training-day-with-exercises as rest CONFIRMS first, then clears its exercises and
// the weekly target drops (5 → 4, reflected on Stats); Cancel keeps the exercises (never a silent
// delete); a rest day offers no "+ Exercise" (can't gain exercises); toggling a rest day back to training
// restores an (empty) training day.
//
// Mutation-check: make setDayRest a no-op → the mark-as-rest doesn't persist → target stays 5 → the
// "of 4 this week" assertion fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

test.describe("cap-rest rest-day toggle + invariant", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seed.seedCopyDay(); });
  test.afterAll(async () => { await seed.restoreCopyDay(); });

  async function openPlan(page) {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "AutoTest Copy Plan" }).click();
      if (await page.getByText(/RestDay/).first().isVisible({ timeout: 4000 }).catch(() => false)) return;
    }
    await expect(page.getByText(/RestDay/).first()).toBeVisible({ timeout: 5000 });
  }

  // "isRest|exerciseCount" for the Filled day, read straight from days_json
  const filledState = async () => {
    const days = await seed.getCopyPlanDays();
    const f = (days || []).find((d) => d.id === "cd_filled");
    return f ? `${!!f.isRest}|${(f.exercises || []).length}` : null;
  };

  test("mark a training day (with exercises) as rest → confirm, clear, target drops 5→4", async ({ page }) => {
    await openPlan(page);
    await page.getByText(/Filled/).first().click();                          // expand the training day (1 exercise)
    await page.getByRole("switch", { name: "Rest day" }).click();
    await expect(page.getByText(/marking it a rest day will remove/i)).toBeVisible(); // confirm gate fires
    await page.getByRole("button", { name: /Make Rest Day/i }).click();
    await expect.poll(filledState, { timeout: 10000 }).toBe("true|0");        // isRest:true, exercises cleared (persisted)

    // Target dropped: Stats Overview now reads "of 4 this week" (was 5) — weeklyAdherence counts it as rest.
    await page.getByRole("button", { name: /^Stats$/i }).click();
    await expect(page.getByText(/of 4 this week/)).toBeVisible({ timeout: 8000 });
  });

  test("invariant: Cancel keeps exercises; a rest day has no + Exercise; toggling back restores training", async ({ page }) => {
    await openPlan(page);

    // Cancel must NOT clear exercises (no silent delete).
    await page.getByText(/Filled/).first().click();
    await page.getByRole("switch", { name: "Rest day" }).click();
    await expect(page.getByText(/marking it a rest day will remove/i)).toBeVisible();
    await page.getByRole("button", { name: /^Cancel$/ }).click();
    await expect.poll(filledState, { timeout: 8000 }).toBe("false|1");        // unchanged

    // A rest day cannot gain exercises — the add control is not offered.
    await page.getByText(/RestDay/).first().click();                         // expand the rest day (isRest:true)
    await expect(page.getByText(/Rest day — no exercises/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ Exercise/ })).toHaveCount(0);

    // Toggle it back to training → the add control returns.
    await page.getByRole("switch", { name: "Rest day" }).click();
    await expect(page.getByRole("button", { name: /\+ Exercise/ })).toBeVisible({ timeout: 8000 });
  });
});
