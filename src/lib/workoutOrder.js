// Display order for the in-workout exercise list. PURE, and — load-bearing — NON-MUTATING.
//
// The workout screen shows: in-progress first, untouched next, completed last (the "done pile",
// kept in completion order). That grouping is DERIVED here at render time from completedIds /
// loggedSets — it is never baked into the underlying exercises array.
//
// Why that matters: the plan day's authored exercise order is the source of truth, and the
// mid-workout add/swap/delete/edit paths write back to plans.days_json from that same array. If the
// display grouping were applied to the array itself (it used to be), any of those writes would
// silently persist the completion shuffle into the plan — reordering a user's plan day when they
// reordered nothing. Deriving the order instead of mutating keeps the authored order intact.
//
// completedIds is an ORDERED id list (the completedExIds Set, spread) — its position doubles as the
// completion sequence, which keeps the done pile in the order the user actually finished exercises.

// Rank: 0 = in progress (has a real logged set), 1 = untouched, 2 = completed (done pile).
function rankOf(ex, doneSeq, loggedSets) {
  if (doneSeq.has(ex.id)) return 2;
  const ml = loggedSets[ex.name] || {};
  const isCardio = ex.muscle === "Cardio" || ex.muscle === "Recovery";
  const started = isCardio
    ? !!(ml[1]?.minutes && !ml[1]?.prepop)
    : Object.values(ml).some((v) => (v.weight || v.reps) && !v.prepop);
  return started ? 0 : 1;
}

export function workoutDisplayOrder(exercises, opts = {}) {
  const { completedIds = [], loggedSets = {}, lastActive = null } = opts;
  const doneSeq = new Map((completedIds || []).map((id, i) => [id, i]));
  // Copy first: the caller's array is the authored order and must never be reordered in place.
  return [...(exercises || [])].sort((a, b) => {
    const ra = rankOf(a, doneSeq, loggedSets), rb = rankOf(b, doneSeq, loggedSets);
    if (ra !== rb) return ra - rb;
    // Done pile keeps completion order (not authored order) — matches the pre-existing UX.
    if (ra === 2) return (doneSeq.get(a.id) ?? 0) - (doneSeq.get(b.id) ?? 0);
    // Among in-progress, the last active exercise floats to the top.
    if (ra === 0) { if (a.name === lastActive) return -1; if (b.name === lastActive) return 1; }
    return 0;
  });
}
