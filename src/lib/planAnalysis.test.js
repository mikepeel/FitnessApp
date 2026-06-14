import { analyzePlan } from "./planAnalysis";

const find = (r, mu) => r.perMuscle.find((x) => x.muscle === mu);
const day = (...exercises) => ({ exercises });

describe("analyzePlan", () => {
  test("chest-heavy / leg-light → chest in range, quads under", () => {
    const plan = [
      day(
        { name: "Barbell Bench Press", sets: "4", muscle: "Chest" },
        { name: "Incline Dumbbell Press", sets: "4", muscle: "Chest" },
        { name: "Cable Flye", sets: "4", muscle: "Chest" },
        { name: "Leg Extension", sets: "3", muscle: "Legs" }
      ),
    ];
    const r = analyzePlan(plan, { goal: "hypertrophy" });
    expect(find(r, "Chest").weeklySets).toBe(12);
    expect(["in_range", "high"]).toContain(find(r, "Chest").status);
    expect(find(r, "Quads").status).toBe("under");
  });

  test("muscle hammered in ONE day (>16) → sessionFlag", () => {
    const r = analyzePlan([day({ name: "Leg Extension", sets: "18", muscle: "Legs" })], { goal: "hypertrophy" });
    const q = find(r, "Quads");
    expect(q.maxDaySets).toBe(18);
    expect(q.sessionFlag).toBe(true);
  });

  test("in-range volume all on one day → frequencyFlag (freq < 2)", () => {
    const r = analyzePlan([day({ name: "Barbell Bench Press", sets: "12", muscle: "Chest" })], { goal: "hypertrophy" });
    const c = find(r, "Chest");
    expect(c.status).toBe("in_range");
    expect(c.freq).toBe(1);
    expect(c.frequencyFlag).toBe(true);
    expect(c.sessionFlag).toBe(false);
  });

  test("low-evidence muscle under → status under, evidenceTier 'low' carried", () => {
    const r = analyzePlan([day({ name: "Barbell Deadlift", sets: "4", muscle: "Back" })], { goal: "hypertrophy" });
    const f = find(r, "Forearms");
    expect(f.weeklySets).toBe(2); // 4 sets * 0.5 secondary
    expect(f.status).toBe("under");
    expect(f.evidenceTier).toBe("low");
  });

  test("goal 'strength' uses the coarse block (no per-muscle bands)", () => {
    const plan = [
      day(
        { name: "Barbell Bench Press", sets: "5", muscle: "Chest" },
        { name: "Leg Extension", sets: "5", muscle: "Legs" }
      ),
    ];
    const r = analyzePlan(plan, { goal: "strength" });
    expect(r.goal).toBe("strength");
    expect(r.goalDefaulted).toBe(false);
    // every fine muscle scored against the SAME coarse primary-mover band
    r.perMuscle.forEach((m) => expect(m.band).toEqual([6, 12]));
    r.perMuscle.forEach((m) => expect(m.evidenceTier).toBe("moderate"));
  });

  test("fractional correctness: 4× bench → Chest 4, Triceps 2, Front Delts 2", () => {
    const r = analyzePlan([day({ name: "Barbell Bench Press", sets: "4", muscle: "Chest" })], { goal: "hypertrophy" });
    expect(find(r, "Chest").weeklySets).toBe(4);
    expect(find(r, "Triceps").weeklySets).toBe(2);
    expect(find(r, "Front Delts").weeklySets).toBe(2);
  });

  test("goal defaults to hypertrophy and records it", () => {
    const r = analyzePlan([day({ name: "Barbell Bench Press", sets: "4", muscle: "Chest" })]);
    expect(r.goal).toBe("hypertrophy");
    expect(r.goalDefaulted).toBe(true);
    const r2 = analyzePlan([day({ name: "Barbell Bench Press", sets: "4", muscle: "Chest" })], { goal: "hypertrophy" });
    expect(r2.goalDefaulted).toBe(false);
  });

  test("cardio / rest entries are skipped", () => {
    const r = analyzePlan([day(
      { name: "Treadmill Run", sets: "1", muscle: "Cardio" },
      { name: "Rest", sets: "", muscle: "" }
    )], { goal: "hypertrophy" });
    expect(r.perMuscle).toHaveLength(0);
    expect(r.perGroup).toHaveLength(0);
  });

  test("rolls fine muscles up to display groups", () => {
    const r = analyzePlan([day({ name: "Barbell Bench Press", sets: "4", muscle: "Chest" })], { goal: "hypertrophy" });
    const shoulders = r.perGroup.find((g) => g.group === "Shoulders");
    // Front Delts 2 (secondary from bench) rolls up under Shoulders
    expect(shoulders).toBeTruthy();
    expect(shoulders.weeklySets).toBe(2);
    expect(shoulders.fineMuscles.map((m) => m.muscle)).toContain("Front Delts");
  });
});
