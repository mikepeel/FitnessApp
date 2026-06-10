// Pure strength projections from a chronological e1RM series (no LLM).
// series: [{ date: "YYYY-MM-DD", orm }, ...] in chronological order.
// Returns { status, trendPerWeek, currentOrm, projected?, milestone? }.

const DAY = 86400000;
const toDay = (d) => new Date(d + "T12:00:00").getTime(); // local noon → DST-safe day diff

export const projectExercise = (series, opts = {}) => {
  const increment = opts.increment ?? 5;
  const pts = (series || []).filter((p) => p && p.date && Number.isFinite(Number(p.orm)));

  // Gate: need enough distinct sessions over enough calendar span to fit a line.
  const distinct = new Set(pts.map((p) => p.date));
  const span = pts.length ? (toDay(pts[pts.length - 1].date) - toDay(pts[0].date)) / DAY : 0;
  if (distinct.size < 5 || span < 21) return { status: "insufficient_data" };

  // OLS of orm on days-since-first.
  const first = toDay(pts[0].date);
  const xs = pts.map((p) => (toDay(p.date) - first) / DAY);
  const ys = pts.map((p) => Number(p.orm));
  const n = pts.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let Sxx = 0, Sxy = 0, SStot = 0;
  for (let i = 0; i < n; i++) {
    Sxx += (xs[i] - xbar) ** 2;
    Sxy += (xs[i] - xbar) * (ys[i] - ybar);
    SStot += (ys[i] - ybar) ** 2;
  }
  const m = Sxx > 0 ? Sxy / Sxx : 0;
  const b = ybar - m * xbar;
  let SSres = 0;
  for (let i = 0; i < n; i++) SSres += (ys[i] - (m * xs[i] + b)) ** 2;
  const r2 = SStot > 0 ? 1 - SSres / SStot : 0;

  const trendPerWeek = Math.round(7 * m * 10) / 10;
  const currentOrm = Math.round(ys[ys.length - 1]);
  const status =
    m > 0 && r2 >= 0.3 ? "gaining" : m < 0 && r2 >= 0.3 ? "declining" : "flat";

  const out = { status, trendPerWeek, currentOrm };

  // 8-week forecast band (only when reliably gaining; horizon ≤ 12 weeks).
  if (status === "gaining") {
    const x0 = xs[xs.length - 1] + 56; // 8 weeks past the most recent session
    const yhat = m * x0 + b;
    const s = Math.sqrt(SSres / (n - 2));
    const sePred = 1.3 * s * Math.sqrt(1 + 1 / n + (x0 - xbar) ** 2 / Sxx);
    const mid = Math.round(yhat);
    const low = Math.round(yhat - sePred);
    const high = Math.round(yhat + sePred);
    if ([mid, low, high].every(Number.isFinite)) out.projected = { weeks: 8, low, mid, high };
  }

  // Next-increment milestone ETA (only when gaining, ≤ 12 weeks out).
  if (m > 0) {
    let target = Math.ceil(currentOrm / increment) * increment;
    if (target <= currentOrm) target += increment; // strictly the next plate up
    const weeks = (target - currentOrm) / (7 * m);
    if (Number.isFinite(weeks) && weeks > 0 && weeks <= 12) {
      out.milestone = { target, weeks: Math.round(weeks * 10) / 10 };
    }
  }

  // Never leak NaN/Infinity to the UI.
  if (!Number.isFinite(out.trendPerWeek) || !Number.isFinite(out.currentOrm)) {
    return { status: "insufficient_data" };
  }
  return out;
};
