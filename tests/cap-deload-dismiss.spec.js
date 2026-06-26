// @ts-check
// Deload dismissal persistence. The bug: the "X" set local state only, and load seeded from null,
// so dismissal never survived a reload — the prompt returned every open. Fix persists a
// dismissed-at marker to user_metadata (read on load) and gates via deloadVisible with a 7-day
// window. This UI test covers the CORE bug — dismiss → reload → stays gone. The window-EXPIRY
// ("returns after 7 days") is covered rigorously by the pure deloadVisible.test.js (+ mutation):
// the browser can't age a persisted JWT-claim marker without a token refresh that a plain reload
// doesn't force, so aging it in-browser isn't reliably drivable.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seedHistory = require("./seedHistory");

test.describe("cap-cleanup deload dismissal persists (user_metadata + 7-day window)", () => {
  test.skip(!seedHistory.hasKey(), "needs SUPABASE_SERVICE_KEY");

  test.beforeEach(async () => { await seedHistory.seedDeload(); }); // deloadDue true + marker cleared
  test.afterAll(async () => { await seedHistory.cleanup(); await seedHistory.setDeloadDismissedAt(null); });

  test("dismissal survives a reload (the core bug)", async ({ page }) => {
    // 1) Due + un-dismissed → the prompt shows
    await ensureCleanHome(page);
    await expect(page.getByText(/Deload Week Recommended/)).toBeVisible({ timeout: 10000 });

    // 2) Dismiss via the card's X → immediate hide. The heading and the ✕ button share the flex
    //    row two levels up from the heading text node.
    await page.getByText(/Deload Week Recommended/).locator("xpath=../..").getByRole("button").click();
    await expect(page.getByText(/Deload Week Recommended/)).toHaveCount(0);

    // the app persisted the marker to user_metadata
    await expect.poll(async () => (await seedHistory.getUserMeta())?.deload_dismissed_at, { timeout: 8000 }).toBeTruthy();

    // 3) Reload → STILL GONE (before the fix it returned here every open)
    await ensureCleanHome(page);
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 10000 }); // tab loaded
    await expect(page.getByText(/Deload Week Recommended/)).toHaveCount(0);
  });
});
