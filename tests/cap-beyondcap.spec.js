// @ts-check
// Guards for the beyond-cap delete/edit fix: History's date-range window (step 5) can display
// sessions beyond the .limit(100) prop load, and those rows must still be deletable/editable
// by id. Self-seeds two ~178-day-old rows that sit inside the 6M window but past the 100-row
// prop cap (verified outside the prop), so they're displayable yet absent from `sessions`.
//
//  - DELETE is a genuine fails-before/passes-after: before the fix deleteSession's prop-find
//    early return no-ops on these rows; after, it deletes by id. (Mutation = re-adding that
//    early return, which is exactly the pre-fix code → the delete test fails.)
//  - EDIT is a LABELED GUARD: saveEdit already writes by id from the edit-form state, so this
//    passes today. Its mutation-check is "add a prop-existence early return to saveEdit" — i.e.
//    guard against saveEdit ever regressing into the delete bug.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup beyond-cap delete/edit", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY in .env to seed beyond-cap fixtures");

  test.beforeAll(async () => { await seedHistory.seed({ bulk: 90 }); });
  test.afterAll(async () => { await seedHistory.cleanup(); });

  test("deleting a beyond-cap session (not in the loaded prop) removes it by id", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByRole("button", { name: "6M" }).click();

    // The beyond-cap row is displayed in the 6M window (it's not in the capped prop).
    await expect(page.getByText("AutoTest-BeyondCap-Del")).toBeVisible({ timeout: 10000 });

    // Expand → Delete → confirm.
    await page.getByText("AutoTest-BeyondCap-Del").click();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByText("Delete this workout?")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Delete" }).last().click();

    // The by-id delete + window re-fetch remove it. Before the fix this no-ops and the card stays.
    await expect(page.getByText("AutoTest-BeyondCap-Del")).not.toBeVisible({ timeout: 10000 });
  });

  test("editing a beyond-cap session persists by id (guard: saveEdit must not regress to a prop-find early return)", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();
    await page.getByRole("button", { name: "6M" }).click();
    await expect(page.getByText("AutoTest-BeyondCap-Edit")).toBeVisible({ timeout: 10000 });

    // Expand → ✎ Edit → change duration to a distinctive 287 min → Save.
    await page.getByText("AutoTest-BeyondCap-Edit").click();
    await page.getByRole("button", { name: /Edit/ }).first().click();
    await expect(page.getByText("✎ Edit Workout")).toBeVisible({ timeout: 5000 });
    await page.locator('input[max="300"]').fill("287");
    await page.getByRole("button", { name: /Save Changes/ }).click();

    // On success the modal closes and the window re-fetches → the card shows the new duration.
    // 287min is distinctive (no real session has it), so it uniquely identifies the edited card.
    await expect(page.getByText(/287\s*min/)).toBeVisible({ timeout: 10000 });
  });
});
