// "X of Y scheduled sessions this week" + a NON-JUDGMENTAL status, for the Stats Overview adherence
// line. Pure. Reuses the canonical plan-week boundary (planWeekStart) and the done-count window
// (planWeekSessions) — no new week math. The per-date training-day schedule mirrors complianceStreak:
// position-based when the plan has a startDate, else a weekday-name map.
//
// Deliberately non-shaming: a shortfall — even a finished week that fell short — reads as a plain
// count ("4 of 5 this week"), NEVER as "behind" or failure. Only a met target is celebrated.
//
// Returns { done, target, status }:
//   target = non-rest scheduled training days in the CURRENT plan week.
//   done   = completed sessions in the plan week (planWeekSessions — same basis as the "This Week" count).
//   status = "complete" (done >= target) | "on_track" (target > 0, done < target — any shortfall,
//            framed neutrally) | "no_target". No "behind"/"ahead"/"on_pace" — the line never scolds.
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

export function weeklyAdherence(plan, sessions, anchor, now = new Date()) {
  const ws = planWeekStart(anchor, now);
  if (!ws || !plan || !((plan.days || []).length)) return { done: 0, target: 0, status: "no_target" };

  let target = 0;
  for (let i = 0; i < 7; i++) {
    const dt = new Date(ws); dt.setDate(ws.getDate() + i);
    const pd = planDayForDate(plan, dt);
    if (pd && !pd.isRest) target++; // scheduled training day
  }

  const done = planWeekSessions(sessions, anchor, now).length;

  let status;
  if (target === 0) status = "no_target";
  else if (done >= target) status = "complete";
  else status = "on_track"; // any shortfall — including a finished, short week — reads neutral, never "behind"
  return { done, target, status };
}
