// Fractional muscle-volume resolver.
//
// Resolves an exercise name to the FINE muscles it works, with a contribution
// factor per muscle (primary = 1.0, secondary = 0.5). Source of truth is the
// hand-curated src/data/exerciseMuscleMap.json. Cardio and rest/recovery names are
// recognised but never contribute muscle sets (cardio is tracked as minutes).
//
// Unmapped exercises fall back to GROUP-level credit (1.0 to the app's existing
// coarse primary tag) — only mapped lifts earn fine-muscle credit; customs still
// show up at the display-group level.
import map from "../data/exerciseMuscleMap.json";

const SECONDARY = typeof map.secondaryFactor === "number" ? map.secondaryFactor : 0.5;
const ROLLUP = map.taxonomy.rollup;

// The 8th group (Cardio) is a modality tracked separately as minutes, so the fine
// rollup targets only these strength display groups.
export const DISPLAY_GROUPS = Object.keys(map.taxonomy.displayGroups);

// lowercase, trim, collapse internal whitespace, strip surrounding punctuation.
export function normalizeName(name) {
  return String(name == null ? "" : name)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\w]+|[^\w]+$/g, "");
}

// Pre-normalised lookups (map keys are stored in original case).
const NONCOUNTING = new Set((map.nonCounting || []).map(normalizeName));
const CARDIO = new Set((map.cardioModality || []).map(normalizeName));
const EXERCISES = {};
for (const k of Object.keys(map.exercises || {})) EXERCISES[normalizeName(k)] = map.exercises[k];
const ALIASES = {};
for (const k of Object.keys(map.aliases || {})) ALIASES[normalizeName(k)] = map.aliases[k];

function contributionsFromEntry(entry) {
  return [
    ...(entry.primary || []).map((muscle) => ({ muscle, factor: 1.0 })),
    ...(entry.secondary || []).map((muscle) => ({ muscle, factor: SECONDARY })),
  ];
}

// Resolve an exercise name to its fine-muscle contributions.
// Returns { contributions:[{muscle,factor}], counted:bool, modality:'strength'|'cardio'|null }
export function muscleContributions(exerciseName, coarseFallback) {
  const key = normalizeName(exerciseName);
  // 1. non-counting (rest / recovery / blank)
  if (NONCOUNTING.has(key)) return { contributions: [], counted: false, modality: null };
  // 2. cardio modality — recognised, but never muscle sets (tracked as minutes)
  if (CARDIO.has(key)) return { contributions: [], counted: false, modality: "cardio" };
  // 3. direct fine mapping
  let entry = EXERCISES[key];
  // 4. alias -> canonical name -> fine mapping
  if (!entry && ALIASES[key]) entry = EXERCISES[normalizeName(ALIASES[key])];
  if (entry) return { contributions: contributionsFromEntry(entry), counted: true, modality: "strength" };
  // 5. coarse GROUP-level fallback (app's existing single primary tag)
  if (coarseFallback) return { contributions: [{ muscle: coarseFallback, factor: 1.0 }], counted: true, modality: "strength" };
  // 6. unmapped, no fallback
  return { contributions: [], counted: false, modality: null };
}

// Roll a fine muscle up to one of the display groups. A value that is already a
// display group returns itself.
export function rollupToGroup(muscle) {
  if (ROLLUP[muscle]) return ROLLUP[muscle];
  if (DISPLAY_GROUPS.includes(muscle)) return muscle;
  return muscle;
}

// The single DISPLAY GROUP that should receive an exercise's TONNAGE — its primary mover — using
// the SAME resolver as set credit (muscleContributions → rollupToGroup), so a muscle row's bar
// (tonnage) and its set count never come from different maps. Unresolvable (no fine mapping and no
// coarse fallback) → "Other".
export function primaryMoverGroup(exerciseName, coarseFallback) {
  const r = muscleContributions(exerciseName, coarseFallback);
  if (!r.counted || !r.contributions.length) return "Other";
  const primary = r.contributions.find((c) => c.factor >= 1) || r.contributions[0];
  return rollupToGroup(primary.muscle);
}
