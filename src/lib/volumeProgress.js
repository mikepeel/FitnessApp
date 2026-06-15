// Volume × progress coupling (pure). Enriches a flagged muscle's volume status with the
// user's OWN strength trend on that muscle's primary lifts — conservatively. No trend math
// here: the per-lift trend is injected (projectExercise's status string), so this stays
// fully testable and never reimplements the projection engine.
import { muscleContributions } from "./muscleVolume";

// Working-set counts per lift where driverMuscle is a PRIMARY mover (factor >= 1.0), from
// the given (already 28-day-windowed) sessions. Cardio/rest/warmup don't count.
function primaryLiftVolumes(driverMuscle, sessions) {
  const vol = {};
  for (const s of sessions || []) {
    for (const x of (s && s.setsArr) || []) {
      if (!x || x.type === "warmup") continue;
      const res = muscleContributions(x.exName, x.muscle);
      if (!res.counted) continue;
      const c = res.contributions.find((c) => c.muscle === driverMuscle);
      if (c && c.factor >= 1) vol[x.exName] = (vol[x.exName] || 0) + 1;
    }
  }
  return vol;
}

// The driverMuscle's primary lift with the most working-set volume in the window (or null).
export function dominantPrimaryLift(driverMuscle, sessions) {
  const vol = primaryLiftVolumes(driverMuscle, sessions);
  const lifts = Object.keys(vol);
  if (!lifts.length) return null;
  return lifts.sort((a, b) => vol[b] - vol[a])[0];
}

// trendFn(liftName) -> projectExercise-style status: 'gaining' | 'flat' | 'declining' |
// 'insufficient_data'. Returns a conservative per-driver trend keyed on the DOMINANT lift:
//   gaining  : the dominant primary lift is gaining.
//   stalled  : the dominant primary lift is flat/declining (with data) AND nothing is gaining.
//   unknown  : dominant lacks trend data, a primary is still gaining, or no primary was logged.
// (One accessory flat among gaining compounds is NOT stalled; one accessory gaining keeps a
// stalled dominant out of 'stalled' too — we never over-claim a plateau.)
export function classifyDriverTrend(driverMuscle, sessions, trendFn) {
  const vol = primaryLiftVolumes(driverMuscle, sessions);
  const lifts = Object.keys(vol);
  if (!lifts.length) return "unknown";
  const dominant = lifts.sort((a, b) => vol[b] - vol[a])[0];
  const map = (t) => (t === "gaining" ? "gaining" : t === "flat" || t === "declining" ? "stalled" : "unknown");
  const mapped = {};
  for (const l of lifts) mapped[l] = map(trendFn(l));
  if (mapped[dominant] === "gaining") return "gaining";
  const anyGaining = lifts.some((l) => mapped[l] === "gaining");
  if (mapped[dominant] === "stalled" && !anyGaining) return "stalled";
  return "unknown";
}

// Progress-aware copy variant for a flagged muscle. `plainCopy` is the existing Lane-2 line,
// returned VERBATIM when the trend is unknown (graceful fallback). status is the volume status
// ('under'/'maintenance' = below band; 'high' = over band). Low-evidence handling stays in the
// caller — this only changes the line text, never which groups surface.
export function progressCopy(status, trend, dominantLift, plainCopy) {
  const lift = dominantLift || "your main lift";
  if (status === "under" || status === "maintenance") {
    if (trend === "gaining") return `Below typical volume, but ${lift} is still climbing — hold here and add only if it stalls.`;
    if (trend === "stalled") return `Volume is low and ${lift} has been flat — adding sets is the clear lever.`;
    return plainCopy;
  }
  if (status === "high") {
    if (trend === "stalled") return "Above the productive range and not progressing — trimming may help more than adding; watch recovery.";
    if (trend === "gaining") return "Above typical volume but still progressing — fine for now; watch recovery.";
    return plainCopy;
  }
  return plainCopy;
}
