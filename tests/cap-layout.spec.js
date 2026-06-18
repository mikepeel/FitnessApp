// @ts-check
// Regression guards for the cap-cleanup LAYOUT REFLOWS (steps 4b + 6/7): capped/misleading
// cells were removed, so these assert the removed content is absent and the surviving layout
// is intact. Guarding removals, so the mutation-check re-ADDs the element: reverting 4b /
// 6-7 makes each test fail (verified locally — see report). No seeding (renders from the
// loaded account data).
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");

test.describe("cap-cleanup layout reflows", () => {
  test("Progress ALL-Mode cards drop the capped first→cur delta and session-count footer", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await page.getByRole("button", { name: "Progress" }).click();

    // ALL-Mode (no exercise selected) renders one card per lift.
    await expect(page.getByText(/Progress .* All Lifts/)).toBeVisible({ timeout: 10000 });
    // A lift card rendered (the PR marker is card-only — the exercise <select> options also
    // contain the lift names, so don't assert on a bare name).
    await expect(page.getByText(/PR \d+/).first()).toBeVisible();

    // The removed footer ("{N} sessions · {first} → {cur} lbs") and delta marker ("▲ +N" /
    // "▼ -N") must not appear on these cards.
    await expect(page.getByText(/→ \d+ lbs/)).not.toBeVisible();
    await expect(page.getByText(/[▲▼]\s*[+-]?\d+/)).not.toBeVisible();
  });

  test("Stats This Week card reflows to two cells (no broken/3-column grid)", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    // Overview is the default sub-tab; the This Week card lives there.

    const weekGrid = page
      .locator('div[style*="grid-template-columns"]')
      .filter({ hasText: "sessions" })
      .filter({ hasText: "lbs" })
      .first();
    await expect(weekGrid).toBeVisible({ timeout: 10000 });

    // Two surviving cells, no third "total" cell — assert the grid has exactly two columns.
    const cols = await weekGrid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
    expect(cols).toBe(2);
    await expect(weekGrid.getByText("total", { exact: true })).not.toBeVisible();
  });
});
