// Select the N most-recently-achieved personal records, newest first.
// Input: a prs map { [exName]: { weight, date } } where `date` is the PR's achieved_at.
// Returns [[exName, pr], …] sorted by date descending (undated PRs sort last), capped at n,
// with a deterministic name tie-break. Pure. Replaces the old Object.entries(prs).slice(0,8),
// which returned an arbitrary insertion-order first-8.
export function recentPRs(prs, n = 8) {
  return Object.entries(prs || {})
    .sort((a, b) => {
      const da = (a[1] && a[1].date) || "";
      const db = (b[1] && b[1].date) || "";
      if (da !== db) return da < db ? 1 : -1; // later ISO date first
      return a[0].localeCompare(b[0]); // deterministic tie-break (incl. undated)
    })
    .slice(0, n);
}
