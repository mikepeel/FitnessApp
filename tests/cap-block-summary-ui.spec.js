// @ts-check
// Commit 2b — the one-shot full-screen block-completion summary + four-way next-step. Fixture:
// seedBlockSummary seeds a completed plan (past scheduled end) plus a crafted FROZEN snapshot in
// user_metadata (controllable adherence/PRs/most-improved/seen). The summary is driven by that snapshot.
//
// Trigger: on a fresh context the stored token is pre-seed, so we activate the completed plan via its
// chip — persistActivePlanKey's updateUser refreshes the session (USER_UPDATED) with the seeded snapshot,
// and the render-computed one-shot pops.
const { test, expect } = require("@playwright/test");
const { ensureCleanHome } = require("./helpers");
const seed = require("./seedHistory");

const KEY = "AutoTest-Completed";

// The adaptive hero (data-testid="summary-hero") must be the single dominant element — larger than any
// supporting stat (data-testid="summary-stat"), the tell of the editorial three-tier hierarchy.
async function assertHeroDominant(page, expect) {
  const heroPx = await page.locator('[data-testid="summary-hero"]').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const statPx = await page.locator('[data-testid="summary-stat"]').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(heroPx).toBeGreaterThan(statPx);     // hero dominates the supporting floor
  expect(heroPx).toBeGreaterThanOrEqual(40);  // and is genuinely large
}
// The overflow lesson (8cc0d0f): both summaries must render with all bounding rects inside the viewport
// at 375 AND 320, and the page must not scroll horizontally.
async function assertNoOverflow(page, expect) {
  const orig = page.viewportSize();
  for (const w of [375, 320]) {
    await page.setViewportSize({ width: w, height: 760 });
    const box = await page.locator('[data-testid="summary-hero"]').boundingBox();
    expect(box.x, `hero left in-viewport @${w}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `hero right in-viewport @${w}`).toBeLessThanOrEqual(w + 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `no horizontal overflow @${w}`).toBeLessThanOrEqual(1);
  }
  if (orig) await page.setViewportSize(orig);
}

test.describe("cap-block block-completion summary (one-shot UI)", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");
  // Restore after EACH test so a "Repeat" clone (same plan name) can't leave a duplicate chip for the next.
  test.afterEach(async () => { await seed.restoreCompletedBlock(); });

  // Fresh login so the app loads with the SEEDED server metadata (active completed plan + its snapshot)
  // — the stored storageState token is pre-seed, and updateUser-based token refreshes don't reliably
  // carry admin-set metadata. A real login returns a token reflecting current server state, so the
  // one-shot's inputs are present on load and it pops (or not) deterministically.
  async function activate(page) {
    await page.goto("/");
    await page.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (/supabase|sb-/i.test(k)) localStorage.removeItem(k); } catch (e) { /* noop */ } });
    await page.goto("/");
    await page.getByPlaceholder("you@example.com").fill(process.env.TEST_EMAIL || "");
    await page.getByPlaceholder("Your password").fill(process.env.TEST_PASSWORD || "");
    await page.getByRole("button", { name: /sign in/i }).click();
  }

  test("≥60% block pops: mostImproved is the dominant HERO, supporting stats present, four next-steps, no overflow", async ({ page }) => {
    await seed.seedBlockSummary({ adherencePct: 0.7, sessionsCompleted: 28, sessionsScheduled: 40, prs: [{ name: "AutoBench", weight: 225 }], mostImproved: { name: "AutoPress", pctGain: 0.2, from: 120, to: 144, fromWeight: 185, toWeight: 205 } });
    await activate(page);
    await expect(page.getByText("PLAN RECAP")).toBeVisible({ timeout: 15000 });
    // HERO = the strength win (a qualifying most-improved), rendered as the dominant element.
    await expect(page.locator('[data-testid="summary-hero"]')).toHaveText("+20%");
    await expect(page.getByText("AutoPress")).toBeVisible();  // hero sub-line = the lift
    await expect(page.getByText("185 → 205 lbs")).toBeVisible();  // weight context: concrete TOP-SET weight, start → end
    // Supporting floor still present & legible (the practical stats, not lost to minimalism).
    await expect(page.getByText("28 of 40")).toBeVisible();
    await expect(page.getByText("1 new PR")).toBeVisible();
    await expect(page.getByText("AutoBench")).toBeVisible();
    for (const b of ["Repeat this plan", "Start from a template", "Build from scratch", "Not now"]) {
      await expect(page.getByRole("button", { name: b })).toBeVisible();
    }
    await assertHeroDominant(page, expect);
    await assertNoOverflow(page, expect);
  });

  test("sub-60% block does NOT pop (adherence gate)", async ({ page }) => {
    await seed.seedBlockSummary({ adherencePct: 0.5 });
    await activate(page); // reload lands on the normal app (Workout tab) when the summary doesn't pop
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 12000 });
    await page.waitForTimeout(2000); // give any (wrong) pop a chance to render
    await expect(page.getByText("PLAN RECAP")).toHaveCount(0);
  });

  test("Not now marks the plan seen (no re-pop on reload); the old inline banner is gone", async ({ page }) => {
    await seed.seedBlockSummary({ adherencePct: 0.7 });
    await activate(page);
    await expect(page.getByText("PLAN RECAP")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/PROGRAM COMPLETE/)).toHaveCount(0); // retired inline banner is gone
    await expect.poll(async () => { const bs = await seed.getBlockSummaries(); return bs && bs[KEY] && bs[KEY].seen ? "seen" : "no"; }, { timeout: 10000 }).toBe("seen");
    await page.goto("/"); // reload → one-shot: does not re-pop
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 12000 });
    await expect(page.getByText("PLAN RECAP")).toHaveCount(0);
  });

  test("Repeat this plan clones a fresh, active plan (new key, today start, fresh exercise ids)", async ({ page }) => {
    await seed.seedBlockSummary({ adherencePct: 0.7 });
    await activate(page);
    await expect(page.getByText("PLAN RECAP")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Repeat this plan" }).click();
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 10000 });

    const today = new Date().toLocaleDateString("en-CA");
    await expect.poll(async () => { const ps = await seed.getPlans(); return ps.some(p => p.plan_key.startsWith("custom_") && p.start_date === today) ? "yes" : "no"; }, { timeout: 12000 }).toBe("yes");
    const plans = await seed.getPlans();
    const clone = plans.find(p => p.plan_key.startsWith("custom_") && p.start_date === today);
    const cloneExIds = (clone.days_json || []).flatMap(d => (d.exercises || []).map(e => e.id));
    expect(cloneExIds.length).toBeGreaterThan(0);                                  // clone carries the copied exercises
    for (const id of cloneExIds) expect(["ace0", "ace1", "ace2", "ace4", "ace5"]).not.toContain(id); // FRESH ids
    expect((await seed.getUserMeta()).active_plan_key).toBe(clone.plan_key);        // the clone is active
    expect((await seed.getBlockSummaries())[KEY].seen).toBe(true);                  // finished block marked seen
  });

  test("no-qualifying-lift block reads NEUTRAL — weeks-complete hero, count in the supporting floor", async ({ page }) => {
    await seed.seedBlockSummary({ adherencePct: 0.65, sessionsCompleted: 26, sessionsScheduled: 40, prs: [], mostImproved: null });
    await activate(page);
    await expect(page.getByText("PLAN RECAP")).toBeVisible({ timeout: 15000 });
    // No qualifying lift → the neutral completion hero ("N weeks complete"); the count is NOT hero'd (it
    // lives quietly in the supporting floor), so a middling block reads calm — not celebratory, not scolding.
    await expect(page.locator('[data-testid="summary-hero"]')).toHaveText("8");
    await expect(page.getByText("WEEKS COMPLETE")).toBeVisible();
    await expect(page.getByText("26 of 40")).toBeVisible();                   // honest count, supporting floor
    await expect(page.getByText("No new PRs this cycle")).toBeVisible();
    await expect(page.getByText("No standout lift this cycle")).toBeVisible();
    await expect(page.getByText(/great|amazing|crushed|behind|nailed|beast|smashed/i)).toHaveCount(0);
    await assertHeroDominant(page, expect);
    await assertNoOverflow(page, expect);
  });
});
