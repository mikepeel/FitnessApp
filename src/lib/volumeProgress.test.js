import { classifyDriverTrend, dominantPrimaryLift, progressCopy } from "./volumeProgress";

// Sessions with setsArr; exName resolves to driverMuscle as PRIMARY via the muscleVolume map.
const sess = (exName, count) => ({ setsArr: Array.from({ length: count }, () => ({ exName, type: "working" })) });

describe("classifyDriverTrend (conservative, keyed on dominant primary lift)", () => {
  test("dominant primary gaining → 'gaining'", () => {
    expect(classifyDriverTrend("Chest", [sess("Barbell Bench Press", 6)], () => "gaining")).toBe("gaining");
  });

  test("primaries flat with sufficient data → 'stalled'", () => {
    expect(classifyDriverTrend("Chest", [sess("Barbell Bench Press", 6)], () => "flat")).toBe("stalled");
  });

  test("declining counts as stalled", () => {
    expect(classifyDriverTrend("Chest", [sess("Barbell Bench Press", 6)], () => "declining")).toBe("stalled");
  });

  test("dominant primary gaining + one accessory flat → 'gaining' (conservative)", () => {
    const sessions = [sess("Barbell Bench Press", 8), sess("Incline Barbell Press", 3)]; // bench dominant
    const trendFn = (l) => (l === "Barbell Bench Press" ? "gaining" : "flat");
    expect(classifyDriverTrend("Chest", sessions, trendFn)).toBe("gaining");
  });

  test("dominant stalled but an accessory still gaining → 'unknown' (never over-claim a plateau)", () => {
    const sessions = [sess("Barbell Bench Press", 8), sess("Incline Barbell Press", 3)];
    const trendFn = (l) => (l === "Barbell Bench Press" ? "flat" : "gaining");
    expect(classifyDriverTrend("Chest", sessions, trendFn)).toBe("unknown");
  });

  test("primaries with insufficient data → 'unknown'", () => {
    expect(classifyDriverTrend("Chest", [sess("Barbell Bench Press", 6)], () => "insufficient_data")).toBe("unknown");
  });

  test("no primary lift logged → 'unknown'", () => {
    // Leg Extension is Quads-primary, not Chest → no chest-primary lift in the window.
    expect(classifyDriverTrend("Chest", [sess("Leg Extension", 5)], () => "gaining")).toBe("unknown");
  });
});

describe("dominantPrimaryLift", () => {
  test("returns the highest-volume primary lift for the muscle", () => {
    const sessions = [sess("Barbell Bench Press", 8), sess("Incline Barbell Press", 3)];
    expect(dominantPrimaryLift("Chest", sessions)).toBe("Barbell Bench Press");
  });

  test("null when no primary lift logged", () => {
    expect(dominantPrimaryLift("Chest", [sess("Leg Extension", 5)])).toBeNull();
  });
});

describe("progressCopy (variants + graceful fallback)", () => {
  const PLAIN = "~3 more sets/week or a second day would close it.";

  test("under + gaining → soft hold copy naming the lift", () => {
    expect(progressCopy("under", "gaining", "Bench Press", PLAIN)).toBe(
      "Below typical volume, but Bench Press is still climbing — hold here and add only if it stalls."
    );
  });

  test("under + stalled → strong clear-lever copy naming the lift", () => {
    expect(progressCopy("under", "stalled", "Bench Press", PLAIN)).toBe(
      "Volume is low and Bench Press has been flat — adding sets is the clear lever."
    );
  });

  test("under + unknown → plain Lane-2 string VERBATIM (fallback pinned)", () => {
    expect(progressCopy("under", "unknown", "Bench Press", PLAIN)).toBe(PLAIN);
  });

  test("high + stalled → trim copy, never 'overtraining'", () => {
    const c = progressCopy("high", "stalled", null, PLAIN);
    expect(c).toBe("Above the productive range and not progressing — trimming may help more than adding; watch recovery.");
    expect(c.toLowerCase()).not.toContain("overtrain");
  });

  test("high + gaining → soft fine-for-now copy", () => {
    expect(progressCopy("high", "gaining", null, PLAIN)).toBe(
      "Above typical volume but still progressing — fine for now; watch recovery."
    );
  });

  test("high + unknown → plain Lane-2 string VERBATIM (fallback pinned)", () => {
    expect(progressCopy("high", "unknown", null, PLAIN)).toBe(PLAIN);
  });

  test("maintenance is treated as below-band (under) for coupling", () => {
    expect(progressCopy("maintenance", "stalled", "Squat", PLAIN)).toBe(
      "Volume is low and Squat has been flat — adding sets is the clear lever."
    );
  });
});
