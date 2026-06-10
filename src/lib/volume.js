// Training volume = Σ (weight × reps) over non-warmup sets — mirrors the existing
// StatsTab volume math exactly (warmups excluded).
export const sessionVolume = (session) =>
  (session?.setsArr || [])
    .filter((x) => x.type !== "warmup")
    .reduce((b, x) => b + (parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0), 0);

// Rolling 28-day volume windows, anchored at local noon today (stable through a
// partial calendar month). Half-open windows:
//   current  = completedAt in (now-28d, now]
//   previous = completedAt in (now-56d, now-28d]
// `now` is injectable for tests.
export const rollingVolume = (sessions, now = new Date()) => {
  const noon = new Date(now);
  noon.setHours(12, 0, 0, 0);
  const end = noon.getTime();
  const day = 86400000;
  const cut28 = end - 28 * day;
  const cut56 = end - 56 * day;
  let current = 0;
  let previous = 0;
  (sessions || []).forEach((s) => {
    if (!s.completedAt) return;
    const t = new Date(s.completedAt).getTime();
    if (t > cut28 && t <= end) current += sessionVolume(s);
    else if (t > cut56 && t <= cut28) previous += sessionVolume(s);
  });
  return { current, previous };
};
