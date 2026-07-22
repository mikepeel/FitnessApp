// @ts-check
// Commit B — the exercise picker stays OPEN across selections (multi-add). Fixture: a throwaway plan
// with ONE empty training day (AutoPickerDay), set active. The test adds THREE exercises in a single
// picker session WITHOUT reopening, then asserts: per-row "Added" feedback, the running count, that the
// picker stayed open the whole time, that Done closes it, that the day holds the three in SELECTION
// order (append order), and that they PERSIST across a reload (the per-add writes committed).
//
// Mutation-check: restore close-on-select at the PlanTab call site (onSelect also runs setAddExDay(null),
// and drop the multiAdd prop) -> after the first pick the modal closes, the "Add Exercises" heading is
// gone, and the second search finds nothing -> this test fails.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

test.describe("cap-picker exercise picker multi-add", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seed.seedPickerDay(); });
  test.afterAll(async () => { await seed.restorePicker(); });

  // Distinct library exercises, clicked in THIS order → must land appended in THIS order.
  const ADDS = ["Goblet Squat", "Face Pull", "Hammer Curl"];

  async function openEmptyDayPicker(page) {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    // Activate the seeded plan via its chip (robust regardless of metadata-resolution timing).
    await page.getByRole("button", { name: "AutoTest Picker Plan" }).click();
    const dayCard = page.getByText(/AutoPickerDay/).first();
    await expect(dayCard).toBeVisible({ timeout: 12000 });
    await dayCard.click();
    await page.getByRole("button", { name: /\+ Exercise/i }).click();
    await expect(page.getByText("Add Exercises")).toBeVisible({ timeout: 8000 }); // multiAdd header
  }

  test("three added in one session, in order, with feedback; Done closes; survives reload", async ({ page }) => {
    await openEmptyDayPicker(page);
    const search = page.getByPlaceholder(/Search .* exercises/i);

    for (let i = 0; i < ADDS.length; i++) {
      await search.fill(ADDS[i]);
      await page.getByText(ADDS[i], { exact: true }).first().click();
      // LOAD-BEARING: the picker must still be open after a selection.
      await expect(page.getByText("Add Exercises")).toBeVisible();
      // per-row feedback: the just-added row (still filtered in) flips to "Added".
      await expect(page.getByText("Added", { exact: true }).first()).toBeVisible();
      // running count reflects how many were added this session (header count span, anchored so it
      // doesn't also match the "Done — N added" bar).
      await expect(page.getByText(new RegExp(`^${i + 1} added$`))).toBeVisible();
    }

    // Done closes the picker.
    await page.getByRole("button", { name: /Done/i }).first().click();
    await expect(page.getByText("Add Exercises")).toHaveCount(0);

    // The day now holds all three, in SELECTION order — asserted by vertical position.
    const ys = [];
    for (const name of ADDS) {
      const el = page.getByText(name, { exact: true }).first();
      await expect(el).toBeVisible();
      const box = await el.boundingBox();
      ys.push(box ? box.y : 0);
    }
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);

    // Persistence: reload, re-open the day, the three are still there (per-add writes committed —
    // staying open did not defer or lose a write).
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await page.getByRole("button", { name: "AutoTest Picker Plan" }).click();
    const dayCard = page.getByText(/AutoPickerDay/).first();
    await expect(dayCard).toBeVisible({ timeout: 12000 });
    await dayCard.click();
    for (const name of ADDS) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 8000 });
    }
  });
});
