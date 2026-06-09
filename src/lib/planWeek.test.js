import { planWeekOf, elapsedDaysSince, parsePlanDate } from "./planWeek";

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

  test("no start date -> null", () => {
    expect(planWeekOf({}, new Date("2026-06-09T09:00:00"))).toBe(null);
  });
});

describe("elapsedDaysSince", () => {
  test("pre-noon on the 2-week boundary -> 14 (now normalized up to noon)", () => {
    expect(elapsedDaysSince("2026-05-26", new Date("2026-06-09T09:00:00"))).toBe(14);
  });

  test("afternoon on the 2-week boundary -> 14 (time-of-day independent)", () => {
    expect(elapsedDaysSince("2026-05-26", new Date("2026-06-09T13:00:00"))).toBe(14);
  });

  test("exact start day -> 0", () => {
    expect(elapsedDaysSince("2026-05-26", new Date("2026-05-26T08:00:00"))).toBe(0);
  });

  test("future start (now before start) -> negative", () => {
    expect(elapsedDaysSince("2026-05-26", new Date("2026-05-20T09:00:00"))).toBe(-6);
  });

  test("missing start date -> null", () => {
    expect(elapsedDaysSince(null)).toBe(null);
    expect(elapsedDaysSince("")).toBe(null);
    expect(elapsedDaysSince(undefined)).toBe(null);
  });

  test("does NOT mutate the passed `now`", () => {
    const now = new Date("2026-06-09T09:30:00");
    const before = now.getTime();
    elapsedDaysSince("2026-05-26", now);
    expect(now.getTime()).toBe(before);
    expect(now.getHours()).toBe(9);
  });
});

describe("parsePlanDate", () => {
  test("parses a YYYY-MM-DD string to local noon", () => {
    const d = parsePlanDate("2026-05-26");
    expect(d.getHours()).toBe(12);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // May (0-indexed)
    expect(d.getDate()).toBe(26);
  });

  test("returns null for missing/empty input", () => {
    expect(parsePlanDate(null)).toBe(null);
    expect(parsePlanDate("")).toBe(null);
    expect(parsePlanDate(undefined)).toBe(null);
  });
});
