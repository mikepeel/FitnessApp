import { projectExercise } from "./projections";

const fmt = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
// Build a chronological series of { date, orm } at a fixed day step.
const series = (orms, stepDays = 7) =>
  orms.map((orm, i) => {
    const dt = new Date(2026, 0, 1, 12, 0, 0);
    dt.setDate(dt.getDate() + i * stepDays);
    return { date: fmt(dt), orm };
  });

const allFinite = (...nums) => nums.every(Number.isFinite);

describe("projectExercise", () => {
  test("steady rise → gaining: forecast above current, range, finite milestone ≤12 wks", () => {
    const r = projectExercise(series([200, 204, 211, 214, 221, 225]));
    expect(r.status).toBe("gaining");
    expect(r.trendPerWeek).toBeGreaterThan(0);
    expect(r.projected).toBeDefined();
    expect(r.projected.weeks).toBe(8);
    expect(r.projected.mid).toBeGreaterThan(r.currentOrm);
    expect(r.projected.low).toBeLessThanOrEqual(r.projected.mid);
    expect(r.projected.high).toBeGreaterThanOrEqual(r.projected.mid);
    expect(r.milestone).toBeDefined();
    expect(r.milestone.target).toBeGreaterThan(r.currentOrm);
    expect(r.milestone.weeks).toBeGreaterThan(0);
    expect(r.milestone.weeks).toBeLessThanOrEqual(12);
    expect(
      allFinite(
        r.trendPerWeek, r.currentOrm,
        r.projected.low, r.projected.mid, r.projected.high,
        r.milestone.target, r.milestone.weeks
      )
    ).toBe(true);
  });

  test("noisy-flat → flat: no forecast, no milestone", () => {
    const r = projectExercise(series([200, 202, 199, 201, 200, 201]));
    expect(r.status).toBe("flat");
    expect(r.projected).toBeUndefined();
    expect(r.milestone).toBeUndefined();
  });

  test("steady decline → declining: no gain forecast", () => {
    const r = projectExercise(series([200, 195, 190, 185, 180, 175]));
    expect(r.status).toBe("declining");
    expect(r.trendPerWeek).toBeLessThan(0);
    expect(r.projected).toBeUndefined();
    expect(r.milestone).toBeUndefined();
  });

  test("3 sessions over 10 days → insufficient_data", () => {
    const r = projectExercise(series([200, 205, 210], 5));
    expect(r.status).toBe("insufficient_data");
    expect(r.projected).toBeUndefined();
    expect(r.milestone).toBeUndefined();
  });

  test("noisy rising with low r² → flat (forecast suppressed)", () => {
    const r = projectExercise(series([200, 245, 195, 240, 200, 235]));
    expect(r.status).toBe("flat");
    expect(r.projected).toBeUndefined();
  });

  test("empty / null series → insufficient_data", () => {
    expect(projectExercise([]).status).toBe("insufficient_data");
    expect(projectExercise(null).status).toBe("insufficient_data");
  });
});
