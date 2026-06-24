// @ts-check
// COMMIT 5 — gate D: the Plan-tab "Analyze plan" button (and the analysisOpen PlanAnalysisView)
// render only when showPlanAnalysis && showCoaching. analyzePlan still computes when the view is
// opened; gating just hides the entry point. The rest of the Plan tab (the plan editor) is NOT
// gated — asserted via the "WEEK n OF n" pill, so only the analysis entry is hidden.
// Driven from the DB (setCoaching) + reload. Mutation-check: remove the gate → the button shows
// when off → the toHaveCount(0) fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

async function gotoPlan(page) {
  await ensureCleanHome(page); // re-navigates → loads current coaching settings fresh
  await page.getByRole("button", { name: /^Plan$/i }).click();
  await expect(page.getByText(/WEEK \d+ OF \d+/)).toBeVisible({ timeout: 10000 }); // plan editor rendered
}

test.describe("cap-cleanup gate D — plan analysis (showPlanAnalysis)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.resetCoaching(); });
  test.afterAll(async () => { await seedHistory.resetCoaching(); });

  test("Analyze-plan button hides when off, returns when on, master overrides; plan editor stays", async ({ page }) => {
    // ON → present
    await gotoPlan(page);
    await expect(page.getByRole("button", { name: /Analyze plan/i })).toBeVisible({ timeout: 10000 });

    // showPlanAnalysis OFF → button gone, but the plan editor remains (only the analysis entry is gated)
    await seedHistory.setCoaching({ show_plan_analysis: false });
    await gotoPlan(page);
    await expect(page.getByRole("button", { name: /Analyze plan/i })).toHaveCount(0);
    await expect(page.getByText(/WEEK \d+ OF \d+/)).toBeVisible();

    // back ON → returns
    await seedHistory.setCoaching({ show_plan_analysis: true });
    await gotoPlan(page);
    await expect(page.getByRole("button", { name: /Analyze plan/i })).toBeVisible({ timeout: 10000 });

    // master OFF overrides the sub-toggle ON
    await seedHistory.setCoaching({ show_plan_analysis: true, show_coaching: false });
    await gotoPlan(page);
    await expect(page.getByRole("button", { name: /Analyze plan/i })).toHaveCount(0);
  });
});
