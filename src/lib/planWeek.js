// Shared plan-date math. Single source of truth for "elapsed days since a plan
// start" so the week label and the day rotation can't drift apart again.

// Parse a "YYYY-MM-DD" plan date as LOCAL noon (avoids UTC-midnight day shifts).
// Returns null for a missing/empty date.
export const parsePlanDate = (dateStr) =>
  dateStr ? new Date(dateStr + "T12:00:00") : null;

// Whole local days elapsed since a plan's start date. `now` is normalized to
// local noon on a COPY (the start is already noon-anchored) so the diff is a
// clean day count regardless of the time of day the page is viewed.
// Returns null when there's no start date. `now` is injectable for tests.
export const elapsedDaysSince = (startDateStr, now = new Date()) => {
  const start = parsePlanDate(startDateStr);
  if (!start) return null;
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  return Math.floor((d - start) / 86400000);
};

// Current plan week, 1-based. `now` is injectable for tests.
export const planWeekOf = (plan, now = new Date()) => {
  const days = elapsedDaysSince(plan?.startDate, now);
  if (days === null) return null;
  if (days < 0) return 1;
  return Math.max(1, Math.ceil((days + 1) / 7));
};

// Program week (1-based) from a bare start-date string — same math as planWeekOf, but
// anchored on a date (e.g. the user's earliest COMPLETED session) rather than a plan object.
// Used for the program-week fallback when a plan has no start_date, so the anchor can come
// from a full-history query instead of the capped sessions array. `now` injectable for tests.
export const programWeekFromDate = (startDateStr, now = new Date()) => {
  const days = elapsedDaysSince(startDateStr, now);
  if (days === null) return null;
  if (days < 0) return 1;
  return Math.max(1, Math.ceil((days + 1) / 7));
};
