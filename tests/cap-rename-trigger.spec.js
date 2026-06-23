// @ts-check
// Edge B: the "apply rename to other sessions?" prompt must fire even when the only OTHER
// occurrence of the exercise is BEYOND the loaded .limit(100) prop. Old detection used
// allSessions.some(...) over the capped prop, so a beyond-cap-only occurrence never prompted and
// the uncapped rename never ran. Seed (inCap:false) has OldLift only in the edited (in-cap)
// session and a ~178d beyond-cap session — no in-cap "other" occurrence.
// Mutation-check: revert detection to the prop-only check → the prompt never fires.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup rename trigger (Edge B)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed rename fixtures");

  test.beforeEach(async () => { await seedHistory.seedRename({ inCap: false }); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("a beyond-cap-only occurrence still fires the apply-to-all prompt and renames it", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();

    // Rename OldLift→NewLift in the edited (in-cap) session. The only OTHER occurrence is beyond-cap.
    await page.getByText("AutoTest-RenameEdit").click();
    await page.getByRole("button", { name: /Edit/ }).first().click();
    await expect(page.getByText("✎ Edit Workout")).toBeVisible({ timeout: 5000 });
    await page.getByTitle("Rename exercise").first().click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("NewLift");
    await page.getByTitle("Confirm rename").click();
    await page.getByRole("button", { name: /Save Changes/ }).click();

    // The prompt MUST fire even though no other occurrence is in the loaded prop (the fix's point).
    await expect(page.getByText(/apply rename to other sessions/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /Apply to all/i }).click();
    await expect(page.getByText("✎ Edit Workout")).toHaveCount(0, { timeout: 15000 });

    // The beyond-cap session got renamed.
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByRole("button", { name: "6M" }).click();
    await page.getByText("AutoTest-RenameBeyond").click();
    await expect(page.getByText("NewLift")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("OldLift")).toHaveCount(0);
  });
});
