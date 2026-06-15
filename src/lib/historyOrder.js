// Exercise display order for a saved History session.
//
// Order is persisted explicitly in workout_sessions.exercise_order (a jsonb ARRAY —
// jsonb preserves array element order, unlike object keys, which it normalizes by
// length/bytewise). Prefer that array; fall back to sets_data key order, then to
// unique setsArr order. Never re-derive from the plan. Pure and testable.
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
