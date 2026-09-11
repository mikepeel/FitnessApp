// @ts-check
// Regression tests for the complete PERSONAL-data export (Settings → Data → Download my data).
// Headless Chromium has no file-share, so deliverFile() takes the <a download> path → a real
// download event we can capture and validate. Distinct from the anonymized "Copy for AI" export.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const fs = require("fs");

test.describe("data export (download my data)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Settings/i }).click();
    await expect(page.getByText("Download my data")).toBeVisible({ timeout: 8000 });
  });

  test("JSON download is a complete, faithful export (real dates, not anonymized)", async ({ page }) => {
    const dlPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^JSON$/ }).click();
    const download = await dlPromise;
    expect(download.suggestedFilename()).toMatch(/^iron-training-\d{4}-\d{2}-\d{2}\.json$/);

    const content = fs.readFileSync(await download.path(), "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.app).toBe("IRON");
    expect(parsed.kind).toBe("personal-training-export");
    expect(typeof parsed.sessionCount).toBe("number");
    expect(Array.isArray(parsed.sessions)).toBe(true);
    expect(parsed.sessions.length).toBe(parsed.sessionCount);
    if (parsed.sessions.length) {
      const s = parsed.sessions[0];
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // real local date is KEPT
      expect(Array.isArray(s.exercises)).toBe(true);
    }
  });

  test("CSV download has the set-table header + rows", async ({ page }) => {
    const dlPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^CSV$/ }).click();
    const download = await dlPromise;
    expect(download.suggestedFilename()).toMatch(/^iron-training-\d{4}-\d{2}-\d{2}\.csv$/);

    const content = fs.readFileSync(await download.path(), "utf8");
    const lines = content.split("\n");
    expect(lines[0]).toBe("date,day,exercise,track,set,type,weight,reps,seconds,minutes,level,pr,notes");
    expect(lines.length).toBeGreaterThan(1); // header + at least one row (test account has history)
  });
});
