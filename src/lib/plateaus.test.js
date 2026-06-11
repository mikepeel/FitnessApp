import { detectPlateaus } from "./plateaus";

const NOW = new Date(2026, 5, 10, 12, 0, 0); // Jun 10 2026, local noon
const DAY = 86400000;
const fmt = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
// N weekly points; the LAST point is `endDaysAgo` days before NOW.
const weekly = (orms, endDaysAgo = 0) =>
  orms.map((orm, i) => {
    const fromEnd = orms.length - 1 - i;
    const dt = new Date(NOW.getTime() - (endDaysAgo + fromEnd * 7) * DAY);
    return { date: fmt(dt), orm };
  });

const flat6 = weekly([200, 200, 200, 200, 200, 200, 200]); // 7 pts, span 42d, last=now
const flat10 = weekly(Array(11).fill(200)); // 11 pts, span 70d
const declining = weekly([220, 215, 210, 205, 200, 195, 190]); // 7 pts, span 42d
const rising = weekly([200, 205, 210, 215, 220, 225, 230]); // gaining
const flatButOld = weekly([200, 200, 200, 200, 200, 200, 200], 30); // last trained 30d ago
const thin = weekly([200, 205, 210, 200]); // 4 pts

const opts = { now: NOW };

describe("detectPlateaus", () => {
  test("a rising lift is not flagged", () => {
    expect(detectPlateaus({ Rising: rising }, opts)).toEqual([]);
  });

  test("flat ~6 weeks → 'add reps or weight'", () => {
    expect(detectPlateaus({ Bench: flat6 }, opts)).toEqual([
      { exercise: "Bench", status: "flat", stalledWeeks: 6, currentOrm: 200, suggestion: "add reps or weight", viaVolume: false },
    ]);
  });

  test("flat ~10 weeks → 'variation'", () => {
    const r = detectPlateaus({ Squat: flat10 }, opts);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ exercise: "Squat", status: "flat", stalledWeeks: 10, suggestion: "variation" });
  });

  test("declining → 'deload'", () => {
    const r = detectPlateaus({ Deadlift: declining }, opts);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ exercise: "Deadlift", status: "declining", suggestion: "deload", currentOrm: 190 });
  });

  test("last trained 30 days ago → excluded (abandoned)", () => {
    expect(detectPlateaus({ Old: flatButOld }, opts)).toEqual([]);
  });

  test("thin data (<6 sessions) → excluded", () => {
    expect(detectPlateaus({ Thin: thin }, opts)).toEqual([]);
  });

  test("results are sorted by stalledWeeks desc; ineligible lifts excluded", () => {
    const r = detectPlateaus(
      { Flat10: flat10, Flat6: flat6, Dead: declining, Rising: rising, Thin: thin },
      opts
    );
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.exercise)).not.toContain("Rising");
    expect(r.map((x) => x.exercise)).not.toContain("Thin");
    expect(r[0]).toMatchObject({ exercise: "Flat10", stalledWeeks: 10 });
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].stalledWeeks).toBeGreaterThanOrEqual(r[i].stalledWeeks);
    }
  });

  // ── tonnage-aware gating ──
  test("flat e1RM + rising tonnage → excluded (volume progress)", () => {
    const e1rm = weekly(Array(7).fill(200));
    const tonnage = weekly([2000, 2200, 2400, 2600, 2800, 3000, 3200]);
    expect(detectPlateaus({ Bench: e1rm }, { now: NOW, tonnage: { Bench: tonnage } })).toEqual([]);
  });

  test("flat e1RM + flat tonnage → flagged (true plateau)", () => {
    const e1rm = weekly(Array(7).fill(200));
    const tonnage = weekly(Array(7).fill(2000));
    const r = detectPlateaus({ Bench: e1rm }, { now: NOW, tonnage: { Bench: tonnage } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ exercise: "Bench", status: "flat", suggestion: "add reps or weight", viaVolume: false });
  });

  test("declining e1RM + rising tonnage → still flagged 'deload' (not tonnage-gated)", () => {
    const e1rm = weekly([220, 215, 210, 205, 200, 195, 190]);
    const tonnage = weekly([2000, 2200, 2400, 2600, 2800, 3000, 3200]);
    const r = detectPlateaus({ Deadlift: e1rm }, { now: NOW, tonnage: { Deadlift: tonnage } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: "declining", suggestion: "deload" });
  });

  test("reps>12 at same weight (capped flat e1RM, rising tonnage) → excluded", () => {
    const e1rm = weekly(Array(7).fill(280));
    const tonnage = weekly([3000, 3300, 3600, 3900, 4200, 4500, 4800]);
    expect(detectPlateaus({ Squat: e1rm }, { now: NOW, tonnage: { Squat: tonnage } })).toEqual([]);
  });
});
