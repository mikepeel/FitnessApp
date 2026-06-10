// Plateau detection — reuses the projections trend engine (no trend math here).
// Input: { [exerciseName]: series } where series is what projectExercise consumes
// ([{ date:"YYYY-MM-DD", orm }, ...] chronological).
import { projectExercise } from "./projections";

const DAY = 86400000;
const toDay = (d) => new Date(d + "T12:00:00").getTime(); // local noon → DST-safe diff

export const detectPlateaus = (exerciseSeriesMap, opts = {}) => {
  const now = opts.now ? new Date(opts.now) : new Date();
  now.setHours(12, 0, 0, 0);
  const nowMs = now.getTime();
  const out = [];

  for (const [exercise, series] of Object.entries(exerciseSeriesMap || {})) {
    const pts = (series || []).filter((p) => p && p.date && Number.isFinite(Number(p.orm)));

    // Eligible: enough history, long enough span, and trained recently (don't flag
    // abandoned lifts).
    const distinct = new Set(pts.map((p) => p.date));
    if (distinct.size < 6) continue;
    const firstMs = toDay(pts[0].date);
    const lastMs = toDay(pts[pts.length - 1].date);
    if ((lastMs - firstMs) / DAY < 35) continue;
    if ((nowMs - lastMs) / DAY > 21) continue;

    const proj = projectExercise(series);
    if (proj.status !== "flat" && proj.status !== "declining") continue;

    // Whole weeks since the last NEW e1RM high (round to whole lb first).
    let maxSoFar = -Infinity;
    let lastHighMs = firstMs;
    for (const p of pts) {
      const orm = Math.round(Number(p.orm));
      if (orm > maxSoFar) { maxSoFar = orm; lastHighMs = toDay(p.date); }
    }
    const stalledWeeks = Math.max(0, Math.floor((nowMs - lastHighMs) / (7 * DAY)));

    const suggestion =
      proj.status === "declining" ? "deload" : stalledWeeks >= 8 ? "variation" : "add reps or weight";

    out.push({ exercise, status: proj.status, stalledWeeks, currentOrm: proj.currentOrm, suggestion });
  }

  out.sort((a, b) => b.stalledWeeks - a.stalledWeeks);
  return out;
};
