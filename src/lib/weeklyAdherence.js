// "X of Y scheduled sessions this week" + a PROGRESS-AWARE status, for the Stats Overview adherence
// line. Pure. Reuses the canonical plan-week boundary (planWeekStart) and the done-count window
// (planWeekSessions) — no new week math. The per-date training-day schedule mirrors complianceStreak:
// position-based when the plan has a startDate, else a weekday-name map.
//
// Returns { done, target, status }:
//   target = non-rest scheduled training days in the CURRENT plan week.
//   done   = completed sessions in the plan week (planWeekSessions — same basis as the "This Week" count).
//   status = "complete" | "ahead" | "on_pace" | "behind" | "no_target".
// PROGRESS-AWARE (anti-shame): "behind" fires ONLY when the target is no longer REACHABLE
// (done + remaining training days, today inclusive, < target). An early-week shortfall while the
// remaining days could still reach target is "on_pace" — never "behind".
import { planWeekStart, elapsedDaysSince, planWeekSessions } from "./planWeek";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The plan day scheduled for local-date `d` (a Date) — mirrors complianceStreak: position-based
// rotation when the plan has a startDate, else a weekday-name map. Returns the day object or null.
function planDayForDate(plan, d) {
  const days = (plan && plan.days) || [];
  if (!days.length) return null;
  if (plan.startDate) {
    const elapsed = elapsedDaysSince(plan.startDate, d);
    if (elapsed == null || elapsed < 0) return null;
    return days[elapsed % days.length];
  }
  const name = DOW[d.getDay()];
  const map = {};
  for (const pd of days) if (pd && pd.name) map[pd.name] = pd;
  return map[name] || null;
}

export function weeklyAdherence(plan, sessions, anchor, now = new Date(), opts = {}) {
  const localDay = opts.localDay || ((d) => new Date(d).toLocaleDateString("en-CA"));
  const ws = planWeekStart(anchor, now);
  if (!ws || !plan || !((plan.days || []).length)) return { done: 0, target: 0, status: "no_target" };
  const today = localDay(now);

  let target = 0, expectedByNow = 0, remaining = 0;
  for (let i = 0; i < 7; i++) {
    const dt = new Date(ws); dt.setDate(ws.getDate() + i);
    const pd = planDayForDate(plan, dt);
    if (!pd || pd.isRest) continue; // not a scheduled training day
    target++;
    const ds = localDay(dt);
    if (ds <= today) expectedByNow++;   // training days due so far this week
    if (ds >= today) remaining++;       // still trainable (today inclusive) — conservative
  }

  const done = planWeekSessions(sessions, anchor, now).length;

  let status;
  if (target === 0) status = "no_target";
  else if (done >= target) status = "complete";
  else if (done + remaining < target) status = "behind"; // unreachable even if every remaining day is trained
  else if (done > expectedByNow) status = "ahead";
  else status = "on_pace";              // reachable / in progress — never shame an early-week shortfall
  return { done, target, status };
}
