import { liftSeriesFromSets } from "./liftSeries";

describe("liftSeriesFromSets", () => {
  test("one row per day (max weight + e1RM formulas), sorted ascending, with label", () => {
    const sets = [
      { weight: 100, reps: 5, date: "2026-02-01" },
      { weight: 110, reps: 3, date: "2026-02-01" }, // same day, heavier
      { weight: 95, reps: 10, date: "2026-01-15" },
    ];
    const s = liftSeriesFromSets(sets);
    expect(s.map((p) => p.date)).toEqual(["2026-01-15", "2026-02-01"]); // chronological
    expect(s[1].weight).toBe(110); // per-day max
    expect(s[1].label).toBe("02-01");
    expect(s[1].ormEpley).toBeGreaterThan(0);
    expect(s[1].ormBrzycki).toBeGreaterThan(0);
    expect(s[1].ormLombardi).toBeGreaterThan(0);
  });

  test("ignores weight<=0 and date-less sets", () => {
    expect(liftSeriesFromSets([{ weight: 0, reps: 5, date: "2026-01-01" }, { weight: 100, reps: 5, date: null }])).toEqual([]);
  });

  // The point of the drill-down fix: built from FULL history it keeps datapoints the capped
  // (.limit(100)) load would have dropped off the bottom.
  test("FULL HISTORY includes early datapoints a capped subset drops", () => {
    const full = [
      { weight: 135, reps: 5, date: "2026-01-01" }, // earliest, outside a 100-row window
      ...Array.from({ length: 100 }, (_, i) => ({ weight: 185, reps: 5, date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}` })),
    ];
    const capped = full.slice(1); // oldest dropped off the cap
    expect(liftSeriesFromSets(capped)[0].date).not.toBe("2026-01-01");
    expect(liftSeriesFromSets(full)[0].date).toBe("2026-01-01");
  });
});
