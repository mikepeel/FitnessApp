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
const LABELS = ["AutoTest-Bulk", "AutoTest-Partial"];
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
  const { error } = await sb.from("workout_sessions").insert(rows);
  if (error) throw new Error("seedHistory insert failed: " + error.message);
  return { skipped: false, uid, count: rows.length };
}

module.exports = { seed, cleanup, hasKey };
