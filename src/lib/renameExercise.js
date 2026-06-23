// Exercise-rename helpers, extracted so the rename can be unit-tested and so the across-history
// rename operates on whatever rows it's given (the cap bug passed only the loaded .limit(100)
// prop, so occurrences beyond that window were never renamed).

// Rename an exercise key inside one session's sets_data blob. Merge-aware: if newName already
// exists, the moving sets are renumbered to continue after newName's existing set numbers — so
// jsonb keys never collide AND the logged_sets rebuilt from this blob get distinct set_numbers
// (no duplicates, unlike a blind exercise_name UPDATE). Pure; returns the same ref on a no-op.
export function renameSetsData(setsObj, oldName, newName) {
  if (!setsObj || !setsObj[oldName] || oldName === newName) return setsObj;
  const sets = { ...setsObj };
  const moving = sets[oldName];
  delete sets[oldName];
  if (sets[newName]) {
    const merged = { ...sets[newName] };
    let next = Math.max(0, ...Object.keys(merged).map(Number)) + 1;
    for (const k of Object.keys(moving)) { merged[next++] = moving[k]; }
    sets[newName] = merged;
  } else {
    sets[newName] = moving;
  }
  return sets;
}

// Flatten a sets_data blob to set rows (used to rebuild logged_sets after a rename). Pure.
// Mirrors the in-app serializer exactly so the rebuilt rows match the loaded shape.
export function setsToArr(setsObj) {
  const arr = [];
  for (const [exName, sets] of Object.entries(setsObj || {})) {
    for (const [sn, v] of Object.entries(sets)) {
      if (v.weight || v.reps || v.minutes) arr.push({ exName, setNum: parseInt(sn), weight: v.weight || "", reps: v.reps || "", minutes: v.minutes || "", level: v.level || "", isPR: v.isPR || false, type: v.type || "working" });
    }
  }
  return arr;
}

// Stamp each set leaf with its stored is_pr (from prMap, keyed by `${exName}|${setNum}`) BEFORE a
// rename, so renameSetsData carries the flag with the moved leaf object through any renumber and
// the logged_sets rebuilt from the blob preserve the pre-rebuild badges (preserve, NOT recompute).
// Falls back to the leaf's existing isPR when prMap has no entry. Pure (returns a new object).
export function enrichIsPR(setsObj, prMap = {}) {
  const out = {};
  for (const [exName, sets] of Object.entries(setsObj || {})) {
    out[exName] = {};
    for (const [sn, leaf] of Object.entries(sets || {})) {
      const k = `${exName}|${sn}`;
      out[exName][sn] = { ...leaf, isPR: k in prMap ? !!prMap[k] : !!(leaf && leaf.isPR) };
    }
  }
  return out;
}

// Plan the sets_data rewrites for a rename across the GIVEN rows ([{id, sets_data}]). Returns
// {id, sets_data} only for rows whose blob holds oldName. Pure — the caller decides which rows to
// pass; the cap bug passed only the loaded prop, so occurrences beyond that window were missed.
export function planRename(rows, oldName, newName) {
  if (oldName === newName) return [];
  return (rows || [])
    .filter((r) => r && r.sets_data && Object.prototype.hasOwnProperty.call(r.sets_data, oldName))
    .map((r) => ({ id: r.id, sets_data: renameSetsData(r.sets_data, oldName, newName) }));
}
