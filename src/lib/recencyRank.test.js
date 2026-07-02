import { lastTrainedMap, daysIdle, orderByRecency, orderPRsByRecency, DORMANT_DAYS } from "./recencyRank";

const NOW = new Date("2026-07-01T12:00:00"); // dormant = last trained on/before 2026-06-10 (>21d)

describe("lastTrainedMap", () => {
  test("max completedAt (local date) per lift from setsArr; nothing else needed", () => {
    const sessions = [
      { completedAt: "2026-06-01T15:00:00Z", setsArr: [{ exName: "A" }, { exName: "B" }] },
      { completedAt: "2026-06-20T15:00:00Z", setsArr: [{ exName: "A" }] },
    ];
    const m = lastTrainedMap(sessions);
    expect(m.A).toBe("2026-06-20"); // later of the two A sessions
    expect(m.B).toBe("2026-06-01");
  });
  test("daysIdle: unknown lift → Infinity (most dormant)", () => {
    expect(daysIdle("Nope", { A: "2026-06-29" }, NOW)).toBe(Infinity);
    expect(daysIdle("A", { A: "2026-06-29" }, NOW)).toBe(2);
  });
});

describe("orderByRecency — All-Lifts: recent-first, dormant DEMOTED not hidden", () => {
  // Names chosen so alphabetical (the OLD order) puts the dormant lift FIRST.
  const lt = { "AutoTest-Dormant": "2026-06-04", "AutoTest-Recent": "2026-06-29" }; // 27d idle vs 2d idle

  test("recent ranks ABOVE dormant, and dormant STILL appears", () => {
    const ordered = orderByRecency(["AutoTest-Dormant", "AutoTest-Recent"], lt, NOW);
    expect(ordered[0]).toBe("AutoTest-Recent");        // recent leads (was alphabetical → Dormant first)
    expect(ordered).toContain("AutoTest-Dormant");     // load-bearing: demote, not hide
  });

  test("a lift never trained (unknown) sinks last but stays present", () => {
    const ordered = orderByRecency(["Zzz", "AutoTest-Recent", "AutoTest-Dormant"], lt, NOW);
    expect(ordered[0]).toBe("AutoTest-Recent");
    expect(ordered[ordered.length - 1]).toBe("Zzz");
    expect(ordered).toHaveLength(3); // nothing dropped
  });

  test("alphabetical tiebreak when equally idle (stable, scannable)", () => {
    const lt2 = { A: "2026-06-29", B: "2026-06-29" };
    expect(orderByRecency(["B", "A"], lt2, NOW)).toEqual(["A", "B"]);
  });
});

describe("orderPRsByRecency — PR board: active tier before dormant, heaviest within tier", () => {
  const lt = { "AutoTest-Recent": "2026-06-29", "AutoTest-Dormant": "2026-06-04" }; // active 2d vs dormant 27d

  test("a RECENT lighter PR ranks ABOVE a DORMANT heavier PR (was pure weight DESC), dormant still present", () => {
    const entries = [["AutoTest-Dormant", { weight: 300 }], ["AutoTest-Recent", { weight: 100 }]];
    const ordered = orderPRsByRecency(entries, lt, NOW);
    expect(ordered[0][0]).toBe("AutoTest-Recent");                 // active leads over the heavier dormant
    expect(ordered.map((e) => e[0])).toContain("AutoTest-Dormant"); // load-bearing: demote, not hide
  });

  test("within a tier, heavier first; across tiers, active always outranks dormant", () => {
    const lt2 = { A: "2026-06-29", B: "2026-06-29", C: "2026-05-01" }; // A,B active; C dormant
    const ordered = orderPRsByRecency([["A", { weight: 100 }], ["B", { weight: 200 }], ["C", { weight: 999 }]], lt2, NOW);
    expect(ordered.map((e) => e[0])).toEqual(["B", "A", "C"]); // active heavy, active light, then dormant (even at 999)
  });

  test("DORMANT_DAYS boundary is shared with the plateau gate idea", () => {
    expect(DORMANT_DAYS).toBe(21);
  });
});
