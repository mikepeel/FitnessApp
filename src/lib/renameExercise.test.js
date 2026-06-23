import { renameSetsData, setsToArr, planRename, enrichIsPR, otherOccurrence } from "./renameExercise";

describe("otherOccurrence — prompt detection sees all given sessions (cap-coverage)", () => {
  const edited = { id: "e", sets: { Squat: {} } };
  const beyond = { id: "b", sets: { Squat: {} } };
  test("finds an occurrence in another session", () => {
    expect(otherOccurrence([edited, beyond], "Squat", "e")).toBe(true);
  });
  test("excludes the edited session itself", () => {
    expect(otherOccurrence([edited], "Squat", "e")).toBe(false);
  });
  test("FAILS-BEFORE: a capped list missing the beyond-cap session reports no occurrence", () => {
    expect(otherOccurrence([edited], "Squat", "e")).toBe(false); // 'b' (beyond cap) absent → missed
  });
  test("PASSES-AFTER: the full (uncapped) list finds the beyond-cap occurrence", () => {
    expect(otherOccurrence([edited, beyond], "Squat", "e")).toBe(true);
  });
});

describe("enrichIsPR + rename PRESERVES is_pr on the correct set (carry-over, not recompute)", () => {
  test("non-merge: each set keeps its stored flag after rename", () => {
    const sets = { A: { 1: { weight: "100", reps: "5" }, 2: { weight: "100", reps: "5" } } };
    const prMap = { "A|1": true, "A|2": false }; // set 1 was a PR when performed, set 2 not
    const arr = setsToArr(renameSetsData(enrichIsPR(sets, prMap), "A", "B"));
    expect(arr.find((x) => x.setNum === 1)).toMatchObject({ exName: "B", isPR: true });
    expect(arr.find((x) => x.setNum === 2)).toMatchObject({ exName: "B", isPR: false });
  });

  test("FAILS-BEFORE: without enrich, a stored flag absent from sets_data is dropped; with enrich, kept", () => {
    const sets = { A: { 1: { weight: "100", reps: "5" } } }; // sets_data lacks isPR (the ~half case)
    expect(setsToArr(renameSetsData(sets, "A", "B"))[0].isPR).toBe(false); // before: badge lost
    expect(setsToArr(renameSetsData(enrichIsPR(sets, { "A|1": true }), "A", "B"))[0].isPR).toBe(true); // after: kept
  });

  test("merge/renumber: the flag follows the physical lift instance and none is invented", () => {
    // Session has A (flagged) and B (not). Rename A→B → A's set moves to B#2 and keeps its flag;
    // existing B#1 stays unflagged.
    const sets = { A: { 1: { weight: "100", reps: "5" } }, B: { 1: { weight: "90", reps: "5" } } };
    const arr = setsToArr(renameSetsData(enrichIsPR(sets, { "A|1": true, "B|1": false }), "A", "B"));
    const bySet = Object.fromEntries(arr.map((x) => [x.setNum, x]));
    expect(bySet[1]).toMatchObject({ exName: "B", weight: "90", isPR: false }); // original B, unchanged
    expect(bySet[2]).toMatchObject({ exName: "B", weight: "100", isPR: true }); // moved A keeps its flag
    expect(arr.filter((x) => x.isPR).length).toBe(1); // exactly one — none invented
  });

  test("idempotent: re-running after the rename (oldName gone) changes nothing", () => {
    const renamed = { B: { 1: { weight: "90", reps: "5", isPR: false }, 2: { weight: "100", reps: "5", isPR: true } } };
    const prMap = { "B|1": false, "B|2": true };
    const again = setsToArr(renameSetsData(enrichIsPR(renamed, prMap), "A", "B")); // no A → no-op rename
    expect(again.filter((x) => x.isPR).map((x) => x.setNum)).toEqual([2]);
  });
});

describe("renameSetsData", () => {
  test("renames a key", () => {
    expect(renameSetsData({ "Bench Pres": { 1: { weight: "100", reps: "5" } } }, "Bench Pres", "Bench Press"))
      .toEqual({ "Bench Press": { 1: { weight: "100", reps: "5" } } });
  });

  test("merge: renaming into an existing name RENUMBERS moving sets (no key/set_number collision)", () => {
    const out = renameSetsData({ A: { 1: { weight: "1" } }, B: { 1: { weight: "2" } } }, "A", "B");
    expect(Object.keys(out)).toEqual(["B"]);
    expect(out.B).toEqual({ 1: { weight: "2" }, 2: { weight: "1" } }); // existing B kept, A's set appended as #2
    // The rebuilt logged_sets therefore have DISTINCT set numbers — the divergence a blind
    // exercise_name UPDATE would create (duplicate set_number 1) is avoided.
    const arr = setsToArr(out);
    expect(arr.filter((x) => x.exName === "B").map((x) => x.setNum).sort()).toEqual([1, 2]);
  });

  test("no-op when oldName absent or old===new (same ref)", () => {
    const o = { A: { 1: { weight: "1" } } };
    expect(renameSetsData(o, "X", "Y")).toBe(o);
    expect(renameSetsData(o, "A", "A")).toBe(o);
  });
});

describe("setsToArr after rename reflects the new name (logged_sets store source)", () => {
  test("flattened rows carry the new exercise name", () => {
    const renamed = renameSetsData({ "Old Lift": { 1: { weight: "100", reps: "5" } } }, "Old Lift", "New Lift");
    expect(setsToArr(renamed)).toEqual([{ exName: "New Lift", setNum: 1, weight: "100", reps: "5", minutes: "", level: "", isPR: false, type: "working" }]);
  });
});

describe("planRename — uncapped coverage (fails-before / passes-after)", () => {
  // Model the loaded window (first 100 rows) plus rows BEYOND it. The old logic iterated only the
  // capped prop; the fix passes ALL rows.
  const windowRows = Array.from({ length: 100 }, (_, i) => ({ id: "w" + i, sets_data: { Other: { 1: { weight: "1" } } } }));
  windowRows[3].sets_data = { "Old Lift": { 1: { weight: "100", reps: "5" } } };
  const beyondRows = [{ id: "beyond1", sets_data: { "Old Lift": { 1: { weight: "200", reps: "3" } } } }];
  const allRows = [...windowRows, ...beyondRows];

  test("PASSES-AFTER: renames occurrences in BOTH the window and beyond it (across both stores)", () => {
    const plan = planRename(allRows, "Old Lift", "New Lift");
    const ids = plan.map((p) => p.id);
    expect(ids).toContain("w3"); // in-window
    expect(ids).toContain("beyond1"); // beyond the cap
    const beyond = plan.find((p) => p.id === "beyond1");
    expect(beyond.sets_data).toEqual({ "New Lift": { 1: { weight: "200", reps: "3" } } }); // sets_data store
    expect(setsToArr(beyond.sets_data)[0].exName).toBe("New Lift"); // logged_sets store source
  });

  test("FAILS-BEFORE: the capped slice (old capped-iteration logic) misses the beyond-window occurrence", () => {
    const cappedPlan = planRename(allRows.slice(0, 100), "Old Lift", "New Lift");
    expect(cappedPlan.map((p) => p.id)).toContain("w3");
    expect(cappedPlan.map((p) => p.id)).not.toContain("beyond1"); // the bug: beyond-window never renamed
  });

  test("no-op when old===new", () => {
    expect(planRename(allRows, "Old Lift", "Old Lift")).toEqual([]);
  });
});
