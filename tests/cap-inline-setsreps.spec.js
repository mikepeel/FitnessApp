// @ts-check
// Commit C — inline sets/reps editing on the exercise row. Reuses the copy-day fixture: its "Chest" day
// holds AutoCopy Alpha/Bravo/Charlie (non-cardio, sets "3" / reps "10"), so the row shows the new
// inline controls (sets steppers + a reps text input). Verifies an inline change PERSISTS (authoritative
// days_json read) without altering the exercise ORDER, its id, or any other row (no cross-wire); that the
// Edit modal still opens and saves; and that the row does not overflow at 375px.
//
// Mutation-check: make the sets stepper a no-op (setSets = () => {}) → the "cd_a|4|8-10" persist poll fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

test.describe("cap-inline inline sets/reps editing", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seed.seedCopyDay(); });
  test.afterAll(async () => { await seed.restoreCopyDay(); });

  async function openChest(page) {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    // Activate the seeded plan (RestDay is a marker unique to it — "Chest" also appears in the baseline
    // plan's tags, so it can't gate activation). Verify + retry against the chip-click race.
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "AutoTest Copy Plan" }).click();
      if (await page.getByText(/RestDay/).first().isVisible({ timeout: 4000 }).catch(() => false)) break;
    }
    await expect(page.getByText(/RestDay/).first()).toBeVisible({ timeout: 5000 });
    await page.getByText(/Chest/).first().click(); // expand the Chest day
    await expect(page.getByText("AutoCopy Alpha", { exact: true }).first()).toBeVisible({ timeout: 8000 });
  }

  test("inline sets + reps persist; order, id, and other rows unchanged", async ({ page }) => {
    await openChest(page);
    const alphaSets = async () => {
      const days = await seed.getCopyPlanDays();
      const chest = (days || []).find((d) => d.id === "cd_chest");
      const a = chest && chest.exercises[0];
      return a ? `${a.id}|${a.sets}|${a.reps}` : null;
    };
    // sets 3 → 4, and let it persist before the next edit (two full-plan writes fired back-to-back can
    // arrive out of order — the app's per-change write model, not specific to inline editing; real use
    // spaces these out).
    await page.getByRole("button", { name: "Increase sets" }).nth(0).click();
    await expect.poll(alphaSets, { timeout: 10000 }).toBe("cd_a|4|10");
    // reps 10 → 8-10 (commit on blur)
    const alphaReps = page.getByRole("textbox", { name: "Reps" }).nth(0);
    await alphaReps.fill("8-10");
    await alphaReps.press("Enter");
    await expect.poll(alphaSets, { timeout: 10000 }).toBe("cd_a|4|8-10"); // id preserved, sets & reps persisted

    const days = await seed.getCopyPlanDays();
    const chest = days.find((d) => d.id === "cd_chest");
    expect(chest.exercises.map((e) => e.id)).toEqual(["cd_a", "cd_b", "cd_c"]);   // order + ids intact
    expect(chest.exercises.map((e) => e.name)).toEqual(["AutoCopy Alpha", "AutoCopy Bravo", "AutoCopy Charlie"]);
    expect(`${chest.exercises[1].sets}|${chest.exercises[1].reps}`).toBe("3|10"); // Bravo untouched — no cross-wire

    // UI round-trip: reload, re-open, the persisted reps value renders (and Bravo's did not change).
    await openChest(page);
    await expect(page.getByRole("textbox", { name: "Reps" }).nth(0)).toHaveValue("8-10");
    await expect(page.getByRole("textbox", { name: "Reps" }).nth(1)).toHaveValue("10");
  });

  test("row with inline controls does not overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openChest(page);
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflows).toBe(false);
  });

  test("Edit modal still opens and saves the other fields", async ({ page }) => {
    await openChest(page);
    await page.getByRole("button", { name: "Edit" }).nth(0).click(); // Alpha's Edit
    await expect(page.getByText("Edit Exercise")).toBeVisible();
    // The modal's Name field is the textbox inside the "Exercise Name" field wrapper (innermost div).
    const nameField = page.locator("div").filter({ has: page.getByText("Exercise Name", { exact: true }) }).last().getByRole("textbox");
    await expect(nameField).toHaveValue("AutoCopy Alpha"); // modal opened on the right exercise
    await nameField.fill("Alpha Renamed");
    await page.getByRole("button", { name: "Save", exact: true }).click(); // not the "Save Day" button
    await expect(page.getByText("Alpha Renamed", { exact: true }).first()).toBeVisible({ timeout: 8000 });
  });
});
