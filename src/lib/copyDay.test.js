import { copyDayInto } from "./copyDay";

// Deterministic fresh-id generator for assertions.
const mkCounter = () => { let k = 0; return () => `new_${k++}`; };

const SRC = {
  id: "src", name: "Tuesday", label: "Pull", tag: "Back . Biceps", color: "#3d8eff", isRest: false,
  exercises: [
    { id: "s1", name: "A", sets: "3", reps: "10", muscle: "Back" },
    { id: "s2", name: "B", sets: "3", reps: "10", muscle: "Biceps" },
    { id: "s3", name: "C", sets: "3", reps: "12", muscle: "Back" },
  ],
};
const names = (arr) => arr.map((e) => e.name);
const ids = (arr) => arr.map((e) => e.id);

test("copy into an EMPTY target: exercises = source in authored order, FRESH ids, target keeps id/name/slot", () => {
  const target = { id: "sat", name: "Saturday", label: "Rest?", tag: "x", color: "#000", isRest: false, exercises: [] };
  const days = [SRC, target];
  const out = copyDayInto(days, "sat", "src", "replace", mkCounter());
  const t = out.find((d) => d.id === "sat");
  expect(names(t.exercises)).toEqual(["A", "B", "C"]);           // source authored order
  expect(ids(t.exercises)).toEqual(["new_0", "new_1", "new_2"]); // fresh ids
  // FRESH-ID GUARD: copied ids differ from the source's (no cross-wire). Mutation-check: change copyDay
  // to reuse `id:e.id` and this fails.
  ids(t.exercises).forEach((id) => expect(ids(SRC.exercises)).not.toContain(id));
  expect(t.id).toBe("sat");        // target keeps its own id
  expect(t.name).toBe("Saturday"); // ...and its own name/slot
  expect(t.label).toBe("Pull");    // takes source's label/tag/color
  expect(t.tag).toBe("Back . Biceps");
  expect(t.color).toBe("#3d8eff");
});

test("pure: the source day and the input array are not mutated (not frozen — result is independent)", () => {
  const target = { id: "sat", name: "Saturday", label: "L", tag: "t", color: "#000", isRest: false, exercises: [] };
  const days = [SRC, target];
  const out = copyDayInto(days, "sat", "src", "replace", mkCounter());
  expect(SRC.exercises).toHaveLength(3);           // source untouched
  expect(days.find((d) => d.id === "sat").exercises).toHaveLength(0); // original target untouched
  const t = out.find((d) => d.id === "sat");
  expect(t.exercises).not.toBe(SRC.exercises);     // distinct array → reorder can't bleed into source
  t.exercises.forEach((e, i) => expect(e).not.toBe(SRC.exercises[i])); // distinct objects
});

test("REPLACE into a NON-empty target: existing dropped, target = source copies only", () => {
  const target = { id: "sat", name: "Saturday", label: "L", tag: "t", color: "#000", isRest: false, exercises: [{ id: "x1", name: "X" }] };
  const out = copyDayInto([SRC, target], "sat", "src", "replace", mkCounter());
  const t = out.find((d) => d.id === "sat");
  expect(names(t.exercises)).toEqual(["A", "B", "C"]);
});

test("APPEND into a NON-empty target: existing + source copies, in order", () => {
  const target = { id: "sat", name: "Saturday", label: "L", tag: "t", color: "#000", isRest: false, exercises: [{ id: "x1", name: "X" }] };
  const out = copyDayInto([SRC, target], "sat", "src", "append", mkCounter());
  const t = out.find((d) => d.id === "sat");
  expect(names(t.exercises)).toEqual(["X", "A", "B", "C"]);
  expect(t.exercises.filter((e) => e.name === "X")).toHaveLength(1); // existing kept its own id, not clobbered
});

test("REST target: isRest flips to false and the copied exercises are present", () => {
  const rest = { id: "sun", name: "Sunday", label: "Rest", tag: "Full Rest", color: "#aaff00", isRest: true, exercises: [] };
  const out = copyDayInto([SRC, rest], "sun", "src", "replace", mkCounter());
  const t = out.find((d) => d.id === "sun");
  expect(t.isRest).toBe(false);
  expect(names(t.exercises)).toEqual(["A", "B", "C"]);
});

test("append the SAME source twice → all ids unique within the day (fresh-id necessity)", () => {
  const target = { id: "sat", name: "Saturday", label: "L", tag: "t", color: "#000", isRest: false, exercises: [] };
  const mk = mkCounter();
  let out = copyDayInto([SRC, target], "sat", "src", "append", mk);
  out = copyDayInto(out, "sat", "src", "append", mk);
  const t = out.find((d) => d.id === "sat");
  expect(names(t.exercises)).toEqual(["A", "B", "C", "A", "B", "C"]);
  expect(new Set(ids(t.exercises)).size).toBe(6); // no duplicate ids within the day
});

test("no-op: self-copy or missing source returns the list unchanged", () => {
  const days = [SRC];
  expect(copyDayInto(days, "src", "src", "replace", mkCounter())).toBe(days); // self-copy
  expect(copyDayInto(days, "src", "nope", "replace", mkCounter())).toBe(days); // missing source
});
