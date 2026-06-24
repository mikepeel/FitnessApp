// Coaching / insight visibility toggles, mapped between the camelCase `settings` object and the
// snake_case `user_settings` row. All DEFAULT ON. The row→settings map COALESCES with `?? true`:
// an EXISTING user's row predates these columns (value `undefined`), and the load maps columns
// directly with no coalescing — without `?? true` that undefined reads falsy and would silently
// hide the surface from current users. The column DEFAULT true backfills rows, and this coalesce
// is the belt-and-suspenders for any row that still lacks the value. A STORED false is respected
// (only null/undefined falls back to true).
export const COACHING_DEFAULTS = {
  showCoaching: true,
  showPlateaus: true,
  showVolumeTargets: true,
  showCoach: true,
  showPlanAnalysis: true,
};

export function coachingFromRow(row) {
  const r = row || {};
  return {
    showCoaching: r.show_coaching ?? true,
    showPlateaus: r.show_plateaus ?? true,
    showVolumeTargets: r.show_volume_targets ?? true,
    showCoach: r.show_coach ?? true,
    showPlanAnalysis: r.show_plan_analysis ?? true,
  };
}

export function coachingToRow(s) {
  const x = s || {};
  return {
    show_coaching: x.showCoaching ?? true,
    show_plateaus: x.showPlateaus ?? true,
    show_volume_targets: x.showVolumeTargets ?? true,
    show_coach: x.showCoach ?? true,
    show_plan_analysis: x.showPlanAnalysis ?? true,
  };
}
