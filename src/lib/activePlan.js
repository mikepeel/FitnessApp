// Resolves which plan key is active from a saved key + the user's available plan keys — the exact
// selection the load path uses: the saved key if it's one of the user's plans, else the first plan
// (DB order), else null. Pure (extracted so the resolution + the self-correct's clobber decision
// are testable). The FIX is in the CALLER (single-source `savedKey` on user_metadata, the store
// every write targets — not the stale, never-written profiles.active_plan_key); this helper's
// behavior is unchanged.
export function resolveActivePlanKey(savedKey, planKeys) {
  const keys = planKeys || [];
  return (savedKey && keys.includes(savedKey)) ? savedKey : (keys.length > 0 ? keys[0] : null);
}
