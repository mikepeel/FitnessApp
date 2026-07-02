// Recency-aware RANKING for lift/PR surfaces — demote dormant lifts, never hide them. Pure.
//
// A "dormant" lift is one not trained within DORMANT_DAYS (the same 21-day idea as the plateau gate
// in plateaus.js, but softer: here a dormant lift is DEMOTED, not removed — every lift/PR still
// appears in the ordered output). Last-trained comes from the already-loaded sessions (no new fetch).
export const DORMANT_DAYS = 21;

const toDay = (d) => new Date(d + "T12:00:00").getTime(); // local noon → DST-safe whole-day diff

// { [exName]: lastTrainedLocalDate "YYYY-MM-DD" } — max completedAt per lift, from in-memory sessions.
export function lastTrainedMap(sessions) {
  const m = {};
  for (const s of sessions || []) {
    if (!s || !s.completedAt) continue;
    const d = new Date(s.completedAt).toLocaleDateString("en-CA");
    for (const x of s.setsArr || []) {
      if (!x || !x.exName) continue;
      if (!m[x.exName] || d > m[x.exName]) m[x.exName] = d;
    }
  }
  return m;
}

// Whole days since a lift was last trained; unknown (never in the loaded sessions) → Infinity (treated
// as the most dormant, so it sinks last but still appears).
export function daysIdle(name, ltMap, now = new Date()) {
  const d = ltMap && ltMap[name];
  if (!d) return Infinity;
  const n = new Date(now); n.setHours(12, 0, 0, 0);
  return Math.round((n.getTime() - toDay(d)) / 86400000);
}

// All-Lifts list ordering: RECENT-FIRST (fewest days idle first), alphabetical tiebreak. Every name is
// returned — dormant lifts simply sink to the bottom. Chosen UX: a scannable "what you're training now"
// order; the drill-down picker stays alphabetical for findability.
export function orderByRecency(names, ltMap, now = new Date()) {
  return [...(names || [])].sort((a, b) => {
    const ia = daysIdle(a, ltMap, now), ib = daysIdle(b, ltMap, now);
    if (ia !== ib) return ia - ib; // fewer days idle → nearer the top
    return String(a).localeCompare(String(b));
  });
}

// PR board ordering: ACTIVE lifts (idle <= DORMANT_DAYS) before DORMANT ones, heaviest-first WITHIN
// each tier, name tiebreak. A stale heavy record no longer headlines over recent work, but every PR
// stays in the ordered list (the board renders the top of it). entries: [[name, { weight }], …].
export function orderPRsByRecency(entries, ltMap, now = new Date()) {
  const isDormant = (n) => daysIdle(n, ltMap, now) > DORMANT_DAYS;
  return [...(entries || [])].sort((a, b) => {
    const da = isDormant(a[0]), db = isDormant(b[0]);
    if (da !== db) return da ? 1 : -1;                 // active tier first
    const wa = (a[1] && a[1].weight) || 0, wb = (b[1] && b[1].weight) || 0;
    if (wa !== wb) return wb - wa;                      // heavier first within the tier
    return String(a[0]).localeCompare(String(b[0]));
  });
}
