import { selectBlockHero, MEANINGFUL_GAIN } from "./selectBlockHero";

const snap = (o) => ({ sessionsCompleted: 20, sessionsScheduled: 40, prsHit: 0, durationWeeks: 8, adherencePct: 0.5, mostImproved: null, ...o });

test("qualifying, meaningfully-positive most-improved -> hero = mostImproved (load-bearing)", () => {
  const h = selectBlockHero(snap({ mostImproved: { name: "Bench Press", pctGain: 0.08 }, adherencePct: 0.75, prsHit: 2 }));
  expect(h).toEqual({ kind: "mostImproved", name: "Bench Press", pctGain: 0.08 });
});

test("FLUKY/MARGINAL guard: a qualifying-but-below-floor gain does NOT hero the shaky % — falls back to consistency", () => {
  // +0.4% passed 2a's session/week gate (non-null) but is below MEANINGFUL_GAIN → not a hero.
  const h = selectBlockHero(snap({ mostImproved: { name: "Curl", pctGain: 0.004 }, adherencePct: 0.8, sessionsCompleted: 32, sessionsScheduled: 40 }));
  expect(h.kind).toBe("consistency");
  expect(h).toEqual({ kind: "consistency", sessionsCompleted: 32, sessionsScheduled: 40 });
});

test("floor boundary: exactly at the floor heroes; just below falls back", () => {
  expect(selectBlockHero(snap({ mostImproved: { name: "A", pctGain: MEANINGFUL_GAIN }, adherencePct: 0.7 })).kind).toBe("mostImproved");
  expect(selectBlockHero(snap({ mostImproved: { name: "A", pctGain: MEANINGFUL_GAIN - 0.0001 }, adherencePct: 0.7 })).kind).toBe("consistency");
});

test("consistency-strong / PR-less block (no most-improved) -> hero = consistency", () => {
  const h = selectBlockHero(snap({ mostImproved: null, adherencePct: 0.9, sessionsCompleted: 18, sessionsScheduled: 20, prsHit: 0 }));
  expect(h).toEqual({ kind: "consistency", sessionsCompleted: 18, sessionsScheduled: 20 });
});

test("bad block (low adherence, 0 PRs, null most-improved) -> hero = neutral completion", () => {
  const h = selectBlockHero(snap({ mostImproved: null, adherencePct: 0.3, sessionsCompleted: 12, sessionsScheduled: 40, prsHit: 0, durationWeeks: 8 }));
  expect(h).toEqual({ kind: "completion", durationWeeks: 8 });
});

test("low adherence but HAS PRs (no qualifying lift) -> consistency, not completion (there is a win to note)", () => {
  const h = selectBlockHero(snap({ mostImproved: null, adherencePct: 0.4, sessionsCompleted: 16, sessionsScheduled: 40, prsHit: 2 }));
  expect(h.kind).toBe("consistency");
});

test("adherence falls back to X/Y when adherencePct is absent", () => {
  const h = selectBlockHero({ mostImproved: null, sessionsCompleted: 5, sessionsScheduled: 40, prsHit: 0, durationWeeks: 6 }); // 5/40 = 0.125 < 0.60
  expect(h).toEqual({ kind: "completion", durationWeeks: 6 });
});
