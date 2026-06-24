// Per-SESSION work log for ONE exercise, sets compressed (pure, testable). Complements
// liftSeriesFromSets (which collapses to a per-day max for the charts) — this preserves the
// reps/sets the charts drop, so progressive overload reads at a glance (3×6 → 3×7 → 3×8).
//
// Input rows (one exercise, WORKING sets only — caller excludes warmups): each
//   { sessionId, setNumber, weight, reps, date, completedAt }
// where `date` is a local "YYYY-MM-DD" for display and `completedAt` is the session's ISO
// timestamp for ordering. Groups rows by session; within a session orders by setNumber and
// collapses CONSECUTIVE identical (reps, weight) sets into one group { count, reps, weight }
// (a change starts a new group — 8,8,6 → [2×8, 1×6]; 8,6,8 → [1×8, 1×6, 1×8]). Returns one row
// per session { sessionId, date, completedAt, groups }, NEWEST FIRST (deterministic tie-break
// by sessionId so the order is stable). Zero/negative-weight sets are skipped.
export function liftSessionsFromSets(rows) {
  const bySession = {};
  for (const r of rows || []) {
    const w = parseFloat(r && r.weight) || 0;
    if (w <= 0) continue;
    const sid = r.sessionId;
    if (sid == null) continue;
    if (!bySession[sid]) bySession[sid] = { sessionId: sid, date: r.date || null, completedAt: r.completedAt || "", sets: [] };
    bySession[sid].sets.push({ setNumber: parseInt(r.setNumber, 10) || 0, weight: w, reps: parseInt(r.reps, 10) || 0 });
  }
  const out = Object.values(bySession).map((s) => {
    s.sets.sort((a, b) => a.setNumber - b.setNumber); // performed order
    const groups = [];
    for (const x of s.sets) {
      const last = groups[groups.length - 1];
      if (last && last.reps === x.reps && last.weight === x.weight) last.count++;
      else groups.push({ count: 1, reps: x.reps, weight: x.weight });
    }
    return { sessionId: s.sessionId, date: s.date, completedAt: s.completedAt, groups };
  });
  out.sort((a, b) => {
    if (a.completedAt !== b.completedAt) return a.completedAt < b.completedAt ? 1 : -1; // newest first
    return String(a.sessionId).localeCompare(String(b.sessionId)); // deterministic tie-break
  });
  return out;
}
