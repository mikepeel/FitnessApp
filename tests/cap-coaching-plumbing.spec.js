// @ts-check
// COMMIT 1 — coaching/insight toggles plumbing only (persistence + Settings UI, NO gating yet).
// Asserts: the "Coaching & Insights" section + rows render; flipping the master persists to
// user_settings and survives a reload (round-trip); and — critically — NO surface is gated yet,
// so with the master OFF the Coach tab and "Analyze plan" still appear. The ?? true coalesce
// (existing users keep their surfaces) is covered by the pure coachingSettings.test.js.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup coaching toggles — plumbing (no gating)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY to read/reset settings");

  test.beforeEach(async () => { await seedHistory.resetCoaching(); }); // known start: all ON
  test.afterAll(async () => { await seedHistory.resetCoaching(); });   // restore baseline

  test("toggles persist (round-trip) and no surface is gated yet", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Settings/i }).click();

    // Section + the four sub-rows render.
    await expect(page.getByText("Coaching & Insights", { exact: true })).toBeVisible({ timeout: 10000 });
    for (const lbl of ["Plateau & trend callouts", "Volume vs targets", "Coach tab", "Plan analysis"]) {
      await expect(page.getByText(lbl, { exact: true })).toBeVisible();
    }
    // Master ON (beforeEach reset) → sub-rows at full opacity.
    const coachRow = page.getByText("Coach tab", { exact: true }).locator("xpath=../..");
    await expect(coachRow).toHaveCSS("opacity", "1");

    // Flip the MASTER off and save.
    const masterRow = page.getByText(/interpretive guidance/).locator("xpath=../..");
    await masterRow.locator("xpath=./div[last()]").click(); // the Toggle is the row's last child
    await page.getByRole("button", { name: /Save Settings|Saved/ }).click();

    // Round-trip part 1: it persisted to user_settings.
    await expect.poll(async () => (await seedHistory.readCoaching())?.show_coaching, { timeout: 8000 }).toBe(false);

    // Round-trip part 2: reload → the loaded-back OFF state is reflected (sub-rows dimmed).
    // ensureCleanHome re-navigates and waits for networkidle so settings finish loading before
    // MoreTab mounts (it seeds `local` from settings at mount).
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Settings/i }).click();
    await expect(page.getByText("Coaching & Insights", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Coach tab", { exact: true }).locator("xpath=../..")).toHaveCSS("opacity", "0.4");

    // NO GATING YET: with the master OFF, the surfaces still appear.
    await page.getByRole("button", { name: /Stats/i }).click();
    await expect(page.getByRole("button", { name: /Coach/i })).toBeVisible({ timeout: 10000 }); // Coach sub-tab still present
    await page.getByRole("button", { name: /^Plan$/i }).click();
    await expect(page.getByRole("button", { name: /Analyze plan/i })).toBeVisible({ timeout: 10000 }); // Analyze-plan still present
  });
});
