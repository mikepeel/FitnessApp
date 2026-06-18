# IRON Testing Guide

### 9. Regression testing
- After any change to a shared component (Btn, Pill, Mono, SectionLabel, RestTimer, WorkoutSession), verify all tabs still render correctly
- After any change to loadUserData, verify ALL data types load correctly: sessions, PRs, settings, plans, body stats
- After any change to saveSessions, verify the full round trip:
  save → backup confirms count increased → logout → re-login → data appears correctly in History and Workout tab

### 10. iOS PWA testing checklist
After any UI change, verify on mobile:
- [ ] Safe area insets not violated (status bar, home indicator)
- [ ] No horizontal scroll introduced
- [ ] Touch targets are large enough to tap accurately
- [ ] Text is readable without zooming
- [ ] No content hidden behind the bottom nav bar

### 11. Error handling standards
Every async function must follow this pattern:
- try/catch around all await calls
- console.error with the function name and full error object
- Graceful UI fallback — never let an error crash the whole screen
- Example:
  ```js
  try {
    const { data, error } = await supabase.from(...).select();
    if (error) throw error;
    // use data
  } catch (e) {
    console.error("loadSessions:", e);
    // set empty state, show no error to user unless actionable
  }
  ```

### 12. Pre-commit grep checks
Before every commit run these checks and fix any failures:
- No localStorage: `grep "localStorage" src/App.js`
- No hardcoded orange: `grep "#ff5500\|#e84800" src/App.js`
- No duplicate imports: check first 10 lines for duplicate import statements
- No uncaught Supabase calls: `grep "await supabase" src/App.js` (manually verify each has try/catch)
- No console.log left in: `grep "console\.log" src/App.js` (console.error is fine, console.log should be removed)
- No hardcoded personal data: `grep -i "mike\|maste\|49-year" src/App.js`

### 13. Supabase operation checklist
Before any database operation:
- [ ] Confirm table schema via `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '...' ORDER BY ordinal_position`
- [ ] Confirm RLS policies exist for SELECT, INSERT, UPDATE, DELETE
- [ ] Confirm every field in payload matches an actual column
- [ ] Confirm snake_case → camelCase mapping is correct in load functions
- [ ] Confirm camelCase → snake_case mapping is correct in save functions

### 14. Timezone testing
After any change involving dates, streaks, session matching, or day-of-week logic, verify:
- [ ] Completing a workout after 7pm local time still shows correct date
- [ ] Streak advances correctly on the day of completion, not the next day
- [ ] Workout tab day cards show the correct calendar date for each day
- [ ] History tab groups sessions under the correct date
- [ ] Done pill appears on the correct day card after completing a workout
- [ ] Session completed at 11:59pm local time appears on the correct date, not the next day (UTC rollover edge case)

The root cause of timezone bugs is always the same: UTC midnight (00:00 UTC) is the previous evening in US timezones. Any code that uses ISO strings or UTC dates for local day comparisons will fail for users in UTC-5 through UTC-8 (US timezones).

The correct local date helper:
```js
const toLocalDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local TZ
```

Never use:
- `new Date("YYYY-MM-DD").getDay()` — parses as UTC midnight, returns wrong weekday
- `.toISOString().split("T")[0]` — returns UTC date, one day behind in US timezones after ~7pm

### 15. UI testing (Playwright) — required for UI-behavior changes
Any commit that changes UI behavior — rendered output, user interactions, async-driven
display, or layout — requires a Playwright UI test. Pure-function tests plus a clean build are
NOT sufficient on their own for a UI change. This is the automated complement to the manual
checks in §9 ("verify all tabs render") and the §10 iOS/layout checklist — do both; an
automated test does not replace the §10 mobile pass, and the manual pass does not replace the
automated test.

- **Never happy-path only.** Every UI test must include at least one non-happy-path case —
  error, empty state, or edge — in addition to any happy-path assertion.
- **Bug fixes: fails-before / passes-after, at the UI.** The test must reproduce the broken UI
  state before the fix (red) and pass after (green) — the same discipline applied to logic
  fixes, now at the rendered layer. If the fix already landed, substitute a mutation check:
  reverting the fixed line(s) must make the test fail. A test that passes whether or not the
  fix is present is vacuous — don't ship it.
- **Exercise the fail-safe / error path.** The graceful fallback required by §11 must be
  proven by a test, not assumed: force the failure (e.g. Playwright `page.route` interception
  to make a fetch fail or return an error) and assert the fallback renders correctly AND that
  no false error banner appears on the user's primary action.
- **Data seeding.** Tests needing large datasets — e.g. >100 sessions to hit
  cap/truncation/pagination boundaries — require a seeded account in iron-test; seed it
  deterministically rather than relying on whatever data happens to exist. Fail-safe,
  pagination, partial-session display, and layout tests run on normal seed data. Clean up any
  rows seeded for a test afterward (0 residue).
