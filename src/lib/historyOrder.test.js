import { exerciseOrderForSession } from "./historyOrder";

describe("exerciseOrderForSession", () => {
  test("returns the session's saved sets_data key order, NOT plan-day order", () => {
    // Saved order (how it was stored):
    const session = {
      dayLabel: "Pull",
      sets: { "Wide Grip Pulldown": { 1: {} }, "Extensions": { 1: {} }, "Rear Delt Machine": { 1: {} } },
    };
    // A plan with TWO "Pull" days whose first one orders exercises differently must not
    // influence the result — the function takes no plans and never sorts. (The old render
    // would have re-sorted by that first "Pull" day; this asserts saved order wins.)
    expect(exerciseOrderForSession(session)).toEqual([
      "Wide Grip Pulldown",
      "Extensions",
      "Rear Delt Machine",
    ]);
  });

  test("freeform session (no matching plan) → sets_data key order", () => {
    const session = { dayLabel: "Custom Day", sets: { A: { 1: {} }, B: { 1: {} }, C: { 1: {} } } };
    expect(exerciseOrderForSession(session)).toEqual(["A", "B", "C"]);
  });

  test("falls back to unique setsArr order when sets_data is missing", () => {
    const session = { setsArr: [{ exName: "X" }, { exName: "X" }, { exName: "Y" }, { exName: "Z" }, { exName: "Y" }] };
    expect(exerciseOrderForSession(session)).toEqual(["X", "Y", "Z"]);
  });

  test("empty / null session → empty array", () => {
    expect(exerciseOrderForSession({})).toEqual([]);
    expect(exerciseOrderForSession(null)).toEqual([]);
  });
});
