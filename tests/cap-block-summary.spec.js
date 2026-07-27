// @ts-check
// Block-summary snapshot at completion (Commit 2a). Fixture: a plan 80 days old / 8 weeks (past its
// scheduled end → complete), 5 training + 2 rest (Y=40), with user_metadata.blockSummaries cleared.
//
// Verifies the integration smoke (no summary UI here — that's 2b): opening the app with this completed,
// un-snapshotted plan active writes exactly one frozen record into user_metadata.blockSummaries[key];
// re-opening does NOT rewrite it (capturedAt stable). The stored record round-trips (read back via the
// service key) with the right planKey / scheduledEnd / Y.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

const KEY = "AutoTest-Completed";

test.describe("cap-block block summary snapshot at completion", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seed.seedCompletedBlock(); });
  test.afterAll(async () => { await seed.restoreCompletedBlock(); });

  test("completed plan writes one frozen snapshot on open; re-open does not rewrite it", async ({ page }) => {
    // Activate the completed plan via its chip — persistActivePlanKey refreshes the session token so a
    // later reload's loadUserData sees it active (and the seeded empty blockSummaries).
    await ensureCleanHome(page);
    await page.getByRole("button", { name: /^Plan$/i }).click();
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "AutoTest Completed Plan" }).click();
      if (await page.getByText(/AutoCompletedDay/).first().isVisible({ timeout: 4000 }).catch(() => false)) break;
    }
    await expect(page.getByText(/AutoCompletedDay/).first()).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(3000); // let persistActivePlanKey's updateUser refresh the stored token

    // Reload → loadUserData runs with the completed plan active + no snapshot → the snapshot is written.
    await ensureCleanHome(page);
    await expect.poll(async () => { const bs = await seed.getBlockSummaries(); return bs && bs[KEY] ? "yes" : "no"; }, { timeout: 15000 }).toBe("yes");

    const snap = (await seed.getBlockSummaries())[KEY];
    expect(snap.planKey).toBe(KEY);
    expect(snap.sessionsScheduled).toBe(40);              // 5 non-rest × 8 weeks
    expect(typeof snap.scheduledEnd).toBe("string");
    expect(typeof snap.adherencePct).toBe("number");
    expect(typeof snap.capturedAt).toBe("string");
    const capturedAt = snap.capturedAt;

    // Re-open → idempotent: the frozen record is NOT recomputed/overwritten.
    await ensureCleanHome(page);
    await page.waitForTimeout(4000); // give any (unwanted) rewrite a chance to land
    const snap2 = (await seed.getBlockSummaries())[KEY];
    expect(snap2.capturedAt).toBe(capturedAt); // same record — frozen
  });
});
