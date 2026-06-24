import { recentPRs } from "./recentPRs";

describe("recentPRs", () => {
  const prs = {
    Bench: { weight: 225, date: "2026-01-10T12:00:00Z" },
    Squat: { weight: 315, date: "2026-06-01T12:00:00Z" },
    Dead: { weight: 405, date: "2026-03-15T12:00:00Z" },
  };

  test("returns PRs newest-first by achieved date", () => {
    expect(recentPRs(prs).map(([n]) => n)).toEqual(["Squat", "Dead", "Bench"]);
  });

  test("FAILS-BEFORE → PASSES-AFTER: recency order differs from insertion-order slice", () => {
    const before = Object.entries(prs).slice(0, 8).map(([n]) => n); // old: ["Bench","Squat","Dead"]
    const after = recentPRs(prs).map(([n]) => n); //              new: ["Squat","Dead","Bench"]
    expect(after).not.toEqual(before);
    expect(after[0]).toBe("Squat"); // most-recently achieved first
  });

  test("caps at n (default 8)", () => {
    const many = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => ["Lift" + i, { weight: 100 + i, date: `2026-02-${String(i + 1).padStart(2, "0")}T00:00:00Z` }])
    );
    expect(recentPRs(many).length).toBe(8);
    expect(recentPRs(many, 3).length).toBe(3);
    expect(recentPRs(many, 3).map(([n]) => n)).toEqual(["Lift11", "Lift10", "Lift9"]); // newest 3
  });

  test("undated PRs sort last with a deterministic name tie-break", () => {
    const p = { A: { weight: 1, date: "" }, B: { weight: 1, date: "2026-01-01T00:00:00Z" }, C: { weight: 1 } };
    expect(recentPRs(p).map(([n]) => n)).toEqual(["B", "A", "C"]); // dated first; A & C undated → by name
  });
});
