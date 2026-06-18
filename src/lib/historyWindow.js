// Windowing for the History list. Date basis is COALESCE(completedAt, startedAt) so
// in-progress / partial sessions (completedAt null) are included — History is the one view
// that shows them. filter: "1m" | "3m" | "6m" (trailing days) | "all" (no cutoff). Returns
// rows with completedAt coalesced (so downstream month-grouping never sees null), newest
// first. `now` is injectable for tests. Pure — the same predicate the DB fetch uses
// server-side, so the fetched window and the rendered window agree.
const DAYS = { "1m": 30, "3m": 90, "6m": 180 };

export function historyWindow(rows, filter, now = Date.now()) {
  const days = DAYS[filter];
  const cutoff = days ? now - days * 86400000 : null;
  return (rows || [])
    .filter((s) => s && (s.completedAt || s.startedAt))
    .map((s) => ({ ...s, completedAt: s.completedAt || s.startedAt }))
    .filter((s) => cutoff == null || new Date(s.completedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}
