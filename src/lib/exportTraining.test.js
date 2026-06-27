import { serializeTrainingExport } from "./exportTraining";

const row = (exerciseName, setNumber, weight, reps, setType, sessionId, completedAt) => ({ exerciseName, setNumber, weight, reps, setType, sessionId, completedAt });
const D0 = "2026-06-01T12:00:00", D3 = "2026-06-04T12:00:00", D7 = "2026-06-08T12:00:00";
const fixture = () => [
  row("Bench Press", 1, 95, 5, "warmup", "s1", D0),   // WARMUP — must be excluded
  row("Bench Press", 2, 185, 5, "working", "s1", D0),
  row("Bench Press", 3, 185, 5, "working", "s1", D0),
  row("Bench Press", 4, 185, 5, "working", "s1", D0),
  row("Bench Press", 1, 190, 5, "working", "s2", D7),
  row("Bench Press", 2, 190, 5, "working", "s2", D7),
  row("Bench Press", 3, 190, 5, "working", "s2", D7),
  row("MySecretLift", 1, 40, 8, "working", "s1", D0),  // CUSTOM (free text) — must genericize
  row("MySecretLift", 2, 40, 8, "working", "s1", D0),
  row("MySecretLift", 1, 40, 10, "working", "s3", D3),
  row("MySecretLift", 2, 40, 10, "working", "s3", D3),
];

// PRIMARY allowlist assertion — by construction, not by scanning: the output may contain ONLY these
// keys, and every value must match its allowlisted SHAPE. A stray field fails the exact key-set check.
function assertAllowlistOnly(out) {
  expect(Object.keys(out).sort()).toEqual(["instructions", "log"]);
  expect(typeof out.instructions).toBe("string");
  expect(Array.isArray(out.log)).toBe(true);
  for (const ex of out.log) {
    expect(Object.keys(ex).sort()).toEqual(["exercise", "sessions"]);
    expect(typeof ex.exercise).toBe("string");
    expect(Array.isArray(ex.sessions)).toBe(true);
    for (const s of ex.sessions) {
      expect(Object.keys(s).sort()).toEqual(["day", "sets"]);
      expect(Number.isInteger(s.day)).toBe(true);
      expect(typeof s.sets).toBe("string");
      expect(s.sets).toMatch(/^\d+×\d+ @ [\d.]+(, \d+×\d+ @ [\d.]+)*$/); // compressed reps×weight only
    }
  }
}

describe("serializeTrainingExport", () => {
  test("PRIMARY: output contains ONLY allowlisted keys + shapes", () => {
    assertAllowlistOnly(serializeTrainingExport(fixture()));
  });

  test("SECONDARY denylist net: no date / uuid / email / DB column names; custom name genericized", () => {
    const str = JSON.stringify(serializeTrainingExport(fixture()));
    expect(str).not.toMatch(/\d{4}-\d{2}-\d{2}/);                       // no YYYY-MM-DD / ISO date
    expect(str).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i); // no uuid
    expect(str).not.toMatch(/[^\s@]+@[^\s@]+\.[^\s@]+/);                // no email (the " @ " in "3×5 @ 185" notation is not email-shaped; the PRIMARY shape assertion already constrains it)
    for (const col of ["user_id", "session_id", "notes", "set_type", "is_pr", "exercise_name", "completed_at"]) {
      expect(str).not.toContain(col);
    }
    expect(str).not.toContain("MySecretLift"); // raw custom name never leaves
    expect(str).toContain("Custom Exercise 1");
  });

  test("warmup excluded: Bench day 0 is 3×5 @ 185 (the 95-lb warmup is gone)", () => {
    const out = serializeTrainingExport(fixture());
    const bench = out.log.find((e) => e.exercise === "Bench Press");
    expect(bench.sessions.find((s) => s.day === 0).sets).toBe("3×5 @ 185");
  });

  test("anchor + offsets: earliest session is day 0; spacing matches real day gaps", () => {
    const out = serializeTrainingExport(fixture());
    const bench = out.log.find((e) => e.exercise === "Bench Press");
    expect(bench.sessions.map((s) => s.day)).toEqual([0, 7]); // oldest first, 7-day gap
    const custom = out.log.find((e) => e.exercise === "Custom Exercise 1");
    expect(custom.sessions.map((s) => s.day)).toEqual([0, 3]);
  });

  test("custom genericized to a stable label; standard name kept as-is", () => {
    const out = serializeTrainingExport(fixture());
    expect(out.log.map((e) => e.exercise).sort()).toEqual(["Bench Press", "Custom Exercise 1"]);
  });

  test("empty / no working sets -> empty log (still a valid object)", () => {
    assertAllowlistOnly(serializeTrainingExport([]));
    expect(serializeTrainingExport([]).log).toEqual([]);
    // only-warmup input -> empty log
    expect(serializeTrainingExport([row("Bench Press", 1, 95, 5, "warmup", "s1", D0)]).log).toEqual([]);
  });
});
