// Volume scoring engine (pure — no UI, no prose).
//
// Scores weekly fractional sets per FINE muscle against evidence-based bands. The
// scoring core (scoreVolume / rollupGroups / summarize) is shared by both the plan
// analyzer (analyzePlan, below) and the realized-volume analyzer (realizedVolume.js),
// so a plan and a logged history with the same per-muscle metrics score identically.
import { muscleContributions, rollupToGroup, DISPLAY_GROUPS } from "./muscleVolume";
import guidelines from "../data/volumeGuidelines.json";

const FLOOR = guidelines.maintenanceFloorSets;            // weekly sets = "maintenance"
const FREQ_TARGET = guidelines.frequency.targetPerWeek;   // 2x/week
const SESSION_FLAG_ABOVE = guidelines.perSessionCeiling.flagAbove; // >this in one day = flag
const TIER_RANK = { low: 1, moderate: 2, high: 3 };
const round05 = (n) => Math.round(n * 2) / 2;

// Group-flag gating: only high/moderate-evidence muscles can flag a whole group.
// Low-evidence muscles (forearms, lower back, adductors) keep a per-muscle status for
// the expand view but never headline the group. "Below its band" = under or maintenance
// (both sit beneath the productive low); "over its band" = high.
const isGated = (m) => m.evidenceTier === "high" || m.evidenceTier === "moderate";
const belowBand = (m) => m.status === "under" || m.status === "maintenance";
const overBand = (m) => m.status === "high";

function statusFor(weekly, band, floor) {
  const [lo, hi] = band;
  if (weekly > hi) return "high";
  if (weekly >= lo) return "in_range";
  if (weekly >= floor) return "maintenance";
  return "under";
}

// Band + evidence tier for a fine muscle. Strength uses the coarse primary-mover block
// for every muscle (no per-muscle band false-precision); hypertrophy uses the
// per-muscle productive band.
function bandFor(muscle, goal) {
  if (goal === "strength") return { band: guidelines.strength.coarseWeeklySetsPrimaryMover, evidenceTier: guidelines.strength.evidenceTier };
  const h = guidelines.hypertrophy[muscle] || { productive: [0, 0], evidenceTier: "low" };
  return { band: h.productive, evidenceTier: h.evidenceTier };
}

const orderIdx = (g) => { const i = DISPLAY_GROUPS.indexOf(g); return i < 0 ? 99 : i; };

export function resolveGoal(goalRaw) {
  const goal = goalRaw === "strength" ? "strength" : "hypertrophy";
  return { goal, goalDefaulted: goalRaw !== "hypertrophy" && goalRaw !== "strength" };
}

// Score per-fine-muscle metrics. metricsMap: { muscle: { weeklySets, freq, maxDaySets } }
// (weeklySets/maxDaySets RAW for scoring; rounded for display in the output). Returns
// the per-muscle findings, sorted by display group then muscle.
export function scoreVolume(metricsMap, goal) {
  return Object.keys(metricsMap || {})
    .map((muscle) => {
      const m = metricsMap[muscle] || {};
      const w = m.weeklySets || 0;
      const freq = m.freq || 0;
      const md = m.maxDaySets || 0;
      const { band, evidenceTier } = bandFor(muscle, goal);
      const status = statusFor(w, band, FLOOR);
      return {
        muscle,
        group: rollupToGroup(muscle),
        weeklySets: round05(w),
        freq,
        maxDaySets: round05(md),
        status,
        frequencyFlag: (status === "in_range" || status === "high") && freq < FREQ_TARGET,
        sessionFlag: md > SESSION_FLAG_ABOVE,
        band,
        evidenceTier,
      };
    })
    .sort((a, b) => orderIdx(a.group) - orderIdx(b.group) || a.muscle.localeCompare(b.muscle));
}

