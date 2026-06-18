// Plateau detection — multi-axis "no recent PR" definition.
//
// An exercise is plateaued only if, within the trailing 6-week window, it set NO new
// personal best vs its pre-window history on ANY of three axes — "prior best" = the best
// value recorded strictly BEFORE the window began:
//   1. WEIGHT  — max single-set weight (any reps)
//   2. e1RM    — best e1RM under ANY of Epley / Brzycki / Lombardi (one is enough)
//   3. VOLUME  — best single-session volume (Σ weight*reps)
// Any new best on any axis => NOT a plateau (the lifter is progressing by some measure).
// Guards: no pre-window history, or no in-window sessions => NOT flagged (insufficient
// signal is not a stall).
//
// Input: { [name]: series } where series is the enriched per-day aggregate from seriesFor:
//   [{ date:"YYYY-MM-DD", weight, orm, ormEpley, ormBrzycki, ormLombardi }] (chronological).
// opts.tonnage[name]: per-day session volume [{ date, orm: tonnage }] (the VOLUME axis).
// projectExercise is still used for display metadata (suggestion / currentOrm) — NOT the flag.
import { projectExercise } from "./projections";
import { estimate1RM } from "./oneRepMax";

const DAY = 86400000;
const WINDOW_DAYS = 42; // trailing 6 weeks
const toDay = (d) => new Date(d + "T12:00:00").getTime(); // local noon → DST-safe day diff
const maxOf = (arr, key) => arr.reduce((m, p) => Math.max(m, Number(p[key]) || 0), -Infinity);
// e1RM per formula for one set — must mirror seriesFor's enrichment (App.js): Epley via
// estimate1RM (reps capped at 12), Brzycki (skip reps>=37), Lombardi.
const brzycki1RM = (w, r) => (r >= 37 ? 0 : (w * 36) / (37 - r));
const lombardi1RM = (w, r) => w * Math.pow(r, 0.1);

export const detectPlateaus = (exerciseSeriesMap, opts = {}) => {
  const now = opts.now ? new Date(opts.now) : new Date();
  now.setHours(12, 0, 0, 0);
  const windowStart = now.getTime() - WINDOW_DAYS * DAY;
  const out = [];

  for (const [exercise, raw] of Object.entries(exerciseSeriesMap || {})) {
    const series = (raw || []).filter((p) => p && p.date).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!series.length) continue;
    const ton = (opts.tonnage && opts.tonnage[exercise]) || [];

    const win = series.filter((p) => toDay(p.date) >= windowStart);
    if (!win.length) continue; // not training it in-window → not a plateau

    // Prior bests strictly before the window. Prefer a full-history priorBest map (uncapped,
    // built by priorBests with the same windowStart); fall back to the capped pre-window slice
    // of the loaded series when no map is supplied.
    let prior;
    if (opts.priorBest) {
      prior = opts.priorBest[exercise] || null;
    } else {
      const pp = series.filter((p) => toDay(p.date) < windowStart);
      const tp = ton.filter((p) => toDay(p.date) < windowStart);
      prior = pp.length
        ? { weight: maxOf(pp, "weight"), ormEpley: maxOf(pp, "ormEpley"), ormBrzycki: maxOf(pp, "ormBrzycki"), ormLombardi: maxOf(pp, "ormLombardi"), volume: maxOf(tp, "orm") }
        : null;
    }
    if (!prior) continue; // no pre-window history → not a plateau

    const pv = (k) => (Number.isFinite(prior[k]) ? prior[k] : -Infinity);
    const tonWin = ton.filter((p) => toDay(p.date) >= windowStart);
    // 1. WEIGHT — heavier single set in window than ever before the window?
    if (maxOf(win, "weight") > pv("weight")) continue;
    // 2. e1RM — any formula's window-best beats its prior-best?
    if (["ormEpley", "ormBrzycki", "ormLombardi"].some((f) => maxOf(win, f) > pv(f))) continue;
    // 3. VOLUME — bigger single-session volume in window than before it?
    if (maxOf(tonWin, "orm") > pv("volume")) continue;

    // No new best on any axis → plateau. stalledWeeks = whole weeks from the most recent PR
    // on ANY axis to the exercise's latest session date (how long it's been stuck).
    const tonByDate = {};
    for (const p of ton) tonByDate[p.date] = Number(p.orm) || 0;
    let mW = -Infinity, mE = -Infinity, mB = -Infinity, mL = -Infinity, mV = -Infinity, lastPR = series[0].date;
    for (const p of series) {
      let isPR = false;
      const w = Number(p.weight) || 0, e = Number(p.ormEpley) || 0, b = Number(p.ormBrzycki) || 0, l = Number(p.ormLombardi) || 0, v = tonByDate[p.date] || 0;
      if (w > mW) { mW = w; isPR = true; }
      if (e > mE) { mE = e; isPR = true; }
      if (b > mB) { mB = b; isPR = true; }
      if (l > mL) { mL = l; isPR = true; }
      if (v > mV) { mV = v; isPR = true; }
      if (isPR) lastPR = p.date;
    }
    const latestDate = series[series.length - 1].date;
    const stalledWeeks = Math.max(0, Math.floor((toDay(latestDate) - toDay(lastPR)) / (7 * DAY)));

    // Display metadata only (the flag above is authoritative): keep projectExercise's
    // suggestion/currentOrm; use a neutral, plateau-consistent status (not the trend label).
    const proj = projectExercise(series);
    const suggestion = proj.status === "declining" ? "deload" : stalledWeeks >= 8 ? "variation" : "add reps or weight";
    out.push({ exercise, status: "stalled", stalledWeeks, currentOrm: proj.currentOrm, suggestion, viaVolume: false });
  }

  out.sort((a, b) => b.stalledWeeks - a.stalledWeeks);
  return out;
};

// Per-exercise per-axis bests from full-history sets, for detectPlateaus' opts.priorBest.
// sets: { exName, weight, reps, date, sessionId } — completed, non-warmup (the caller filters
// those). Applies the SAME day-granular window cut as detectPlateaus (toDay(date) <
// windowStart) so the prior/in-window boundary matches exactly. Returns
// { [exName]: { weight, ormEpley, ormBrzycki, ormLombardi, volume } }; volume is the max
// single-session Σ(weight*reps).
export function priorBests(sets, windowStart) {
  const byEx = {};
  const sessVol = {}; // sessVol[ex][sessionId] = Σ weight*reps in that session
  for (const s of sets || []) {
    if (!s) continue;
    if (windowStart != null && toDay(s.date) >= windowStart) continue; // pre-window only
    const ex = s.exName;
    if (ex == null || ex === "") continue;
    const w = parseFloat(s.weight) || 0;
    if (w <= 0) continue;
    const r = parseInt(s.reps, 10) || 1;
    const b = byEx[ex] || (byEx[ex] = { weight: 0, ormEpley: 0, ormBrzycki: 0, ormLombardi: 0, volume: 0 });
    b.weight = Math.max(b.weight, w);
    b.ormEpley = Math.max(b.ormEpley, estimate1RM(w, r));
    if (r < 37) b.ormBrzycki = Math.max(b.ormBrzycki, brzycki1RM(w, r));
    b.ormLombardi = Math.max(b.ormLombardi, lombardi1RM(w, r));
    const sid = s.sessionId || s.date || "_";
    const sv = sessVol[ex] || (sessVol[ex] = {});
    sv[sid] = (sv[sid] || 0) + w * r;
  }
  for (const ex in sessVol) {
    const vols = Object.values(sessVol[ex]);
    if (vols.length) byEx[ex].volume = Math.max(...vols);
  }
  return byEx;
}
