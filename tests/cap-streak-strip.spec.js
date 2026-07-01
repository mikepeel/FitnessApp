// @ts-check
// Stats → Overview streak RECORD strip (beneath the judgment digest): the longest weekly-consistency
// run, read from FULL history via longestStreak (the uncapped fetch), NOT the capped `sessions`. The
// CURRENT streak is intentionally NOT repeated here — it lives in the digest's adherence line above.
//
// This spec carries the coverage of two specs deleted in a17fdab when the streak chips left the
// Workout header:
//   • on-screen / no-overflow at 375px AND 320px (was cap-streak-overflow, lesson 8cc0d0f), and
//   • the full-history "best" proof (was cap-longest-streak): a longest run that exists ONLY beyond
//     the 100-session cap still counts, and a bridging partial is excluded — so exactly "12".
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup Overview streak record strip", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  // seedLongest: 12 consecutive weeks placed BEYOND the 100-session cap (recent history has only
  // short runs ~4) + a PARTIAL adjacent to the old run. So full-history non-partial best = 12 exactly
  // (capped source → ~4, counting the partial → 13). Seeded once; the gate is toggled per test.
  test.beforeAll(async () => { await seedHistory.seedLongest(); });
  test.beforeEach(async () => { await seedHistory.setStreakTracking(true); });
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.setStreakTracking(true); });

  for (const width of [375, 320]) {
    test(`shows the full-history best (12-week run) and stays on-screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await ensureCleanHome(page);
      await page.getByRole("button", { name: /Stats/i }).click();

      // Exactly "12" = full-history source: a capped fetch would read ~4, counting the partial → 13.
      const best = page.getByText(/Best: 12-week run/);
      await expect(best).toBeVisible({ timeout: 15000 });

      // ON-SCREEN: the record's right edge sits within the viewport (not bleeding off the right).
      const box = await best.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
    });
  }

  test("hidden when streakTracking is off — non-vacuous (streak data is resolved before asserting absence)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });

    // First prove the strip CAN render (streak data resolves + the strip mounts) with the gate on.
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await expect(page.getByText(/Best: 12-week run/)).toBeVisible({ timeout: 15000 });

    // Turn the gate OFF and reload. Round-trip Stats→Workout→Stats so longestStreak is resolved in app
    // state before the absence check — otherwise a naive first-paint count-0 would pass before an
    // (ungated) strip could async-mount, making the assertion vacuously green.
    await seedHistory.setStreakTracking(false);
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await expect(page.getByText(/of \d+ this week/i)).toBeVisible({ timeout: 15000 }); // Overview loaded
    await page.getByRole("button", { name: /Workout/i }).click();
    await page.getByRole("button", { name: /Stats/i }).click();                        // 2nd render — data now in state
    await expect(page.getByText(/of \d+ this week/i)).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/Best: \d+-week run/)).toHaveCount(0); // gated off
  });
});
