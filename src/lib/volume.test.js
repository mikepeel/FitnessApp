import { rollingVolume, sessionVolume } from "./volume";

const NOW = new Date(2026, 5, 10, 12, 0, 0); // Jun 10 2026, local noon
const DAY = 86400000;

// A completed session worth 1000 volume (100×10 working set); the warmup is excluded.
const sess = (daysAgo, hourOffset = 0) => ({
  completedAt: new Date(NOW.getTime() - daysAgo * DAY + hourOffset * 3600000).toISOString(),
  setsArr: [
    { weight: "100", reps: "10", type: "working" }, // 1000
    { weight: "200", reps: "5", type: "warmup" }, // excluded
  ],
});

describe("sessionVolume", () => {
  test("sums weight×reps over working sets, excludes warmups", () => {
    expect(sessionVolume(sess(0))).toBe(1000);
  });
  test("missing setsArr → 0", () => {
    expect(sessionVolume({})).toBe(0);
  });
});

describe("rollingVolume", () => {
  test("a session within the last 28 days counts toward current", () => {
    expect(rollingVolume([sess(14)], NOW)).toEqual({ current: 1000, previous: 0 });
  });

  test("28-day boundary, current side (just under 28d) → current", () => {
    expect(rollingVolume([sess(28, 1)], NOW)).toEqual({ current: 1000, previous: 0 });
  });

  test("exactly 28 days ago → previous (half-open windows)", () => {
    expect(rollingVolume([sess(28)], NOW)).toEqual({ current: 0, previous: 1000 });
  });

  test("a session 28–56 days ago counts toward previous", () => {
    expect(rollingVolume([sess(42)], NOW)).toEqual({ current: 0, previous: 1000 });
  });

  test("56-day cutoff excludes older sessions", () => {
    expect(rollingVolume([sess(50), sess(60)], NOW)).toEqual({ current: 0, previous: 1000 });
  });

  test("empty previous window → previous 0, current can be >0", () => {
    expect(rollingVolume([sess(3)], NOW)).toEqual({ current: 1000, previous: 0 });
  });

  test("both windows empty → { current: 0, previous: 0 }", () => {
    expect(rollingVolume([], NOW)).toEqual({ current: 0, previous: 0 });
    expect(rollingVolume([sess(100)], NOW)).toEqual({ current: 0, previous: 0 });
  });

  test("accumulates multiple sessions per window", () => {
    expect(rollingVolume([sess(5), sess(10), sess(40)], NOW)).toEqual({ current: 2000, previous: 1000 });
  });
});
