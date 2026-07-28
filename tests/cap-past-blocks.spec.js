// @ts-check
// Commit 2c — the Progress "past blocks" list. Fixture: a non-completed active plan (so the one-shot
// never pops) + three stored blockSummaries of varied adherence — AutoTest Hist Plan (75%), Low Block
// (40% — never popped), Old Block (90%). The list must show ALL of them, most-recent first; tapping a
// row opens the BlockSummary as an inert history detail (no seen change). Fresh login per test so the
// app loads with the seeded metadata deterministically.
const { test, expect } = require("@playwright/test");
const seed = require("./seedHistory");

const HIST = "AutoTest-Hist", LOW = "AutoTest-HistLow";

test.describe("cap-past-blocks Progress past-blocks list", () => {
  test.skip(!seed.hasKey(), "needs SUPABASE_SERVICE_KEY");
  test.afterEach(async () => { await seed.restorePastBlocks(); });

  async function freshLogin(page) {
    await page.goto("/");
    await page.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (/supabase|sb-/i.test(k)) localStorage.removeItem(k); } catch (e) { /* noop */ } });
    await page.goto("/");
    await page.getByPlaceholder("you@example.com").fill(process.env.TEST_EMAIL || "");
    await page.getByPlaceholder("Your password").fill(process.env.TEST_PASSWORD || "");
    await page.getByRole("button", { name: /sign in/i }).click();
  }
  async function openProgress(page) {
    await freshLogin(page);
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 15000 }); // logged in, no one-shot
    await expect(page.getByText(/ActiveDay/).first()).toBeVisible({ timeout: 10000 }); // plans finished loading (active plan's day rendered)
    await page.getByRole("button", { name: /^Stats$/i }).click();
    await page.getByRole("button", { name: /^Progress$/i }).click();
    await expect(page.getByText("Past Blocks")).toBeVisible({ timeout: 10000 });
  }

  test("lists ALL completed plans (incl. the sub-60% one), most-recent first, with headline stats", async ({ page }) => {
    await seed.seedPastBlocks();
    await openProgress(page);
    await expect(page.getByRole("button", { name: /AutoTest Hist Plan/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Low Block/ })).toBeVisible();   // LOAD-BEARING: sub-60% IS listed
    await expect(page.getByRole("button", { name: /Old Block/ })).toBeVisible();
    await expect(page.getByText(/16 of 40/)).toBeVisible();                         // Low Block headline stat
    const yHist = (await page.getByRole("button", { name: /AutoTest Hist Plan/ }).boundingBox()).y;
    const yLow = (await page.getByRole("button", { name: /Low Block/ }).boundingBox()).y;
    const yOld = (await page.getByRole("button", { name: /Old Block/ }).boundingBox()).y;
    expect(yHist).toBeLessThan(yLow); // 80d ago
    expect(yLow).toBeLessThan(yOld);  // 120d < 200d ago
  });

  test("tapping a block opens the history detail (Repeat + Back) and does NOT alter seen", async ({ page }) => {
    await seed.seedPastBlocks();
    await openProgress(page);
    await page.getByRole("button", { name: /Low Block/ }).click();
    await expect(page.getByText("BLOCK COMPLETE")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/16 of 40/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Repeat this block" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Not now" })).toHaveCount(0);            // not the one-shot four-way
    await expect(page.getByRole("button", { name: "Start from a template" })).toHaveCount(0);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Past Blocks")).toBeVisible({ timeout: 8000 });
    expect((await seed.getBlockSummaries())[LOW].seen).toBe(false);                        // seen untouched
  });

  test("empty state when there are no completed blocks", async ({ page }) => {
    await seed.seedPastBlocks({ empty: true });
    await openProgress(page);
    await expect(page.getByText("Your completed plans will appear here.")).toBeVisible();
  });

  test("Repeat from history clones a fresh, active plan (fresh ids) without altering seen", async ({ page }) => {
    await seed.seedPastBlocks();
    await openProgress(page);
    await page.getByRole("button", { name: /AutoTest Hist Plan/ }).click(); // the block whose plan row exists
    await expect(page.getByText("BLOCK COMPLETE")).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: "Repeat this block" }).click();
    await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 10000 });
    const today = new Date().toLocaleDateString("en-CA");
    await expect.poll(async () => { const ps = await seed.getPlans(); return ps.some(p => p.plan_key.startsWith("custom_") && p.start_date === today) ? "yes" : "no"; }, { timeout: 12000 }).toBe("yes");
    const plans = await seed.getPlans();
    const clone = plans.find(p => p.plan_key.startsWith("custom_") && p.start_date === today);
    const cloneExIds = (clone.days_json || []).flatMap(d => (d.exercises || []).map(e => e.id));
    expect(cloneExIds.length).toBeGreaterThan(0);
    for (const id of cloneExIds) expect(["he0", "he1"]).not.toContain(id);       // FRESH ids
    expect((await seed.getUserMeta()).active_plan_key).toBe(clone.plan_key);      // clone is active
    expect((await seed.getBlockSummaries())[HIST].seen).toBe(false);             // history Repeat did NOT mark seen
  });
});
