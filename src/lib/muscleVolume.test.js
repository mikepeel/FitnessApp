import { muscleContributions, rollupToGroup, normalizeName, DISPLAY_GROUPS, primaryMoverGroup } from "./muscleVolume";

const byMuscle = (r) => Object.fromEntries(r.contributions.map((c) => [c.muscle, c.factor]));

describe("primaryMoverGroup — tonnage routes to the same group as set credit", () => {
  test("resolves lifts absent from the legacy coarse map to their real group", () => {
    expect(primaryMoverGroup("Wide-Grip Lat Pulldown")).toBe("Back"); // Lats → Back
    expect(primaryMoverGroup("Shrugs")).toBe("Back"); // Traps → Back
    expect(primaryMoverGroup("Dumbbell Lateral Raise")).toBe("Shoulders"); // Side Delts → Shoulders
  });
  test("coarse fallback still routes a mapped-but-unlisted lift to its tagged group", () => {
    expect(primaryMoverGroup("Totally Made Up Lift", "Legs")).toBe("Legs");
  });
  test("genuinely unresolvable (no mapping, no fallback) → Other", () => {
    expect(primaryMoverGroup("Extensions")).toBe("Other");
    expect(primaryMoverGroup("Totally Made Up Lift")).toBe("Other");
  });

  // The audit's before/after on a BDP-like row: a Back lift absent from the legacy coarse map.
  // BEFORE (legacy coarse map) orphans its tonnage to "Other" → Back bar = 0 and "Other" (hidden)
  // inflates the scaling max. AFTER (primaryMoverGroup) the tonnage lands on Back and the max
  // scales to displayed groups only.
  test("fails-before / passes-after: tonnage grouping + scaling", () => {
    const sets = [
      { exName: "Wide-Grip Lat Pulldown", weight: 100, reps: 10 }, // → Back (absent from legacy map)
      { exName: "Bench Press", weight: 185, reps: 5 }, // → Chest (in both)
    ];
    const order = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Abs"];
    const legacyMap = { "Bench Press": "Chest" }; // the hardcoded map lacks Wide-Grip Lat Pulldown
    // BEFORE
    const oldVol = {};
    sets.forEach((x) => { const g = legacyMap[x.exName] || "Other"; oldVol[g] = (oldVol[g] || 0) + x.weight * x.reps; });
    expect(oldVol.Back).toBeUndefined(); // bug: Back tonnage orphaned
    expect(oldVol.Other).toBe(1000); // …into the hidden "Other" bucket
    expect(Math.max(...Object.values(oldVol), 1)).toBe(1000); // max includes Other → understates bars
    // AFTER
    const newVol = {};
    sets.forEach((x) => { const g = primaryMoverGroup(x.exName, legacyMap[x.exName]); newVol[g] = (newVol[g] || 0) + (parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0); });
    expect(newVol.Back).toBe(1000); // resolves
    expect(newVol.Other).toBeUndefined();
    expect(Math.max(...order.map((m) => newVol[m] || 0), 1)).toBe(1000); // scales to displayed groups
  });

  test("0-weight nit: a missing weight contributes 0 tonnage, not reps×1", () => {
    const x = { weight: "", reps: "12" };
    expect((parseFloat(x.weight) || 0) * (parseInt(x.reps) || 0)).toBe(0); // new
    expect((parseFloat(x.weight) || 1) * (parseInt(x.reps) || 1)).toBe(12); // old (inflated)
  });
});

describe("muscleContributions", () => {
  test("Barbell Bench Press → Chest 1.0, Triceps 0.5, Front Delts 0.5", () => {
    const r = muscleContributions("Barbell Bench Press");
    expect(r).toMatchObject({ counted: true, modality: "strength" });
    expect(byMuscle(r)).toEqual({ Chest: 1.0, Triceps: 0.5, "Front Delts": 0.5 });
  });

  test("Barbell Deadlift → Glutes/Hamstrings/Lower Back 1.0; Quads/Traps/Lats/Forearms 0.5", () => {
    const r = muscleContributions("Barbell Deadlift");
    expect(r.counted).toBe(true);
    expect(byMuscle(r)).toEqual({
      Glutes: 1.0,
      Hamstrings: 1.0,
      "Lower Back": 1.0,
      Quads: 0.5,
      Traps: 0.5,
      Lats: 0.5,
      Forearms: 0.5,
    });
  });

  test("alias 'Goblet squat' resolves to Goblet Squat's contributions", () => {
    const alias = muscleContributions("Goblet squat");
    const canon = muscleContributions("Goblet Squat");
    expect(alias.counted).toBe(true);
    expect(alias.contributions).toEqual(canon.contributions);
  });

  test("'Rest' is non-counting; 'Treadmill Run' is cardio modality", () => {
    expect(muscleContributions("Rest")).toEqual({ contributions: [], counted: false, modality: null });
    expect(muscleContributions("Treadmill Run")).toEqual({ contributions: [], counted: false, modality: "cardio" });
  });

  test("blank name is non-counting", () => {
    expect(muscleContributions("")).toMatchObject({ counted: false, modality: null });
  });

  test("unknown name with coarse fallback 'Legs' → [{Legs,1.0}] counted", () => {
    const r = muscleContributions("Totally Made Up Lift", "Legs");
    expect(r).toEqual({ contributions: [{ muscle: "Legs", factor: 1.0 }], counted: true, modality: "strength" });
  });

  test("unknown name with no fallback → empty, not counted", () => {
    expect(muscleContributions("Totally Made Up Lift")).toEqual({ contributions: [], counted: false, modality: null });
  });

  test("ambiguousUnmapped name falls to fallback/none (no fine mapping)", () => {
    expect(muscleContributions("Extensions").counted).toBe(false);
    expect(muscleContributions("Extensions", "Legs").contributions).toEqual([{ muscle: "Legs", factor: 1.0 }]);
  });
});

describe("rollupToGroup / taxonomy", () => {
  test("fine muscles roll up to display groups", () => {
    expect(rollupToGroup("Front Delts")).toBe("Shoulders");
    expect(rollupToGroup("Adductors")).toBe("Legs");
    expect(rollupToGroup("Lats")).toBe("Back");
  });
  test("a value already a display group returns itself", () => {
    expect(rollupToGroup("Chest")).toBe("Chest");
    expect(rollupToGroup("Legs")).toBe("Legs");
    expect(rollupToGroup("Shoulders")).toBe("Shoulders");
  });
  test("DISPLAY_GROUPS are the 7 strength groups", () => {
    expect(DISPLAY_GROUPS).toEqual(["Chest", "Shoulders", "Back", "Biceps", "Triceps", "Legs", "Abs"]);
  });
});

describe("normalizeName", () => {
  test("lowercases, collapses whitespace, strips surrounding punctuation", () => {
    expect(normalizeName("  Barbell   Bench  Press  ")).toBe("barbell bench press");
    expect(normalizeName("(Extensions)")).toBe("extensions");
    expect(normalizeName("")).toBe("");
  });
});
