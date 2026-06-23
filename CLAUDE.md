# IRON Workout App — Claude Code Context

## Project Overview
IRON is a React PWA workout tracker. Production app, real users. Handle with care.

## Live Deployment
- **URL**: https://fitness-app-iota-pied.vercel.app/
- **GitHub**: github.com/mikepeel/FitnessApp (user: mikepeel)
- **Supabase Project**: ldbrabnvpiidrdkmjpbo
- **Supabase URL**: https://ldbrabnvpiidrdkmjpbo.supabase.co
- **Anon key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYnJhYm52cGlpZHJka21qcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDMxOTQsImV4cCI6MjA5MzUxOTE5NH0.mJZINJgMl8QD-gTSc2LLikwc8OUloCTyfqoHqRe1xZI

## Repo Structure
```
FitnessApp/
├── public/index.html        ← PWA meta, safe area insets, title "IRON"
├── src/
│   ├── App.js               ← ENTIRE app in one file (~2800 lines)
│   └── index.js             ← standard CRA entry
└── package.json             ← FitnessApp@1.3.0, react-scripts
```

## Tech Stack
- React (Create React App), single-file architecture
- Supabase: auth + all data persistence
- Vercel: auto-deploys on push to main
- No localStorage — Supabase is source of truth
- CI=false set in Vercel env vars
- No TypeScript, no separate CSS files

## Deploy Process
1. Edit src/App.js (and public/index.html if needed)
2. `npm run build` — confirm clean compile
3. `git add src/App.js public/index.html`
4. `git commit -m "description"`
5. `git push origin main`
6. Vercel auto-deploys in ~90 seconds
7. **For any UI-visible change**: wait for deploy, then run Playwright tests (see below) before declaring done

## UI Testing with Playwright
Playwright MCP is configured in `.claude.json`. Use it for all changes that affect visible UI.

**Standard test flow after deploy:**
1. Navigate to the live URL
2. Log in (credentials via user)
3. Screenshot full page to verify layout
4. Test the specific changed component
5. Check for regressions in adjacent tabs/features

**What to test per change type:**
- Layout changes → screenshot Plan/Workout tabs at mobile-equivalent width
- Color/icon changes → screenshot nav bar and day cards
- Scheduling changes → verify Workout tab shows correct day rotation
- Data persistence → reload page, confirm data survived

**Playwright tools available:** `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_take_screenshot`

**Fail criteria:** If a screenshot shows unexpected overlap, wrong colors, missing elements, or broken layout — stop, diagnose, fix before committing.

## Architecture
Single React component file. Key functions in order:
- `THEMES` — dark/light color system
- `MIKE_PLANS` — default plan data (A=Custom PPL, B=Custom Antagonist Split)
- `DEFAULT_SETTINGS` — user settings defaults
- `DOW` — full day names array: ["Sunday","Monday",...,"Saturday"]
- `getProgramStart(sessions)` — derives program start from first session
- `programWeek(sessions)` — current week number
- `AuthScreen` — login/signup/reset, gates entire app
- `ForgeApp` — main app component (exported default)
- `TodayTab` (Workout tab) — week schedule, smart start
- `PlanTab` — edit workout plans
- `HistoryTab` — session log, manual log
- `StatsTab` — 5 sub-tabs: Overview, Progress, Muscles, Body, Coach
- `MoreTab` (Settings tab) — settings, reminders, sign out
- `WorkoutSession` — active workout screen

## Design System
### Dark Mode
- bg: #161b22
- surface: #1e2530
- card: #252d3a
- border: #3a4456
- text: #e8edf4
- muted: #b0bac8
- faint: #6a7585
- cardText: #f2f5fa

### Light Mode
- bg: #f7f9fc
- surface: #ffffff
- card: #ffffff
- border: #e2e8f0
- text: #1a202c
- muted: #3d4f63
- faint: #7a8fa8
- cardText: #0d1117

### Accent Colors (same both modes)
- accent/blue: #4f8ef7
- neon/green: #3ecf8e
- gold: #f7c948
- red/danger: #f06584
- NO orange anywhere — was removed intentionally

## Supabase Schema
Tables: `profiles`, `user_settings`, `plans`, `plan_days`, `exercises`,
`workout_sessions` (has `rating` column), `logged_sets`, `personal_records`, `plan_clones`,
`workout_drafts` (one row per user, UNIQUE on user_id, stores in-progress workout state)

