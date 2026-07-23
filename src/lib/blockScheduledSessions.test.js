import { blockScheduledSessions } from "./blockScheduledSessions";

const T = { isRest: false };
const R = { isRest: true };
const plan = (days, durationWeeks) => ({ days, durationWeeks });

test("4 training / 3 rest over 8 weeks → 32", () => {
  // 7-day rotation, 4 non-rest, 8 full rotations
  expect(blockScheduledSessions(plan([T, T, T, T, R, R, R], 8))).toBe(32);
});

test("all-rest plan → 0", () => {
  expect(blockScheduledSessions(plan([R, R, R, R, R, R, R], 8))).toBe(0);
});

test("no days → 0", () => {
  expect(blockScheduledSessions(plan([], 8))).toBe(0);
  expect(blockScheduledSessions({})).toBe(0);
  expect(blockScheduledSessions(null)).toBe(0);
});

test("missing durationWeeks → 10-week default (matches App.js)", () => {
  // 4 non-rest per 7-day week × 10 weeks
  expect(blockScheduledSessions(plan([T, T, T, T, R, R, R]))).toBe(40);
  expect(blockScheduledSessions(plan([T, T, T, T, R, R, R], 0))).toBe(40); // 0 || 10
});

test("rotation not evenly dividing the block is handled per-day", () => {
  // 5-day rotation (3 train, 2 rest) over 8 weeks = 56 days.
  // 56 = 11 full cycles (55 days → 33 train) + day 55 (index%5==0 → train) = 34.
  expect(blockScheduledSessions(plan([T, T, T, R, R], 8))).toBe(34);
});
