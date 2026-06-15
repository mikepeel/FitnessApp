// Volume-aware plateau advice (pure). The mirror of the volume-overlay coupling: start
// from a STALLED lift, cross with its primary muscles' realized volume status, and tailor
// the fix. Shares the same inputs as the overlay (the muscleVolume resolver + analyzeRealized
// statuses), so the two screens give consistent advice for the same lift/muscle. No volume
// or trend math here.
import { muscleContributions } from "./muscleVolume";
import guidelines from "../data/volumeGuidelines.json";

const HIGH_MOD = new Set(
  Object.keys(guidelines.hypertrophy).filter((m) => guidelines.hypertrophy[m].evidenceTier !== "low")
);

// Production resolver: a lift's PRIMARY (factor 1.0) high/moderate-evidence muscles. Low-
// evidence movers (forearms, lower back, adductors) are excluded so they never drive advice
// — consistent with the overlay never headlining them.
export function primaryGatedMuscles(lift) {
  const res = muscleContributions(lift, "");
  if (!res || !res.counted) return [];
  return res.contributions.filter((c) => c.factor >= 1 && HIGH_MOD.has(c.muscle)).map((c) => c.muscle);
}

// stalledLift: the plateaued lift name. perMuscleStatus: { muscle: 'under'|'maintenance'|
// 'in_range'|'high' } (realized volume statuses; missing = unknown). resolver(lift) -> the
// lift's primary high/mod muscles (injected for testability; defaults to primaryGatedMuscles).
// plainAdvice: today's plateau advice string, returned verbatim on the 'plain' tier.
//
// Resolution when primaries disagree: pick the most conservative CORRECT tier in this order —
//   add_volume   (a primary is genuinely below its band: the clearest, safest lever)
//   reduce_fatigue (none below, but a primary is above its band)
//   look_elsewhere (all known primaries in range: volume isn't the problem)
// 'add_volume' is emitted ONLY when a high/mod primary is genuinely under/maintenance.
export function volumeAwarePlateauAdvice(stalledLift, perMuscleStatus, resolver = primaryGatedMuscles, plainAdvice = "") {
  const muscles = resolver(stalledLift) || [];
  const status = (m) => (perMuscleStatus && perMuscleStatus[m]) || "unknown";
  const below = (m) => status(m) === "under" || status(m) === "maintenance";
  const over = (m) => status(m) === "high";
  const known = muscles.filter((m) => status(m) !== "unknown");

  // No high/mod primary, or none with a known volume status → today's advice unchanged.
  if (!muscles.length || !known.length) return { tier: "plain", copy: plainAdvice };

  const underM = muscles.find(below);
  if (underM)
    return {
      tier: "add_volume",
      copy: `${stalledLift} has stalled and your ${underM} volume is below the typical range — adding sets is the most likely fix before changing anything else.`,
    };
  const highM = muscles.find(over);
  if (highM)
    return {
      tier: "reduce_fatigue",
      copy: `${stalledLift} has stalled and your ${highM} volume is already above the productive range — this looks like accumulated fatigue; a planned deload or trimming sets is more likely to help than adding.`,
    };
  return {
    tier: "look_elsewhere",
    copy: `${stalledLift} has stalled but your ${known[0]} volume is already in range — more sets probably won't help. Look at load/intensity, proximity to failure, exercise variation, or recovery (sleep, stress, nutrition).`,
  };
}
