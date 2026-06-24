// @ts-check
// Seeds / cleans history fixtures for the cap-cleanup interaction tests (run from beforeAll/
// afterAll, so the suite is self-contained and leaves no residue). Service-key only — the
// tests test.skip() when it's absent. All rows carry unique AutoTest day_labels so cleanup
// can target them exactly without touching real or other-test data.
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const p = path.join(__dirname, "..", file);
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
}
loadEnv(".env");
loadEnv(".env.test.local");

const SUPABASE_URL = "https://ldbrabnvpiidrdkmjpbo.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY;
const MARKER = "[AUTOMATED TEST — SAFE TO DELETE]";
const LABELS = ["AutoTest-Bulk", "AutoTest-Partial", "AutoTest-BeyondCap-Del", "AutoTest-BeyondCap-Edit", "AutoTest-InCap-Rollback", "AutoTest-BeyondCap-Rollback", "AutoTest-RenameBulk", "AutoTest-RenameEdit", "AutoTest-RenameInCap", "AutoTest-RenameBeyond", "AutoTest-Muscle", "AutoTest-Drill", "AutoTest-Week"];
const DAY = 86400000;

const hasKey = () => !!KEY && !KEY.includes("anon");
const admin = () => createClient(SUPABASE_URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function getUid(sb) {
  const { data } = await sb.auth.admin.listUsers();
  return data?.users?.find((u) => u.email === process.env.TEST_EMAIL)?.id || null;
}

// Removes only this seeder's rows (by the unique AutoTest labels).
async function cleanup() {
  if (!hasKey()) return;
  const sb = admin();
  const { data } = await sb.from("workout_sessions").select("id").in("day_label", LABELS);
  const ids = (data || []).map((r) => r.id);
  if (!ids.length) return;
  await sb.from("logged_sets").delete().in("session_id", ids);
  await sb.from("workout_sessions").delete().in("id", ids);
}

// `bulk` completed sessions aged 95..(95+bulk) days — inside the 6m window, outside 3m — plus
// one recent in-progress (partial) session. With the ~20 baseline sessions this pushes the
// "all" view past the 100-row first page so pagination ("Load more") is exercised, and gives
// the window-switching test rows that appear only in wider windows.
async function seed({ bulk = 90 } = {}) {
  if (!hasKey()) return { skipped: true };
  const sb = admin();
  const uid = await getUid(sb);
  if (!uid) return { skipped: true };
  await cleanup(); // idempotent: clear any prior run's rows first
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < bulk; i++) {
    const d = new Date(now - (95 + i) * DAY).toISOString();
    rows.push({ user_id: uid, day_label: "AutoTest-Bulk", started_at: d, completed_at: d, notes: MARKER, sets_data: {}, partial: false });
  }
  rows.push({ user_id: uid, day_label: "AutoTest-Partial", started_at: new Date(now - DAY).toISOString(), completed_at: null, notes: MARKER, sets_data: {}, partial: true });
  // Two beyond-cap rows aged 178d: inside the 6m window, but past the 100-row prop cap given the
  // bulk above — so they're displayable in History 6M yet absent from the loaded `sessions` prop.
  // Used to prove delete/edit operate by id on rows not in the prop. dur ~60min (started 60m before).
  const bcCompleted = new Date(now - 178 * DAY);
  const bcStarted = new Date(bcCompleted.getTime() - 60 * 60000).toISOString();
  ["AutoTest-BeyondCap-Del", "AutoTest-BeyondCap-Edit"].forEach((lbl) => {
    rows.push({ user_id: uid, day_label: lbl, started_at: bcStarted, completed_at: bcCompleted.toISOString(), notes: MARKER, sets_data: {}, partial: false });
  });
  // Recent (in-cap → in the loaded prop) row WITH a set, for the saveEdit rollback (.catch) test:
  // editing its weight then forcing the logged_sets insert to fail must roll sets_data back to 100.
  rows.push({ user_id: uid, day_label: "AutoTest-InCap-Rollback", started_at: new Date(now - 2 * DAY - 3600000).toISOString(), completed_at: new Date(now - 2 * DAY).toISOString(), notes: MARKER, sets_data: { "Bench Press": { "1": { weight: "100", reps: "5" } } }, partial: false });
  // Beyond-cap (~178d, past the prop cap) row WITH a set, for the beyond-cap rollback test: a
  // failed edit must roll sets_data back to 100 using the modal-passed baseline (no prop entry).
  rows.push({ user_id: uid, day_label: "AutoTest-BeyondCap-Rollback", started_at: bcStarted, completed_at: bcCompleted.toISOString(), notes: MARKER, sets_data: { "Bench Press": { "1": { weight: "100", reps: "5" } } }, partial: false });
  const { error } = await sb.from("workout_sessions").insert(rows);
  if (error) throw new Error("seedHistory insert failed: " + error.message);
  return { skipped: false, uid, count: rows.length };
}

