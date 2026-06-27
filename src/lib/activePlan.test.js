import { resolveActivePlanKey } from "./activePlan";

// The two read SOURCES the fix toggles between (this is what the one-line change at App.js:1105 does):
const oldSaved = (prof, meta) => prof || meta; // current code: profiles-preferred
const newSaved = (prof, meta) => meta;         // fix: metadata-only
// The load self-correct (App.js:1110) writes metadata iff the resolved key != the saved key — so a
// clobber of the user's metadata choice happens exactly when resolve(saved) !== saved.
const willClobber = (saved, keys) => resolveActivePlanKey(saved, keys) !== saved;

describe("resolveActivePlanKey", () => {
  test("valid saved key wins; invalid falls to planKeys[0]; empty -> null", () => {
    expect(resolveActivePlanKey("Y", ["X", "Y"])).toBe("Y");
    expect(resolveActivePlanKey("B", ["X", "Y"])).toBe("X"); // invalid -> first plan
    expect(resolveActivePlanKey("X", [])).toBe(null);
    expect(resolveActivePlanKey(null, ["X", "Y"])).toBe("X");
    expect(resolveActivePlanKey(undefined, [])).toBe(null);
  });

  describe("multi-plan re-arm case (the dormant bug): profiles stale, metadata = the real choice, >=2 plans", () => {
    const keys = ["X", "Y"];
    const meta = "Y"; // the user switched to Y; the live choice lives in metadata

    test("FAILS-BEFORE / PASSES-AFTER + no-clobber: stale INVALID profiles 'B'", () => {
      const prof = "B";
      // BEFORE (profiles-preferred): resolves planKeys[0]=X (wrong) AND the self-correct clobbers metadata to X
      expect(resolveActivePlanKey(oldSaved(prof, meta), keys)).toBe("X");
      expect(willClobber(oldSaved(prof, meta), keys)).toBe(true);
      // AFTER (metadata-only): resolves Y (the choice), and does NOT clobber
      expect(resolveActivePlanKey(newSaved(prof, meta), keys)).toBe("Y");
      expect(willClobber(newSaved(prof, meta), keys)).toBe(false);
    });

    test("stale VALID profiles 'X' (the worst case): BEFORE the stale key wins outright; AFTER honors metadata", () => {
      const prof = "X";
      expect(resolveActivePlanKey(oldSaved(prof, meta), keys)).toBe("X"); // stale valid overrides the choice
      expect(resolveActivePlanKey(newSaved(prof, meta), keys)).toBe("Y");
    });
  });

  describe("resolution-equivalence: every CURRENT account resolves identically OLD vs NEW (no live user's plan changes)", () => {
    // Baseline traced from live data (probe_equiv): all resolve the same before and after the fix.
    const accounts = [
      { name: "iron-test", prof: "preset_test_ppl", meta: "preset_1779844030358", keys: ["preset_test_ppl"], expect: "preset_test_ppl" },
      { name: "peelrachel", prof: "B", meta: "preset_1779824785735", keys: ["preset_1779824785735"], expect: "preset_1779824785735" },
      { name: "mikeapeel", prof: "B", meta: "preset_1779763678332", keys: ["preset_1779763678332"], expect: "preset_1779763678332" },
      { name: "no-plans-user", prof: "B", meta: null, keys: [], expect: null },
    ];
    for (const a of accounts) {
      test(`${a.name} resolves identically (-> ${a.expect})`, () => {
        const before = resolveActivePlanKey(oldSaved(a.prof, a.meta), a.keys);
        const after = resolveActivePlanKey(newSaved(a.prof, a.meta), a.keys);
        expect(before).toBe(a.expect);
        expect(after).toBe(before); // the load-bearing "no live user changes" proof
      });
    }
  });
});
