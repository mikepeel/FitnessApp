// Compose a durable plan-completion snapshot from a plan + its block-window data. PURE and
// DETERMINISTIC (no Date.now — the window is bounded at the plan's SCHEDULED END, computed from the
// plan, so the record is frozen regardless of WHEN it's captured). The caller adds `capturedAt`.
//
// Why bound at scheduled-end (not "now"): a user who opens the app late shouldn't fold gap-sessions
// (training done AFTER the block ended, before they reopened) into the finished block's stats.
//
// Inputs (caller fetches uncapped, warmups excluded for setRows — same source discipline as
// lifetimePRs / plateau prior-best):
//   plan    : { key, name, startDate:"YYYY-MM-DD", durationWeeks, days:[{isRest,...}] }
//   data.sessions : [{ completedAt: ISO, partial: bool }]   (any range; filtered here to the window)
//   data.prs      : { [name]: { weight, date: achieved_at } }
//   data.setRows  : [{ name, weight, reps, sessionId, date:"YYYY-MM-DD" }]  (working sets)
import { blockScheduledSessions } from "./blockScheduledSessions";
import { mostImprovedInBlock } from "./mostImprovedInBlock";
import { parsePlanDate } from "./planWeek";

const toLocal = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-CA"); };

// Scheduled-end local date = start_date + durationWeeks*7 days (durationWeeks defaults to 10).
export function scheduledEndStr(plan) {
  const start = parsePlanDate(plan && plan.startDate);
  if (!start) return null;
  const weeks = (plan && plan.durationWeeks) || 10;
  const end = new Date(start); end.setDate(end.getDate() + weeks * 7);
  return end.toLocaleDateString("en-CA");
}

export function buildBlockSummary(plan, data) {
  const { sessions = [], prs = {}, setRows = [] } = data || {};
  const startStr = plan && plan.startDate;
  const endStr = scheduledEndStr(plan);
  if (!startStr || !endStr) return null; // can't define a window without a start date
  const inWindow = (dstr) => !!dstr && dstr >= startStr && dstr <= endStr; // [start, scheduledEnd], local dates

  // X: completed, non-partial sessions inside the block window.
  const sessionsCompleted = (sessions || []).filter(
    (s) => s && s.completedAt && !s.partial && inWindow(toLocal(s.completedAt))
  ).length;

  // Y: scheduled (non-rest) sessions over the whole block.
  const sessionsScheduled = blockScheduledSessions(plan);
  const adherencePct = sessionsScheduled > 0 ? sessionsCompleted / sessionsScheduled : 0;

  // PRs whose achieved_at falls in the window (same basis recentPRs uses — by achieved_at).
  const prsInWindow = Object.entries(prs || {})
    .filter(([, pr]) => pr && inWindow(toLocal(pr.date)))
    .map(([name, pr]) => ({ name, weight: pr.weight }));

  // Most-improved lift by % e1RM — over the window's working sets only.
  const mostImproved = mostImprovedInBlock((setRows || []).filter((r) => r && inWindow(r.date)), { startDate: startStr }) || null;

  return {
    planKey: (plan && plan.key) || null,
    planName: (plan && plan.name) || null,
    startDate: startStr,
    durationWeeks: (plan && plan.durationWeeks) || 10,
    scheduledEnd: endStr,
    sessionsCompleted,
    sessionsScheduled,
    adherencePct,
    prsHit: prsInWindow.length,
    prs: prsInWindow,
    mostImproved,
  };
}
