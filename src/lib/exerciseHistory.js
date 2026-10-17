// Per-session history for ONE exercise, for the in-workout "History & progress" sheet (pure, testable).
//
// sessions: app session objects { id|supabaseId, completedAt (ISO), setsArr: [{ exName, setNum, weight, reps,
//   minutes, type }] }. names: every name this exercise has been logged under (current name + aliases).
// Working sets only (warmups excluded). Unlike liftSessionsFromSets, zero-weight sets are KEPT so
// bodyweight / timed-hold history works.
//
// Each session row: { sessionId, completedAt, groups, top, change } NEWEST FIRST, where
//   groups  = consecutive identical sets collapsed: [{ count, weight, reps, minutes }]
//   top     = the session's best set — heaviest weight, ties broken by most reps (bodyweight: most reps;
//             cardio: total minutes in `minutes`)
//   change  = vs the previous (older) session's top: { kind: "first" | "up" | "down" | "same", what, delta }
//             what = "weight" | "reps" | "minutes" (which number moved)
// Returns { rows, lastIncrease } — lastIncrease is the newest row whose change.kind === "up" (or null).
export function exerciseHistory(sessions, names, { limit = 8, cardio = false } = {}) {
  const want = new Set((names || []).filter(Boolean).map((n) => String(n).toLowerCase()));
  const rows = [];
  for (const s of sessions || []) {
    if (!s || !s.completedAt) continue;
    const sets = (s.setsArr || [])
      .filter((x) => x && want.has(String(x.exName || "").toLowerCase()) && x.type !== "warmup")
      .map((x) => ({ setNum: parseInt(x.setNum, 10) || 0, weight: parseFloat(x.weight) || 0, reps: parseInt(x.reps, 10) || 0, minutes: parseFloat(x.minutes) || 0 }))
      .filter((x) => (cardio ? x.minutes > 0 : x.reps > 0 || x.weight > 0));
    if (!sets.length) continue;
    sets.sort((a, b) => a.setNum - b.setNum);
    const groups = [];
    for (const x of sets) {
      const g = groups[groups.length - 1];
      if (g && g.weight === x.weight && g.reps === x.reps && g.minutes === x.minutes) g.count++;
      else groups.push({ count: 1, weight: x.weight, reps: x.reps, minutes: x.minutes });
    }
    let top;
    if (cardio) top = { weight: 0, reps: 0, minutes: sets.reduce((a, x) => a + x.minutes, 0) };
    else top = sets.reduce((b, x) => (x.weight > b.weight || (x.weight === b.weight && x.reps > b.reps) ? x : b), sets[0]);
    rows.push({ sessionId: s.supabaseId || s.id || s.completedAt, completedAt: s.completedAt, groups, top: { weight: top.weight, reps: top.reps, minutes: top.minutes } });
  }
  rows.sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : String(a.sessionId).localeCompare(String(b.sessionId))));
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i].top, prev = rows[i + 1] && rows[i + 1].top;
    rows[i].change = compareTop(cur, prev, cardio);
  }
  const lastIncrease = rows.find((r) => r.change.kind === "up") || null;
  return { rows: rows.slice(0, limit), lastIncrease, total: rows.length };
}

function compareTop(cur, prev, cardio) {
  if (!prev) return { kind: "first", what: null, delta: 0 };
  const round = (v) => Math.round(v * 10) / 10;
  if (cardio) {
    const d = round(cur.minutes - prev.minutes);
    return { kind: d > 0 ? "up" : d < 0 ? "down" : "same", what: "minutes", delta: d };
  }
  if (cur.weight !== prev.weight) {
    const d = round(cur.weight - prev.weight);
    return { kind: d > 0 ? "up" : "down", what: "weight", delta: d };
  }
  const d = cur.reps - prev.reps;
  return { kind: d > 0 ? "up" : d < 0 ? "down" : "same", what: "reps", delta: d };
}
