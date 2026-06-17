import { lifetimePRs } from "./lifetimePRs";

// Replicates the PRE-FIX recalcPRs computation (App.js:3043-3051, pre-fix): max weight per
// exercise across whatever sessions are in scope, with NO warmup filter. This is what ran
// against the *capped* `sessions` window, so feeding it the capped subset reproduces the bug.
const legacyRecalc = (sessions) => {
  const out = {};
  for (const sess of sessions) {
    for (const set of sess.setsArr || []) {
      const w = parseFloat(set.weight) || 0;
      if (w > 0 && (!out[set.exName] || w > out[set.exName].weight)) {
        out[set.exName] = { weight: w, date: sess.completedAt };
      }
    }
  }
  return out;
};
// Flatten sessions → the row shape recalcPRs feeds lifetimePRs (warmup carried for the filter).
const flat = (sessions) =>
  sessions.flatMap((s) => (s.setsArr || []).map((x) => ({ exName: x.exName, weight: x.weight, warmup: x.type === "warmup", date: s.completedAt })));

describe("lifetimePRs — full-history PR source", () => {
  test("CORRUPTION: capped window loses an out-of-window PR; full history preserves it", () => {
    // True all-time Bench PR (300) set long ago; the recent (in-window) best is only 200.
    const oldPR = { completedAt: "2025-01-01", setsArr: [{ exName: "Bench", weight: 300, type: "working" }] };
    const recent = Array.from({ length: 100 }, (_, i) => ({
      completedAt: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`,
      setsArr: [{ exName: "Bench", weight: 200, type: "working" }],
    }));
    const cappedWindow = recent; // what .limit(100) loads — oldPR has dropped off the bottom
    const fullHistory = [oldPR, ...recent];

    // BEFORE (legacy over the capped window): PR lowered to 200 — the corruption.
    expect(legacyRecalc(cappedWindow).Bench.weight).toBe(200);
    // AFTER (full-history source): true 300 preserved.
    expect(lifetimePRs(flat(fullHistory)).Bench.weight).toBe(300);
  });

  test("CORRECTION: removing the PR-setting set recomputes the PR DOWN (no phantom-PR guard)", () => {
    const withPR = [
      { completedAt: "2026-01-01", setsArr: [{ exName: "Squat", weight: 315, type: "working" }] },
      { completedAt: "2026-02-01", setsArr: [{ exName: "Squat", weight: 275, type: "working" }] },
    ];
    expect(lifetimePRs(flat(withPR)).Squat.weight).toBe(315);
    // The 315 session is deleted/edited away → next-best in full history is 275.
    const corrected = withPR.slice(1);
    expect(lifetimePRs(flat(corrected)).Squat.weight).toBe(275); // recomputes DOWN, not held at 315
  });

  test("WARMUP: legacy promotes a heavy warmup; lifetimePRs excludes it (matches flagPRs)", () => {
    const sessions = [
      { completedAt: "2026-03-01", setsArr: [
        { exName: "Press", weight: 185, type: "warmup" },
        { exName: "Press", weight: 135, type: "working" },
      ] },
    ];
    expect(legacyRecalc(sessions).Press.weight).toBe(185); // BUG: warmup counted as a PR
    expect(lifetimePRs(flat(sessions)).Press.weight).toBe(135); // FIXED: warmup excluded
  });

  test("ORPHAN GUARD: an exercise only in out-of-window sessions still appears (won't be orphan-deleted)", () => {
    const fullHistory = [
      { completedAt: "2025-06-01", setsArr: [{ exName: "Old Lift", weight: 100, type: "working" }] },
      ...Array.from({ length: 100 }, () => ({ completedAt: "2026-05-01", setsArr: [{ exName: "Bench", weight: 200, type: "working" }] })),
    ];
    const prs = lifetimePRs(flat(fullHistory));
    expect(prs["Old Lift"]).toBeDefined(); // present in full history → its PR row is kept
    expect(prs["Old Lift"].weight).toBe(100);
  });

  test("ignores weight<=0 and blank exercise names", () => {
    const d = "2026-01-01"; // completed sessions (have a date) so only weight/name filtering is tested
    const prs = lifetimePRs([{ exName: "X", weight: 0, date: d }, { exName: "", weight: 50, date: d }, { exName: "X", weight: 90, date: d }]);
    expect(prs.X.weight).toBe(90);
    expect(prs[""]).toBeUndefined();
  });

  test("COMPLETED-ONLY: a set in a non-completed session (no completed_at) does NOT set a PR; a completed one does", () => {
    // A heavier set logged in a partial/in-progress session (completed_at null → date null)
    // must be ignored; the completed-session set is the PR.
    expect(
      lifetimePRs([
        { exName: "Deadlift", weight: 500, date: null }, // partial session — must be excluded
        { exName: "Deadlift", weight: 405, date: "2026-02-01" }, // completed
      ]).Deadlift.weight
    ).toBe(405);
    // The same 500 set, once its session is completed (has a date), DOES set the PR.
    expect(lifetimePRs([{ exName: "Deadlift", weight: 500, date: "2026-03-01" }]).Deadlift.weight).toBe(500);
  });
});
