// @ts-check
// F2: first-run empty states. Forces an empty account (every session read → []) so the invitations
// render, then asserts History and the Stats muscle map show welcoming first-run copy (not a dry/
// debug message). The mock only affects GET reads of workout_sessions.
const { test, expect } = require("@playwright/test");

test.describe("cap-empty first-run empty states", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\/rest\/v1\/workout_sessions/, route =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/0" }, body: "[]" })
        : route.continue());
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 15000 });
  });

  test("History shows a welcoming first-run invitation, not a debug message", async ({ page }) => {
    await page.getByRole("button", { name: /History/i }).click();
    await expect(page.getByText("Your training log starts here")).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /Start a workout/ })).toBeVisible();
  });

  test("the Stats muscle map invites the first workout", async ({ page }) => {
    await page.getByRole("button", { name: /^Stats$/i }).click();
    await page.getByRole("button", { name: /Muscles/i }).click();
    await expect(page.getByText(/Do your first workout/)).toBeVisible({ timeout: 8000 });
  });
});
