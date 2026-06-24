import { planWeekOf, elapsedDaysSince, parsePlanDate, programWeekFromDate, planWeekStart, planWeekSessions } from "./planWeek";

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

describe("programWeekFromDate (program-week fallback anchor)", () => {
  const NOW = new Date("2026-06-17T12:00:00");

  // The program-week fallback must anchor on the user's TRUE earliest completed session
  // (full history), not the earliest session that happens to be in the capped load window.
  test("capped oldest-loaded anchor under-counts; true earliest gives the correct week", () => {
    const loadedEarliest = "2026-05-01"; // oldest session still inside the 100-row window
    const trueEarliest = "2026-01-01"; // real first session, dropped off the cap
    expect(programWeekFromDate(loadedEarliest, NOW)).toBe(7); // BEFORE: capped anchor → too small
    expect(programWeekFromDate(trueEarliest, NOW)).toBe(24); // AFTER: full-history anchor → correct
  });

  test("missing date -> null (caller keeps existing fallback)", () => {
    expect(programWeekFromDate(null, NOW)).toBe(null);
    expect(programWeekFromDate("", NOW)).toBe(null);
  });

  test("future start (now before start) -> 1", () => {
    expect(programWeekFromDate("2026-07-01", NOW)).toBe(1);
  });

  test("exact start day -> 1", () => {
    expect(programWeekFromDate("2026-06-17", NOW)).toBe(1);
  });
});

describe("planWeekStart (plan-week window boundary)", () => {
  // Tuesday-anchored plan (BDP). Local-noon timestamps keep the day deterministic across TZs.
  const TUE = "2026-06-23";

  test("mid-week -> the plan-week's anchor weekday, NOT the calendar Sunday", () => {
    // now = Thursday 06-25; the plan week started Tuesday 06-23 (the bug used Sunday 06-21).
    expect(planWeekStart(TUE, new Date("2026-06-25T10:00:00")).toLocaleDateString("en-CA")).toBe("2026-06-23");
  });

  test("second plan week -> anchor + 7 days (block math = planWeekOf - 1)", () => {
    expect(planWeekStart(TUE, new Date("2026-07-01T10:00:00")).toLocaleDateString("en-CA")).toBe("2026-06-30");
  });

  test("now before start -> the start itself (block 0)", () => {
    expect(planWeekStart(TUE, new Date("2026-06-20T10:00:00")).toLocaleDateString("en-CA")).toBe("2026-06-23");
  });

  test("no start date -> null", () => {
    expect(planWeekStart(null, new Date("2026-06-25T10:00:00"))).toBe(null);
  });
});

describe("planWeekSessions (This Week card window)", () => {
  // Tuesday-anchored plan. `now` = Thursday 06-25, so the Sunday-start calendar week begins
  // 06-21 — pulling in a session that belongs to the PRIOR plan week. The plan week starts 06-23.
  const TUE = "2026-06-23";
  const NOW = new Date("2026-06-25T10:00:00");
  const vol = (w, r) => [{ type: "working", weight: String(w), reps: String(r) }];
  const sundayPriorWeek = { completedAt: "2026-06-21T12:00:00", setsArr: vol(100, 5) }; // 500 — prior plan week
  const wedThisWeek = { completedAt: "2026-06-24T12:00:00", setsArr: vol(200, 5) }; // 1000 — current plan week
  const sessions = [sundayPriorWeek, wedThisWeek];
  const weekVol = (rows) => rows.reduce((a, s) => a + (s.setsArr || []).filter((x) => x.type !== "warmup").reduce((b, x) => b + (parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0), 0), 0);

  test("FAILS-BEFORE: the Sunday-start calendar window counts 2 (the adjacent-week session leaks in)", () => {
    const weekStart = new Date(NOW); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // the OLD bug
    const weekStr = weekStart.toLocaleDateString("en-CA");
    const before = sessions.filter((s) => s.completedAt && new Date(s.completedAt).toLocaleDateString("en-CA") >= weekStr);
    expect(weekStr).toBe("2026-06-21");
    expect(before).toHaveLength(2); // both the Sunday and the Wednesday → wrong
  });

  test("PASSES-AFTER: the plan-week window counts 1 (only the in-week session)", () => {
    const after = planWeekSessions(sessions, TUE, NOW);
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(wedThisWeek);
  });

  test("the volume cell uses the SAME window — the out-of-week session contributes nothing", () => {
    // Both cells derive from planWeekSessions, so volume = the in-week session only (1000, not 1500).
    expect(weekVol(planWeekSessions(sessions, TUE, NOW))).toBe(1000);
  });

  test("partials / null-completed rows never enter the window", () => {
    const withPartial = [...sessions, { completedAt: null, setsArr: vol(999, 9) }];
    expect(planWeekSessions(withPartial, TUE, NOW)).toHaveLength(1);
  });

  test("no anchor -> empty window", () => {
    expect(planWeekSessions(sessions, null, NOW)).toEqual([]);
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
