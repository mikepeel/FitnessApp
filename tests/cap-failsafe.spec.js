// @ts-check
// Regression guards for the cap-cleanup FETCH FAIL-SAFES (drill-down 4a, History window 5).
// Each forces the targeted fetch to fail via route interception and asserts the app falls
// back to the capped in-memory data — charts/list still render, no false error banner. These
// are non-happy-path tests (the fetch fails); they guard the graceful fallback required by
// TESTING.md §11/§15.
//
// Mutation-verified locally (E2E_BASE_URL=http://localhost:3000):
//   - drill: chartData fallback `:seriesFor(selEx)` → `:[]`  ⇒ empty-state shows ⇒ test fails
//   - history: `if(error||!data)return;` → `{setWindowSessions([]);return;}` ⇒ list empties ⇒ test fails
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");

test.describe("cap-cleanup fetch fail-safes", () => {
  test("drill-down: a failed full-history fetch falls back to the capped series (charts render, no empty state)", async ({ page }) => {
    // Force the per-lift full-history fetch to fail. Only the drill query filters by
    // exercise_name (recalcPRs / plateau fetches don't), so this targets it alone.
    await page.route(/\/rest\/v1\/logged_sets\?.*exercise_name=eq/, (route) => route.abort());

    await ensureCleanHome(page);
    await page.getByRole("button", { name: /Stats/i }).click();
    await page.getByRole("button", { name: "Progress" }).click();

    // Drill into Bench Press — iron-test has 6 logged sessions of it, so the capped
    // seriesFor() fallback is non-empty (chartData.length > 1 → charts render).
    await page.locator("select").selectOption("Bench Press");

    // Fallback renders the charts; the "not enough data" empty-state must NOT appear.
    await expect(page.getByText(/Bench Press\b.*Max Weight/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Log 2\+ weighted sessions of Bench Press/)).not.toBeVisible();
  });

  test("history: a failed window fetch falls back to the loaded list (sessions still show, no error banner)", async ({ page }) => {
    // Count interceptions so we only assert AFTER the window fetch has actually fired and
    // been aborted — otherwise a transient prop render could mask a broken fallback.
    let hits = 0;
    // Fail as an error RESPONSE (500), not a network abort: supabase-js returns {error}
    // (no throw), so this exercises the explicit `if(error||!data)return` fail-safe guard.
    await page.route(/\/rest\/v1\/workout_sessions\?.*or=/, (route) => {
      hits++;
      return route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"forced failure"}' });
    });

    await ensureCleanHome(page);
    await page.getByRole("button", { name: /History/i }).click();

    const header = page.getByText(/\d+ sessions · last/).first();
    await expect(header).toBeVisible({ timeout: 10000 });

    // Default filter is 3M (fires a window fetch on open); switch to 6M to exercise it again.
    await page.getByRole("button", { name: "6M" }).click();

    // Wait until the intercepted fetch has fired+aborted, then let React settle.
    await expect.poll(() => hits, { timeout: 8000 }).toBeGreaterThan(0);
    await page.waitForTimeout(600);

    // Fallback: the loaded (prop) sessions still render — count stays > 0.
    const count = parseInt(((await header.textContent()) || "").match(/(\d+) sessions/)[1], 10);
    expect(count).toBeGreaterThan(0);
    // No false error banner on the user's action.
    await expect(page.getByText(/couldn.?t load|failed to load|something went wrong/i)).not.toBeVisible();
  });
});
