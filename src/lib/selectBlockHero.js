// Adaptive "honest hero" for the Plan Summary: pick WHICH stat leads, chosen to be the strongest TRUE
// story for the block. Pure DISPLAY RULE over the frozen 2a snapshot — no new computation. Two states:
//   1. a qualifying, meaningfully-positive most-improved lift  -> the concrete strength win
//   2. else                                                    -> neutral "N weeks complete" (dignified)
// It never crowns a shaky number: the fluky-low-start case is already filtered upstream (2a's
// mostImprovedInBlock gates >=3 sessions/>=3 weeks and smooths best-of-first-2 -> best-of-last-2), and
// MEANINGFUL_GAIN adds a magnitude floor so a technically-qualifying but marginal gain falls back to the
// neutral completion hero rather than getting hero'd. The session count and any PRs are never hero'd —
// they always live in the supporting floor, so a poor block reads calm, never a manufactured flex.
//
// MEANINGFUL_GAIN floor rationale: Epley e1RM is sensitive to rep-count, so session-to-session e1RM noise
// is roughly 2-4%. A 3% floor keeps the heroed gain a real trend, not noise — and since 2a already filters
// evidence (sessions/weeks) and smooths the start, this is only the magnitude bar (e.g. +0.4% -> not a hero).
export const MEANINGFUL_GAIN = 0.03;

export function selectBlockHero(snapshot) {
  const s = snapshot || {};
  const mi = s.mostImproved;
  const durationWeeks = Number(s.durationWeeks) || 0;

  // 1. a genuine, meaningfully-positive most-improved lift leads (the concrete strength win)
  if (mi && typeof mi.pctGain === "number" && mi.pctGain >= MEANINGFUL_GAIN) {
    return { kind: "mostImproved", name: mi.name, pctGain: mi.pctGain };
  }
  // 2. otherwise, the neutral completion hero ("N weeks complete") — never a shaky low count or a fake flex
  return { kind: "completion", durationWeeks };
}
