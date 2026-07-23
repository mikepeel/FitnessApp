// Scheduled (non-rest) sessions over a whole plan block — the block analog of weeklyAdherence's
// per-week non-rest count. Loops the day rotation across durationWeeks*7 days, counting
// days[i % days.length].isRest === false. It reuses the SAME position rotation weeklyAdherence uses
// (days[elapsed % days.length]) — there is no second notion of a "scheduled day". Pure.
//
// durationWeeks defaults to 10 (matching App.js's `plan?.durationWeeks || 10`). A plan with no days,
// or an all-rest plan, yields 0. A rotation that doesn't evenly divide durationWeeks*7 is handled
// naturally — each day of the block counts the slot it actually lands on.
export function blockScheduledSessions(plan) {
  const days = (plan && plan.days) || [];
  if (!days.length) return 0;
  const weeks = (plan && plan.durationWeeks) || 10;
  const total = weeks * 7;
  let y = 0;
  for (let i = 0; i < total; i++) {
    const d = days[i % days.length];
    if (d && !d.isRest) y++;
  }
  return y;
}
