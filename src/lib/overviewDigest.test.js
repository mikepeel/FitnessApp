import { assembleDigest } from "./overviewDigest";

const kinds = (d) => d.lines.map((l) => l.kind);
const texts = (d) => d.lines.map((l) => l.text);

describe("assembleDigest", () => {
  test("always-on adherence line is present in EVERY state (even with nothing situational)", () => {
    const d = assembleDigest({ adherence: { done: 2, target: 4, status: "on_pace" } });
    expect(d.lines[0].kind).toBe("adherence");
    expect(d.lines[0].text).toBe("2 of 4 this week — on pace");
    // nothing situational fired → the warm empty state, not a list of absences
    expect(kinds(d)).toEqual(["adherence", "ok"]);
    expect(d.lines[1].text).toBe("Training's on track");
  });

  test("adherence pairs with the current streak when present; no_target drops the 'of Y'", () => {
    expect(assembleDigest({ adherence: { done: 3, target: 4, status: "on_pace" }, currentStreak: 5 }).lines[0].text)
      .toBe("3 of 4 this week — on pace · 5-session streak");
    expect(assembleDigest({ adherence: { done: 2, target: 0, status: "no_target" } }).lines[0].text)
      .toBe("2 sessions this week");
  });

  test("POSITIVE-FIRST ordering: PR above plateau when both fire for DIFFERENT lifts", () => {
    const d = assembleDigest({
      adherence: { done: 3, target: 4, status: "on_pace" },
      recentPR: { lift: "Deadlift", weight: 405, when: "2d ago" },
      plateaus: [{ exercise: "Squat", stalledWeeks: 4 }],
    });
    expect(kinds(d)).toEqual(["adherence", "pr", "plateau"]);
    expect(d.lines[1].text).toBe("New PR: Deadlift 405 lb (2d ago)");
    expect(d.lines[2].text).toBe("Squat has stalled 4 weeks");
  });

  test("PER-LIFT DEDUP: same lift PR + plateau -> ONE line (PR); a DIFFERENT lift's stall still shows", () => {
    const d = assembleDigest({
      adherence: { done: 3, target: 4, status: "on_pace" },
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
    const d = assembleDigest({ adherence: { done: 1, target: 3, status: "on_pace" }, volumeFlag: { group: "Shoulders", status: "high" } });
    expect(kinds(d).filter((k) => k === "volume")).toHaveLength(1);
    expect(d.lines[1].text).toBe("Shoulders above the productive range (by logged-set count)");
  });

  test("behind status is honest but not harsh; tone flags it", () => {
    const d = assembleDigest({ adherence: { done: 1, target: 4, status: "behind" } });
    expect(d.lines[0].text).toBe("1 of 4 this week — behind");
    expect(d.lines[0].tone).toBe("caution");
  });
});
