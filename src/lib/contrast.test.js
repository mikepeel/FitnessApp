// WCAG AA contrast guard for the `faint` text token (readability commit 1). Reads the ACTUAL token
// values out of src/App.js's THEMES so the assertion tracks the source (revert the token -> this fails).
// faint is the tier that was failing (dark #6a7585 ~2.96:1 on card); the fix lifts it to legible while
// keeping it quieter than muted. WCAG contrast = (Lhi+0.05)/(Llo+0.05) with sRGB relative luminance.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
const darkBlock = src.slice(src.indexOf("dark: {"), src.indexOf("light: {"));
const lightBlock = src.slice(src.indexOf("light: {"));
const tok = (block, name) => {
  const m = block.match(new RegExp("(?:^|[^A-Za-z])" + name + ':"(#[0-9a-fA-F]{6})"'));
  if (!m) throw new Error(`token ${name} not found`);
  return m[1];
};

function luminance(hex) {
  const ch = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

const dark = { bg: tok(darkBlock, "bg"), surface: tok(darkBlock, "surface"), card: tok(darkBlock, "card"), muted: tok(darkBlock, "muted"), faint: tok(darkBlock, "faint") };
const light = { bg: tok(lightBlock, "bg"), card: tok(lightBlock, "card"), muted: tok(lightBlock, "muted"), faint: tok(lightBlock, "faint") };

describe("faint token — WCAG AA contrast", () => {
  test("sanity: the contrast math reproduces a known failure (old dark faint #6a7585 on card ~2.96:1)", () => {
    expect(ratio("#6a7585", dark.card)).toBeLessThan(3); // the value we're fixing
  });

  test("DARK faint clears 4.5:1 on every dark surface, with >5:1 headroom on the worst (card)", () => {
    for (const s of ["card", "surface", "bg"]) {
      expect(ratio(dark.faint, dark[s])).toBeGreaterThanOrEqual(4.5); // AA normal text
    }
    // Tinted-protector + low-brightness headroom: worst surface still comfortably above 5:1.
    expect(ratio(dark.faint, dark.card)).toBeGreaterThan(5); // load-bearing: revert -> ~2.96 -> fails
  });

  test("LIGHT faint clears 4.5:1 on light bg + card (>5:1 headroom)", () => {
    expect(ratio(light.faint, light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(light.faint, light.card)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(light.faint, light.card)).toBeGreaterThan(5);
  });

  test("hierarchy preserved: faint stays QUIETER (lower contrast) than muted in both themes", () => {
    expect(ratio(dark.faint, dark.card)).toBeLessThan(ratio(dark.muted, dark.card));
    expect(ratio(light.faint, light.card)).toBeLessThan(ratio(light.muted, light.card));
  });
});
