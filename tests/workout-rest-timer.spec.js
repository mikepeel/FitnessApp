// @ts-check
// Regression tests for Issue 2 — rest timer behavior in WorkoutSession
// Tests: fires on strength set confirm, resets mid-countdown, does NOT fire for cardio
const { test, expect } = require("@playwright/test");

test.describe("rest timer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for workout tab to confirm app loaded
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Minimize the workout without saving so no session is created
    const closeBtn = page.locator("button", { hasText: "✕" }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test("rest timer fires after confirming a non-last strength set", async ({ page }) => {
    // Start today's workout (first START button)
    await page.getByRole("button", { name: "START" }).first().click();
    await expect(page.getByText(/exercises/)).toBeVisible();

    // Fill Set 1 of the first exercise (Bench Press)
    const weightInputs = page.getByPlaceholder("lbs");
    const repsInputs = page.getByPlaceholder("reps");
    await weightInputs.first().fill("175");
    await repsInputs.first().fill("8");

    // Confirm Set 1
    await page.getByRole("button", { name: "✓" }).first().click();

    // REST timer must appear
    await expect(page.getByText("REST")).toBeVisible({ timeout: 3000 });
    const timerText = await page.getByText(/^0:\d\d$|^1:\d\d$/).first().textContent();
    expect(timerText).toBeTruthy();
  });

  test("confirming next set mid-countdown resets rest timer to full duration", async ({ page }) => {
    await page.getByRole("button", { name: "START" }).first().click();
    await expect(page.getByText(/exercises/)).toBeVisible();

    const weightInputs = page.getByPlaceholder("lbs");
    const repsInputs = page.getByPlaceholder("reps");

    // Confirm Set 1
    await weightInputs.first().fill("175");
    await repsInputs.first().fill("8");
    await page.getByRole("button", { name: "✓" }).first().click();
    await expect(page.getByText("REST")).toBeVisible({ timeout: 3000 });

    // Wait 5 seconds so timer has visibly counted down
    await page.waitForTimeout(5000);
    const timerAfterSet1 = await page
      .locator("text=/^0:\\d\\d$|^1:\\d\\d$/")
      .first()
      .textContent();

    // Confirm Set 2 — weight is pre-filled, just add reps
    await repsInputs.first().fill("7");
    await page.getByRole("button", { name: "✓" }).first().click();

    // Timer must still be visible (not gone)
    await expect(page.getByText("REST")).toBeVisible({ timeout: 3000 });

    // Timer should be HIGHER than where it was before Set 2 confirm (reset happened)
    await page.waitForTimeout(500);
    const timerAfterSet2 = await page
      .locator("text=/^0:\\d\\d$|^1:\\d\\d$/")
      .first()
      .textContent();

    const toSeconds = (t) => {
      const [m, s] = t.replace(/^0?/, "").split(":").map(Number);
      return m * 60 + s;
    };
    expect(toSeconds(timerAfterSet2)).toBeGreaterThan(toSeconds(timerAfterSet1));
  });

  test("confirming a cardio interval does NOT show the rest timer", async ({ page }) => {
    await page.getByRole("button", { name: "START" }).first().click();
    await expect(page.getByText(/exercises/)).toBeVisible();

    // Fill and confirm a strength set so rest timer state is active, then skip
    const weightInputs = page.getByPlaceholder("lbs");
    const repsInputs = page.getByPlaceholder("reps");
    await weightInputs.first().fill("175");
    await repsInputs.first().fill("8");
    await page.getByRole("button", { name: "✓" }).first().click();
    await expect(page.getByText("REST")).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText("REST")).not.toBeVisible();

    // Scroll to Stair Stepper (cardio, last exercise)
    await page.getByText("Stair Stepper").scrollIntoViewIfNeeded();
    const minutesInput = page.getByPlaceholder("10");
    await minutesInput.fill("12");

    // Confirm the cardio interval
    // Use the last ✓ button (Stair Stepper's confirm)
    const confirmBtns = page.getByRole("button", { name: "✓" });
    await confirmBtns.last().click();

    // REST timer must NOT appear after cardio confirm
    await page.waitForTimeout(1000);
    await expect(page.getByText("REST")).not.toBeVisible();

    // Stair Stepper should show LOGGED badge
    await expect(page.getByText("LOGGED")).toBeVisible();
  });
});
