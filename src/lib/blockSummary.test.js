import { buildBlockSummary, scheduledEndStr } from "./blockSummary";

// 7-day plan: 5 training, 2 rest → Y = 5 * 8 = 40. start 2026-01-01, 8 weeks → scheduledEnd 2026-02-26.
const T = { isRest: false }, R = { isRest: true };
const PLAN = { key: "P1", name: "Block One", startDate: "2026-01-01", durationWeeks: 8, days: [T, T, T, T, T, R, R] };

// Local-time ISO (no Z) so toLocaleDateString gives the intended date on any TZ.
const sess = (date, partial = false) => ({ completedAt: `${date}T18:00:00`, partial });
const set = (name, sessionId, date, weight, reps) => ({ name, weight, reps, sessionId, date });

// A "Press" lift qualifying in-window (weeks 0/2/5): 100→100→120 @5 → e1RM 116.7→116.7→140 → +20%.
// Plus a POST-END Press session (2026-03-05) that must be excluded.
const SETROWS = [
  set("Press", "p1", "2026-01-05", 100, 5),
  set("Press", "p2", "2026-01-20", 100, 5),
  set("Press", "p3", "2026-02-10", 120, 5),
  set("Press", "p4", "2026-03-05", 300, 5), // post-end — excluded by the window
];
const PRS = {
  Bench: { weight: 225, date: "2026-01-15T18:00:00" }, // in window
  Squat: { weight: 315, date: "2026-03-10T18:00:00" }, // post-end — excluded
  Old: { weight: 135, date: "2025-11-01T18:00:00" },   // pre-start — excluded
};
const SESSIONS = [
  sess("2025-12-20"),        // pre-start — excluded
  sess("2026-01-05"),        // in
  sess("2026-01-20"),        // in
  sess("2026-02-10"),        // in
  sess("2026-02-20", true),  // partial — excluded
  sess("2026-03-05"),        // POST-END — excluded (load-bearing)
];

test("scheduledEndStr = start + durationWeeks*7 days", () => {
  expect(scheduledEndStr(PLAN)).toBe("2026-02-26"); // 2026-01-01 + 56 days
});

test("assembles X, Y, adherence, PRs, mostImproved — window bounded at scheduled-end", () => {
  const s = buildBlockSummary(PLAN, { sessions: SESSIONS, prs: PRS, setRows: SETROWS });
  expect(s.sessionsCompleted).toBe(3);          // Jan5, Jan20, Feb10 — NOT the post-end/partial/pre-start
  expect(s.sessionsScheduled).toBe(40);         // 5 non-rest × 8 weeks
  expect(s.adherencePct).toBeCloseTo(3 / 40, 6);
  expect(s.prsHit).toBe(1);                     // Bench only (Squat post-end, Old pre-start excluded)
  expect(s.prs).toEqual([{ name: "Bench", weight: 225 }]);
  expect(s.mostImproved).not.toBeNull();
  expect(s.mostImproved.name).toBe("Press");
  expect(s.mostImproved.pctGain).toBeCloseTo(0.2, 2); // in-window only; the 300@5 post-end set excluded
  expect(s.planKey).toBe("P1");
  expect(s.scheduledEnd).toBe("2026-02-26");
});

test("LOAD-BEARING: a session AFTER scheduled-end is excluded from X", () => {
  // Mutation-check target: if the window bound were "now" instead of scheduledEnd, the 2026-03-05
  // session (before now) would be wrongly counted → sessionsCompleted would be 4.
  const s = buildBlockSummary(PLAN, { sessions: SESSIONS, prs: PRS, setRows: SETROWS });
  expect(s.sessionsCompleted).toBe(3);
});

test("no start date → null (can't window)", () => {
  expect(buildBlockSummary({ key: "X", name: "n", durationWeeks: 8, days: [T] }, { sessions: SESSIONS })).toBeNull();
});

test("empty block: zero sessions, null mostImproved, still a valid record", () => {
  const s = buildBlockSummary(PLAN, { sessions: [], prs: {}, setRows: [] });
  expect(s.sessionsCompleted).toBe(0);
  expect(s.adherencePct).toBe(0);
  expect(s.prsHit).toBe(0);
  expect(s.mostImproved).toBeNull();
});
