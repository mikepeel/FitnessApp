// Exercise display order for a saved History session.
//
// The order a workout was saved in lives in the sets_data blob's key order (written
// in performed/plan order at save time). History must render THAT order verbatim —
// never re-derive it from the current plan, which scrambles sessions for
// duplicate-labeled plan days. Pure and testable.
export function exerciseOrderForSession(session) {
  const sd = session && session.sets;
  if (sd && typeof sd === "object") {
    const keys = Object.keys(sd);
    if (keys.length) return keys;
  }
  // Fallback (no sets_data): unique exercise names in setsArr order — the order the
  // card derived before.
  const seen = new Set();
  const out = [];
  for (const x of (session && session.setsArr) || []) {
    const n = x && x.exName;
    if (n != null && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}
