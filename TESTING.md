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
