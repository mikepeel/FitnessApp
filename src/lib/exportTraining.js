// Anonymized, ALLOWLIST-ONLY training-data export for pasting into an external AI. Pure +
// deterministic. Two hard constraints: only the fields below leave the app, and the output is
// non-attributable (no ids, no absolute dates, no free text, no app/schema fingerprint).
//
// Input rows (already fetched with ONLY allowlisted columns + the join for timing):
//   { exerciseName, setNumber, weight, reps, setType, sessionId, completedAt }
// Output: { instructions, log: [ { exercise, sessions: [ { day, sets } ] } ] }
//   - exercise: a recognized STANDARD name (exported as-is) or a stable "Custom Exercise N" label.
//   - day: integer offset from the user's FIRST exported session (day 0) — never an absolute date.
//   - sets: compressed reps×weight ("3×6 @ 185") via the shared liftSessionsFromSets.
import { liftSessionsFromSets } from "./liftSessions";
import muscleMap from "../data/exerciseMuscleMap.json";

// Canonical standard-exercise set (trim + lowercase): map exercises + aliases. A logged name in
// this set is a known movement (export as-is); anything else is treated as user-custom (free text,
// could leak identity) and genericized. A tighter list genericizes MORE — the safe direction.
const STANDARD = new Set(
  [...Object.keys(muscleMap.exercises || {}), ...Object.keys(muscleMap.aliases || {})].map((s) => s.trim().toLowerCase())
);
const isStandard = (name) => STANDARD.has(String(name == null ? "" : name).trim().toLowerCase());

// Directive header — describes the data's NATURE only (no origin, app name, or schema terms).
export const EXPORT_INSTRUCTIONS =
  "The following is anonymized strength-training data. Each exercise lists its sessions over time, " +
  "with sets shown as reps × weight, and dates given as integer day offsets from the first session " +
  "(day 0). Evaluate progression and progressive overload, assess balance across movements, and flag " +
  "plateaus, programming gaps, or concerns. Respond with concise, actionable feedback.";

export function serializeTrainingExport(rows, opts = {}) {
  const localDay = opts.localDay || ((iso) => new Date(iso).toLocaleDateString("en-CA"));
  // ALLOWLIST (serializer side): keep only completed working (non-warmup) sets. `partial` is
  // excluded at the FETCH and never reaches here.
  const working = (rows || []).filter((r) => r && r.completedAt && r.setType !== "warmup");
  if (!working.length) return { instructions: EXPORT_INSTRUCTIONS, log: [] };

  const anchorDay = working.map((r) => localDay(r.completedAt)).sort()[0];
  const anchorMs = new Date(anchorDay + "T12:00:00").getTime();
  const dayOffset = (iso) => Math.round((new Date(localDay(iso) + "T12:00:00").getTime() - anchorMs) / 86400000);

  // Stable custom-name mapping (first-seen order), so progression for one custom lift still tracks.
  const customLabels = new Map();
  const labelFor = (name) => {
    if (isStandard(name)) return String(name);
    const key = String(name == null ? "" : name).trim().toLowerCase();
    if (!customLabels.has(key)) customLabels.set(key, `Custom Exercise ${customLabels.size + 1}`);
    return customLabels.get(key);
  };

  const byExercise = new Map();
  for (const r of working) {
    const label = labelFor(r.exerciseName);
    if (!byExercise.has(label)) byExercise.set(label, []);
    byExercise.get(label).push(r);
  }

  const log = [...byExercise.entries()].map(([exercise, exRows]) => {
    // Feed the shared compressor rows whose `date` is ALREADY the relative day offset, so the
    // grouping carries relative timing — an absolute date is never present.
    const shaped = liftSessionsFromSets(
      exRows.map((r) => ({ sessionId: r.sessionId, setNumber: r.setNumber, weight: r.weight, reps: r.reps, date: String(dayOffset(r.completedAt)), completedAt: r.completedAt }))
    );
    const sessions = shaped
      .map((s) => ({ day: Number(s.date), sets: s.groups.map((g) => `${g.count}×${g.reps} @ ${g.weight}`).join(", ") }))
      .sort((a, b) => a.day - b.day); // oldest first
    return { exercise, sessions };
  });

  return { instructions: EXPORT_INSTRUCTIONS, log };
}
