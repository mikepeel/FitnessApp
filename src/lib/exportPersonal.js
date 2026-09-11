// Complete, faithful PERSONAL-data export — the user's OWN training history, downloaded to their
// OWN device. This is the opposite of the anonymized AI export (exportTraining.js): it KEEPS real
// dates, every set type (warmup/drop/failure), cardio + holds, and per-session notes. Nothing is
// stripped, because it never leaves the user's control. Pure + deterministic.
//
// Input: in-app session objects (as produced by lib/sessionMap.mapSessionRow):
//   { dayLabel, startedAt, completedAt, notes, partial,
//     setsArr: [ { exName, setNum, weight, reps, minutes, level, isPR, type } ] }
// `trackOf(exName) => "weight"|"reps"|"time"|"cardio"` is INJECTED so this lib stays free of the
// exercise catalog (and is unit-testable with a stub).

const localDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-CA"); } catch { return ""; }
};

// "" / null -> null; a numeric string -> a Number; anything else -> the original (never lie about a value).
const num = (v) => (v === "" || v == null ? null : (Number.isNaN(Number(v)) ? v : Number(v)));

const byDateAsc = (a, b) => {
  const da = a.completedAt || a.startedAt || "";
  const db = b.completedAt || b.startedAt || "";
  return da < db ? -1 : da > db ? 1 : 0; // oldest first — a natural chronological history
};

// One stored set -> a track-appropriate object holding ONLY the fields that apply to that type,
// so the export represents each movement exactly as it was logged (weighted vs bodyweight vs hold
// vs cardio). Holds store their seconds in `reps`; cardio stores minutes + level.
function shapeSet(s, track) {
  const o = { set: s.setNum };
  if (track === "cardio") {
    if (s.minutes !== "" && s.minutes != null) o.minutes = num(s.minutes);
    if (s.level) o.level = s.level;
  } else if (track === "time") {
    if (s.reps !== "" && s.reps != null) o.seconds = num(s.reps);
    if (s.weight !== "" && s.weight != null) o.addedWeight = num(s.weight);
  } else if (track === "reps") {
    if (s.reps !== "" && s.reps != null) o.reps = num(s.reps);
    if (s.weight !== "" && s.weight != null) o.addedWeight = num(s.weight);
  } else {
    if (s.weight !== "" && s.weight != null) o.weight = num(s.weight);
    if (s.reps !== "" && s.reps != null) o.reps = num(s.reps);
  }
  if (s.type && s.type !== "working") o.type = s.type;
  if (s.isPR) o.pr = true;
  return o;
}

// Group a session's flat setsArr by exercise, first-seen order (matches the logged order).
function exercisesFrom(session, trackOf) {
  const byEx = new Map();
  for (const s of session.setsArr || []) {
    if (!byEx.has(s.exName)) byEx.set(s.exName, []);
    byEx.get(s.exName).push(s);
  }
  return [...byEx.entries()].map(([name, sets]) => {
    const track = trackOf(name);
    return {
      exercise: name,
      track,
      sets: sets.slice().sort((a, b) => a.setNum - b.setNum).map((s) => shapeSet(s, track)),
    };
  });
}

export function buildPersonalExport(sessions, opts = {}) {
  const trackOf = opts.trackOf || (() => "weight");
  const now = opts.now || new Date();
  const rows = (sessions || []).slice().sort(byDateAsc);
  const out = rows.map((s) => ({
    date: localDate(s.completedAt || s.startedAt),
    day: s.dayLabel || "",
    startedAt: s.startedAt || null,
    completedAt: s.completedAt || null,
    ...(s.partial ? { partial: true } : {}),
    ...(s.notes ? { notes: s.notes } : {}),
    exercises: exercisesFrom(s, trackOf),
  }));
  return {
    app: "IRON",
    kind: "personal-training-export",
    exportedAt: now.toISOString(),
    sessionCount: out.length,
    note: "Your complete training history — every session, exercise, and set. This is your data.",
    sessions: out,
  };
}

// CSV: one row per set (the spreadsheet view). A session's notes appear once, on its first row.
const CSV_COLS = ["date", "day", "exercise", "track", "set", "type", "weight", "reps", "seconds", "minutes", "level", "pr", "notes"];

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildPersonalCSV(sessions, opts = {}) {
  const trackOf = opts.trackOf || (() => "weight");
  const rows = (sessions || []).slice().sort(byDateAsc);
  const lines = [CSV_COLS.join(",")];
  for (const s of rows) {
    const date = localDate(s.completedAt || s.startedAt);
    const day = s.dayLabel || "";
    const exs = exercisesFrom(s, trackOf);
    let firstRow = true;
    let wroteAny = false;
    for (const ex of exs) {
      for (const set of ex.sets) {
        wroteAny = true;
        const cells = {
          date, day, exercise: ex.exercise, track: ex.track, set: set.set,
          type: set.type || "working",
          // weight column holds real weight (weight track) or added weight (reps/time tracks)
          weight: set.weight != null ? set.weight : (set.addedWeight != null ? set.addedWeight : ""),
          reps: set.reps != null ? set.reps : "",
          seconds: set.seconds != null ? set.seconds : "",
          minutes: set.minutes != null ? set.minutes : "",
          level: set.level != null ? set.level : "",
          pr: set.pr ? "yes" : "",
          notes: firstRow ? (s.notes || "") : "",
        };
        lines.push(CSV_COLS.map((c) => csvCell(cells[c])).join(","));
        firstRow = false;
      }
    }
    // A session with no logged sets still gets one row (date + day + notes), so it isn't lost.
    if (!wroteAny) {
      const cells = { date, day, notes: s.notes || "" };
      lines.push(CSV_COLS.map((c) => csvCell(c in cells ? cells[c] : "")).join(","));
    }
  }
  return lines.join("\n");
}
