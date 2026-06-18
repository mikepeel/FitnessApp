// Maps a workout_sessions row (with embedded logged_sets) to the in-app session object.
// Single source of truth so the main loader (loadUserData) and the History date-range fetch
// produce identical shapes and can't drift. Pure.
export function mapSessionRow(s) {
  const lsMap = {};
  (s.logged_sets || []).forEach((ls) => {
    lsMap[`${ls.exercise_name}|${ls.set_number}`] = { isPR: ls.is_pr || false, type: ls.set_type || "working" };
  });
  return {
    id: s.id, supabaseId: s.id,
    dayLabel: s.day_label, dayId: s.day_id,
    startedAt: s.started_at, completedAt: s.completed_at,
    notes: s.notes, partial: s.partial || false, sets: s.sets_data || {},
    exerciseOrder: s.exercise_order || null,
    setsArr: Object.entries(s.sets_data || {}).flatMap(([exName, sets]) =>
      Object.entries(sets).map(([setNum, x]) => {
        const ls = lsMap[`${exName}|${setNum}`] || {};
        return {
          exName, setNum: parseInt(setNum),
          weight: x.weight || "", reps: x.reps || "",
          minutes: x.minutes || "", level: x.level || "",
          muscle: "", isPR: ls.isPR || false, type: ls.type || x.type || "working",
        };
      })
    ),
  };
}
