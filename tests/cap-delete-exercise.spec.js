// @ts-check
// Regression for finding ③: deleting ONE exercise must not remove every exercise sharing its name.
// The multi-add picker de-dupes within a session but resets on reopen, so adding the same movement
// across two sessions yields two same-named rows (distinct ids). Deleting one must leave exactly one.
//
// Fixture: the throwaway "AutoTest Picker Plan" with an empty "AutoPickerDay" (seedPickerDay), active.
// Mutation-check: restore the old `filter(e=>e.id!==exId&&e.name!==exName)` and this test sees 0 left.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

test.describe("cap-delete-exercise single-target delete", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seed.seedPickerDay(); });
  test.afterAll(async () => { await seed.restorePicker(); });

  const EX = "Face Pull";

  async function openDay(page) {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await page.getByRole("button", { name: "AutoTest Picker Plan" }).click();
    const dayCard = page.getByText(/AutoPickerDay/).first();
    await expect(dayCard).toBeVisible({ timeout: 12000 });
    await dayCard.click();
    return dayCard;
  }

  async function addOnce(page) {
    await page.getByRole("button", { name: /\+ Exercise/i }).click();
    await expect(page.getByText("Add Exercises")).toBeVisible({ timeout: 8000 });
    await page.getByPlaceholder(/Search .* exercises/i).fill(EX);
    // The picker modal renders AFTER the day list in the DOM, so the picker's row is the LAST match —
    // .first() would grab the already-added row sitting behind the modal (not clickable).
    await page.getByText(EX, { exact: true }).last().click();
    await expect(page.getByText("Added", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: /Done/i }).first().click();
    await expect(page.getByText("Add Exercises")).toHaveCount(0);
  }

  test("deleting one duplicate leaves the other (not both)", async ({ page }) => {
    await openDay(page);
    // Two separate picker sessions → two "Face Pull" rows in the day.
    await addOnce(page);
    await addOnce(page);

    // The day now shows the exercise name twice (each row renders the name).
    const rows = page.getByText(EX, { exact: true });
    await expect(rows).toHaveCount(2, { timeout: 8000 });

    // Delete the first one via its ✕ (danger) button.
    await page.getByRole("button", { name: "✕" }).first().click();

    // Exactly ONE remains — the old code would have removed BOTH.
    await expect(page.getByText(EX, { exact: true })).toHaveCount(1);

    // Let the delete's save commit before navigating (goto would cancel an in-flight write).
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    // And it survives a reload (the single-target delete committed).
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await page.getByRole("button", { name: "AutoTest Picker Plan" }).click();
    const dayCard = page.getByText(/AutoPickerDay/).first();
    await expect(dayCard).toBeVisible({ timeout: 12000 });
    await dayCard.click();
    await expect(page.getByText(EX, { exact: true })).toHaveCount(1, { timeout: 8000 });
  });
});
