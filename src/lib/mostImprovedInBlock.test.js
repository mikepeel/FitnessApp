import { mostImprovedInBlock } from "./mostImprovedInBlock";

const START = "2026-01-01";
const opts = { startDate: START };
// week 0 / 1 / 2 / 3 anchored on START (floor(days/7))
const W0 = "2026-01-01", W1 = "2026-01-08", W2 = "2026-01-15", W3 = "2026-01-22";

// one working set
const s = (name, sessionId, date, weight, reps) => ({ name, sessionId, date, weight, reps });

test("LOAD-BEARING: % gain beats a larger ABSOLUTE gain (normalization)", () => {
  const rows = [
    // Small lift: 50→50→60 @5  → e1RM 58.3→58.3→70  → +20%, abs ≈ +11.7
    s("Small", "sa1", W0, 50, 5), s("Small", "sa2", W1, 50, 5), s("Small", "sa3", W2, 60, 5),
    // Big lift: 300→300→330 @5 → e1RM 350→350→385   → +10%, abs = +35
    s("Big", "b1", W0, 300, 5), s("Big", "b2", W1, 300, 5), s("Big", "b3", W2, 330, 5),
  ];
  const res = mostImprovedInBlock(rows, opts);
  expect(res).not.toBeNull();
  expect(res.name).toBe("Small"); // % wins; absolute would pick "Big"
  expect(res.pctGain).toBeCloseTo(0.2, 2);
});

test("gate: only 2 sessions → ineligible → null", () => {
  const rows = [s("Two", "t1", W0, 100, 5), s("Two", "t2", W2, 200, 5)]; // huge gain, 2 sessions
  expect(mostImprovedInBlock(rows, opts)).toBeNull();
});

test("gate: 3 sessions within a SINGLE week → ineligible → null", () => {
  const rows = [
    s("Cluster", "c1", "2026-01-01", 100, 5),
    s("Cluster", "c2", "2026-01-02", 130, 5),
    s("Cluster", "c3", "2026-01-03", 160, 5), // all week 0
  ];
  expect(mostImprovedInBlock(rows, opts)).toBeNull();
});

test("smoothing: a fluky-low FIRST session does not inflate the winner", () => {
  const rows = [
    s("Smooth", "s1", W0, 40, 5),  // fluke low → e1RM 46.7
    s("Smooth", "s2", W1, 60, 5),  // 70
    s("Smooth", "s3", W2, 62, 5),  // 72.3
    s("Smooth", "s4", W3, 64, 5),  // 74.7
  ];
  const res = mostImprovedInBlock(rows, opts);
  expect(res).not.toBeNull();
  // baseline = best of first two (70, not 46.7) → gain ≈ 6.7%, NOT ~60%
  expect(res.pctGain).toBeGreaterThan(0);
  expect(res.pctGain).toBeLessThan(0.2);
});

test("rep progress at the same weight registers a positive gain (e1RM, not top weight)", () => {
  const rows = [
    s("Reps", "r1", W0, 185, 6), // 222
    s("Reps", "r2", W1, 185, 7), // 228.2
    s("Reps", "r3", W2, 185, 8), // 234.3
    s("Reps", "r4", W3, 185, 9), // 240.5
  ];
  const res = mostImprovedInBlock(rows, opts);
  expect(res).not.toBeNull();
  expect(res.name).toBe("Reps");
  expect(res.pctGain).toBeGreaterThan(0); // top-weight basis would be 0 here
});

test("null: no qualifying lift", () => {
  expect(mostImprovedInBlock([], opts)).toBeNull();
  expect(mostImprovedInBlock([s("Once", "o1", W0, 100, 5)], opts)).toBeNull(); // 1 session
});

test("null: best pctGain <= 0 (a decline is never crowned)", () => {
  const rows = [
    s("Down", "d1", W0, 100, 5), // 116.7
    s("Down", "d2", W1, 95, 5),  // 110.8
    s("Down", "d3", W2, 90, 5),  // 105
  ];
  expect(mostImprovedInBlock(rows, opts)).toBeNull();
});
