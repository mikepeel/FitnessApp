// @ts-check
// AI training-data export — anonymized, allowlist-only. UI smoke + integration denylist net on REAL
// data: the button produces valid JSON to the clipboard with NO uuid / absolute date / email / DB
// column name. The exhaustive allowlist + genericization + relative-date safety is mutation-checked
// in the pure exportTraining.test.js; this proves the real fetch+serialize+copy path is clean.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.describe("cap-cleanup AI training-data export (anonymized)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test("Settings button copies anonymized JSON; no id / date / email / column names leak", async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Settings/i }).click();

    await expect(page.getByText("Copy training data for AI")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByText(/Copied/)).toBeVisible({ timeout: 10000 });

    const json = await page.evaluate(() => navigator.clipboard.readText());
    const obj = JSON.parse(json); // valid JSON
    expect(typeof obj.instructions).toBe("string");
    expect(Array.isArray(obj.log)).toBe(true);
    expect(obj.log.length).toBeGreaterThan(0); // iron-test has logged sessions

    // Denylist net on the REAL serialized output.
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i); // no uuid
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);            // no YYYY-MM-DD / ISO date
    expect(json).not.toMatch(/[^\s@]+@[^\s@]+\.[^\s@]+/);     // no email
    for (const col of ["user_id", "session_id", "notes", "set_type", "is_pr", "exercise_name", "completed_at", "day_label"]) {
      expect(json).not.toContain(col);
    }
    // Only the allowlisted top-level keys.
    expect(Object.keys(obj).sort()).toEqual(["instructions", "log"]);
  });
});
