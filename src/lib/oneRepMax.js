// Epley one-rep-max estimate: weight * (1 + reps/30).
// Returns an UNROUNDED number; callers round for display.
export const estimate1RM = (weight, reps) => {
  const w = parseFloat(weight) || 0;
  if (w <= 0) return 0;
  let r = parseInt(reps, 10);
  if (!Number.isFinite(r) || r < 1) r = 1; // missing/<1 reps → treat as a single rep
  if (r > 12) r = 12; // cap: Epley degrades at high rep counts
  return w * (1 + r / 30);
};
