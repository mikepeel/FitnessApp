import { analyzeRealized } from "./realizedVolume";
import { analyzePlan, scoreVolume } from "./planAnalysis";

const NOW = new Date(2026, 5, 15, 12, 0, 0); // Jun 15 2026, local noon
const DAY = 86400000;
const iso = (daysAgo) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();
const sess = (daysAgo, exName, count, muscle = "") => ({
  completedAt: iso(daysAgo),
  setsArr: Array.from({ length: count }, () => ({ exName, muscle, type: "working" })),
});
// 8 distinct training days spanning 27 days → passes the sufficiency gate.
const DAYS8 = [0, 4, 8, 12, 16, 20, 24, 27];
const chestSessions = (perDay) => DAYS8.map((d) => sess(d, "Barbell Bench Press", perDay, "Chest"));
const find = (r, m) => r.perMuscle.find((x) => x.muscle === m);

describe("analyzeRealized", () => {
  test("40 chest-primary sets across the window → chest 10.0/wk, in_range", () => {
    const r = analyzeRealized(chestSessions(5), { now: NOW }); // 8 days × 5 = 40
    expect(r.sufficient).toBe(true);
    expect(find(r, "Chest").weeklySets).toBe(10);
    expect(find(r, "Chest").status).toBe("in_range");
  });

  test("sparse window (4 sessions) → sufficient:false, nothing scored", () => {
    const r = analyzeRealized([0, 2, 4, 6].map((d) => sess(d, "Barbell Bench Press", 5, "Chest")), { now: NOW });
    expect(r.sufficient).toBe(false);
    expect(r.perMuscle).toBeUndefined();
  });

  test("sufficient window but a muscle with 0 sets → status 'under' (gate didn't suppress it)", () => {
    const r = analyzeRealized(chestSessions(5), { now: NOW });
    expect(r.sufficient).toBe(true);
    expect(find(r, "Quads").weeklySets).toBe(0);
    expect(find(r, "Quads").status).toBe("under");
  });

  test("÷weeks normalization: 16 sets over 28d → 4.0/wk", () => {
    const r = analyzeRealized(chestSessions(2), { now: NOW }); // 8 days × 2 = 16
    expect(find(r, "Chest").weeklySets).toBe(4);
  });

  test("scoreVolume parity: same metrics via plan vs realized → identical status", () => {
    // plan: 12 chest sets across 2 days
    const plan = [
      { exercises: [{ name: "Barbell Bench Press", sets: "6", muscle: "Chest" }] },
      { exercises: [{ name: "Barbell Bench Press", sets: "6", muscle: "Chest" }] },
    ];
    const planChest = analyzePlan(plan, { goal: "hypertrophy" }).perMuscle.find((m) => m.muscle === "Chest");
    // realized: 48 chest sets across 8 days over 28d → 48/4 = 12/wk, freq 8/4 = 2/wk
    const realChest = find(analyzeRealized(chestSessions(6), { goal: "hypertrophy", now: NOW }), "Chest");
    expect(planChest.weeklySets).toBe(12);
    expect(realChest.weeklySets).toBe(12);
    expect(planChest.freq).toBe(2);
    expect(realChest.freq).toBe(2);
    expect(realChest.status).toBe(planChest.status);
    expect(realChest.status).toBe("in_range");
  });

  test("scoreVolume core scores under / in_range / high + flags", () => {
    const out = scoreVolume(
      { Chest: { weeklySets: 12, freq: 2, maxDaySets: 6 }, Quads: { weeklySets: 4, freq: 1, maxDaySets: 4 }, Triceps: { weeklySets: 22, freq: 1, maxDaySets: 18 } },
      "hypertrophy"
    );
    const by = Object.fromEntries(out.map((m) => [m.muscle, m]));
    expect(by.Chest.status).toBe("in_range");
    expect(by.Quads.status).toBe("under");
    expect(by.Triceps.status).toBe("high");
    expect(by.Triceps.frequencyFlag).toBe(true); // in/above range but freq < 2
    expect(by.Triceps.sessionFlag).toBe(true); // maxDay 18 > 16
  });

  test("cardio / warmup sets don't count toward muscle volume", () => {
    // sufficient strength history + cardio rows; cardio contributes no muscle sets.
    const sessions = chestSessions(5).map((s) => ({ ...s, setsArr: [...s.setsArr, { exName: "Rowing Machine", minutes: "20", type: "working" }, { exName: "Barbell Bench Press", muscle: "Chest", type: "warmup" }] }));
    const r = analyzeRealized(sessions, { now: NOW });
    expect(r.sufficient).toBe(true);
    expect(find(r, "Chest").weeklySets).toBe(10); // still 40/4, warmup + cardio ignored
  });

  test("records windowDays and goalDefaulted", () => {
    const r = analyzeRealized(chestSessions(5), { now: NOW });
    expect(r.windowDays).toBe(28);
    expect(r.goalDefaulted).toBe(true);
    expect(r.goal).toBe("hypertrophy");
  });
});
