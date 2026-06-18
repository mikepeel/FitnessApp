import { historyWindow } from "./historyWindow";

const NOW = new Date("2026-06-18T12:00:00").getTime();
const DAY = 86400000;
const iso = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();

describe("historyWindow", () => {
  test("6m window returns ALL in-window sessions (no 100 cap) and includes an in-window partial", () => {
    const completed = Array.from({ length: 130 }, (_, i) => ({ id: "c" + i, completedAt: iso(10 + i) })); // 10..139d ago, all < 180d
    const partial = { id: "p1", completedAt: null, startedAt: iso(5) }; // in-progress
    const out = historyWindow([...completed, partial], "6m", NOW);
    expect(out.length).toBe(131); // not truncated at 100
    expect(out.find((s) => s.id === "p1")).toBeTruthy(); // partial included
  });

  test("partial inclusion is via COALESCE(completedAt, startedAt) — a completed_at-only predicate would drop it", () => {
    const partial = { id: "p1", completedAt: null, startedAt: iso(5) };
    // BEFORE (completed_at-only predicate): the partial is dropped.
    const completedOnly = [partial].filter((s) => s.completedAt && new Date(s.completedAt).getTime() >= NOW - 90 * DAY);
    expect(completedOnly).toHaveLength(0);
    // AFTER (COALESCE): the partial is kept.
    expect(historyWindow([partial], "3m", NOW).map((s) => s.id)).toEqual(["p1"]);
  });

  test("sorted newest-first by COALESCE date; partial's completedAt is coalesced for grouping", () => {
    const a = { id: "a", completedAt: iso(20) };
    const b = { id: "b", completedAt: null, startedAt: iso(2) }; // most recent (partial)
    const out = historyWindow([a, b], "all", NOW);
    expect(out.map((s) => s.id)).toEqual(["b", "a"]);
    expect(out[0].completedAt).toBe(iso(2)); // coalesced from startedAt
  });

  test("'all' applies no cutoff; dated filters exclude out-of-window sessions", () => {
    const old = { id: "old", completedAt: iso(400) };
    expect(historyWindow([old], "all", NOW).map((s) => s.id)).toEqual(["old"]);
    expect(historyWindow([old], "6m", NOW)).toEqual([]);
  });
});
