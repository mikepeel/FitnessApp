// Exercise display order for a saved History session.
//
// PRIMARY (correct by design): workout_sessions.exercise_order — a jsonb ARRAY, and jsonb preserves
// array element order. It is the snapshot of the PLAN's order taken at save time (finish() sorts the
// logged exercises by the plan day's order before writing). Plan order is the source of truth, so
// History showing it is intended, not a bug.
//
// FALLBACK (when exercise_order is absent — ~45 legacy sessions): there is effectively ONE source,
// sets_data, and its order is ARBITRARY. Postgres jsonb normalizes object keys by length-then-bytewise
// (verified: 6/6 sampled sessions came back exactly so), so Object.keys(sets_data) is never performed
// order. setsArr is NOT a second opinion — sessionMap.js builds it FROM sets_data via Object.entries,
// so uniqueNames(setsArr) is the same list (verified identical on 8/8 real NULL-order sessions). The
// order of the two branches below therefore cannot change any output; it is not a preference.
//
// For those sessions the true order is UNRECOVERABLE: logged_sets has uuid PKs and one batched
// created_at, and set_number only orders sets WITHIN an exercise. Nothing better exists to fall back to.
//
// Do NOT "fix" this by re-deriving order from the current plan: that fabricates history, and the plan
// itself was being silently corrupted (markExerciseDone/persistToPlan, fixed in 2aebfe6) when those
// rows were written. Pure and testable.
function uniqueNames(setsArr) {
  const seen = new Set();
  const out = [];
  for (const x of setsArr || []) {
    const n = x && x.exName;
    if (n != null && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

export function exerciseOrderForSession(session) {
  // Exercises actually present in the session (membership, any order).
  const sd = session && session.sets;
  const present = (sd && typeof sd === "object" && Object.keys(sd).length)
    ? Object.keys(sd)
    : uniqueNames(session && session.setsArr);
  // Explicit saved order wins: keep it (minus exercises since removed), then append
  // any present exercise it doesn't list (e.g. added after the order was recorded).
  const explicit = session && session.exerciseOrder;
  if (Array.isArray(explicit) && explicit.length) {
    const presentSet = new Set(present);
    const seen = new Set();
    const out = [];
    for (const n of explicit) if (presentSet.has(n) && !seen.has(n)) { seen.add(n); out.push(n); }
    for (const n of present) if (!seen.has(n)) { seen.add(n); out.push(n); }
    if (out.length) return out;
  }
  return present;
}
