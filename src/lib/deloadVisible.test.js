import { deloadVisible, DELOAD_DISMISS_WINDOW_MS } from "./deloadVisible";

const NOW = new Date("2026-06-26T12:00:00Z");
const agoMs = (ms) => new Date(NOW.getTime() - ms).toISOString();
const days = (n) => n * 86400000;

describe("deloadVisible", () => {
  test("not due → hidden regardless of dismissal", () => {
    expect(deloadVisible(false, null, NOW)).toBe(false);
    expect(deloadVisible(false, agoMs(days(30)), NOW)).toBe(false); // even long-expired
    expect(deloadVisible(false, agoMs(days(1)), NOW)).toBe(false);
  });

  test("due and never dismissed → shown", () => {
    expect(deloadVisible(true, null, NOW)).toBe(true);
    expect(deloadVisible(true, undefined, NOW)).toBe(true);
  });

  test("PASSES-AFTER: due but dismissed within the 7-day window → hidden (persisted dismissal suppresses)", () => {
    // Before the fix this state was unreachable on load (dismissal lived in local state lost on
    // reload, so the prompt always returned). With persistence, a recent dismissal hides it.
    expect(deloadVisible(true, agoMs(days(1)), NOW)).toBe(false);
    expect(deloadVisible(true, agoMs(0), NOW)).toBe(false); // just dismissed
  });

  test("NON-HAPPY-PATH: dismissed older than 7 days while still due → RETURNS (window expires, not forever)", () => {
    expect(deloadVisible(true, agoMs(days(8)), NOW)).toBe(true);
    expect(deloadVisible(true, agoMs(days(30)), NOW)).toBe(true);
  });

  test("boundary: exactly 7 days → still hidden; just past → shown", () => {
    expect(deloadVisible(true, agoMs(DELOAD_DISMISS_WINDOW_MS), NOW)).toBe(false);     // == window, not yet >
    expect(deloadVisible(true, agoMs(DELOAD_DISMISS_WINDOW_MS + 1000), NOW)).toBe(true); // just past
  });

  test("unparseable dismissedAt → don't suppress (fail open to showing)", () => {
    expect(deloadVisible(true, "not-a-date", NOW)).toBe(true);
  });
});
