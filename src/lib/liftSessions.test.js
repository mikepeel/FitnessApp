import { liftSessionsFromSets } from "./liftSessions";
import { liftSeriesFromSets } from "./liftSeries";

const row = (sessionId, setNumber, weight, reps, date, completedAt) => ({ sessionId, setNumber, weight, reps, date, completedAt });

describe("liftSessionsFromSets", () => {
  test("uniform session → one compressed group (N×reps @ weight)", () => {
    const rows = [1, 2, 3, 4].map((n) => row("s1", n, 175, 7, "2026-06-01", "2026-06-01T10:00:00Z"));
    const out = liftSessionsFromSets(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: "2026-06-01", groups: [{ count: 4, reps: 7, weight: 175 }] });
  });

  test("mixed session splits in PERFORMED ORDER (8,8,6 → 2×8, 1×6)", () => {
    const rows = [row("s1", 1, 185, 8, "d", "t"), row("s1", 2, 185, 8, "d", "t"), row("s1", 3, 185, 6, "d", "t")];
    expect(liftSessionsFromSets(rows)[0].groups).toEqual([{ count: 2, reps: 8, weight: 185 }, { count: 1, reps: 6, weight: 185 }]);
  });

  test("non-consecutive identical sets stay separate (8,6,8 → 3 groups, by setNumber)", () => {
    // deliberately pass out of order to prove it sorts by setNumber first
    const rows = [row("s1", 3, 185, 8, "d", "t"), row("s1", 1, 185, 8, "d", "t"), row("s1", 2, 185, 6, "d", "t")];
    expect(liftSessionsFromSets(rows)[0].groups).toEqual([{ count: 1, reps: 8, weight: 185 }, { count: 1, reps: 6, weight: 185 }, { count: 1, reps: 8, weight: 185 }]);
  });

  test("two SAME-DAY sessions stay separate (grouped by sessionId), newest first", () => {
    const rows = [
      row("s1", 1, 185, 8, "2026-06-01", "2026-06-01T08:00:00Z"),
      row("s2", 1, 135, 12, "2026-06-01", "2026-06-01T18:00:00Z"),
    ];
    const out = liftSessionsFromSets(rows);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.sessionId)).toEqual(["s2", "s1"]); // 18:00 before 08:00
  });

  test("newest-first across days; skips zero-weight sets", () => {
    const rows = [
      row("old", 1, 100, 5, "2026-01-01", "2026-01-01T10:00:00Z"),
      row("new", 1, 0, 10, "2026-06-01", "2026-06-01T10:00:00Z"), // 0-weight skipped
      row("new", 2, 110, 5, "2026-06-01", "2026-06-01T10:00:00Z"),
    ];
    const out = liftSessionsFromSets(rows);
    expect(out.map((o) => o.date)).toEqual(["2026-06-01", "2026-01-01"]);
    expect(out[0].groups).toEqual([{ count: 1, reps: 5, weight: 110 }]);
  });

  test("FAILS-BEFORE / PASSES-AFTER: liftSeriesFromSets drops reps & set count; liftSessionsFromSets keeps them", () => {
    const rich = [row("s1", 1, 185, 8, "2026-06-01", "t"), row("s1", 2, 185, 8, "2026-06-01", "t"), row("s1", 3, 185, 6, "2026-06-01", "t")];
    const series = liftSeriesFromSets(rich); // the chart shaper
    expect(series[0].weight).toBe(185); // only the day max
    expect(series[0].reps).toBeUndefined(); // reps are gone
    expect(series[0].count).toBeUndefined(); // set count is gone
    const sess = liftSessionsFromSets(rich); // the work-log shaper
    expect(sess[0].groups).toEqual([{ count: 2, reps: 8, weight: 185 }, { count: 1, reps: 6, weight: 185 }]); // preserved + split
  });

  test("stable / idempotent: same input → identical output", () => {
    const rows = [row("a", 1, 100, 5, "2026-01-01", "2026-01-01T10:00:00Z"), row("b", 1, 100, 5, "2026-02-01", "2026-02-01T10:00:00Z")];
    expect(JSON.stringify(liftSessionsFromSets(rows))).toBe(JSON.stringify(liftSessionsFromSets(rows)));
  });
});
