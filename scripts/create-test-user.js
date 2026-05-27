/**
 * Creates a dedicated test user for Playwright regression tests.
 * Run once: node scripts/create-test-user.js
 *
 * Requires SUPABASE_SERVICE_KEY in .env (Settings → API → service_role key).
 * The test user gets full Pro access and a default PPL plan so all workout
 * features are reachable during tests.
 *
 * After running, add to .env.test.local:
 *   TEST_EMAIL=iron-test@example.com
 *   TEST_PASSWORD=<the password you set below>
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env
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
  console.error("ERROR: SUPABASE_SERVICE_KEY must be the service_role key, not the anon key.");
  console.error("Get it from: Supabase Dashboard → Settings → API → service_role");
  process.exit(1);
}

// ── CONFIG — change these before running ────────────────────────────────────
const TEST_EMAIL = "iron-test@example.com";
const TEST_PASSWORD = "IronTest2026!"; // change this to something secure
// ────────────────────────────────────────────────────────────────────────────

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Creating test user: ${TEST_EMAIL}`);

  // 1. Create auth user
  const { data: userData, error: userErr } =
    await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true, // skip email confirmation for test account
    });

  if (userErr) {
    if (userErr.message.includes("already been registered")) {
      console.log("User already exists — fetching existing user...");
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email === TEST_EMAIL);
      if (!existing) {
        console.error("Could not find existing user. Delete and re-run.");
        process.exit(1);
      }
      await setupUserData(existing.id);
      return;
    }
    console.error("Failed to create user:", userErr.message);
    process.exit(1);
  }

  const uid = userData.user.id;
  console.log(`Auth user created: ${uid}`);
  await setupUserData(uid);
}

async function setupUserData(uid) {
  // 2. Upsert profile with is_pro = true (full access)
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: uid,
      is_pro: true,
      active_plan_key: null,
    },
    { onConflict: "id" }
  );
  if (profErr) console.warn("Profile upsert warning:", profErr.message);
  else console.log("Profile set (is_pro=true)");

  // 3. Upsert user_settings with defaults (rest timer enabled, 90s)
  const { error: settErr } = await admin.from("user_settings").upsert(
    {
      user_id: uid,
      rest_timer: true,
      rest_seconds: 90,
      pr_detection: true,
      last_ref: true,
      deload_reminder: true,
      streak_tracking: true,
      plate_calc: true,
      workout_notes: true,
      ai_recs: true,
      theme_mode: "dark",
      apple_health: false,
      ai_age_range: "",
      ai_experience: "",
      ai_joint_notes: "",
      ai_goal: "",
    },
    { onConflict: "user_id" }
  );
  if (settErr) console.warn("Settings upsert warning:", settErr.message);
  else console.log("User settings set");

  console.log("\n✓ Test user ready.");
  console.log("\nAdd to .env.test.local:");
  console.log(`  TEST_EMAIL=${TEST_EMAIL}`);
  console.log(`  TEST_PASSWORD=${TEST_PASSWORD}`);
  console.log("\nThe default PPL and Antagonist plans load automatically from");
  console.log("MIKE_PLANS in App.js — no plan data needs to be inserted.");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
