// Longest run of CONSECUTIVE calendar weeks each containing >=1 completed workout — a
// plan-AGNOSTIC consistency stat (distinct from the plan-compliance current streak). Week boundary
// is fixed MONDAY (ISO-week), independent of the orphaned start_day column. Pure + deterministic.
//
// Input: completedDates = local "YYYY-MM-DD" strings (caller converts completed_at via the same
// local-date basis as current streak's toLD, and excludes partials BEFORE calling — same
// "completed non-partial" basis). Multiple dates in one week collapse to that one week. Returns the
// max run length (NOT the latest run); a gap week breaks a run. Empty/none → 0.
//
// Monday-week index, timezone-free (buckets pure calendar dates, no double-TZ): for "YYYY-MM-DD",
// epochDay = UTC-days for that Y/M/D; 1970-01-05 was a Monday (epochDay 4), so the Monday-aligned
// week index is floor((epochDay - 4) / 7). Two dates straddling a Monday → different indices;
// within one Mon–Sun week → same index.
export function longestWeeklyStreak(completedDates) {
  const weeks = new Set();
  for (const d of completedDates || []) {
    const m = typeof d === "string" && d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) continue;
    const epochDay = Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
    weeks.add(Math.floor((epochDay - 4) / 7));
  }
  if (!weeks.size) return 0;
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) { run++; if (run > best) best = run; }
    else run = 1;
  }
  return best;
}
