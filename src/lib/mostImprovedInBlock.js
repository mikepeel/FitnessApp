// Most-improved lift by PERCENT e1RM gain within a completed block. Pure, testable.
//
// Why percent (not absolute): % normalizes across lift sizes so a small lift's real progress can win
// over a big lift's larger raw jump. Why e1RM (not top weight): Epley e1RM catches rep progression at
// the same load (3×6@185 → 3×9@185 is real progress top-weight-only would score as zero).
//
// INPUT `rows`: per-set rows ALREADY filtered by the caller to the block window and to WORKING sets
// (warmups excluded upstream, consistent with lifetimePRs / plateau prior-best). Each row:
//   { name, weight, reps, sessionId, date }
// where `date` is the session's local "YYYY-MM-DD" (orders sessions AND buckets them into block weeks)
// and `sessionId` groups sets into one session. `opts.startDate` is the block start ("YYYY-MM-DD") — it
// anchors the SAME floor(days/7) week buckets weeklyAdherence/planWeek use, so "distinct weeks" means
// block weeks (not a parallel definition). Without it, the week gate can't be evaluated → returns null.
//
// Per session, e1RM = max estimate1RM over that session's sets. GATE: a lift needs >= 3 sessions across
// >= 3 DISTINCT block weeks to be eligible. SMOOTHING: baseline = best e1RM of the first two qualifying
// sessions; endpoint = best of the last two (resists a fluky bookend). pctGain = (endpoint-baseline)/
// baseline. Returns the highest-pctGain qualifying lift { name, pctGain, from, to, fromWeight, toWeight },
// where from/to are the e1RM endpoints (drive the %) and fromWeight/toWeight are the concrete TOP-SET
// weights over the same windows (for display); or null if none qualify OR best pctGain <= 0 (never a decline).
import { estimate1RM } from "./oneRepMax";
import { elapsedDaysSince, parsePlanDate } from "./planWeek";

const MIN_SESSIONS = 3;
const MIN_WEEKS = 3;

export function mostImprovedInBlock(rows, opts = {}) {
  const startDate = opts.startDate || null;

  // name -> (sessionId -> { orm: best e1RM this session, date })
  const byLift = new Map();
  for (const r of rows || []) {
    const name = r && r.name;
    const sid = r && r.sessionId;
    const w = parseFloat(r && r.weight) || 0;
    if (!name || sid == null || w <= 0) continue;
    const e = estimate1RM(w, r.reps);
    if (!byLift.has(name)) byLift.set(name, new Map());
    const sessions = byLift.get(name);
    const prev = sessions.get(sid);
    if (!prev) sessions.set(sid, { orm: e, topWeight: w, date: r.date || null });
    else { if (e > prev.orm) prev.orm = e; if (w > prev.topWeight) prev.topWeight = w; }
  }

  const weekOf = (dateStr) => {
    if (!startDate || !dateStr) return null;
    const days = elapsedDaysSince(startDate, parsePlanDate(dateStr));
    return days == null ? null : Math.floor(days / 7);
  };

  let best = null;
  for (const [name, sessMap] of byLift) {
    const sess = [...sessMap.entries()].map(([sid, v]) => ({ sid, orm: v.orm, topWeight: v.topWeight, date: v.date, week: weekOf(v.date) }));
    // oldest first; deterministic tie-break on sessionId when dates collide
    sess.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : String(a.sid).localeCompare(String(b.sid))));
    if (sess.length < MIN_SESSIONS) continue;
    const distinctWeeks = new Set(sess.map((s) => s.week).filter((w) => Number.isFinite(w)));
    if (distinctWeeks.size < MIN_WEEKS) continue;
    const baseline = Math.max(sess[0].orm, sess[1].orm);                       // best e1RM of first two
    const endpoint = Math.max(sess[sess.length - 1].orm, sess[sess.length - 2].orm); // best e1RM of last two
    if (baseline <= 0) continue;
    const pctGain = (endpoint - baseline) / baseline;
    // Concrete TOP-SET weights (heaviest actually lifted) over the SAME first-two / last-two windows — the
    // honest "you went from X to Y lbs" the UI can show alongside the %. Not the e1RM. The caller shows it
    // only when it actually rose (a rep-based gain leaves top weight flat → no fabricated weight change).
    const fromWeight = Math.max(sess[0].topWeight, sess[1].topWeight);
    const toWeight = Math.max(sess[sess.length - 1].topWeight, sess[sess.length - 2].topWeight);
    if (!best || pctGain > best.pctGain) best = { name, pctGain, from: baseline, to: endpoint, fromWeight, toWeight };
  }

  if (!best || best.pctGain <= 0) return null;
  return best;
}