Session object shape:
```js
{
  id: string,
  dayId: string,        // plan day id
  dayLabel: string,     // e.g. "Arms"
  startedAt: ISO string,
  completedAt: ISO string,
  notes: string,
  rating: 0-5,
  sets: { [exName]: [{setNum, weight, reps, done}] },
  setsArr: [{exName, setNum, weight, reps, muscle, isPR}]
}
```

## Nav Tabs
```js
{key:"today", icon:"dumbbell", label:"Workout"}   // gold 3D SVG dumbbell
{key:"plan",  icon:"notebook", label:"Plan"}       // notebook SVG
{key:"log",   icon:"clock",    label:"History"}    // clock SVG
{key:"stats", icon:"◎",        label:"Stats"}
{key:"more",  icon:"gear",     label:"Settings"}   // gear SVG
```
Icons are SVG components rendered inline in the nav — not emojis.

## Key Behaviors
- **Auth gate**: entire app behind login. AuthScreen has gold dumbbell hero image (base64 embedded), "Workout. Track. Improve." tagline
- **Program start**: dynamic from first logged session via `getProgramStart(sessions)`
- **Workout tab day ordering**: today first, future days next, past days at bottom
- **Completed day matching**: match on BOTH `completedAt` date string AND `dayLabel` — this is how History and Workout tab stay in sync
- **Day cards**: today = green border + glow. Past days = 0.7 opacity uniform. Done days show ✓ Done pill + sets/lbs volume line
- **Rest day quotes**: 100 quotes, rotated by day-of-year, reshuffled each 100-day cycle
- **Session rating**: 😴😐🙂💪🔥 (1-5) captured on workout completion
- **Offline**: banner shown, queue logic in place
- **Safe area insets**: `env(safe-area-inset-top/bottom)` throughout for iPhone

