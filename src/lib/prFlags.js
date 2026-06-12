// Weight-level PR flagging.
//
// A set is a personal record only if its weight strictly exceeds the running max
// for that exercise — the prior all-time best, then any heavier set earlier in the
// same sequence. Equalling the current best is NOT a PR (strict >). This is the
// "running max" rule: 3 sets of 85 above a prior 80 yield exactly ONE PR (the
// first 85), not three.
//
// Input `sets` is one exercise's sets in performed / chronological order. Each
// element is either a number (weight) or an object { weight, warmup }. Warmup sets
// are never PRs and never raise the running max. `priorBest` is the max weight from
// all earlier history for the exercise (0 when there is none).
//
// Returns an array of booleans aligned 1:1 with the input sets.
export function flagPRs(sets, priorBest = 0) {
  let runningMax = Number(priorBest) || 0;
  return (sets || []).map((s) => {
    const obj = s && typeof s === "object";
    const weight = Number(obj ? s.weight : s) || 0;
    const warmup = obj ? !!s.warmup : false;
    if (warmup || weight <= 0) return false;
    if (weight > runningMax) {
      runningMax = weight;
      return true;
    }
    return false;
  });
}
