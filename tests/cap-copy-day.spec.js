// @ts-check
// Commit A — copy-day ("make this day = another day"). Fixture: a 7-day plan (seedCopyDay) with a
// SOURCE "Chest" day (AutoCopy Alpha/Bravo/Charlie, in that authored order), an empty training day, a
// non-empty training day, and a rest day. Non-rest count = 5, so flipping the rest day → weekly target 6.
//
// Verifies: copy into an empty day lands the source's exercises in AUTHORED ORDER; a subsequent reorder
// still works (not frozen); a non-empty target shows the Replace/Append sheet (Replace first/default) and
// Replace drops the existing; a rest target shows the truthful "training day — target 5 → 6" line and,
// after copying, the Stats Overview adherence target actually reads 6.
//
// Note: copy also copies the source's LABEL onto the target, so after a copy the target's day label
// changes to the source's — assertions therefore key on the unique exercise NAMES, not the day label.
//
// Mutation-check lives in the pure suite (src/lib/copyDay.test.js): reusing source ids (drop mkId) fails
// the fresh-id + within-day-uniqueness assertions.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

const SRC = ["AutoCopy Alpha", "AutoCopy Bravo", "AutoCopy Charlie"];
const yOf = async (loc) => (await loc.boundingBox()).y;

test.describe("cap-copy-day copy a day into another", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seed.seedCopyDay(); });
  test.afterAll(async () => { await seed.restoreCopyDay(); });

  async function openPlan(page) {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    // Activate the seeded plan via its chip. Admin-set active-plan metadata isn't reliably read on
    // load, so the chip click is the real activation, and it can race with plan render — verify it
    // switched (RestDay is a fresh-seed marker) and retry if not.
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "AutoTest Copy Plan" }).click();
      if (await page.getByText(/RestDay/).first().isVisible({ timeout: 4000 }).catch(() => false)) return;
    }
    await expect(page.getByText(/RestDay/).first()).toBeVisible({ timeout: 5000 });
  }

  test("empty target: silent copy in source order, and a later reorder still works", async ({ page }) => {
    await openPlan(page);
    await page.getByText(/EmptyDay/).first().click();               // expand the empty day
    await page.getByRole("button", { name: /Copy from/ }).click();  // source picker
    await page.getByRole("button", { name: /Chest/ }).click();      // empty + non-rest → silent copy

    for (const n of SRC) await expect(page.getByText(n, { exact: true }).first()).toBeVisible({ timeout: 8000 });
    const [yA, yB, yC] = [await yOf(page.getByText(SRC[0], { exact: true }).first()),
                          await yOf(page.getByText(SRC[1], { exact: true }).first()),
                          await yOf(page.getByText(SRC[2], { exact: true }).first())];
    expect(yA).toBeLessThan(yB);
    expect(yB).toBeLessThan(yC); // Alpha, Bravo, Charlie — source authored order

    // Not frozen: enter reorder, move Charlie (3rd) up → it lands above Bravo.
    await page.getByRole("button", { name: /^Reorder$/ }).click();
    await page.getByRole("button", { name: "Move exercise up" }).nth(2).click();
    const yB2 = await yOf(page.getByText(SRC[1], { exact: true }).first());
    const yC2 = await yOf(page.getByText(SRC[2], { exact: true }).first());
    expect(yC2).toBeLessThan(yB2);
  });

  test("non-empty target: Replace/Append sheet (Replace default), and Replace drops the existing", async ({ page }) => {
    await openPlan(page);
    await page.getByText(/Filled/).first().click();                // expand the non-empty day (has AutoKeep Delta)
    await page.getByRole("button", { name: /Copy from/ }).click();
    await page.getByRole("button", { name: /Chest/ }).click();      // non-empty → confirm sheet

    const replace = page.getByRole("button", { name: /Replace/ });
    const append = page.getByRole("button", { name: /Append/ });
    await expect(replace).toBeVisible();
    await expect(append).toBeVisible();
    expect(await yOf(replace)).toBeLessThan(await yOf(append)); // Replace is the primary/default (first)

    await replace.click();
    for (const n of SRC) await expect(page.getByText(n, { exact: true }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("AutoKeep Delta", { exact: true })).toHaveCount(0); // existing dropped
  });

  test("rest target: truthful 'training day — target 5 → 6' line, and Stats target updates to 6", async ({ page }) => {
    await openPlan(page);
    await page.getByText(/RestDay/).first().click();               // expand the rest day
    await page.getByRole("button", { name: /Copy from/ }).click();
    await page.getByRole("button", { name: /Chest/ }).click();      // rest target → confirm sheet

    await expect(page.getByText(/training day/i)).toBeVisible();
    await expect(page.getByText(/target goes 5\D+6/)).toBeVisible(); // 5 → 6, computed from the plan
    await page.getByRole("button", { name: /Copy 3 exercises/ }).click(); // empty rest → single Copy

    await expect(page.getByText(SRC[0], { exact: true }).first()).toBeVisible({ timeout: 8000 });

    // Truthfulness: the number the sheet promised is what Stats now shows.
    await page.getByRole("button", { name: /^Stats$/i }).click();
    await expect(page.getByText(/of 6 this week/)).toBeVisible({ timeout: 8000 });
  });
});
