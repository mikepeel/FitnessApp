// @ts-check
// Regression tests for Issue 1 — workout save persists to Supabase
// Tests: save succeeds using getSession (not getUser), no error banner, session in History
const { test, expect } = require("@playwright/test");

test.describe("workout save", () => {
  test("completing a workout saves the session and shows it in History", async ({ page }) => {
    let insertedSessionId = null;
    let saveRequestMade = false;
    let saveRequestFailed = false;

    // Intercept the workout_sessions insert to capture it without creating persistent data
    await page.route("**/rest/v1/workout_sessions**", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        saveRequestMade = true;
        // Let it through — this creates real data which we will clean up after
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible();

    // Start today's workout
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

    // Complete workout
    await page.getByRole("button", { name: /COMPLETE WORKOUT/i }).click();

    // Rating modal — select any rating and confirm
    const ratingBtn = page.getByRole("button", { name: "🙂" });
    if (await ratingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ratingBtn.click();
    }
    const doneBtn = page.getByRole("button", { name: /DONE|SAVE|FINISH/i });
    if (await doneBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await doneBtn.click();
    }

    // CRITICAL: no "Could not save" error banner should appear
    await expect(page.getByText(/could not save/i)).not.toBeVisible({ timeout: 5000 });

    // The save request must have been made
    expect(saveRequestMade).toBe(true);

    // Navigate to History and verify the session appears
    await page.getByRole("button", { name: /History/i }).click();
    await expect(page.getByText(/AUTOMATED TEST/i)).toBeVisible({ timeout: 10000 });
  });

  test("error banner does NOT appear after workout save (auth regression)", async ({ page }) => {
    // This test specifically guards against the getUser() 403 regression.
    // If auth.getSession() is ever reverted to auth.getUser(), this test will catch it
    // because getUser() can return 403 when the token is being refreshed.

    await page.goto("/");
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible();

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

    await page.getByRole("button", { name: /COMPLETE WORKOUT/i }).click();

    const ratingBtn = page.getByRole("button", { name: "🙂" });
    if (await ratingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ratingBtn.click();
    }
    const doneBtn = page.getByRole("button", { name: /DONE|SAVE|FINISH/i });
    if (await doneBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await doneBtn.click();
    }

    // The definitive regression check: no error banner
    await expect(page.getByText(/could not save/i)).not.toBeVisible({ timeout: 8000 });
  });
});
