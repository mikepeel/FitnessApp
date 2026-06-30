import { weeklyAdherence } from "./weeklyAdherence";

// Position-based plan starting Monday 2026-06-22: Mon/Tue train, Wed rest, Thu/Fri train, Sat/Sun rest.
// → 4 training days (Mon,Tue,Thu,Fri) in a 7-day plan week.
const PLAN = {
  startDate: "2026-06-22",
  days: [
    { name: "Mon", label: "Push", isRest: false },
    { name: "Tue", label: "Pull", isRest: false },
    { name: "Wed", label: "Rest", isRest: true },
    { name: "Thu", label: "Legs", isRest: false },
    { name: "Fri", label: "Push", isRest: false },
    { name: "Sat", label: "Rest", isRest: true },
    { name: "Sun", label: "Rest", isRest: true },
  ],
};
const ANCHOR = "2026-06-22";
const at = (d) => `${d}T12:00:00`;        // local-noon, TZ-stable
const sess = (d) => ({ completedAt: at(d) });

describe("weeklyAdherence", () => {
  test("target counts NON-REST days only (rest days excluded)", () => {
    expect(weeklyAdherence(PLAN, [], ANCHOR, new Date(at("2026-06-24"))).target).toBe(4);
  });

  test("done counts completed in-week sessions (prior-week + null-completed excluded)", () => {
    const sessions = [
      sess("2026-06-22"), sess("2026-06-23"), // in week
      sess("2026-06-15"),                     // prior plan week -> excluded
      { completedAt: null },                  // in-progress/partial -> excluded
    ];
    expect(weeklyAdherence(PLAN, sessions, ANCHOR, new Date(at("2026-06-24"))).done).toBe(2);
  });

  test("ANTI-SHAME: early week (1 of 4, 3 training days still reachable) is on_pace, NOT behind", () => {
    const r = weeklyAdherence(PLAN, [sess("2026-06-22")], ANCHOR, new Date(at("2026-06-23")));
    expect(r).toMatchObject({ done: 1, target: 4 });
    expect(r.status).toBe("on_pace");   // load-bearing: not "behind" early
  });

  test("END OF WEEK: 1 of 4 with no remaining training days IS behind", () => {
    const r = weeklyAdherence(PLAN, [sess("2026-06-22")], ANCHOR, new Date(at("2026-06-28")));
    expect(r).toMatchObject({ done: 1, target: 4, status: "behind" });
  });

  test("complete: done >= target", () => {
    const sessions = ["2026-06-22", "2026-06-23", "2026-06-25", "2026-06-26"].map(sess);
    expect(weeklyAdherence(PLAN, sessions, ANCHOR, new Date(at("2026-06-26"))).status).toBe("complete");
  });

  test("ahead: more sessions than the training days due so far", () => {
    // By Tue, 2 training days due (Mon,Tue); 3 sessions done -> ahead (and 3<4, not complete).
    const sessions = ["2026-06-22", "2026-06-22", "2026-06-23"].map(sess);
    const r = weeklyAdherence(PLAN, sessions, ANCHOR, new Date(at("2026-06-23")));
    expect(r).toMatchObject({ done: 3, target: 4, status: "ahead" });
  });

  test("no-startDate fallback computes a sensible target via the weekday-name map", () => {
    const weekdayPlan = {
      days: [
        { name: "Monday", isRest: false }, { name: "Tuesday", isRest: false },
        { name: "Wednesday", isRest: true }, { name: "Thursday", isRest: false },
        { name: "Friday", isRest: false }, { name: "Saturday", isRest: true }, { name: "Sunday", isRest: true },
      ],
    };
    // anchor = a program-start date; a 7-day plan week hits each weekday once -> 4 non-rest weekdays.
    expect(weeklyAdherence(weekdayPlan, [], "2026-06-01", new Date(at("2026-06-10"))).target).toBe(4);
  });

  test("no plan / no days -> no_target (consumer skips the line)", () => {
    expect(weeklyAdherence(null, [], ANCHOR, new Date(at("2026-06-24")))).toEqual({ done: 0, target: 0, status: "no_target" });
    expect(weeklyAdherence({ days: [] }, [], ANCHOR, new Date(at("2026-06-24"))).status).toBe("no_target");
  });
});
