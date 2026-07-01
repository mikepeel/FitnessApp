// Pure assembler for the Stats Overview JUDGMENT DIGEST. Composes already-computed engine outputs
// into an ordered list of digest lines: one ALWAYS-ON adherence line, then situational judgment
// lines shown only when firing — POSITIVE-FIRST, deduped per lift, capped at 3. No analytics here;
// the caller computes/gates the inputs and renders the lines.
//
// Input (each pre-gated by the caller — pass null/[]/false when a toggle hides it):
//   adherence      : { done, target, status } from weeklyAdherence
//   currentStreak  : number (already 0 when streakTracking is off)
//   recentPR       : { lift, weight, when } | null   (only when recent + prDetection on)
//   plateaus       : [{ exercise, stalledWeeks }]    (detectPlateaus, sorted longest-stalled first)
//   volumeFlag     : { group, status } | null        (ONE flagged group; volume + balance are one engine)
//   deloadNewlyDue : boolean                          (deloadVisible — respects the dismissal window)
// Returns { lines: [{ kind, text, tone }] } with lines[0] always the adherence line.
const plural = (n) => (Number(n) === 1 ? "" : "s");

function adherenceLine(a, streak) {
  const done = (a && a.done) || 0;
  const target = a && a.target;
  let text, tone;
  if (!a || a.status === "no_target" || !target) {
    text = `${done} session${plural(done)} this week`;
    tone = "neutral";
  } else {
    const tail =
      a.status === "complete" ? " — week complete" :
      a.status === "ahead" ? " — ahead of plan" :
      a.status === "behind" ? " — behind" : " — on pace";
    text = `${done} of ${target} this week${tail}`;
    tone = a.status === "behind" ? "caution" : (a.status === "complete" || a.status === "ahead") ? "positive" : "neutral";
  }
  if (streak > 0) text += ` · ${streak}-session streak`;
  return { kind: "adherence", text, tone };
}

function volumeLine(v) {
  // Maintenance = holding (above the floor, below the productive low) — not a deficit; honest copy.
  if (v.status === "maintenance") return { kind: "volume", text: `${v.group} at maintenance volume — holding, not building (by logged-set count)`, tone: "info" };
  const dir = v.status === "high" ? "above" : v.status === "mixed" ? "outside" : "below"; // under → below
  return { kind: "volume", text: `${v.group} ${dir} the productive range (by logged-set count)`, tone: "info" };
}

export function assembleDigest(input) {
  const { adherence, currentStreak = 0, recentPR = null, plateaus = [], volumeFlag = null, deloadNewlyDue = false } = input || {};
  const lines = [adherenceLine(adherence, currentStreak)];

  // Situational candidates, POSITIVE-FIRST.
  const sit = [];
  // 1. Recent PR — the positive lead.
  if (recentPR && recentPR.lift) {
    sit.push({ kind: "pr", lift: recentPR.lift, text: `New PR: ${recentPR.lift} ${recentPR.weight} lb${recentPR.when ? ` (${recentPR.when})` : ""}`, tone: "positive" });
  }
  // 2. Plateau — the longest-stalled lift that ISN'T the PR lift. Per-lift dedup: PR wins for its
  //    own lift, but a DIFFERENT lift's stall is NOT hidden (positive-first is ordering, not suppression).
  const prLift = recentPR && recentPR.lift;
  const plat = (plateaus || []).find((p) => p && p.exercise && p.exercise !== prLift);
  if (plat) sit.push({ kind: "plateau", lift: plat.exercise, text: `${plat.exercise} has stalled ${plat.stalledWeeks} week${plural(plat.stalledWeeks)}`, tone: "caution" });
  // 3. Volume — exactly one line (volume-vs-target and muscle-balance are the same engine).
  if (volumeFlag && volumeFlag.group) sit.push(volumeLine(volumeFlag));
  // 4. Deload — only when newly due.
  if (deloadNewlyDue) sit.push({ kind: "deload", text: "A deload may be due", tone: "info" });

  if (sit.length === 0) lines.push({ kind: "ok", text: "Training's on track", tone: "positive" });
  else lines.push(...sit.slice(0, 3)); // cap 3, already positive-first

  return { lines };
}
