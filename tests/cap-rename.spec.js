// @ts-check
// Guards for renameExerciseEverywhere across FULL history (not just the loaded .limit(100) prop).
// Seeds three sessions holding "OldLift": one we edit, one recent in-cap (so the "apply to all?"
// prompt fires), one ~178d beyond-cap (verified outside the prop). Renaming via the modal's
// "apply to all" must rename the beyond-cap one too. Mutation-check: revert renameExerciseEverywhere
// to iterate the capped prop → the beyond-cap assertion fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

async function renameInModal(page, target, newName) {
  await page.getByText(target).click(); // expand the card
  await page.getByRole("button", { name: /Edit/ }).first().click();
  await expect(page.getByText("✎ Edit Workout")).toBeVisible({ timeout: 5000 });
  await page.getByTitle("Rename exercise").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(newName);
  await page.getByTitle("Confirm rename").click();
  await page.getByRole("button", { name: /Save Changes/ }).click();
  await expect(page.getByText(/apply rename to other sessions/i)).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: /Apply to all/i }).click();
  // The handler awaits renameExerciseEverywhere THEN closes the modal — so the modal disappearing
  // is the signal the rename's DB writes finished. Wait for it before reloading (else we cancel
  // the in-flight writes by navigating away).
  await expect(page.getByText("✎ Edit Workout")).toHaveCount(0, { timeout: 15000 });
}

test.describe("cap-cleanup rename across full history", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed rename fixtures");

  // Re-seed before EACH test: the rename test mutates the fixture (OldLift→NewLift), so a shared
  // beforeAll would leave the second test with nothing to rename.
  test.beforeEach(async () => { await seedHistory.seedRename(); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("renaming an exercise applies across full history, including a beyond-cap session", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await renameInModal(page, "AutoTest-RenameEdit", "NewLift");

    // The beyond-cap session (outside the loaded prop) must now show the new name in History 6M.
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByRole("button", { name: "6M" }).click();
    await page.getByText("AutoTest-RenameBeyond").click(); // expand
    await expect(page.getByText("NewLift")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("OldLift")).toHaveCount(0); // renamed everywhere visible
  });

  test("a forced rename write failure is graceful (no false error banner)", async ({ page }) => {
    // Let saveEdit's own logged_sets insert (the 1st POST) succeed; fail the rename's first insert
    // (2nd POST) so renameExerciseEverywhere returns false mid-way.
    let inserts = 0;
    await page.route(/\/rest\/v1\/logged_sets(\?|$)/, (route) => {
      if (route.request().method() === "POST") {
        inserts++;
        if (inserts >= 2) return route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"forced"}' });
      }
      return route.continue();
    });

    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await renameInModal(page, "AutoTest-RenameEdit", "NewLift");

    // Graceful: the app keeps working (History header visible), no false error banner.
    await expect(page.getByText(/Workout History/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Save failed|couldn.?t load|something went wrong/i)).toHaveCount(0);
  });
});
