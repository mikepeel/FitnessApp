import { buildPersonalExport, buildPersonalCSV } from "./exportPersonal";

// Injected track resolver stub — keeps the test free of the real catalog.
const trackOf = (n) => ({ "Plank": "time", "Rowing Machine": "cardio", "Pull-Up": "reps" }[n] || "weight");

// Two sessions, deliberately out of order (May 20 is EARLIER than June 1) to prove chronological sort.
const fixture = () => [
  {
    dayLabel: "Push", startedAt: "2026-06-01T18:00:00Z", completedAt: "2026-06-01T19:00:00Z",
    notes: "felt strong", partial: false,
    setsArr: [
      { exName: "Bench Press", setNum: 1, weight: "95", reps: "5", minutes: "", level: "", isPR: false, type: "warmup" },
      { exName: "Bench Press", setNum: 2, weight: "185", reps: "5", minutes: "", level: "", isPR: true, type: "working" },
      { exName: "Plank", setNum: 1, weight: "", reps: "60", minutes: "", level: "", isPR: false, type: "working" },
    ],
  },
  {
    dayLabel: "Cardio", startedAt: "2026-05-20T18:00:00Z", completedAt: "2026-05-20T18:30:00Z",
    notes: "", partial: false,
    setsArr: [
      { exName: "Rowing Machine", setNum: 1, weight: "", reps: "", minutes: "20", level: "8", isPR: false, type: "working" },
      { exName: "Pull-Up", setNum: 1, weight: "25", reps: "8", minutes: "", level: "", isPR: false, type: "working" },
    ],
  },
];

describe("buildPersonalExport (JSON)", () => {
  test("chronological, oldest first; real dates + notes preserved (NOT anonymized)", () => {
    const out = buildPersonalExport(fixture(), { trackOf });
    expect(out.sessionCount).toBe(2);
    expect(out.sessions.map((s) => s.day)).toEqual(["Cardio", "Push"]); // May 20 before June 1
    // Real ISO timestamps are KEPT (this is the user's own data)
    expect(out.sessions[1].completedAt).toBe("2026-06-01T19:00:00Z");
    expect(out.sessions.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))).toBe(true);
    expect(out.sessions[1].notes).toBe("felt strong");
  });

  test("every set type is represented faithfully (weight / bodyweight / hold / cardio)", () => {
    const out = buildPersonalExport(fixture(), { trackOf });
    const push = out.sessions.find((s) => s.day === "Push");
    const cardio = out.sessions.find((s) => s.day === "Cardio");

    const bench = push.exercises.find((e) => e.exercise === "Bench Press");
    expect(bench.track).toBe("weight");
    expect(bench.sets[0]).toEqual({ set: 1, weight: 95, reps: 5, type: "warmup" }); // warmup KEPT, flagged
    expect(bench.sets[1]).toEqual({ set: 2, weight: 185, reps: 5, pr: true });      // working omits type; pr kept

    const plank = push.exercises.find((e) => e.exercise === "Plank");
    expect(plank.track).toBe("time");
    expect(plank.sets[0]).toEqual({ set: 1, seconds: 60 }); // holds -> seconds, never a bare "60 reps"

    const row = cardio.exercises.find((e) => e.exercise === "Rowing Machine");
    expect(row.track).toBe("cardio");
    expect(row.sets[0]).toEqual({ set: 1, minutes: 20, level: "8" });

    const pull = cardio.exercises.find((e) => e.exercise === "Pull-Up");
    expect(pull.track).toBe("reps");
    expect(pull.sets[0]).toEqual({ set: 1, reps: 8, addedWeight: 25 }); // bodyweight + added
  });

  test("empty input -> valid, empty export", () => {
    const out = buildPersonalExport([], { trackOf });
    expect(out.sessionCount).toBe(0);
    expect(out.sessions).toEqual([]);
    expect(typeof out.exportedAt).toBe("string");
  });
});

describe("buildPersonalCSV", () => {
  test("header + one row per set; type-appropriate columns; notes once per session", () => {
    const csv = buildPersonalCSV(fixture(), { trackOf });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,day,exercise,track,set,type,weight,reps,seconds,minutes,level,pr,notes");
    expect(lines.length).toBe(1 + 5); // 5 sets total across both sessions

    const plank = lines.find((l) => l.includes("Plank"));
    expect(plank).toMatch(/,time,1,working,,,60,,,/); // seconds column filled, weight/reps empty

    const rowing = lines.find((l) => l.includes("Rowing Machine"));
    expect(rowing).toMatch(/,cardio,1,working,,,,20,8,/); // minutes + level filled

    const pull = lines.find((l) => l.includes("Pull-Up"));
    expect(pull).toMatch(/,reps,1,working,25,8,/); // added weight in weight column, reps filled

    // "felt strong" note appears exactly once (first row of the Push session)
    expect(csv.match(/felt strong/g).length).toBe(1);
  });

  test("empty input -> header only", () => {
    expect(buildPersonalCSV([], { trackOf })).toBe("date,day,exercise,track,set,type,weight,reps,seconds,minutes,level,pr,notes");
  });

  test("a session with no logged sets still yields one row", () => {
    const csv = buildPersonalCSV([{ dayLabel: "Rest", completedAt: "2026-06-02T12:00:00Z", notes: "deload", setsArr: [] }], { trackOf });
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + 1 empty-session row
    expect(lines[1]).toMatch(/,Rest,,,,,,,,,,,deload/);
  });
});
