// @ts-check
// F3: confirming a set plays a one-beat pop. Asserts the confirmed row carries the motion class
// (the animation itself is CSS + respects prefers-reduced-motion). Abandons the workout after.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");

test.describe("cap-confirm confirmation motion", () => {
  test.afterEach(async ({ page }) => {
    const moreBtn = page.locator("button", { hasText: "⋯" }).first();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await page.getByRole("button", { name: "✕ Abandon" }).click();
      await page.getByRole("button", { name: "Abandon" }).click();
      await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 8000 });
    }
  });

  test("a confirmed set carries the pop-motion class", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: "START" }).first().click();
    await expect(page.getByText(/exercises/)).toBeVisible();
    await page.getByPlaceholder("lbs").first().fill("135");
    await page.getByPlaceholder("reps").first().fill("8");
    await page.getByRole("button", { name: /confirm set/i }).first().click();
    await expect(page.locator(".iron-pop").first()).toBeVisible({ timeout: 5000 });
  });
});
