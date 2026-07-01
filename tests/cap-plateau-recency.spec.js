// @ts-check
// Plateau recency gate: a lift not trained within 21 days is DORMANT, and "stalled" is
// true-but-meaningless for it (abandoned, not stalling). detectPlateaus now suppresses it. Both
// consumers inherit the gate (same engine): the Overview digest plateau line and the Progress-tab
// Plateaus list. seedDormantPlateau logs "AutoTest-Dormant" flat 25×10, last trained 25d ago (>21d,
// but inside the 42d window with pre-window history) — so WITHOUT the gate it would flag "stalled".
// Mutation-check: remove the gate → it flags again → the plateau line appears → this fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup plateau recency gate — dormant lift not flagged", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedDormantPlateau(); });
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.resetCoaching(); });

  test("an abandoned lift (25d idle, no PR) is NOT flagged as a plateau on the Progress tab", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await page.getByRole("button", { name: "Progress" }).click();

    // Progress loaded: the dormant lift renders as a LIFT CARD (present regardless of plateau gating).
    // This makes the absence check below non-vacuous — the plateau card renders in the same pass.
    // Target the card's name span (the drill-picker <option> also holds the name but is hidden).
    await expect(page.locator("span").filter({ hasText: /^AutoTest-Dormant$/ }).first()).toBeVisible({ timeout: 15000 });

    // Expand the Plateaus card if one rendered (other lifts may plateau — we only care about this one).
    const ph = page.getByText(/Plateaus \(/i);
    if (await ph.count()) await ph.first().click();

    // GATED: no "AutoTest-Dormant — stalled …" plateau line (last trained 25d ago > 21d).
    await expect(page.getByText(/AutoTest-Dormant.*stalled/i)).toHaveCount(0);
  });
});