// Roll scored fine muscles up to display groups. Group status is gated by EVIDENCE:
// it derives only from the group's high/moderate-evidence members vs their OWN bands —
//   under  : any gated member below its band
//   high   : any gated member over its band
//   mixed  : both (specifics show per-muscle on expand)
//   in_range: otherwise
// The summed-fine-band is NOT the pass/fail target (it over-flagged groups whenever an
// indirect-only minor muscle sat at zero). `band` is still returned (summed) for now so
// existing displays render; the overlay/Plan-Analysis screens drop it as a target next.
// Only groups that have member muscles are returned.
export function rollupGroups(perMuscle, groupMetrics, goal) {
  return DISPLAY_GROUPS.map((group) => {
    const members = perMuscle.filter((m) => m.group === group);
    if (!members.length) return null;
    const gm = (groupMetrics && groupMetrics[group]) || { weeklySets: 0, freq: 0, maxDaySets: 0 };
    const gated = members.filter(isGated);
    const anyUnder = gated.some(belowBand);
    const anyOver = gated.some(overBand);
    const status = anyUnder && anyOver ? "mixed" : anyUnder ? "under" : anyOver ? "high" : "in_range";
    const inOrAbove = status === "in_range" || status === "high" || status === "mixed";
    // Evidence tier from the gated members (so a flagged group never carries low-evidence
    // soft copy at the headline); fall back to all members if a group has no gated ones.
    const tierPool = gated.length ? gated : members;
    return {
      group,
      weeklySets: round05(gm.weeklySets || 0),
      freq: gm.freq || 0,
      maxDaySets: round05(gm.maxDaySets || 0),
      status,
      frequencyFlag: inOrAbove && (gm.freq || 0) < FREQ_TARGET,
      sessionFlag: members.some((m) => m.sessionFlag),
      band: [members.reduce((s, m) => s + m.band[0], 0), members.reduce((s, m) => s + m.band[1], 0)],
      evidenceTier: tierPool.map((m) => m.evidenceTier).sort((a, b) => TIER_RANK[a] - TIER_RANK[b])[0],
      fineMuscles: members,
    };
  }).filter(Boolean);
}

// Counts are evidence-gated to match group flagging: only high/moderate-evidence
// muscles below/over their band count toward under/high (so a low-evidence minor at
// zero never makes a plan read as "unbalanced"). Frequency/session flags are unchanged.
export function summarize(perMuscle) {
  const gated = perMuscle.filter(isGated);
  return {
    underCount: gated.filter(belowBand).length,
    highCount: gated.filter(overBand).length,
    flagged: perMuscle
      .filter((m) => m.frequencyFlag || m.sessionFlag)
      .map((m) => ({ muscle: m.muscle, group: m.group, frequencyFlag: m.frequencyFlag, sessionFlag: m.sessionFlag })),
  };
}

export function analyzePlan(plan, opts = {}) {
  const { goal, goalDefaulted } = resolveGoal(opts.goal);
  const days = Array.isArray(plan) ? plan : (plan && plan.days) || [];

  // Fine-muscle + group-level accumulators over the plan week.
  const weekly = {};
  const dayHits = {};
  const maxDay = {};
  const gDayHits = {};
  const gMaxDay = {};

  days.forEach((day, di) => {
    const today = {};
    const todayG = {};
    ((day && day.exercises) || []).forEach((ex) => {
      const res = muscleContributions(ex && ex.name, ex && ex.muscle);
      if (!res.counted) return;
      const planned = parseInt(ex && ex.sets, 10) || 0;
      if (planned <= 0) return;
      res.contributions.forEach((c) => {
        const add = planned * c.factor;
        weekly[c.muscle] = (weekly[c.muscle] || 0) + add;
        today[c.muscle] = (today[c.muscle] || 0) + add;
        const g = rollupToGroup(c.muscle);
        todayG[g] = (todayG[g] || 0) + add;
      });
    });
    for (const m in today) {
      (dayHits[m] || (dayHits[m] = new Set())).add(di);
      maxDay[m] = Math.max(maxDay[m] || 0, today[m]);
    }
    for (const g in todayG) {
      (gDayHits[g] || (gDayHits[g] = new Set())).add(di);
      gMaxDay[g] = Math.max(gMaxDay[g] || 0, todayG[g]);
    }
  });

  const metricsMap = {};
  for (const m of Object.keys(weekly)) metricsMap[m] = { weeklySets: weekly[m], freq: dayHits[m] ? dayHits[m].size : 0, maxDaySets: maxDay[m] || 0 };
  const perMuscle = scoreVolume(metricsMap, goal);

  const groupMetrics = {};
  for (const g of Object.keys(gDayHits)) groupMetrics[g] = { weeklySets: 0, freq: gDayHits[g].size, maxDaySets: gMaxDay[g] || 0 };
  for (const m of Object.keys(weekly)) { const g = rollupToGroup(m); if (groupMetrics[g]) groupMetrics[g].weeklySets += weekly[m]; }
  const perGroup = rollupGroups(perMuscle, groupMetrics, goal);

  return { goal, goalDefaulted, perMuscle, perGroup, summary: summarize(perMuscle) };
}
