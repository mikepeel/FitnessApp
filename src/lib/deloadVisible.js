// Whether the "Deload Week Recommended" prompt should show. `deloadDue` is the ROLLING trigger
// (stays true while training stays consistent — there is no discrete occurrence to ack), so a
// dismissal is a TIME WINDOW, not a permanent suppression: once dismissed it hides for a 7-day
// deload week, then RETURNS if still due. `dismissedAt` is an ISO string (when the user dismissed)
// or null. Pure + injectable `now` for tests.
export const DELOAD_DISMISS_WINDOW_MS = 7 * 86400000;

export function deloadVisible(deloadDue, dismissedAt, now = new Date()) {
  if (!deloadDue) return false;               // not due → never show
  if (!dismissedAt) return true;              // due and never dismissed → show
  const t = new Date(dismissedAt).getTime();
  if (Number.isNaN(t)) return true;           // unparseable marker → don't suppress
  return now.getTime() - t > DELOAD_DISMISS_WINDOW_MS; // show again only after the 7-day window
}
