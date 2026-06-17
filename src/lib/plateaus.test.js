import { detectPlateaus } from "./plateaus";

// New definition: an exercise is plateaued only if, in the trailing 6-week window, it set
// NO new personal best vs its pre-window history on ANY axis — max single-set WEIGHT, e1RM
// under ANY of {Epley, Brzycki, Lombardi}, or single-session VOLUME. Any new best = not a
// plateau. Guards: no pre-window history, or no in-window sessions → not flagged.

const NOW = new Date(2026, 5, 25, 12, 0, 0); // Jun 25 2026 → window start ≈ May 14
const opts = (tonByName) => ({ now: NOW, tonnage: tonByName });

// e1RM formulas (Epley capped at 12 reps to match estimate1RM; Brzycki guarded at reps>=37).
const epley = (w, r) => w * (1 + Math.min(r, 12) / 30);
const brzycki = (w, r) => (r >= 37 ? 0 : (w * 36) / (37 - r));
const lombardi = (w, r) => w * Math.pow(r, 0.1);

// Build the enriched per-day series + per-day tonnage from [{date, weight, reps, sets=3}].
const build = (rows) => {
  const series = rows.map((x) => ({
    date: x.date,
    weight: x.weight,
    orm: Math.round(epley(x.weight, x.reps)),
    ormEpley: epley(x.weight, x.reps),
    ormBrzycki: brzycki(x.weight, x.reps),
    ormLombardi: lombardi(x.weight, x.reps),
  }));
  const tonnage = rows.map((x) => ({ date: x.date, orm: x.weight * x.reps * (x.sets || 3) }));
  return { series, tonnage };
};

describe("detectPlateaus — multi-axis 'no recent PR' definition", () => {
  // BDP / Rear Delt Machine REAL history (read from the DB during the root-cause pass):
  // 4×(100×12), then 100×10, 100×11, and a 105×10 weight PR in the latest session.
  const BDP = build([
    { date: "2026-05-05", weight: 100, reps: 12 },
    { date: "2026-05-12", weight: 100, reps: 12 },
    { date: "2026-05-27", weight: 100, reps: 12 },
    { date: "2026-06-03", weight: 100, reps: 12 },
    { date: "2026-06-07", weight: 100, reps: 10 },
    { date: "2026-06-10", weight: 100, reps: 11 },
    { date: "2026-06-14", weight: 105, reps: 10 },
  ]);

  test("BDP rear delt machine — set a weight PR (105×10 > prior 100×12) in window → NOT flagged", () => {
    expect(detectPlateaus({ "Rear Delt Machine": BDP.series }, opts({ "Rear Delt Machine": BDP.tonnage }))).toEqual([]);
  });

  test("truly stuck — no new best on weight, any e1RM formula, or volume → STILL flagged", () => {
    const stuck = build([
      { date: "2026-04-01", weight: 100, reps: 10 }, // prior best
      { date: "2026-04-15", weight: 100, reps: 10 }, // prior
      { date: "2026-05-20", weight: 95, reps: 10 },  // window — lower on every axis
      { date: "2026-06-05", weight: 95, reps: 10 },
      { date: "2026-06-14", weight: 95, reps: 10 },
    ]);
    const r = detectPlateaus({ Stuck: stuck.series }, opts({ Stuck: stuck.tonnage }));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ exercise: "Stuck", status: "stalled" });
  });

  test("insufficient pre-window history (no prior best) → NOT flagged", () => {
    const noPrior = build([
      { date: "2026-05-18", weight: 100, reps: 10 }, // all inside the window
      { date: "2026-05-25", weight: 100, reps: 10 },
      { date: "2026-06-01", weight: 100, reps: 10 },
      { date: "2026-06-08", weight: 100, reps: 10 },
      { date: "2026-06-14", weight: 100, reps: 10 },
    ]);
    expect(detectPlateaus({ NoPrior: noPrior.series }, opts({ NoPrior: noPrior.tonnage }))).toEqual([]);
  });

  test("weight axis: heavier single set in window → NOT flagged", () => {
    const ex = build([
      { date: "2026-04-01", weight: 100, reps: 10 },
      { date: "2026-06-10", weight: 105, reps: 10 }, // weight PR (e1RM/volume also up, fine)
    ]);
    expect(detectPlateaus({ Ex: ex.series }, opts({ Ex: ex.tonnage }))).toEqual([]);
  });

  test("e1RM axis only: same weight, more reps (higher e1RM) but LOWER volume → NOT flagged", () => {
    const ex = build([
      { date: "2026-04-01", weight: 100, reps: 10, sets: 3 }, // vol 3000, e1RM(Epley) 133
      { date: "2026-06-10", weight: 100, reps: 12, sets: 2 }, // weight tie, vol 2400 (lower), e1RM 140 (PR)
    ]);
    expect(detectPlateaus({ Ex: ex.series }, opts({ Ex: ex.tonnage }))).toEqual([]);
  });

  test("volume axis only: same weight & reps, more sets → NOT flagged", () => {
    const ex = build([
      { date: "2026-04-01", weight: 100, reps: 10, sets: 3 }, // vol 3000
      { date: "2026-06-10", weight: 100, reps: 10, sets: 4 }, // weight/e1RM tie, vol 4000 (PR)
    ]);
    expect(detectPlateaus({ Ex: ex.series }, opts({ Ex: ex.tonnage }))).toEqual([]);
  });

  test("no in-window sessions (only pre-window history) → NOT flagged", () => {
    const ex = build([
      { date: "2026-04-01", weight: 100, reps: 10 },
      { date: "2026-04-15", weight: 100, reps: 10 },
    ]);
    expect(detectPlateaus({ Ex: ex.series }, opts({ Ex: ex.tonnage }))).toEqual([]);
  });

  test("stalledWeeks measured from the last PR to the latest session date", () => {
    const stuck = build([
      { date: "2026-04-01", weight: 100, reps: 10 }, // last PR here (74 days before 06-14)
      { date: "2026-04-15", weight: 100, reps: 10 },
      { date: "2026-05-20", weight: 95, reps: 10 },
      { date: "2026-06-05", weight: 95, reps: 10 },
      { date: "2026-06-14", weight: 95, reps: 10 }, // latest session
    ]);
    const r = detectPlateaus({ Stuck: stuck.series }, opts({ Stuck: stuck.tonnage }));
    expect(r[0].stalledWeeks).toBe(10); // floor(74 / 7)
  });
});