// Seeds fixtures for the across-history rename tests: 90 bulk (to push the beyond-cap occurrence
// past the 100-row prop) + sessions holding "OldLift" — one recent (the one we edit), one ~178d
// beyond-cap, and (when inCap) one recent in-cap so the "apply to all?" prompt fires off the prop.
// With inCap:false the ONLY other occurrence is beyond-cap (the Edge B trigger case). Each OldLift
// set is flagged is_pr=true. Returns the beyond-cap session id.
async function seedRename({ inCap = true } = {}) {
  if (!hasKey()) return { skipped: true };
  const sb = admin();
  const uid = await getUid(sb);
  if (!uid) return { skipped: true };
  await cleanup();
  const now = Date.now();
  const bulk = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date(now - (95 + i) * DAY).toISOString();
    bulk.push({ user_id: uid, day_label: "AutoTest-RenameBulk", started_at: d, completed_at: d, notes: MARKER, sets_data: {}, partial: false });
  }
  const { error: be } = await sb.from("workout_sessions").insert(bulk);
  if (be) throw new Error("seedRename bulk: " + be.message);
  const blob = { OldLift: { "1": { weight: "100", reps: "5" } } };
  const mk = (label, daysAgo) => ({ user_id: uid, day_label: label, started_at: new Date(now - daysAgo * DAY - 3600000).toISOString(), completed_at: new Date(now - daysAgo * DAY).toISOString(), notes: MARKER, sets_data: blob, partial: false });
  const toInsert = [mk("AutoTest-RenameEdit", 1)];
  if (inCap) toInsert.push(mk("AutoTest-RenameInCap", 2));
  toInsert.push(mk("AutoTest-RenameBeyond", 178));
  const { data: ins, error: ie } = await sb.from("workout_sessions").insert(toInsert).select("id,day_label");
  if (ie) throw new Error("seedRename rows: " + ie.message);
  // Each OldLift set is a PR (is_pr=true) while its sets_data leaf lacks isPR — so a rebuild that
  // doesn't preserve would clear the badge. Used by the badge-persists (rename) and saveEdit-guard tests.
  const ls = (ins || []).map((r) => ({ session_id: r.id, user_id: uid, exercise_name: "OldLift", set_number: 1, weight: 100, reps: 5, set_type: "working", is_pr: true }));
  if (ls.length) { const { error: le } = await sb.from("logged_sets").insert(ls); if (le) throw new Error("seedRename logged_sets: " + le.message); }
  return { skipped: false, beyondId: (ins || []).find((r) => r.day_label === "AutoTest-RenameBeyond")?.id };
}

