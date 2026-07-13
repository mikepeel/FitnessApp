import { assembleDigest } from "./overviewDigest";

const kinds = (d) => d.lines.map((l) => l.kind);
const texts = (d) => d.lines.map((l) => l.text);

describe("assembleDigest", () => {
  test("always-on adherence line is present in EVERY state (even with nothing situational)", () => {
    const d = assembleDigest({ adherence: { done: 2, target: 4, status: "on_track" } });
    expect(d.lines[0].kind).toBe("adherence");
    expect(d.lines[0].text).toBe("2 of 4 this week"); // neutral count — no "on pace"/"behind" tail
    // nothing situational fired → the warm empty state, not a list of absences
    expect(kinds(d)).toEqual(["adherence", "ok"]);
    expect(d.lines[1].text).toBe("Training's on track");
  });

  test("adherence pairs with the current streak when present; no_target drops the 'of Y'", () => {
    expect(assembleDigest({ adherence: { done: 3, target: 4, status: "on_track" }, currentStreak: 5 }).lines[0].text)
      .toBe("3 of 4 this week · 5-session streak");
    expect(assembleDigest({ adherence: { done: 2, target: 0, status: "no_target" } }).lines[0].text)
      .toBe("2 sessions this week");
  });

  test("POSITIVE-FIRST ordering: PR above plateau when both fire for DIFFERENT lifts", () => {
    const d = assembleDigest({
      adherence: { done: 3, target: 4, status: "on_track" },
      recentPR: { lift: "Deadlift", weight: 405, when: "2d ago" },
      plateaus: [{ exercise: "Squat", stalledWeeks: 4 }],
    });
    expect(kinds(d)).toEqual(["adherence", "pr", "plateau"]);
    expect(d.lines[1].text).toBe("New PR: Deadlift 405 lb (2d ago)");
    expect(d.lines[2].text).toBe("Squat has stalled 4 weeks");
  });

  test("PER-LIFT DEDUP: same lift PR + plateau -> ONE line (PR); a DIFFERENT lift's stall still shows", () => {
    const d = assembleDigest({
      adherence: { done: 3, target: 4, status: "on_track" },
      recentPR: { lift: "Bench", weight: 225, when: "today" },
      plateaus: [{ exercise: "Bench", stalledWeeks: 6 }, { exercise: "Squat", stalledWeeks: 3 }],
    });
    // Bench shows ONCE (the PR); the Bench plateau is suppressed; Squat's stall is NOT hidden.
    expect(kinds(d)).toEqual(["adherence", "pr", "plateau"]);
    expect(d.lines[1].text).toBe("New PR: Bench 225 lb (today)");
    expect(d.lines[2].text).toBe("Squat has stalled 3 weeks"); // load-bearing: a real different-lift stall survives
    expect(texts(d).join(" ")).not.toMatch(/Bench has stalled/); // the same-lift stall is gone
  });

  test("CAP 3: when >3 situational fire, keep exactly the top 3 (positive-first); deload (4th) drops", () => {
    const d = assembleDigest({
      adherence: { done: 4, target: 4, status: "complete" },
      recentPR: { lift: "OHP", weight: 135, when: "1d ago" },
      plateaus: [{ exercise: "Row", stalledWeeks: 5 }],
      volumeFlag: { group: "Back", status: "under" },
      deloadNewlyDue: true,
    });
    expect(kinds(d)).toEqual(["adherence", "pr", "plateau", "volume"]); // 3 situational, deload dropped
    expect(d.lines).toHaveLength(4);
  });

  test("exactly ONE volume line; it carries the working-set-proxy basis", () => {
    const d = assembleDigest({ adherence: { done: 1, target: 3, status: "on_track" }, volumeFlag: { group: "Shoulders", status: "high" } });
    expect(kinds(d).filter((k) => k === "volume")).toHaveLength(1);
    expect(d.lines[1].text).toBe("Shoulders above the productive range (by logged-set count)");
  });

  test("a MAINTENANCE volume flag reads as HOLDING, not 'below the productive range'", () => {
    const d = assembleDigest({ adherence: { done: 3, target: 4, status: "on_track" }, volumeFlag: { group: "Chest", status: "maintenance" } });
    const vol = d.lines.find((l) => l.kind === "volume");
    expect(vol.text).toBe("Chest at maintenance volume — holding, not building (by logged-set count)");
    expect(vol.text).not.toMatch(/below the productive range/);
  });

  test("SOFTENED: a shortfall reads as a neutral count — never 'behind', never caution tone", () => {
    // The BDP case: a finished-but-short week is a plain count, not a scold.
    const d = assembleDigest({ adherence: { done: 4, target: 5, status: "on_track" } });
    expect(d.lines[0].text).toBe("4 of 5 this week");
    expect(d.lines[0].tone).toBe("neutral");
    expect(d.lines[0].text).not.toMatch(/behind/i); // mutation guard: re-add a "— behind" tail -> this fails
  });

  test("only a MET target is celebrated: complete -> positive, everything else stays neutral", () => {
    const complete = assembleDigest({ adherence: { done: 5, target: 5, status: "complete" } }).lines[0];
    expect(complete.text).toBe("5 of 5 this week — complete");
    expect(complete.tone).toBe("positive");
    // No status produces "behind" anywhere in the adherence copy.
    for (const status of ["on_track", "complete", "no_target"]) {
      const t = assembleDigest({ adherence: { done: 4, target: 5, status } }).lines[0].text;
      expect(t).not.toMatch(/behind/i);
    }
  });
});
