// Pure day-copy for the plan builder ("make this day = another day"). Given the plan's `days` array,
// copy `sourceId`'s workout into `targetId`, returning a NEW days array (never mutates the input).
//
// Fresh ids are MANDATORY. The builder identifies an exercise by ex.id WITHIN a day — edit
// (saveExercise), delete (deleteExercise), and the React list key all key on ex.id — so two exercises
// sharing an id in the same day cross-wire (editing/deleting one hits both; duplicate React key). Cloning
// with the injected mkId guarantees within-day uniqueness in every case, including copying the same
// source in twice (append). Reusing the source ids does not. This mirrors the existing clone pattern in
// loadPreset / saveAsNewPlan.
//
// The TARGET keeps its own id, name, and slot position; it takes the SOURCE's label/tag/color and, if it
// was a rest day, flips to a training day (isRest:false). Copied exercises land in the SOURCE's authored
// array order (read straight from the plan) — never any workout-screen display order — so the
// authored-order invariant holds by construction.
//
// mode: "append" concatenates the source copies onto the target's existing exercises; anything else
// ("replace", the default) makes the target's exercises the source copies only.
export function copyDayInto(days, targetId, sourceId, mode, mkId) {
  const list = days || [];
  const source = list.find((d) => d && d.id === sourceId);
  if (!source || targetId === sourceId) return list; // no source, or a no-op self-copy
  const clones = (source.exercises || []).map((e) => ({ ...e, id: mkId() }));
  return list.map((d) => {
    if (!d || d.id !== targetId) return d;
    const exercises = mode === "append" ? [...(d.exercises || []), ...clones] : clones;
    return { ...d, exercises, label: source.label, tag: source.tag, color: source.color, isRest: false };
  });
}
