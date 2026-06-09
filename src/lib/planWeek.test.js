import { planWeekOf } from "./planWeek";

// start_date is a local "YYYY-MM-DD" string; the module anchors it to local noon.
// `now` values are constructed as local datetimes (no trailing Z) to mirror that.
const plan = { startDate: "2026-05-26" }; // a Tuesday

describe("planWeekOf", () => {
  test("pre-noon on the exact 2-week boundary -> 3 (reported repro)", () => {
    expect(planWeekOf(plan, new Date("2026-06-09T09:00:00"))).toBe(3);
  });

  test("pre-noon on the exact 1-week boundary -> 2", () => {
    expect(planWeekOf(plan, new Date("2026-06-02T09:00:00"))).toBe(2);
  });

  test("afternoon on the 2-week boundary -> 3", () => {
    expect(planWeekOf(plan, new Date("2026-06-09T13:00:00"))).toBe(3);
  });

  test("morning of the start day -> 1", () => {
    expect(planWeekOf(plan, new Date("2026-05-26T08:00:00"))).toBe(1);
  });

  test("late on the last day of week 1 -> 1", () => {
    expect(planWeekOf(plan, new Date("2026-06-01T23:00:00"))).toBe(1);
  });

  test("late on the last day of week 2 -> 2", () => {
    expect(planWeekOf(plan, new Date("2026-06-08T23:00:00"))).toBe(2);
  });

  test("a future start (now before start) -> 1", () => {
    expect(planWeekOf(plan, new Date("2026-05-20T09:00:00"))).toBe(1);
  });
});