## Critical Rules
1. **Never use localStorage** — all state is Supabase or in-memory
2. **No orange colors** — #ff5500 and #e84800 were removed intentionally, never add back
3. **No hardcoded personal references** — no "Mike", no specific dates in AI prompts
4. **All Supabase calls wrapped in try/catch**
5. **Always add `// eslint-disable-line` to useEffect with empty deps array**
6. **CI=false in Vercel** — warnings don't fail builds but eslint errors do
7. **Single file architecture** — do not split into multiple files
8. **Read before writing** — always read the full relevant section of App.js before editing it. Never make changes based on assumptions about what the code looks like. Use grep to find exact strings before replacing them.
9. **No assumptions about state** — never assume what data looks like in memory or in Supabase. When in doubt, add a console.log, check the actual value, then remove the log before committing.
10. **Preserve existing behavior** — when fixing a bug, change only what is broken. Do not refactor surrounding code, rename variables, or reorganize logic unless explicitly asked. Unrelated changes introduce new bugs.
11. **Test the unhappy path** — for every fix, consider what happens when: the user is offline, Supabase returns an error, the data is null/undefined/empty array, the user has no sessions/PRs/plan. Never assume the happy path is the only path.
12. **Never remove existing functionality** — if asked to add a feature, do not remove or modify existing features unless explicitly instructed. Always check that existing functionality still works after changes.
13. **iOS/PWA awareness** — this app runs as a PWA on iPhone. Safe area insets must be preserved (`env(safe-area-inset-top/bottom)`). No browser-specific APIs without feature detection. Touch targets minimum 44px. No hover-only interactions — everything must work on touch.
14. **Single source of truth** — Supabase is the source of truth, not local state. Any data that needs to survive a page reload must be persisted to Supabase. Never rely on React state for persistence.
15. **Environment variables** — never hardcode API keys, URLs, or secrets in App.js. Use the .env file. Never commit .env to GitHub.
16. **Dependency awareness** — do not add new npm packages without explicit user approval. Every new dependency adds bundle size and potential security risk. Use what is already installed.
17. **Component consistency** — always use existing components (Btn, Pill, Mono, SectionLabel) rather than creating inline styled elements that duplicate them. Consistency in UI components keeps the design system intact.
18. **Timezone safety** — never use `new Date("YYYY-MM-DD").getDay()` or `.toISOString().split("T")[0]` for local date comparisons. Use the local date string helper: `` d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` `` or `d.toLocaleDateString("en-CA")` which returns `"YYYY-MM-DD"` in local time.
21. **Timezone awareness — always use local time** — this app runs for users in their local timezone. Never use UTC dates for day/date comparisons. Specifically:
    - Never use `new Date("YYYY-MM-DD")` to get a day of week — parses as UTC midnight, returns wrong weekday in US timezones
    - Never use `.toISOString().split("T")[0]` for local date comparisons — returns UTC date, one day behind in US timezones after ~7pm
    - Always convert Supabase UTC timestamps to local date before comparing: `new Date(s.completedAt).toLocaleDateString("en-CA")`
    - The canonical local date helper: `const toLocalDate = (d = new Date()) => d.toLocaleDateString("en-CA");`
19. **Supabase schema discipline** — confirm every field in an insert/update payload matches an actual column before deploying. If unsure, query `information_schema.columns` first.
20. **Session-start backup** — run `npm run backup` at the start of every session and confirm record counts before touching any code. If `workout_sessions` count drops, stop and alert immediately.
22. **Solve simply, completely, once** — find the exact broken line, fix it, verify it works. Do not rewrite surrounding code, do not add abstractions, do not over-engineer. The simplest fix that completely solves the problem is always preferred over a clever one.
23. **Diagnose before writing code** — read the relevant code first, identify the exact line or condition causing the bug, state the root cause in one sentence, then fix only that. Do not fix things that are not broken.
24. **Efficiency over thoroughness** — a focused 10-line fix that works is better than a 100-line refactor that might. Fix the bug, run npm run build, confirm it works, commit. Nothing more.
25. **Short prompt format for bug fixes** — when given a bug to fix, expect and follow this format:
    - Run backup first
    - One sentence describing what is wrong
    - One sentence on where to look
    - Fix only the broken part
    - Build, test, commit
    Do not expand scope beyond what is described.

26. **Two phase approach for every change:**
    PHASE 1 — IMPLEMENT
    Write the fix or feature. Run npm run build.
    Confirm it compiles cleanly.

    PHASE 2 — VERIFY (switch to tester mindset)
    After implementing, stop coding entirely.
    Attempt to break what you just built by checking:
    - Does it work with no data?
    - Does it work with maximum data?
    - Does it persist after logout/login?
    - Does it reflect correctly on all other tabs?
    - Does it work on the unhappy path
      (network failure, missing data, null values)?
    Report verification results before committing.
    Only commit if verification passes.

27. **Never self-certify without evidence**
    Do not say "this is fixed" without showing proof.
    Proof means one of:
    - npm run backup shows count increased as expected
    - SQL query shows correct data in Supabase
    - Specific test steps were followed and passed
      with exact results reported
    Saying "this should work" or "this looks correct"
    is not proof. Show the evidence.

## Pre-Deploy Checklist
Before every commit verify:
- [ ] No duplicate import statements
- [ ] No localStorage usage: `grep "localStorage" src/App.js`
- [ ] No #ff5500 or #e84800 orange colors: `grep "#ff5500\|#e84800" src/App.js`
- [ ] No hardcoded personal references: `grep -i "mike\|maste\|49-year" src/App.js`
- [ ] All useEffect([]) have eslint-disable comment
- [ ] All Supabase calls in try/catch blocks with error capture
- [ ] No console.log left in (console.error is fine): `grep "console\.log" src/App.js`
- [ ] Build passes: `npm run build`

## Plans Data
- Plan A: "Custom - PPL" — Push/Pull/Legs, 4-5 days
- Plan B: "Custom - Antagonist Split" — antagonist pairs, 4-5 days (default active)

## About Section (do not change)
```jsx
<SectionLabel C={C}>About</SectionLabel>
<Mono style={{fontSize:12,color:C.muted,lineHeight:1.9,display:"block"}}>
  IRON Workout Tracker{"\n"}
  <span style={{color:C.muted}}>v2.0 . Supabase connected</span>
</Mono>
```

## Known Deferred Items
- URL rename to iron-app.vercel.app (not done yet)
- Apple Watch companion (requires native app, not possible in React PWA)

## Uncertainty & Debugging
- Never guess at a solution without saying so explicitly
- If you're not confident in a diagnosis, say that before attempting a fix
- If a debugging thread has stalled, say so and recommend a reset rather than
  continuing to try things
- Surface "I don't know the root cause yet" as a valid and preferred response
  over speculative fixes
- A confirm-first conclusion must rest on inspected evidence (a real row, a
  probe), not inference; if it rests on inference, label it a hypothesis and
  verify before relying on it
- Don't assume an API/library behaves as expected — verify against the actual
  interface (e.g. the PostgREST builder has no .catch; writes use the
  { error } pattern)
