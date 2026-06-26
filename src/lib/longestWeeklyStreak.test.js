import { longestWeeklyStreak } from "./longestWeeklyStreak";

// Mondays (2026-06-22 is a Monday); each +7 days is the next Monday-week.
const MON = "2026-06-22", MON_1 = "2026-06-15", MON_2 = "2026-06-08", MON_3 = "2026-06-01", MON_4 = "2026-05-25", MON_5 = "2026-05-18";

describe("longestWeeklyStreak", () => {
  test("empty / none → 0", () => {
    expect(longestWeeklyStreak([])).toBe(0);
    expect(longestWeeklyStreak(null)).toBe(0);
    expect(longestWeeklyStreak(["nope", null, undefined])).toBe(0);
  });

  test("consecutive weeks each with a workout → run length", () => {
    expect(longestWeeklyStreak([MON_2, MON_1, MON])).toBe(3);
  });

  test("multiple workouts in one week count as ONE week", () => {
    expect(longestWeeklyStreak(["2026-06-08", "2026-06-09", "2026-06-10", "2026-06-14"])).toBe(1); // all in Mon 06-08..Sun 06-14
  });

  test("week boundary: straddling Monday → two weeks; within one Mon–Sun → one", () => {
    expect(longestWeeklyStreak(["2026-06-07", "2026-06-08"])).toBe(2); // Sun (wk of 06-01) + Mon (wk of 06-08)
    expect(longestWeeklyStreak(["2026-06-08", "2026-06-14"])).toBe(1); // Mon + the Sun of the SAME week
  });

  test("a gap week breaks the run; the MAX run is returned, not the latest", () => {
    // run of 4 (05-18..06-08), gap at 06-15, then a run of 2 (06-22 + next). MAX = 4, not the latest 2.
    const dates = [MON_5, MON_4, MON_3, MON_2, /* gap MON_1 */ MON, "2026-06-29"];
    expect(longestWeeklyStreak(dates)).toBe(4);
  });

  test("order-independent (input need not be sorted)", () => {
    expect(longestWeeklyStreak([MON, MON_3, MON_1, MON_4, MON_2])).toBe(5); // 05-25..06-22 consecutive
  });

  test("BEYOND-CAP: a long run that exists ONLY in older history is still counted; the capped (recent-100) slice misses it", () => {
    // Old run: 6 consecutive weeks, far in the past. Recent: 120 weeks, every-other-week (max run 1).
    const mk = (epochMondayWeeks) => epochMondayWeeks.map((w) => {
      const d = new Date(Date.UTC(2020, 0, 6) + w * 7 * 86400000); // 2020-01-06 is a Monday
      return d.toISOString().slice(0, 10);
    });
    const oldRun = mk([0, 1, 2, 3, 4, 5]);                          // weeks 0..5 → run 6 (oldest)
    const recent = mk(Array.from({ length: 120 }, (_, i) => 20 + i * 2)); // weeks 20,22,... → every other → run 1
    const full = [...oldRun, ...recent];
    expect(longestWeeklyStreak(full)).toBe(6);                      // full history sees the old run

    // The capped source = the 100 most-recent dates (latest by week) → excludes the old run entirely.
    const capped = [...full].sort().slice(-100);
    expect(longestWeeklyStreak(capped)).toBe(1);                    // capped MISSES the 6-run
    expect(longestWeeklyStreak(full)).toBeGreaterThan(longestWeeklyStreak(capped)); // → must use full history
  });
});
