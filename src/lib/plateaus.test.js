import { detectPlateaus, priorBests } from "./plateaus";

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

  // ISOLATION TEST — proves the e1RM axis uses the multi-formula disjunction
  // (any of Epley / Brzycki / Lombardi), NOT Epley alone.
  //
  // In-window session beats the prior best on the LOMBARDI axis only:
  //   pre-window (110 x 1):  W 110   E 113.7   B 110.0   L 110.0   vol 110
  //   pre-window ( 90 x 12): W  90   E 126.0   B 129.6   L 115.4   vol 1080
  //   in-window  (105 x 5):  W 105   E 122.5   B 118.1   L 123.3   vol 525
  //
  //   prior bests:  W 110 | vol 1080 | E 126.0 | B 129.6 | L 115.4
  //   in-window:    W 105 (<110)   vol 525 (<1080)   E 122.5 (<126.0)
  //                 B 118.1 (<129.6)   L 123.3 (>115.4)  <-- the only new best
  //
  // An Epley-only check would see no PR on weight/volume/Epley and FLAG this
  // lift. It must NOT be flagged, because Lombardi set a new best.
  it('does not flag when only a non-Epley e1RM formula (Lombardi) sets a new best', () => {
    const name = 'Lombardi Iso';

    // Per-day enriched series (one set per day, so per-day max == that set).
    // Reconcile field names with what seriesFor now emits
    // (ormEpley/ormBrzycki/ormLombardi). The comparison must use full-precision
    // e1RM; the Lombardi margin (~8) survives integer rounding regardless.
    const series = {
      [name]: [
        { date: '2026-03-25', label: 'd', weight: 110, orm: 114, ormEpley: 113.67, ormBrzycki: 110.00, ormLombardi: 110.00 },
        { date: '2026-04-10', label: 'd', weight: 90,  orm: 126, ormEpley: 126.00, ormBrzycki: 129.60, ormLombardi: 115.39 },
        { date: '2026-06-10', label: 'd', weight: 105, orm: 123, ormEpley: 122.50, ormBrzycki: 118.13, ormLombardi: 123.33 },
      ],
    };

    // Per-day total volume (tonnage), carried under `orm` per the existing shape.
    const tonnage = {
      [name]: [
        { date: '2026-03-25', orm: 110 },
        { date: '2026-04-10', orm: 1080 },
        { date: '2026-06-10', orm: 525 },
      ],
    };

    const result = detectPlateaus(series, { tonnage });

    expect(result.find(p => p.exercise === name)).toBeUndefined();
  });

  // Prior-best from FULL history (opts.priorBest) vs the capped pre-window slice.
  test("opts.priorBest flags a plateau the capped pre-window slice would miss", () => {
    const NOW2 = new Date("2026-06-17T12:00:00");
    // Loaded (capped) series: the only pre-window point is 240 (the true 300 dropped off the
    // cap); in-window best is 250.
    const series = {
      Lift: [
        { date: "2026-04-20", weight: 240, ormEpley: 240, ormBrzycki: 240, ormLombardi: 240 }, // pre-window (capped prior)
        { date: "2026-06-10", weight: 250, ormEpley: 250, ormBrzycki: 250, ormLombardi: 250 }, // in-window
      ],
    };
    const tonnage = { Lift: [ { date: "2026-04-20", orm: 240 }, { date: "2026-06-10", orm: 250 } ] };
    // BEFORE (capped prior 240): in-window 250 > 240 → reads as a PR → NOT flagged.
    expect(detectPlateaus(series, { now: NOW2, tonnage })).toEqual([]);
    // AFTER (full-history priorBest 300): 250 < 300 on every axis → flagged.
    const priorBest = { Lift: { weight: 300, ormEpley: 300, ormBrzycki: 300, ormLombardi: 300, volume: 300 } };
    const r = detectPlateaus(series, { now: NOW2, tonnage, priorBest });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ exercise: "Lift", status: "stalled" });
  });
});

describe("priorBests", () => {
  const WS = new Date("2026-05-06T12:00:00").getTime(); // windowStart

  test("per-axis maxes from pre-window sets; excludes in-window; volume is per session", () => {
    const sets = [
      { exName: "Bench", weight: 200, reps: 5, date: "2026-01-01", sessionId: "s1" }, // pre-window, vol 1000
      { exName: "Bench", weight: 185, reps: 8, date: "2026-02-01", sessionId: "s2" }, // pre-window, vol 1480
      { exName: "Bench", weight: 300, reps: 1, date: "2026-06-10", sessionId: "s9" }, // IN-window → excluded
    ];
    const pb = priorBests(sets, WS).Bench;
    expect(pb.weight).toBe(200); // 300 is in-window, excluded
    expect(pb.volume).toBe(1480); // max single-session Σ(w*r) pre-window: s2 = 185*8
    expect(pb.ormEpley).toBeGreaterThan(0);
  });

  test("warmup-free caller contract: all-in-window or empty → no entry", () => {
    expect(priorBests([{ exName: "X", weight: 100, reps: 5, date: "2026-06-10", sessionId: "a" }], WS).X).toBeUndefined();
    expect(priorBests([], WS)).toEqual({});
  });
});
