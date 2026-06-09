// @ts-check
// Regression tests for Issue 1 — workout save persists to Supabase
// Tests: save succeeds using getSession (not getUser), no error banner, session in History
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");

test.describe("workout save", () => {
  // Start each test from a clean home screen (abandon any draft a prior test left).
  test.beforeEach(async ({ page }) => {
    await ensureCleanHome(page);
  });

  test("completing a workout saves the session and shows it in History", async ({ page }) => {
    // Baseline session count from the History header ("N sessions · last …").
    // History cards render the day label + volume (not notes), so we assert the
    // count increments rather than searching for the notes text.
    await page.getByRole("button", { name: /History/i }).click();
    const header = page.getByText(/\d+ sessions · last/).first();
    await expect(header).toBeVisible({ timeout: 10000 });
    // The count briefly shows 0 while sessions load — wait for the real value.
    await expect
      .poll(async () => {
        const t = (await header.textContent()) || "";
        const m = t.match(/(\d+) sessions/);
        return m ? parseInt(m[1], 10) : 0;
      }, { timeout: 10000 })
      .toBeGreaterThan(0);
    const before = parseInt((await header.textContent()).match(/(\d+) sessions/)[1], 10);

    // Start today's workout
    await page.getByRole("button", { name: /Workout/i }).click();
    await page.getByRole("button", { name: "START" }).first().click();
    await expect(page.getByText(/exercises/)).toBeVisible();

    // Fill one set on the first exercise (minimum to make the save meaningful)
    const weightInputs = page.getByPlaceholder("lbs");
    const repsInputs = page.getByPlaceholder("reps");
    await weightInputs.first().fill("175");
    await repsInputs.first().fill("8");
    await page.getByRole("button", { name: "✓" }).first().click();

    // Add a test marker in notes so this session is identifiable for cleanup
    await page.getByPlaceholder("Energy, joints, anything notable").fill("[AUTOMATED TEST — SAFE TO DELETE]");

    // Skip rest timer if shown
    const skipBtn = page.getByRole("button", { name: "Skip" });
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
    }

    // Complete workout — no rating modal (removed from UI)
    await page.getByRole("button", { name: /COMPLETE WORKOUT/i }).click();

    // CRITICAL: no error banner should appear
    await expect(page.getByText(/Workout not saved/i)).not.toBeVisible({ timeout: 8000 });

    // WorkoutSummary screen appears — dismiss it to return to main nav
    await expect(page.getByText("WORKOUT SUMMARY")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /CLOSE/i }).click();

    // History session count incremented — proves the session persisted
    await page.getByRole("button", { name: /History/i }).click();
    await expect(page.getByText(new RegExp(`${before + 1} sessions · last`))).toBeVisible({ timeout: 10000 });
  });

  test("error banner does NOT appear after workout save (auth regression)", async ({ page }) => {
    // This test specifically guards against the getUser() 403 regression.
    // If auth.getSession() is ever reverted to auth.getUser(), this test will catch it
    // because getUser() can return 403 when the token is being refreshed.

    await page.getByRole("button", { name: "START" }).first().click();
    await expect(page.getByText(/exercises/)).toBeVisible();

    const weightInputs = page.getByPlaceholder("lbs");
    const repsInputs = page.getByPlaceholder("reps");
    await weightInputs.first().fill("100");
    await repsInputs.first().fill("5");
    await page.getByRole("button", { name: "✓" }).first().click();

    await page.getByPlaceholder("Energy, joints, anything notable").fill("[AUTOMATED TEST — SAFE TO DELETE]");

    const skipBtn = page.getByRole("button", { name: "Skip" });
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
    }

    // Complete workout — no rating modal (removed from UI)
    await page.getByRole("button", { name: /COMPLETE WORKOUT/i }).click();

    // WorkoutSummary appears on success — its presence confirms the save went through
    // The definitive regression check: no error banner, summary screen visible
    await expect(page.getByText(/Workout not saved/i)).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText("WORKOUT SUMMARY")).toBeVisible({ timeout: 8000 });
  });
});
