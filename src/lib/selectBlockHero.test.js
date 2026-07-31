import { selectBlockHero, MEANINGFUL_GAIN } from "./selectBlockHero";

const snap = (o) => ({ durationWeeks: 8, mostImproved: null, ...o });

test("qualifying, meaningfully-positive most-improved -> hero = mostImproved (load-bearing)", () => {
  const h = selectBlockHero(snap({ mostImproved: { name: "Bench Press", pctGain: 0.08 } }));
  expect(h).toEqual({ kind: "mostImproved", name: "Bench Press", pctGain: 0.08 });
});

test("FLUKY/MARGINAL guard: a qualifying-but-below-floor gain does NOT hero the shaky % — falls back to completion", () => {
  // +0.4% passed 2a's session/week gate (non-null) but is below MEANINGFUL_GAIN → not a hero.
  const h = selectBlockHero(snap({ mostImproved: { name: "Curl", pctGain: 0.004 }, durationWeeks: 8 }));
  expect(h).toEqual({ kind: "completion", durationWeeks: 8 });
});

test("floor boundary: exactly at the floor heroes; just below falls back to completion", () => {
  expect(selectBlockHero(snap({ mostImproved: { name: "A", pctGain: MEANINGFUL_GAIN } })).kind).toBe("mostImproved");
  expect(selectBlockHero(snap({ mostImproved: { name: "A", pctGain: MEANINGFUL_GAIN - 0.0001 } })).kind).toBe("completion");
});

test("no qualifying most-improved (null) -> hero = neutral completion (weeks), regardless of adherence/PRs", () => {
  // A strong-adherence, PR-having block with no standout lift still leads with weeks-complete; the count
  // and PRs live in the supporting floor, never the hero.
  const h = selectBlockHero(snap({ mostImproved: null, durationWeeks: 10 }));
  expect(h).toEqual({ kind: "completion", durationWeeks: 10 });
});

test("declining/zero gain (2a returns null) -> completion", () => {
  const h = selectBlockHero(snap({ mostImproved: null, durationWeeks: 6 }));
  expect(h).toEqual({ kind: "completion", durationWeeks: 6 });
});

test("missing durationWeeks -> completion with 0 (caller renders a wordmark fallback)", () => {
  const h = selectBlockHero({ mostImproved: null });
  expect(h).toEqual({ kind: "completion", durationWeeks: 0 });
});
