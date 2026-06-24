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

// Local-noon Date for the START of the plan week that contains `now` — the windowing companion
// to planWeekOf, built on the SAME anchor + 7-day blocks (NOT a separate week definition):
// block = floor(days/7) = planWeekOf - 1, so the boundary can never drift from the week label.
// Returns null when there's no start date. `now` injectable for tests.
export const planWeekStart = (startDateStr, now = new Date()) => {
  const days = elapsedDaysSince(startDateStr, now);
  if (days === null) return null;
  const start = parsePlanDate(startDateStr);
  const block = days < 0 ? 0 : Math.floor(days / 7);
  const ws = new Date(start);
  ws.setDate(ws.getDate() + block * 7);
  return ws; // local noon
};

// Sessions completed within the CURRENT plan week — the window for the Stats "This Week" card so
// its count + volume match the plan/History views instead of a Sunday-start calendar week.
// `startDateStr` is the canonical anchor (plan.startDate, else the earliest-completed-session
// program start). Lower-bounded at the plan-week start (matching the card's prior `>=` semantics,
// just re-anchored). Compares LOCAL dates on both sides (session completedAt → local; planWeekStart
// → local noon), so no UTC/midnight drift. Returns [] when there's no anchor.
export const planWeekSessions = (sessions, startDateStr, now = new Date()) => {
  const ws = planWeekStart(startDateStr, now);
  if (!ws) return [];
  const wsStr = ws.toLocaleDateString("en-CA");
  return (sessions || []).filter(
    (s) => s && s.completedAt && new Date(s.completedAt).toLocaleDateString("en-CA") >= wsStr
  );
};
