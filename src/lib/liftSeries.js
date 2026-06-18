// Per-day strength series for ONE exercise, from a flat list of its sets (pure, testable).
//
// Input: sets = [{ weight, reps, date }] (one exercise; non-warmup, completed — the caller
// filters those; `date` is a local "YYYY-MM-DD"). Returns one row per day, sorted ascending:
// { date, label, weight, orm, ormEpley, ormBrzycki, ormLombardi } where each value is that
// day's max. Mirrors App.js seriesFor's enrichment exactly (Epley via estimate1RM with reps
// capped at 12; Brzycki skips reps>=37; Lombardi) so the drill-down's full-history series and
// the capped seriesFor fallback are interchangeable. Used to feed the drill-down charts /
// projection from a lift's FULL history rather than the .limit(100) load.
import { estimate1RM } from "./oneRepMax";

export function liftSeriesFromSets(sets) {
  const grouped = {};
  for (const x of sets || []) {
    const w = parseFloat(x && x.weight) || 0;
    if (w <= 0) continue;
    const d = x.date;
    if (!d) continue;
    const r = parseInt(x.reps, 10) || 1;
    const ep = estimate1RM(w, r);
    const br = r >= 37 ? 0 : (w * 36) / (37 - r);
    const lo = w * Math.pow(r, 0.1);
    const prev = grouped[d] || { weight: 0, orm: 0, ormEpley: 0, ormBrzycki: 0, ormLombardi: 0 };
    grouped[d] = {
      weight: Math.max(prev.weight, w),
      orm: Math.max(prev.orm, ep),
      ormEpley: Math.max(prev.ormEpley, ep),
      ormBrzycki: Math.max(prev.ormBrzycki, br),
      ormLombardi: Math.max(prev.ormLombardi, lo),
    };
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([d, v]) => ({ date: d, label: d.slice(5), weight: v.weight, orm: Math.round(v.orm), ormEpley: v.ormEpley, ormBrzycki: v.ormBrzycki, ormLombardi: v.ormLombardi }));
}