// Seeds a recent (today) session whose ONLY lift is "Dumbbell Lateral Raise" — absent from the
// app's hardcoded tonnage muscleMap but resolved to Shoulders by muscleContributions. With no
// other Shoulders lift in iron-test's 7-day window, this isolates the Muscles-tab tonnage bug:
// before the resolver fix the tonnage orphans to "Other" (Shoulders bar absent / 0k lbs); after,
// it lands on Shoulders. Returns the session id.
async function seedMuscles() {
  if (!hasKey()) return { skipped: true };
  const sb = admin();
  const uid = await getUid(sb);
  if (!uid) return { skipped: true };
  await cleanup();
  const now = new Date();
  const sets_data = { "Dumbbell Lateral Raise": { "1": { weight: "30", reps: "15" }, "2": { weight: "30", reps: "15" }, "3": { weight: "30", reps: "15" } } };
  const { data: ins, error: se } = await sb.from("workout_sessions").insert({ user_id: uid, day_label: "AutoTest-Muscle", started_at: new Date(now.getTime() - 3600000).toISOString(), completed_at: now.toISOString(), notes: MARKER, sets_data, partial: false }).select("id");
  if (se) throw new Error("seedMuscles session: " + se.message);
  const sid = ins[0].id;
  const rows = [1, 2, 3].map((n) => ({ session_id: sid, user_id: uid, exercise_name: "Dumbbell Lateral Raise", set_number: n, weight: 30, reps: 15, set_type: "working", is_pr: false }));
  const { error: le } = await sb.from("logged_sets").insert(rows);
  if (le) throw new Error("seedMuscles logged_sets: " + le.message);
  return { skipped: false, sid };
}

// Seeds a personal_records row achieved "now" (newest), so the Muscles-tab PR card has a known
// most-recent PR to display. Also clears "OldLift" — residue the rename tests leave in
// personal_records (the marker cleanup only removes workout_sessions/logged_sets, not PR rows).
async function seedRecentPR() {
  if (!hasKey()) return { skipped: true };
  const sb = admin();
  const uid = await getUid(sb);
  if (!uid) return { skipped: true };
  await cleanupPRs();
  const { error } = await sb.from("personal_records").upsert(
    { user_id: uid, exercise_name: "AutoTest-PRLift", max_weight: 137, achieved_at: new Date().toISOString() },
    { onConflict: "user_id,exercise_name" }
  );
  if (error) throw new Error("seedRecentPR: " + error.message);
  return { skipped: false };
}

async function cleanupPRs() {
  if (!hasKey()) return;
  const sb = admin();
  const uid = await getUid(sb);
  if (!uid) return;
  await sb.from("personal_records").delete().eq("user_id", uid).in("exercise_name", ["AutoTest-PRLift", "OldLift"]);
}

// Seeds two completed sessions of one lift "AutoTest-Drill" for the Progress drill-down work-log
// table: an OLDER uniform session (4×7 @ 175) and a NEWER mixed session (8,8,6 @ 185). Lets the
// table assert compression ("4×7 @ 175") AND within-session split in performed order
// ("2×8 @ 185, 1×6 @ 185"), newest first. Working sets only (set_type "working").
async function seedDrill() {
  if (!hasKey()) return { skipped: true };
  const sb = admin();
  const uid = await getUid(sb);
  if (!uid) return { skipped: true };
  await cleanup();
  const now = Date.now();
  const mkSession = async (daysAgo, sets_data) => {
    const completed = new Date(now - daysAgo * DAY);
    const { data, error } = await sb.from("workout_sessions").insert({ user_id: uid, day_label: "AutoTest-Drill", started_at: new Date(completed.getTime() - 3600000).toISOString(), completed_at: completed.toISOString(), notes: MARKER, sets_data, partial: false }).select("id");
    if (error) throw new Error("seedDrill session: " + error.message);
    return data[0].id;
  };
  const sidOld = await mkSession(10, { "AutoTest-Drill": { "1": { weight: "175", reps: "7" }, "2": { weight: "175", reps: "7" }, "3": { weight: "175", reps: "7" }, "4": { weight: "175", reps: "7" } } });
  const oldRows = [1, 2, 3, 4].map((n) => ({ session_id: sidOld, user_id: uid, exercise_name: "AutoTest-Drill", set_number: n, weight: 175, reps: 7, set_type: "working", is_pr: false }));
  const sidNew = await mkSession(2, { "AutoTest-Drill": { "1": { weight: "185", reps: "8" }, "2": { weight: "185", reps: "8" }, "3": { weight: "185", reps: "6" } } });
  const newRows = [{ n: 1, r: 8 }, { n: 2, r: 8 }, { n: 3, r: 6 }].map((x) => ({ session_id: sidNew, user_id: uid, exercise_name: "AutoTest-Drill", set_number: x.n, weight: 185, reps: x.r, set_type: "working", is_pr: false }));
  const { error: le } = await sb.from("logged_sets").insert([...oldRows, ...newRows]);
  if (le) throw new Error("seedDrill logged_sets: " + le.message);
  return { skipped: false, sidOld, sidNew };
}

