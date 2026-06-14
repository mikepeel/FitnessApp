import { muscleContributions, rollupToGroup, normalizeName, DISPLAY_GROUPS } from "./muscleVolume";

const byMuscle = (r) => Object.fromEntries(r.contributions.map((c) => [c.muscle, c.factor]));

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
