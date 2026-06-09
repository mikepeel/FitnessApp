/**
 * Deletes all workout sessions created by automated Playwright tests.
 * Matches either marker:
 *   - "[AUTOMATED TEST — SAFE TO DELETE]" in notes (completed-workout tests)
 *   - a day_label starting with "AutoTest-" (manual-log test sessions)
 *
 * Run: node scripts/delete-test-sessions.js
 * Requires SUPABASE_SERVICE_KEY in .env
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
}

const SUPABASE_URL = "https://ldbrabnvpiidrdkmjpbo.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY || SERVICE_KEY.includes("anon")) {
  console.error("ERROR: Requires SUPABASE_SERVICE_KEY (service_role) in .env");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Find sessions with the test marker
  const { data: sessions, error } = await admin
    .from("workout_sessions")
    .select("id, day_label, completed_at, notes")
    .or("notes.ilike.%AUTOMATED TEST%,day_label.ilike.AutoTest-%");

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  if (!sessions || sessions.length === 0) {
    console.log("No test sessions found.");
    return;
  }

  console.log(`Found ${sessions.length} test session(s):`);
  sessions.forEach((s) =>
    console.log(`  ${s.id} — ${s.day_label} — ${s.completed_at?.slice(0, 10)}`)
  );

  // Delete logged_sets for these sessions first (FK constraint)
  const ids = sessions.map((s) => s.id);
  const { error: setsErr } = await admin
    .from("logged_sets")
    .delete()
    .in("session_id", ids);
  if (setsErr) console.warn("logged_sets delete warning:", setsErr.message);

  // Delete the sessions
  const { error: delErr } = await admin
    .from("workout_sessions")
    .delete()
    .in("id", ids);
  if (delErr) {
    console.error("Delete error:", delErr.message);
    process.exit(1);
  }

  console.log(`Deleted ${sessions.length} test session(s) and their sets.`);
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
