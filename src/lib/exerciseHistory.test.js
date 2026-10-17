import { exerciseHistory } from "./exerciseHistory";

const S = (id, completedAt, sets) => ({ id, completedAt, setsArr: sets });
const set = (exName, setNum, weight, reps, extra = {}) => ({ exName, setNum, weight, reps, ...extra });

describe("exerciseHistory", () => {
  test("newest first; weight increase detected with delta", () => {
    const sessions = [
      S("a", "2026-09-01T12:00:00Z", [set("Bench Press", 1, 100, 8), set("Bench Press", 2, 100, 8)]),
      S("b", "2026-09-08T12:00:00Z", [set("Bench Press", 1, 105, 6)]),
    ];
    const { rows, lastIncrease } = exerciseHistory(sessions, ["Bench Press"]);
    expect(rows.map((r) => r.sessionId)).toEqual(["b", "a"]);
    expect(rows[0].change).toEqual({ kind: "up", what: "weight", delta: 5 });
    expect(rows[1].change.kind).toBe("first");
    expect(rows[1].groups).toEqual([{ count: 2, weight: 100, reps: 8, minutes: 0 }]);
    expect(lastIncrease.sessionId).toBe("b");
  });

  test("same weight, more reps = reps increase; fewer = down; equal = same", () => {
    const sessions = [
      S("a", "2026-09-01T12:00:00Z", [set("Row", 1, 100, 8)]),
      S("b", "2026-09-02T12:00:00Z", [set("Row", 1, 100, 10)]),
      S("c", "2026-09-03T12:00:00Z", [set("Row", 1, 100, 9)]),
      S("d", "2026-09-04T12:00:00Z", [set("Row", 1, 100, 9)]),
    ];
    const { rows, lastIncrease } = exerciseHistory(sessions, ["Row"]);
    expect(rows.map((r) => r.change.kind)).toEqual(["same", "down", "up", "first"]);
    expect(rows[2].change).toEqual({ kind: "up", what: "reps", delta: 2 });
    expect(lastIncrease.sessionId).toBe("b");
  });

  test("top set = heaviest, ties broken by reps; warmups excluded", () => {
    const sessions = [S("a", "2026-09-01T12:00:00Z", [
      set("Squat", 1, 135, 10, { type: "warmup" }), set("Squat", 2, 185, 5), set("Squat", 3, 185, 6), set("Squat", 4, 165, 10),
    ])];
    const { rows } = exerciseHistory(sessions, ["Squat"]);
    expect(rows[0].top).toEqual({ weight: 185, reps: 6, minutes: 0 });
    expect(rows[0].groups.length).toBe(3);
  });

  test("bodyweight (zero weight) sessions are kept and compared on reps", () => {
    const sessions = [
      S("a", "2026-09-01T12:00:00Z", [set("Pull-Up", 1, "", 8)]),
      S("b", "2026-09-05T12:00:00Z", [set("Pull-Up", 1, "", 10)]),
    ];
    const { rows } = exerciseHistory(sessions, ["Pull-Up"]);
    expect(rows.length).toBe(2);
    expect(rows[0].change).toEqual({ kind: "up", what: "reps", delta: 2 });
  });

  test("matches aliases case-insensitively; ignores other exercises and empty sessions", () => {
    const sessions = [
      S("a", "2026-09-01T12:00:00Z", [set("Overhead Cable Extension", 1, 40, 12), set("Curl", 1, 30, 10)]),
      S("b", "2026-09-02T12:00:00Z", [set("cable overhead triceps extension", 1, 45, 12)]),
      S("c", "2026-09-03T12:00:00Z", [set("Curl", 1, 30, 10)]),
      { id: "d", completedAt: null, setsArr: [set("Cable Overhead Triceps Extension", 1, 99, 1)] },
    ];
    const { rows } = exerciseHistory(sessions, ["Cable Overhead Triceps Extension", "Overhead Cable Extension"]);
    expect(rows.map((r) => r.sessionId)).toEqual(["b", "a"]);
  });

  test("cardio compares total minutes", () => {
    const sessions = [
      S("a", "2026-09-01T12:00:00Z", [set("Rowing Machine", 1, "", "", { minutes: 20 })]),
      S("b", "2026-09-02T12:00:00Z", [set("Rowing Machine", 1, "", "", { minutes: 15 }), set("Rowing Machine", 2, "", "", { minutes: 10 })]),
    ];
    const { rows } = exerciseHistory(sessions, ["Rowing Machine"], { cardio: true });
    expect(rows[0].top.minutes).toBe(25);
    expect(rows[0].change).toEqual({ kind: "up", what: "minutes", delta: 5 });
  });

  test("limit caps rows but lastIncrease/total consider all history; empty input is safe", () => {
    const sessions = Array.from({ length: 12 }, (_, i) => S(String(i), `2026-08-${String(i + 1).padStart(2, "0")}T12:00:00Z`, [set("Dip", 1, 0, i === 0 ? 10 : 5)]));
    const res = exerciseHistory(sessions, ["Dip"], { limit: 8 });
    expect(res.rows.length).toBe(8);
    expect(res.total).toBe(12);
    expect(res.lastIncrease).toBeNull();
    expect(exerciseHistory(null, ["Dip"])).toEqual({ rows: [], lastIncrease: null, total: 0 });
  });
});
