import { estimate1RM } from "./oneRepMax";

describe("estimate1RM (Epley)", () => {
  test("1 rep ≈ the weight × 31/30", () => {
    expect(estimate1RM(225, 1)).toBeCloseTo(232.5, 5);
  });

  test("mid-rep value: (225, 5) = 262.5", () => {
    expect(estimate1RM(225, 5)).toBeCloseTo(262.5, 5);
  });

  test("reps are capped at 12 (Epley degrades at high reps)", () => {
    expect(estimate1RM(225, 15)).toBeCloseTo(estimate1RM(225, 12), 5);
    expect(estimate1RM(225, 15)).toBeCloseTo(315, 5);
  });

  test("missing / <1 reps treated as a single rep", () => {
    expect(estimate1RM(225, 0)).toBeCloseTo(232.5, 5);
    expect(estimate1RM(225, undefined)).toBeCloseTo(232.5, 5);
    expect(estimate1RM(225, "")).toBeCloseTo(232.5, 5);
  });

  test("zero / invalid weight → 0", () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM("", 5)).toBe(0);
    expect(estimate1RM(null, 5)).toBe(0);
    expect(estimate1RM("abc", 5)).toBe(0);
  });

  test("accepts string inputs (sets_data stores strings)", () => {
    expect(estimate1RM("225", "5")).toBeCloseTo(262.5, 5);
  });
});
