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

const DAY = 86400000;
const WINDOW_DAYS = 42; // trailing 6 weeks
const toDay = (d) => new Date(d + "T12:00:00").getTime(); // local noon → DST-safe day diff
const maxOf = (arr, key) => arr.reduce((m, p) => Math.max(m, Number(p[key]) || 0), -Infinity);

export const detectPlateaus = (exerciseSeriesMap, opts = {}) => {
  const now = opts.now ? new Date(opts.now) : new Date();
  now.setHours(12, 0, 0, 0);
  const windowStart = now.getTime() - WINDOW_DAYS * DAY;
  const out = [];

  for (const [exercise, raw] of Object.entries(exerciseSeriesMap || {})) {
    const series = (raw || []).filter((p) => p && p.date).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!series.length) continue;
    const ton = (opts.tonnage && opts.tonnage[exercise]) || [];

    const prior = series.filter((p) => toDay(p.date) < windowStart);
    const win = series.filter((p) => toDay(p.date) >= windowStart);
    // Guards: need a pre-window "prior best" and at least one in-window session.
    if (!prior.length || !win.length) continue;

    // 1. WEIGHT — heavier single set in window than ever before the window?
    if (maxOf(win, "weight") > maxOf(prior, "weight")) continue;
    // 2. e1RM — any formula's window-best beats its prior-best?
    const formulas = ["ormEpley", "ormBrzycki", "ormLombardi"];
    if (formulas.some((f) => maxOf(win, f) > maxOf(prior, f))) continue;
    // 3. VOLUME — bigger single-session volume in window than before it?
    const tonPrior = ton.filter((p) => toDay(p.date) < windowStart);
    const tonWin = ton.filter((p) => toDay(p.date) >= windowStart);
    if (maxOf(tonWin, "orm") > maxOf(tonPrior, "orm")) continue;

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
