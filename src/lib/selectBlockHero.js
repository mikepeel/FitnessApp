// Adaptive "honest hero" for the Block Summary: pick WHICH stat leads, chosen to be the strongest TRUE
// story for the block. Pure DISPLAY RULE over the frozen 2a snapshot — no new computation. Priority:
//   1. a qualifying, meaningfully-positive most-improved lift  -> the concrete strength win
//   2. else                                                    -> consistency ("X of Y sessions")
//   3. else a bad block (low adherence AND no PRs AND no lift) -> neutral completion (no manufactured flex)
// It never crowns a shaky number: the fluky-low-start case is already filtered upstream (2a's
// mostImprovedInBlock gates >=3 sessions/>=3 weeks and smooths best-of-first-2 -> best-of-last-2), and
// MEANINGFUL_GAIN adds a magnitude floor so a technically-qualifying but marginal gain falls back to
// consistency rather than getting hero'd.
//
// MEANINGFUL_GAIN floor rationale: Epley e1RM is sensitive to rep-count, so session-to-session e1RM noise
// is roughly 2-4%. A 3% floor keeps the heroed gain a real trend, not noise — and since 2a already filters
// evidence (sessions/weeks) and smooths the start, this is only the magnitude bar (e.g. +0.4% -> not a hero).
export const MEANINGFUL_GAIN = 0.03;
// Same bar as the one-shot pop: below it, with no PRs and no qualifying lift, there's simply no flex to lead
// with, so we lead with neutral completion instead of a low "X of Y".
export const LOW_ADHERENCE = 0.60;

export function selectBlockHero(snapshot) {
  const s = snapshot || {};
  const mi = s.mostImproved;
  const X = Number(s.sessionsCompleted) || 0;
  const Y = Number(s.sessionsScheduled) || 0;
  const prsHit = Number(s.prsHit) || 0;
  const durationWeeks = Number(s.durationWeeks) || 0;
  const adherencePct = typeof s.adherencePct === "number" ? s.adherencePct : (Y > 0 ? X / Y : 0);

  // 1. a genuine, meaningfully-positive most-improved lift
  if (mi && typeof mi.pctGain === "number" && mi.pctGain >= MEANINGFUL_GAIN) {
    return { kind: "mostImproved", name: mi.name, pctGain: mi.pctGain };
  }
  // 3. bad block — low adherence AND no PRs (no qualifying lift already established above)
  if (adherencePct < LOW_ADHERENCE && prsHit === 0) {
    return { kind: "completion", durationWeeks };
  }
  // 2. consistency is the honest lead otherwise
  return { kind: "consistency", sessionsCompleted: X, sessionsScheduled: Y };
}
