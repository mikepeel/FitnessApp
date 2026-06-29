// @ts-check
// The "Best: N wk" longest-streak chip (TodayTab streak banner) bled off the right edge on phone
// widths: Row 2 was a nowrap, no-shrink flex row, so plan badge + session-streak chip + Best chip
// exceeded the container and the last chip overflowed off-screen. Fix: flexWrap on Row 2 so the Best
// chip drops to a second line; marginLeft:auto so it right-aligns when wrapped.
//
// Load-bearing assertion: the Best chip is ON-SCREEN (its right edge <= the viewport width) at phone
// widths — not merely present in the DOM. Seed forces all three chips (the overflow case).
// Mutation-check: remove flexWrap -> the chip overflows -> the on-screen assertion fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup longest-streak chip stays on-screen", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedStreakBanner(); }); // all three chips render
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.setStreakTracking(true); });

  for (const width of [375, 320]) {
    test(`Best chip is fully on-screen at ${width}px (no right-edge overflow)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await ensureCleanHome(page);
      // The overflow scenario: plan badge + session-streak chip + Best chip all present.
      await expect(page.getByText(/session streak!/)).toBeVisible({ timeout: 15000 });
      const best = page.getByText(/Best: \d+ wk/);
      await expect(best).toBeVisible();
      const box = await best.boundingBox();
      expect(box).not.toBeNull();
      // ON-SCREEN: the chip's right edge sits within the viewport (it doesn't bleed off the right).
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      expect(box.x).toBeGreaterThanOrEqual(-0.5); // and not off the left either
    });
  }

  test("wide viewport: all three chips stay on ONE line (wrap engages only when needed)", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await ensureCleanHome(page);
    const streak = await page.getByText(/session streak!/).boundingBox();
    const best = await page.getByText(/Best: \d+ wk/).boundingBox();
    expect(Math.abs(best.y - streak.y)).toBeLessThan(6);          // same row — not wrapped
    expect(best.x + best.width).toBeLessThanOrEqual(900 + 0.5);   // both on-screen (pairing preserved)
  });
});
