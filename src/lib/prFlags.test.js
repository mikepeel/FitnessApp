import { flagPRs } from "./prFlags";

describe("flagPRs — weight-level running-max rule", () => {
  test("prior 80, sets 85/85/85 → only the first 85 is a PR", () => {
    expect(flagPRs([{ weight: 85 }, { weight: 85 }, { weight: 85 }], 80)).toEqual([
      true,
      false,
      false,
    ]);
  });

  test("prior 80, sets 85/90/95 → every set is a PR", () => {
    expect(flagPRs([{ weight: 85 }, { weight: 90 }, { weight: 95 }], 80)).toEqual([
      true,
      true,
      true,
    ]);
  });

  test("prior 80, set 80 → tie is not a PR (strict >)", () => {
    expect(flagPRs([{ weight: 80 }], 80)).toEqual([false]);
  });

  test("no history, first set → PR", () => {
    expect(flagPRs([{ weight: 135 }], 0)).toEqual([true]);
  });

  test("warmup sets are ignored — no flag and no running-max bump", () => {
    // A heavy warmup must neither be a PR nor block a lighter working PR.
    expect(flagPRs([{ weight: 225, warmup: true }, { weight: 85 }], 80)).toEqual([
      false,
      true,
    ]);
  });

  // ── extra guards ──
  test("plain numbers are accepted as weights", () => {
    expect(flagPRs([85, 85, 90], 80)).toEqual([true, false, true]);
  });

  test("a dip below the running max after a PR is not a PR", () => {
    expect(flagPRs([{ weight: 90 }, { weight: 85 }, { weight: 95 }], 80)).toEqual([
      true,
      false,
      true,
    ]);
  });

  test("zero / missing weight is never a PR", () => {
    expect(flagPRs([{ weight: 0 }, {}, { weight: 100 }], 0)).toEqual([
      false,
      false,
      true,
    ]);
  });

  test("empty input → empty output", () => {
    expect(flagPRs([], 50)).toEqual([]);
  });
});
