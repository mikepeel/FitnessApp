// Lifetime personal-record computation from FULL set history (pure, testable).
//
// Input: an array of sets, each { exName, weight, date, warmup? } where `date` is the set's
// session completed_at. Returns { [exName]: { weight, date } } — the heaviest non-warmup,
// positive-weight set from a COMPLETED session per exercise, and the date it was achieved.
// Mirrors flagPRs's filter (skip warmup & weight<=0) and the completed-session standard
// (a set with no completed_at date is from a partial/in-progress session — not a lifetime PR).
//
// This is the CURRENT full-history max with NO "never-lower" guard on purpose: if the set
// that established a PR is later deleted or edited down, the PR recomputes downward to the
// next-best set still in history — the intended "PRs track current logged history" behavior.
// The corruption being fixed comes from computing this over a CAPPED window; feeding it full
// history (the recalcPRs caller's job) is what makes it correct.
export function lifetimePRs(sets) {
  const out = {};
  for (const s of sets || []) {
    if (!s || s.warmup) continue;
    if (!s.date) continue; // completed sessions only: no completed_at ⇒ partial/in-progress
    const ex = s.exName;
    if (ex == null || ex === "") continue;
    const w = parseFloat(s.weight) || 0;
    if (w <= 0) continue;
    const cur = out[ex];
    if (!cur || w > cur.weight) out[ex] = { weight: w, date: s.date || null };
  }
  return out;
}