// Seeds two sessions to exercise the Stats "This Week" card's PLAN-week window: one IN the current
// plan week (counted) and one the day BEFORE the plan-week start (prior plan week — but inside the
// old Sunday-start calendar window on Tue–Sat run days, so it would wrongly inflate the count to 2
// / volume to 6k under the bug). Aligns to the SAME anchor the app uses: the active plan's
// start_date (else the earliest-completed-session date), computing the plan-week start with the
// same floor(days/7) blocks as planWeekStart — so the seed can't drift from the card's window.
// After the fix the card shows 1 session / 1k lbs regardless of which weekday the test runs.
async function seedThisWeek() {
  if (!hasKey()) return { skipped: true };
  const sb = admin();
  const uid = await getUid(sb);
  if (!uid) return { skipped: true };
  await cleanup();
  // Resolve the app's anchor: active plan start_date, else earliest completed session.
  const { data: prof } = await sb.from("profiles").select("active_plan_key").eq("id", uid).maybeSingle();
  let startStr = null;
  if (prof?.active_plan_key) {
    const { data: plan } = await sb.from("plans").select("start_date").eq("user_id", uid).eq("plan_key", prof.active_plan_key).maybeSingle();
    startStr = plan?.start_date || null;
  }
  if (!startStr) {
    const { data: first } = await sb.from("workout_sessions").select("completed_at").eq("user_id", uid).not("completed_at", "is", null).order("completed_at", { ascending: true }).limit(1);
    startStr = first?.[0]?.completed_at ? new Date(first[0].completed_at).toLocaleDateString("en-CA") : null;
  }
  if (!startStr) throw new Error("seedThisWeek: no plan start_date and no completed session to anchor on");
  // Current plan-week start (local noon), same anchor + 7-day blocks as planWeekStart.
  const start = new Date(startStr + "T12:00:00");
  const nowNoon = new Date(); nowNoon.setHours(12, 0, 0, 0);
  const days = Math.floor((nowNoon - start) / DAY);
  const block = days < 0 ? 0 : Math.floor(days / 7);
  const pws = new Date(start); pws.setDate(start.getDate() + block * 7); // plan-week start (noon)
  const inWeek = new Date(nowNoon);            // today → always in the current plan week
  const leak = new Date(pws); leak.setDate(pws.getDate() - 1); // day before pws → prior plan week
  const mk = async (completed, sets_data, rows) => {
    const { data, error } = await sb.from("workout_sessions").insert({ user_id: uid, day_label: "AutoTest-Week", started_at: new Date(completed.getTime() - 3600000).toISOString(), completed_at: completed.toISOString(), notes: MARKER, sets_data, partial: false }).select("id");
    if (error) throw new Error("seedThisWeek session: " + error.message);
    const sid = data[0].id;
    const ls = rows.map((r, i) => ({ session_id: sid, user_id: uid, exercise_name: "AutoTest-WeekLift", set_number: i + 1, weight: r.w, reps: r.r, set_type: "working", is_pr: false }));
    const { error: le } = await sb.from("logged_sets").insert(ls);
    if (le) throw new Error("seedThisWeek logged_sets: " + le.message);
  };
  // in-week: 200×5 = 1000 → card "1k". leak: 1000×5 = 5000 → would push the card to "6k" / 2 sessions if windowed by calendar week.
  await mk(inWeek, { "AutoTest-WeekLift": { "1": { weight: "200", reps: "5" } } }, [{ w: 200, r: 5 }]);
  await mk(leak, { "AutoTest-WeekLift": { "1": { weight: "1000", reps: "5" } } }, [{ w: 1000, r: 5 }]);
  return { skipped: false, pws: pws.toLocaleDateString("en-CA"), leak: leak.toLocaleDateString("en-CA") };
}

module.exports = { seed, seedRename, seedMuscles, seedRecentPR, seedDrill, seedThisWeek, cleanup, cleanupPRs, hasKey };
