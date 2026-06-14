// Plan Analysis scoring engine (pure — no UI, no prose).
//
// Scores a week's plan (days_json) against evidence-based weekly-volume bands.
// Sets are FRACTIONAL via muscleContributions (1.0 primary, 0.5 secondary). The
// fine muscle is the scoring unit (bands live per fine muscle); display groups are
// a rollup. Cardio / rest entries (counted:false) are skipped.
import { muscleContributions, rollupToGroup, DISPLAY_GROUPS } from "./muscleVolume";
import guidelines from "../data/volumeGuidelines.json";

const FLOOR = guidelines.maintenanceFloorSets;            // weekly sets = "maintenance"
const FREQ_TARGET = guidelines.frequency.targetPerWeek;   // 2x/week
const SESSION_FLAG_ABOVE = guidelines.perSessionCeiling.flagAbove; // >this in one day = flag
const TIER_RANK = { low: 1, moderate: 2, high: 3 };
const round05 = (n) => Math.round(n * 2) / 2;

function statusFor(weekly, band, floor) {
  const [lo, hi] = band;
  if (weekly > hi) return "high";
  if (weekly >= lo) return "in_range";
  if (weekly >= floor) return "maintenance";
  return "under";
}

export function analyzePlan(plan, opts = {}) {
  const goalRaw = opts.goal;
  const goal = goalRaw === "strength" ? "strength" : "hypertrophy";
  const goalDefaulted = goalRaw !== "hypertrophy" && goalRaw !== "strength";
  const days = Array.isArray(plan) ? plan : (plan && plan.days) || [];

  // Fine-muscle accumulators
  const weekly = {};   // muscle -> weekly fractional sets
  const dayHits = {};  // muscle -> Set(dayIdx)  (frequency)
  const maxDay = {};   // muscle -> max single-day fractional sets
  // Group-level day accumulators (frequency + per-day total are union/sum, not maxes)
  const gDayHits = {};
  const gMaxDay = {};

  days.forEach((day, di) => {
    const today = {};   // fine -> sets this day
    const todayG = {};  // group -> sets this day
    ((day && day.exercises) || []).forEach((ex) => {
      const res = muscleContributions(ex && ex.name, ex && ex.muscle);
      if (!res.counted) return; // cardio / rest / unmapped-without-tag
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

  // Band + evidence tier for a fine muscle. Strength uses the coarse primary-mover
  // block for every muscle (no per-muscle band false-precision); hypertrophy uses
  // the per-muscle productive band.
  const bandFor = (muscle) => {
    if (goal === "strength") return { band: guidelines.strength.coarseWeeklySetsPrimaryMover, evidenceTier: guidelines.strength.evidenceTier };
    const h = guidelines.hypertrophy[muscle] || { productive: [0, 0], evidenceTier: "low" };
    return { band: h.productive, evidenceTier: h.evidenceTier };
  };
  const orderIdx = (g) => { const i = DISPLAY_GROUPS.indexOf(g); return i < 0 ? 99 : i; };

  const perMuscle = Object.keys(weekly)
    .map((muscle) => {
      const w = weekly[muscle];
      const { band, evidenceTier } = bandFor(muscle);
      const freq = dayHits[muscle] ? dayHits[muscle].size : 0;
      const md = maxDay[muscle] || 0;
      const status = statusFor(w, band, FLOOR);
      const frequencyFlag = (status === "in_range" || status === "high") && freq < FREQ_TARGET;
      const sessionFlag = md > SESSION_FLAG_ABOVE;
      return { muscle, group: rollupToGroup(muscle), weeklySets: round05(w), freq, maxDaySets: round05(md), status, frequencyFlag, sessionFlag, band, evidenceTier };
    })
    .sort((a, b) => orderIdx(a.group) - orderIdx(b.group) || a.muscle.localeCompare(b.muscle));

  // Roll up to display groups (only groups that received volume). Group band = the
  // summed productive bands of the group's TRAINED fine muscles; floor scales with
  // member count. The fine-muscle detail carries the precise per-muscle status.
  const perGroup = DISPLAY_GROUPS.map((group) => {
    const members = perMuscle.filter((m) => m.group === group);
    if (!members.length) return null;
    const rawW = members.reduce((s, m) => s + weekly[m.muscle], 0);
    const band = [members.reduce((s, m) => s + m.band[0], 0), members.reduce((s, m) => s + m.band[1], 0)];
    const status = statusFor(rawW, band, FLOOR * members.length);
    const freq = gDayHits[group] ? gDayHits[group].size : 0;
    const status_in_or_above = status === "in_range" || status === "high";
    return {
      group,
      weeklySets: round05(rawW),
      freq,
      maxDaySets: round05(gMaxDay[group] || 0),
      status,
      frequencyFlag: status_in_or_above && freq < FREQ_TARGET,
      sessionFlag: members.some((m) => m.sessionFlag),
      band,
      evidenceTier: members.map((m) => m.evidenceTier).sort((a, b) => TIER_RANK[a] - TIER_RANK[b])[0],
      fineMuscles: members,
    };
  }).filter(Boolean);

  const underCount = perMuscle.filter((m) => m.status === "under").length;
  const highCount = perMuscle.filter((m) => m.status === "high").length;
  const flagged = perMuscle
    .filter((m) => m.frequencyFlag || m.sessionFlag)
    .map((m) => ({ muscle: m.muscle, group: m.group, frequencyFlag: m.frequencyFlag, sessionFlag: m.sessionFlag }));

  return { goal, goalDefaulted, perMuscle, perGroup, summary: { underCount, highCount, flagged } };
}
