// @ts-check
// COMMIT 3 — gate B: <RealizedVolumeInsight/> (the "Volume vs Targets — Last 28 Days" card and the
// muscle-balance status chips inside it) renders only when showVolumeTargets && showCoaching.
// analyzeRealized still computes (it's also called independently by the Plateaus card), so the card
// reappears when toggled back on. The raw "Volume by Muscle — Last 7 Days" bars are NOT gated and
// must stay — asserted, to prove only the interpretive card is hidden, not the whole Muscles tab.
// Driven from the DB (setCoaching) + reload. Mutation-check: remove the gate → OFF still shows it → fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

async function gotoMuscles(page) {
  await ensureCleanHome(page); // re-navigates → loads current coaching settings fresh
  await page.getByRole("button", { name: /Stats/i }).click();
  await page.getByRole("button", { name: "Muscles" }).click();
}

test.describe("cap-cleanup gate B — volume vs targets (showVolumeTargets)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.resetCoaching(); });
  test.afterAll(async () => { await seedHistory.resetCoaching(); });

  test("Volume vs Targets card hides when off, reappears when on, master overrides; raw bars stay", async ({ page }) => {
    // ON → visible
    await gotoMuscles(page);
    await expect(page.getByText(/Volume vs Targets/)).toBeVisible({ timeout: 10000 });

    // showVolumeTargets OFF → card hidden, but the raw "Volume by Muscle" bars REMAIN (only the card is gated)
    await seedHistory.setCoaching({ show_volume_targets: false });
    await gotoMuscles(page);
    await expect(page.getByText(/Volume vs Targets/)).toHaveCount(0);
    await expect(page.getByText(/Volume by Muscle/)).toBeVisible({ timeout: 10000 });

    // back ON → REAPPEARS (analyzeRealized still ran)
    await seedHistory.setCoaching({ show_volume_targets: true });
    await gotoMuscles(page);
    await expect(page.getByText(/Volume vs Targets/)).toBeVisible({ timeout: 10000 });

    // master OFF overrides the sub-toggle ON
    await seedHistory.setCoaching({ show_volume_targets: true, show_coaching: false });
    await gotoMuscles(page);
    await expect(page.getByText(/Volume vs Targets/)).toHaveCount(0);
    await expect(page.getByText(/Volume by Muscle/)).toBeVisible({ timeout: 10000 }); // raw bars still there
  });
});
