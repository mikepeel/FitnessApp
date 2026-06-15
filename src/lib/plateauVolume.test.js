import { volumeAwarePlateauAdvice, primaryGatedMuscles } from "./plateauVolume";

const PLAIN = "add reps or weight";

describe("volumeAwarePlateauAdvice (stall × volume status)", () => {
  const benchResolver = () => ["Chest"]; // stub: bench's primary high/mod mover

  test("stalled bench + chest under → 'add_volume'", () => {
    const a = volumeAwarePlateauAdvice("Bench Press", { Chest: "under" }, benchResolver, PLAIN);
    expect(a.tier).toBe("add_volume");
    expect(a.copy).toContain("Chest");
    expect(a.copy).toContain("adding sets");
  });

  test("stalled bench + chest IN RANGE → 'look_elsewhere' (the honest case)", () => {
    const a = volumeAwarePlateauAdvice("Bench Press", { Chest: "in_range" }, benchResolver, PLAIN);
    expect(a.tier).toBe("look_elsewhere");
    expect(a.copy).toContain("already in range");
    expect(a.copy.toLowerCase()).toMatch(/load|intensity|failure|variation|recovery/);
  });

  test("stalled lift + primary muscle HIGH → 'reduce_fatigue' (deload, never 'overtraining')", () => {
    const a = volumeAwarePlateauAdvice("Bench Press", { Chest: "high" }, benchResolver, PLAIN);
    expect(a.tier).toBe("reduce_fatigue");
    expect(a.copy.toLowerCase()).toContain("deload");
    expect(a.copy.toLowerCase()).not.toContain("overtrain");
  });

  test("maintenance counts as below band → 'add_volume'", () => {
    const a = volumeAwarePlateauAdvice("Bench Press", { Chest: "maintenance" }, benchResolver, PLAIN);
    expect(a.tier).toBe("add_volume");
  });

  test("volume status unknown → 'plain' (existing advice verbatim, fallback pinned)", () => {
    const a = volumeAwarePlateauAdvice("Bench Press", {}, benchResolver, PLAIN);
    expect(a.tier).toBe("plain");
    expect(a.copy).toBe(PLAIN);
  });

  test("no high/mod primary → 'plain'", () => {
    const a = volumeAwarePlateauAdvice("Mystery Lift", { Chest: "under" }, () => [], PLAIN);
    expect(a.tier).toBe("plain");
    expect(a.copy).toBe(PLAIN);
  });

  test("compound, mixed primaries (one under, one in-range) → 'add_volume' via the under one", () => {
    // Resolution rule: a genuinely-under primary wins; advice names that muscle.
    const squatResolver = () => ["Quads", "Glutes"];
    const a = volumeAwarePlateauAdvice("Back Squat", { Quads: "in_range", Glutes: "under" }, squatResolver, PLAIN);
    expect(a.tier).toBe("add_volume");
    expect(a.copy).toContain("Glutes");
    expect(a.copy).not.toContain("Quads");
  });

  test("compound, one in-range + one high (none under) → 'reduce_fatigue'", () => {
    const a = volumeAwarePlateauAdvice("Back Squat", { Quads: "in_range", Glutes: "high" }, () => ["Quads", "Glutes"], PLAIN);
    expect(a.tier).toBe("reduce_fatigue");
    expect(a.copy).toContain("Glutes");
  });
});

describe("primaryGatedMuscles (production resolver)", () => {
  test("resolves a lift to its high/moderate-evidence primary movers", () => {
    expect(primaryGatedMuscles("Barbell Bench Press")).toEqual(["Chest"]);
    expect(primaryGatedMuscles("Goblet Squat").sort()).toEqual(["Glutes", "Quads"]);
  });

  test("unmapped lift → []", () => {
    expect(primaryGatedMuscles("Totally Made Up Lift 9000")).toEqual([]);
  });
});
