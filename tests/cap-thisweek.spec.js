// @ts-check
// Stats "This Week" card — the count + volume used a hardcoded Sunday-start calendar week while
// the plan is start_date-anchored (Tuesday for the test plan), so a session from the ADJACENT
// plan week (inside the Sunday window but before the plan-week start) leaked into the count.
// Fix re-points both cells to the canonical plan-week window (planWeekSessions).
//
// Seed: one session IN the current plan week + one the day BEFORE the plan-week start (prior plan
// week, but inside the Sunday calendar window on Tue–Sat). After the fix the card shows 1 session
// / 1k lbs; the Sunday-start bug would show 2 / 6k.
// Mutation-check is on the pure planWeek window logic (planWeek.test.js); this is the integration.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup This Week card (plan-week window)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed");

  test.beforeEach(async () => { await seedHistory.seedThisWeek(); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("This Week counts the current PLAN week, not a Sunday-start calendar week", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    // Overview is the default sub-tab; the card lives here.
    await expect(page.getByText("This Week")).toBeVisible({ timeout: 10000 });

    const card = page.locator("div").filter({ has: page.getByText("This Week", { exact: true }) }).filter({ hasText: "sessions" }).last();
    // Only the in-week session counts; the prior-plan-week session (inside the Sunday window) is excluded.
    await expect(card.getByText("1", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(card.getByText("1k", { exact: true })).toBeVisible();
    // The Sunday-start bug would surface the adjacent-week session → 2 sessions / 6k lbs.
    await expect(card.getByText("2", { exact: true })).toHaveCount(0);
    await expect(card.getByText("6k", { exact: true })).toHaveCount(0);
  });
});
