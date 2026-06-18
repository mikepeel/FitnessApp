import { mapSessionRow } from "./sessionMap";

describe("mapSessionRow", () => {
  test("maps a workout_sessions row (+ logged_sets) to the in-app session shape", () => {
    const row = {
      id: "abc",
      day_label: "Pull",
      day_id: null,
      started_at: "2026-06-01T10:00:00Z",
      completed_at: "2026-06-01T11:00:00Z",
      notes: "felt good",
      partial: false,
      sets_data: { "Lat Pulldown": { "1": { weight: "120", reps: "10" }, "2": { weight: "120", reps: "9" } } },
      exercise_order: ["Lat Pulldown"],
      logged_sets: [
        { exercise_name: "Lat Pulldown", set_number: 1, is_pr: true, set_type: "working" },
        { exercise_name: "Lat Pulldown", set_number: 2, is_pr: false, set_type: "working" },
      ],
    };
    const m = mapSessionRow(row);
    expect(m).toMatchObject({
      id: "abc", supabaseId: "abc", dayLabel: "Pull", dayId: null,
      startedAt: "2026-06-01T10:00:00Z", completedAt: "2026-06-01T11:00:00Z",
      notes: "felt good", partial: false, exerciseOrder: ["Lat Pulldown"],
    });
    expect(m.setsArr).toHaveLength(2);
    expect(m.setsArr[0]).toMatchObject({ exName: "Lat Pulldown", setNum: 1, weight: "120", reps: "10", isPR: true, type: "working" });
  });

  test("defaults: missing sets_data → empty sets/setsArr; is_pr/partial default false; type from sets_data when no logged_set", () => {
    const m = mapSessionRow({ id: "x", sets_data: { Squat: { "1": { weight: "225", reps: "5", type: "warmup" } } } });
    expect(m.sets).toEqual({ Squat: { "1": { weight: "225", reps: "5", type: "warmup" } } });
    expect(m.partial).toBe(false);
    expect(m.exerciseOrder).toBe(null);
    expect(m.setsArr[0]).toMatchObject({ exName: "Squat", setNum: 1, isPR: false, type: "warmup" }); // type falls back to sets_data x.type
  });

  test("empty row → empty setsArr, no throw", () => {
    expect(mapSessionRow({ id: "e" }).setsArr).toEqual([]);
  });
});
