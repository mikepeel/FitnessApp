// Current plan week, 1-based. `start` is anchored to local noon; the optional
// `now` param exists so tests can inject a fixed instant.
export const planWeekOf = (plan, now = new Date()) => {
  if (!plan?.startDate) return null;
  const start = new Date(plan.startDate + "T12:00:00");
  // Anchor `now` to local noon too, so the day-diff is a whole number of days
  // regardless of the time of day the page is viewed (don't mutate the caller's Date).
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  const days = Math.floor((d - start) / 86400000);
  if (days < 0) return 1;
  return Math.max(1, Math.ceil((days + 1) / 7));
};
