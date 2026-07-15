import { workoutDisplayOrder } from "./workoutOrder";

// Authored plan-day order: A, B, C, D.
const mk = (n) => ({ id: n.toLowerCase(), name: n, muscle: "Chest" });
const A = mk("A"), B = mk("B"), C = mk("C"), D = mk("D"), E = mk("E");
const AUTHORED = [A, B, C, D];
const names = (arr) => arr.map((e) => e.name);
const logged = (n) => ({ [n]: { 1: { weight: "100", reps: "5" } } });

describe("workoutDisplayOrder", () => {
  test("UX PRESERVED: a completed exercise moves to the end of the DISPLAY", () => {
    const shown = workoutDisplayOrder(AUTHORED, { completedIds: ["c"] });
    expect(names(shown)).toEqual(["A", "B", "D", "C"]);
  });

  test("THE LOAD-BEARING CASE: the authored array is NOT mutated by the display shuffle, so a mid-workout ADD writes authored order + E", () => {
    const authored = [...AUTHORED];
    const shown = workoutDisplayOrder(authored, { completedIds: ["c"] });
    expect(names(shown)).toEqual(["A", "B", "D", "C"]); // display shuffled…
    // …while the array persistToPlan reads is untouched. This is the whole fix.
    expect(names(authored)).toEqual(["A", "B", "C", "D"]);
    // What the four mid-workout mutators hand to persistToPlan, derived from that array:
    expect(names([...authored, E])).toEqual(["A", "B", "C", "D", "E"]); // add
    expect(names(authored.filter((e) => e.id !== "b"))).toEqual(["A", "C", "D"]); // delete
    expect(names(authored.map((e) => (e.id === "b" ? { ...e, name: "B2" } : e)))).toEqual(["A", "B2", "C", "D"]); // swap/edit
  });

  test("done pile keeps COMPLETION order, not authored order", () => {
    const shown = workoutDisplayOrder(AUTHORED, { completedIds: ["c", "a"] });
    expect(names(shown)).toEqual(["B", "D", "C", "A"]); // C finished before A
  });

  test("ranking: in-progress first, untouched next, completed last", () => {
    const shown = workoutDisplayOrder(AUTHORED, { completedIds: ["a"], loggedSets: logged("D") });
    expect(names(shown)).toEqual(["D", "B", "C", "A"]);
  });

  test("prepop (suggested) sets do not count as in-progress", () => {
    const shown = workoutDisplayOrder([A, B], { loggedSets: { A: { 1: { weight: "100", reps: "5", prepop: true } } } });
    expect(names(shown)).toEqual(["A", "B"]); // A stays rank 1, authored order holds
  });

  test("cardio counts as in-progress only via minutes", () => {
    const cardio = { id: "s", name: "Stair Stepper", muscle: "Cardio" };
    const shown = workoutDisplayOrder([A, cardio], { loggedSets: { "Stair Stepper": { 1: { minutes: "20" } } } });
    expect(names(shown)).toEqual(["Stair Stepper", "A"]);
  });

  test("lastActive floats to the top among in-progress", () => {
    const shown = workoutDisplayOrder(AUTHORED, { loggedSets: { ...logged("B"), ...logged("D") }, lastActive: "D" });
    expect(names(shown).slice(0, 2)).toEqual(["D", "B"]);
  });

  test("EXPLICIT REORDER STILL WORKS: an authored reorder is reflected (the plan is not frozen)", () => {
    const reordered = [D, C, B, A]; // what PlanTab reorderExercises would produce
    expect(names(workoutDisplayOrder(reordered, {}))).toEqual(["D", "C", "B", "A"]);
  });

  test("empty / missing input is safe", () => {
    expect(workoutDisplayOrder([], {})).toEqual([]);
    expect(workoutDisplayOrder(null, {})).toEqual([]);
    expect(names(workoutDisplayOrder(AUTHORED))).toEqual(["A", "B", "C", "D"]);
  });
});
