import { coachingFromRow, coachingToRow, COACHING_DEFAULTS } from "./coachingSettings";

describe("coachingFromRow", () => {
  const KEYS = ["showCoaching", "showPlateaus", "showVolumeTargets", "showCoach", "showPlanAnalysis"];

  test("EXISTING USER trap: a row LACKING the new columns reads all-true (the ?? true coalesce)", () => {
    // The decisive case — an old user_settings row that predates these columns. Without the
    // coalesce each field would be `undefined` (falsy) and the surface would be silently hidden.
    const out = coachingFromRow({ rest_timer: true, pr_detection: true }); // no show_* keys
    for (const k of KEYS) expect(out[k]).toBe(true);
  });

  test("null / empty / undefined row → all-true", () => {
    for (const k of KEYS) {
      expect(coachingFromRow(null)[k]).toBe(true);
      expect(coachingFromRow(undefined)[k]).toBe(true);
      expect(coachingFromRow({})[k]).toBe(true);
    }
  });

  test("a STORED false is respected (only null/undefined falls back to true)", () => {
    const out = coachingFromRow({ show_coaching: false, show_plateaus: false, show_volume_targets: true, show_coach: false, show_plan_analysis: true });
    expect(out).toEqual({ showCoaching: false, showPlateaus: false, showVolumeTargets: true, showCoach: false, showPlanAnalysis: true });
  });

  test("explicit null column also coalesces to true", () => {
    expect(coachingFromRow({ show_coaching: null }).showCoaching).toBe(true);
  });
});

describe("coachingToRow", () => {
  test("maps camelCase settings → snake_case row", () => {
    expect(coachingToRow({ showCoaching: false, showPlateaus: true, showVolumeTargets: false, showCoach: true, showPlanAnalysis: false }))
      .toEqual({ show_coaching: false, show_plateaus: true, show_volume_targets: false, show_coach: true, show_plan_analysis: false });
  });

  test("missing settings keys default to true (don't write false by accident)", () => {
    expect(coachingToRow({})).toEqual({ show_coaching: true, show_plateaus: true, show_volume_targets: true, show_coach: true, show_plan_analysis: true });
  });

  test("round-trips a stored row through from→to", () => {
    const row = { show_coaching: false, show_plateaus: true, show_volume_targets: false, show_coach: true, show_plan_analysis: true };
    expect(coachingToRow(coachingFromRow(row))).toEqual(row);
  });
});

describe("COACHING_DEFAULTS", () => {
  test("all five default ON", () => {
    expect(COACHING_DEFAULTS).toEqual({ showCoaching: true, showPlateaus: true, showVolumeTargets: true, showCoach: true, showPlanAnalysis: true });
  });
});
