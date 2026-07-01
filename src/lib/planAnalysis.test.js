import { analyzePlan, scoreVolume, rollupGroups } from "./planAnalysis";

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

// Group status is gated by evidence: only high/moderate-evidence members flag a group.
// (This intentionally replaces the old summed-fine-band group pass/fail. No existing test
// asserted the old summed-band group STATUS — test 9 only checks rollup weeklySets/members —
// so the deliberate behavior change is captured by the new assertions below.)
describe("group status — evidence-gated (not summed bands)", () => {
  const roll = (metrics, groupMetrics, goal = "hypertrophy") => {
    const perMuscle = scoreVolume(metrics, goal);
    const perGroup = rollupGroups(perMuscle, groupMetrics, goal);
    return { perMuscle, perGroup, legs: perGroup.find((g) => g.group === "Legs") };
  };

  test("low-evidence minor at 0 does NOT flag the group; majors in range → Legs in_range (minor still 'under' on expand)", () => {
    const metrics = {
      Quads: { weeklySets: 14, freq: 2, maxDaySets: 7 },
      Hamstrings: { weeklySets: 12, freq: 2, maxDaySets: 6 },
      Glutes: { weeklySets: 12, freq: 2, maxDaySets: 6 },
      Calves: { weeklySets: 10, freq: 2, maxDaySets: 5 },
      Adductors: { weeklySets: 0, freq: 0, maxDaySets: 0 }, // low-evidence minor
    };
    const { perMuscle, legs } = roll(metrics, { Legs: { weeklySets: 48, freq: 2, maxDaySets: 7 } });
    expect(legs.status).toBe("in_range"); // OLD summed-band logic flagged this group below-range
    expect(perMuscle.find((m) => m.muscle === "Adductors").status).toBe("under"); // still surfaced on expand
    expect(legs.evidenceTier).not.toBe("low"); // never a soft group headline
  });

  test("a high-evidence major under → group under", () => {
    const metrics = {
      Quads: { weeklySets: 4, freq: 1, maxDaySets: 4 }, // high-evidence, under its own band
      Hamstrings: { weeklySets: 14, freq: 2, maxDaySets: 7 },
      Glutes: { weeklySets: 12, freq: 2, maxDaySets: 6 },
      Calves: { weeklySets: 10, freq: 2, maxDaySets: 5 },
      Adductors: { weeklySets: 0, freq: 0, maxDaySets: 0 },
    };
    const { legs } = roll(metrics, { Legs: { weeklySets: 40, freq: 2, maxDaySets: 7 } });
    expect(legs.status).toBe("under");
  });

  test("both a gated-under and a gated-over member → group 'mixed'", () => {
    const metrics = {
      Quads: { weeklySets: 24, freq: 2, maxDaySets: 12 }, // high-evidence, over (>20)
      Hamstrings: { weeklySets: 4, freq: 1, maxDaySets: 4 }, // high-evidence, under
      Glutes: { weeklySets: 12, freq: 2, maxDaySets: 6 },
      Calves: { weeklySets: 10, freq: 2, maxDaySets: 5 },
      Adductors: { weeklySets: 0, freq: 0, maxDaySets: 0 },
    };
    const { legs } = roll(metrics, { Legs: { weeklySets: 50, freq: 2, maxDaySets: 12 } });
    expect(legs.status).toBe("mixed");
  });

  test("high-evidence muscle at MAINTENANCE (>=floor, <productive low) → group 'maintenance', NOT 'under'", () => {
    // The BDP-shaped case: Chest 9.25 → statusFor gives 'maintenance' (>=6 floor, <10 low). No gated
    // member is genuinely under, so the group is HOLDING — not a deficit. Before the fix this collapsed
    // to 'under' (belowBand folded maintenance into under). Load-bearing.
    const metrics = { Chest: { weeklySets: 9.25, freq: 2, maxDaySets: 5 } };
    const perMuscle = scoreVolume(metrics, "hypertrophy");
    expect(perMuscle.find((m) => m.muscle === "Chest").status).toBe("maintenance"); // fine level already correct
    const chest = rollupGroups(perMuscle, { Chest: { weeklySets: 9.25, freq: 2, maxDaySets: 5 } }, "hypertrophy").find((g) => g.group === "Chest");
    expect(chest.status).toBe("maintenance"); // the fix — was "under"
  });

  test("high-evidence muscle BELOW the maintenance floor → STILL 'under' (fix doesn't soften real deficits)", () => {
    const metrics = { Chest: { weeklySets: 4, freq: 1, maxDaySets: 4 } }; // 4 < floor 6 → genuine deficit
    const perMuscle = scoreVolume(metrics, "hypertrophy");
    expect(perMuscle.find((m) => m.muscle === "Chest").status).toBe("under");
    const chest = rollupGroups(perMuscle, { Chest: { weeklySets: 4, freq: 1, maxDaySets: 4 } }, "hypertrophy").find((g) => g.group === "Chest");
    expect(chest.status).toBe("under");
  });

  test("maintenance composition: genuine-under wins; maintenance+over → mixed; in_range+maintenance → maintenance", () => {
    const back = (m) => rollupGroups(scoreVolume(m, "hypertrophy"), { Back: { weeklySets: 30, freq: 2, maxDaySets: 8 } }, "hypertrophy").find((g) => g.group === "Back");
    // genuine-under (Lats 4) + maintenance (Upper Back 8) → 'under' (a real deficit is NOT upgraded to holding)
    expect(back({ Lats: { weeklySets: 4, freq: 1, maxDaySets: 4 }, "Upper Back": { weeklySets: 8, freq: 2, maxDaySets: 4 } }).status).toBe("under");
    // maintenance (Upper Back 8) + over (Lats 24) → 'mixed' (existing mixed precedence preserved)
    expect(back({ Lats: { weeklySets: 24, freq: 2, maxDaySets: 12 }, "Upper Back": { weeklySets: 8, freq: 2, maxDaySets: 4 } }).status).toBe("mixed");
    // in_range (Lats 12) + maintenance (Upper Back 8) → 'maintenance' (holding; a fully-in-range group has no maintenance member → in_range)
    expect(back({ Lats: { weeklySets: 12, freq: 2, maxDaySets: 6 }, "Upper Back": { weeklySets: 8, freq: 2, maxDaySets: 4 } }).status).toBe("maintenance");
    // sanity: all in_range → 'in_range' (not downgraded)
    expect(back({ Lats: { weeklySets: 12, freq: 2, maxDaySets: 6 }, "Upper Back": { weeklySets: 14, freq: 2, maxDaySets: 7 } }).status).toBe("in_range");
  });

  test("flagged group's evidence tier comes from gated members, never 'low'", () => {
    // Back: Lats (high) under flags the group; Lower Back (low) is ignored for status + tier.
    const metrics = {
      Lats: { weeklySets: 4, freq: 1, maxDaySets: 4 }, // high, under → drives group under
      "Upper Back": { weeklySets: 12, freq: 2, maxDaySets: 6 },
      Traps: { weeklySets: 8, freq: 2, maxDaySets: 4 },
      "Lower Back": { weeklySets: 0, freq: 0, maxDaySets: 0 }, // low evidence, ignored for flag
    };
    const perMuscle = scoreVolume(metrics, "hypertrophy");
    const back = rollupGroups(perMuscle, { Back: { weeklySets: 24, freq: 2, maxDaySets: 6 } }, "hypertrophy").find((g) => g.group === "Back");
    expect(back.status).toBe("under");
    expect(back.evidenceTier).not.toBe("low");
    expect(perMuscle.find((m) => m.muscle === "Lower Back").status).toBe("under"); // still on expand
  });
});
