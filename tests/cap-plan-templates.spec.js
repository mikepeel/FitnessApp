// @ts-check
// B2: the expanded, filterable template library. Asserts the full count and that the goal + days
// filter chips narrow the list correctly.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");

test.describe("cap-plan template browse", () => {
  test("goal + days filters narrow the template list", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await page.getByRole("button", { name: /Templates/i }).click();

    // Full library present.
    await expect(page.getByText(/^16 programs$/)).toBeVisible({ timeout: 8000 });

    // Filter by goal → 5 Build Muscle programs.
    await page.getByRole("button", { name: "Build Muscle" }).click();
    await expect(page.getByText(/^5 programs$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Use & Customize/ }).first()).toBeVisible();

    // Add a days filter → narrows to the single Build-Muscle 6-day program (PPL x2).
    await page.getByRole("button", { name: "6 days" }).click();
    await expect(page.getByText(/^1 program$/)).toBeVisible();
    await expect(page.getByText(/Push Pull Legs/)).toBeVisible();

    // Clearing goal keeps the days filter → all 6-day programs (just PPL x2 here in this library).
    await page.getByRole("button", { name: "All goals" }).click();
    await expect(page.getByText(/^1 program$/)).toBeVisible();
  });
});
