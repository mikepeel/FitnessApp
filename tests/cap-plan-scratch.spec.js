// @ts-check
// B1: "Build from scratch" — creating a blank plan drops you into an editable 3-day scaffold and
// persists. Also covers the discoverability entry point (the "＋ New" chip). Cleans up the plan it makes.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

const PREFIX = "E2E Scratch ";

test.describe("cap-plan build from scratch", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY (cleanup)");
  test.afterAll(async () => { await seed.deletePlansByNamePrefix(PREFIX); });

  test("blank plan opens editable with a scaffold and persists", async ({ page }) => {
    const name = PREFIX + Date.now();
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();

    // Entry point: the "＋ New" chip in My Plans (present because the account has plans).
    await page.getByRole("button", { name: "＋ New" }).click();
    const nameInput = page.getByPlaceholder("My Plan"); // unique to the from-scratch sheet
    await expect(nameInput).toBeVisible({ timeout: 8000 });
    await nameInput.fill(name);
    await page.getByRole("button", { name: /Create & Start Building/ }).click();

    // Lands in the editor: a 3-day scaffold, Day 1 expanded and editable (+ Exercise present).
    await expect(page.getByText(/Day 1/).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Day 2/).first()).toBeVisible();
    await expect(page.getByText(/Day 3/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /\+ Exercise/i }).first()).toBeVisible();

    // Persists across reload (the create committed).
    await page.waitForTimeout(4000); // let the insert round-trip commit
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await expect(page.getByRole("button", { name })).toBeVisible({ timeout: 12000 });
  });

  test("templates read as editable ('Use & Customize')", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await page.getByRole("button", { name: /Templates/i }).click();
    // The primary action names customization, and the editable promise is shown.
    await expect(page.getByRole("button", { name: /Use & Customize/ }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Becomes your own plan/i).first()).toBeVisible();
  });
});
