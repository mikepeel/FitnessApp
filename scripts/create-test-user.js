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

  // 4. Insert Custom PPL plan so tests have workout days with START buttons
  const mkId = () => `id_${Math.random().toString(36).slice(2, 9)}`;
  const today = new Date().toLocaleDateString("en-CA");
  const planKey = "preset_test_ppl";
  const daysJson = [
    { id: mkId(), name: "Monday",    label: "Push", tag: "Chest . Shoulders . Triceps",        color: "#4f8ef7", isRest: false, exercises: [
      { id: mkId(), name: "Bench Press",               sets: "4", reps: "6-10",    note: "Primary strength move",        muscle: "Chest"     },
      { id: mkId(), name: "Incline Press (DB)",        sets: "3", reps: "8-12",    note: "DB preferred for shoulder safety", muscle: "Chest" },
      { id: mkId(), name: "Machine Shoulder Press",    sets: "3", reps: "10-12",   note: "Machine reduces joint stress",  muscle: "Shoulders" },
      { id: mkId(), name: "Dumbbell Lateral Raises",   sets: "3", reps: "12-15",   note: "Slow eccentric",                muscle: "Shoulders" },
      { id: mkId(), name: "Incline Tricep Extension",  sets: "3", reps: "10-12",   note: "Elbow-friendly angle",          muscle: "Triceps"   },
      { id: mkId(), name: "Cable Overhead Extension",  sets: "2", reps: "12-15",   note: "Long-head emphasis",            muscle: "Triceps"   },
      { id: mkId(), name: "Stair Stepper",             sets: "--", reps: "10-15 min", note: "Zone 2 cardio post-workout", muscle: "Cardio"   },
    ]},
    { id: mkId(), name: "Tuesday",   label: "Pull", tag: "Back . Biceps . Rear Delt",          color: "#3d8eff", isRest: false, exercises: [
      { id: mkId(), name: "Reverse Grip Lat Pulldown", sets: "4", reps: "8-12",  note: "", muscle: "Back"    },
      { id: mkId(), name: "Seated Cable Row",          sets: "3", reps: "10-12", note: "", muscle: "Back"    },
      { id: mkId(), name: "Rear Delt Machine",         sets: "3", reps: "12-15", note: "", muscle: "Shoulders"},
      { id: mkId(), name: "Cable Curl",                sets: "3", reps: "10-12", note: "", muscle: "Biceps"  },
      { id: mkId(), name: "Concentration Curl",        sets: "2", reps: "12-15", note: "", muscle: "Biceps"  },
      { id: mkId(), name: "Machine Crunch",            sets: "3", reps: "15-20", note: "", muscle: "Abs"     },
    ]},
    { id: mkId(), name: "Wednesday", label: "Rest",  tag: "Active Recovery",                   color: "#aaff00", isRest: true,  exercises: [
      { id: mkId(), name: "Walking / Yoga / Stretching", sets: "--", reps: "20-30 min", note: "", muscle: "Recovery" },
    ]},
    { id: mkId(), name: "Thursday",  label: "Legs",  tag: "Quads . Glutes . Hamstrings . Core", color: "#aa44ff", isRest: false, exercises: [
      { id: mkId(), name: "Goblet Squat",         sets: "4", reps: "10-15",     note: "", muscle: "Legs" },
      { id: mkId(), name: "DB Romanian Deadlift", sets: "3", reps: "10-12",     note: "", muscle: "Legs" },
      { id: mkId(), name: "Box Step-Ups (DB)",    sets: "3", reps: "10 each",   note: "", muscle: "Legs" },
      { id: mkId(), name: "Decline Sit-Ups",      sets: "3", reps: "12-15",     note: "", muscle: "Abs"  },
      { id: mkId(), name: "Stair Stepper",         sets: "--", reps: "10 min",  note: "", muscle: "Cardio"},
    ]},
    { id: mkId(), name: "Friday",    label: "Push",  tag: "Chest . Shoulders . Triceps (Vol)", color: "#4f8ef7", isRest: false, exercises: [
      { id: mkId(), name: "Incline Press (DB)",      sets: "4", reps: "8-12",  note: "", muscle: "Chest"     },
      { id: mkId(), name: "Cable Fly / Pec Deck",    sets: "3", reps: "12-15", note: "", muscle: "Chest"     },
      { id: mkId(), name: "Machine Shoulder Press",  sets: "3", reps: "10-12", note: "", muscle: "Shoulders" },
      { id: mkId(), name: "Cable Rope Pressdown",    sets: "3", reps: "12-15", note: "", muscle: "Triceps"   },
    ]},
    { id: mkId(), name: "Saturday",  label: "Pull",  tag: "Back . Biceps (Volume)",            color: "#3d8eff", isRest: false, exercises: [
      { id: mkId(), name: "T-Bar Row",               sets: "4", reps: "8-12",  note: "", muscle: "Back"   },
      { id: mkId(), name: "Reverse Grip Pulldown",   sets: "3", reps: "10-12", note: "", muscle: "Back"   },
      { id: mkId(), name: "Cable Curl",              sets: "3", reps: "12-15", note: "", muscle: "Biceps" },
    ]},
    { id: mkId(), name: "Sunday",    label: "Rest",  tag: "Full Rest",                         color: "#aaff00", isRest: true,  exercises: [] },
  ];

  const { error: planErr } = await admin.from("plans").upsert(
    {
      user_id: uid,
      plan_key: planKey,
      name: "Custom PPL",
      subtitle: "Push/Pull/Legs",
      description: "Test plan for automated regression testing",
      days_json: daysJson,
      start_date: today,
      duration_weeks: 10,
    },
    { onConflict: "user_id,plan_key" }
  );
  if (planErr) console.warn("Plan upsert warning:", planErr.message);
  else console.log("Custom PPL plan inserted");

  // Set active_plan_key on profile
  const { error: pkErr } = await admin
    .from("profiles")
    .update({ active_plan_key: planKey })
    .eq("id", uid);
  if (pkErr) console.warn("active_plan_key update warning:", pkErr.message);
  else console.log("active_plan_key set to", planKey);

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
