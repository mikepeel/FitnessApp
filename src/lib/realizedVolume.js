// Realized-volume analyzer (pure — no UI, no prose, no progress coupling).
//
// Computes weekly fractional sets per FINE muscle from logged sessions over a trailing
// window, then scores them against the same bands the plan analyzer uses (shared
// scoreVolume core). Cardio/rest sets don't count. A global data-sufficiency gate
// suppresses scoring until there's enough history to be meaningful.
import { muscleContributions, rollupToGroup, DISPLAY_GROUPS } from "./muscleVolume";
import guidelines from "../data/volumeGuidelines.json";
import { scoreVolume, rollupGroups, summarize, resolveGoal } from "./planAnalysis";

// Global gate constants (tunable). Insufficient if the in-window history spans fewer
// than MIN_HISTORY_DAYS, or there are fewer than MIN_SESSIONS distinct training days.
export const MIN_HISTORY_DAYS = 21;
export const MIN_SESSIONS = 6;

const round05 = (n) => Math.round(n * 2) / 2;
// Every fine muscle, so a muscle with zero sets still scores 'under' (a real finding,
// not gated away) once the window is sufficient.
const FINE_MUSCLES = Object.keys(guidelines.hypertrophy);
const localDayKey = (d) => { const dt = new Date(d); return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`; };

// sessions: [{ completedAt, setsArr:[{ exName, muscle, type, ... }] }, ...]
export function analyzeRealized(sessions, opts = {}) {
  const windowDays = opts.windowDays || 28;
  const { goal, goalDefaulted } = resolveGoal(opts.goal);
  const weeks = windowDays / 7;
  const now = opts.now ? new Date(opts.now) : new Date();
  const cutoff = now.getTime() - windowDays * 86400000;

  const weekly = {}, mDays = {}, mDayTot = {};       // per fine muscle
  const gWeekly = {}, gDays = {}, gDayTot = {};       // per display group
  const trainingDays = new Set();
  let minT = Infinity, maxT = -Infinity;

  for (const s of sessions || []) {
    if (!s || !s.completedAt) continue;
    const t = new Date(s.completedAt).getTime();
    if (!(t > cutoff)) continue; // trailing window
    const dk = localDayKey(s.completedAt);
    let countedAny = false;
    for (const x of s.setsArr || []) {
      if (!x || x.type === "warmup") continue;
      const res = muscleContributions(x.exName, x.muscle);
      if (!res.counted) continue; // cardio / rest / unmapped-without-tag
      countedAny = true;
      for (const c of res.contributions) {
        weekly[c.muscle] = (weekly[c.muscle] || 0) + c.factor;
        (mDays[c.muscle] || (mDays[c.muscle] = new Set())).add(dk);
        const dt = mDayTot[c.muscle] || (mDayTot[c.muscle] = {}); dt[dk] = (dt[dk] || 0) + c.factor;
        const g = rollupToGroup(c.muscle);
        gWeekly[g] = (gWeekly[g] || 0) + c.factor;
        (gDays[g] || (gDays[g] = new Set())).add(dk);
        const gt = gDayTot[g] || (gDayTot[g] = {}); gt[dk] = (gt[dk] || 0) + c.factor;
      }
    }
    if (countedAny) { trainingDays.add(dk); minT = Math.min(minT, t); maxT = Math.max(maxT, t); }
  }

  // Global data-sufficiency gate — don't score (or flag) on too little history.
  const distinctDays = trainingDays.size;
  const spanDays = maxT >= minT ? Math.round((maxT - minT) / 86400000) : 0;
  if (spanDays < MIN_HISTORY_DAYS || distinctDays < MIN_SESSIONS) {
    return { sufficient: false, goal, goalDefaulted, windowDays };
  }

  // Per-muscle metrics, normalised to per-week (maxDaySets stays absolute — it's a
  // single-session ceiling check). All fine muscles included.
  const metricsMap = {};
  for (const m of FINE_MUSCLES) {
    const md = mDayTot[m] ? Math.max(...Object.values(mDayTot[m])) : 0;
    metricsMap[m] = { weeklySets: (weekly[m] || 0) / weeks, freq: (mDays[m] ? mDays[m].size : 0) / weeks, maxDaySets: md };
  }
  const perMuscle = scoreVolume(metricsMap, goal);

  const groupMetrics = {};
  for (const g of DISPLAY_GROUPS) {
    const gmd = gDayTot[g] ? Math.max(...Object.values(gDayTot[g])) : 0;
    groupMetrics[g] = { weeklySets: (gWeekly[g] || 0) / weeks, freq: (gDays[g] ? gDays[g].size : 0) / weeks, maxDaySets: gmd };
  }
  const perGroup = rollupGroups(perMuscle, groupMetrics, goal);

  return { sufficient: true, goal, goalDefaulted, windowDays, perMuscle, perGroup, summary: summarize(perMuscle) };
}
