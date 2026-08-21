import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/* The colour contract. Every token points at a step, the ladder only ever
   rises, every line sits below every surface, and every pair clears its floor.
   Adapted from NightWarden's console suite, which solves the same system at the
   dark end; the cases that differ are marked, and they differ because light
   inverts the direction of an edge rather than because the idea changed.

   Converted here rather than read from a browser: a browser reports oklch()
   back verbatim, so a naive rgb() regex reads L, C and H as r, g and b. */

type Step = { L: number; C: number; H: number };

const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

/* :root carries primitives and semantics; @theme carries everything with no
   palette dimension. They are parsed separately because only the first is held
   to the "must resolve to a step" rule. */
const declarations = new Map<string, string>();
for (const block of css.matchAll(/:root\s*\{([\s\S]*?)\n\}/g)) {
  for (const m of block[1].matchAll(/--([a-z][-a-z0-9]*):\s*([^;]+);/g)) {
    declarations.set(m[1]!, m[2]!.trim().replace(/\s+/g, " "));
  }
}

const scale = new Map<string, Step>();
const aliases = new Map<string, string>();
const mixes = new Map<string, { base: string; toward: string; part: number }>();
const overlays = new Map<string, { ink: string; alpha: number }>();

/* A mix names both poles and blends in OKLab, where the browser blends. */
const MIX =
  /^color-mix\(\s*in oklab,\s*var\(--([a-z][-a-z0-9]*)\),\s*var\(--([a-z][-a-z0-9]*)\) ([\d.]+)%\s*\)$/;
/* An overlay names no base: a control that can sit on four depths has no one
   surface to be mixed against, so it composites over whatever is beneath. */
const OVERLAY =
  /^color-mix\(\s*in srgb,\s*var\(--([a-z][-a-z0-9]*)\) ([\d.]+)%,\s*transparent\s*\)$/;

for (const [name, value] of declarations) {
  const triple = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (triple) {
    scale.set(name, { L: +triple[1]!, C: +triple[2]!, H: +triple[3]! });
    continue;
  }
  const blend = MIX.exec(value);
  if (blend) {
    mixes.set(name, { base: blend[1]!, toward: blend[2]!, part: +blend[3]! / 100 });
    continue;
  }
  const wash = OVERLAY.exec(value);
  if (wash) {
    overlays.set(name, { ink: wash[1]!, alpha: +wash[2]! / 100 });
    continue;
  }
  const alias = /^var\(--([a-z][-a-z0-9]*)\)$/.exec(value);
  if (alias) aliases.set(name, alias[1]!);
}

function blend(x: Step, y: Step, part: number): Step {
  const polar = ({ L, C, H }: Step) => {
    const h = (H * Math.PI) / 180;
    return [L, C * Math.cos(h), C * Math.sin(h)] as const;
  };
  const [l1, a1, b1] = polar(x);
  const [l2, a2, b2] = polar(y);
  const [L, a, b] = [
    l1 + (l2 - l1) * part,
    a1 + (a2 - a1) * part,
    b1 + (b2 - b1) * part,
  ];
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(a, b), H };
}

function step(name: string): Step {
  const target = aliases.get(name) ?? name;
  const mix = mixes.get(target);
  if (mix) return blend(step(mix.base), step(mix.toward), mix.part);
  const value = scale.get(target);
  if (!value) throw new Error(`--${name} does not resolve to a step on the scale`);
  return value;
}

/* OKLab to linear sRGB, then luminance. Clamped, because a browser clamps too. */
function luminance({ L, C, H }: Step): number {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const [r, g, bl] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(step(a)), luminance(step(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["n-1", "n-2", "n-3"];
const LINES = ["line-1", "line-2"];

describe("the ladder", () => {
  it("rises: the ground is the deepest surface and a card the lightest", () => {
    /* The relationship the whole system rests on, and the one that was wrong
       before this test existed: a card sits ABOVE the page, so the page is
       slightly grey and the card is white — not the other way round. */
    expect(step("n-1").L).toBeLessThan(step("n-2").L);
    expect(step("n-2").L).toBeLessThan(step("n-3").L);
  });

  it("keeps every surface step big enough to read and small enough to be calm", () => {
    /* Deliberately NOT an even-spacing rule. These are measured values, and
       Linear's own ladder is not evenly spaced — an assertion of evenness would
       contradict the reference this system is built on. What matters is that no
       rung is so small it is a gesture, nor so large it reads as a new colour. */
    for (const [below, above] of [
      ["n-1", "n-2"],
      ["n-2", "n-3"],
    ] as const) {
      const d = step(above).L - step(below).L;
      expect(d, `${below} to ${above}`).toBeGreaterThan(0.01);
      expect(d, `${below} to ${above}`).toBeLessThan(0.06);
    }
  });

  it("sinks a control in two steps, and never below the deepest surface", () => {
    /* Linear looks raised with no shadow at all — its rest surface simply sits
       above the page and sinks below it when pressed. Deliberately NOT an
       evenness rule: their own steps are 5.5 then 1.5 in lch, decreasing, and
       asserting evenness here would repeat the mistake made on the surfaces. */
    expect(step("control").L).toBeGreaterThan(step("n-2").L);
    expect(step("control-hover").L).toBeLessThan(step("control").L);
    expect(step("control-active").L).toBeLessThan(step("control-hover").L);
    expect(step("control-active").L).toBeGreaterThan(step("sunk").L);
    // Each move has to be visible, or it is a token nobody can see.
    expect(step("control").L - step("control-hover").L).toBeGreaterThan(0.008);
    expect(step("control-hover").L - step("control-active").L).toBeGreaterThan(0.008);
  });

  it("keeps the sidebar's hover and selected fills apart", () => {
    /* Hovering a selected row still has to say something. */
    expect(step("sunk-1").L).toBeGreaterThan(step("sunk").L);
    expect(step("sunk-1").L).toBeLessThan(step("n-1").L);
  });

  it("drops the selected fill BELOW the ground, never one step up", () => {
    /* Dark rises to signal state, light sinks. Getting this backwards makes a
       selected row read as a raised one, which is the wrong affordance. */
    expect(step("sunk").L).toBeLessThan(step("n-1").L);
  });

  it("keeps every line below every surface, so an edge cannot invert", () => {
    /* In light, "a line sits above every surface" means darker. A line lighter
       than a raised surface disappears exactly where it is needed most. */
    for (const line of LINES) {
      for (const n of SURFACES) {
        expect(step(line).L, `${line} on ${n}`).toBeLessThan(step(n).L);
      }
    }
  });

  it("keeps the input border darker than the card border", () => {
    /* A card and an input share one fill. The border is the only thing that
       separates them, so the input's has to be the more defined of the two. */
    expect(step("line-2").L).toBeLessThan(step("line-1").L);
  });

  it("spaces ink evenly", () => {
    const a = step("ink-2").L - step("ink-1").L;
    const b = step("ink-3").L - step("ink-2").L;
    expect(a).toBeCloseTo(b, 2);
  });
});

describe("derivation", () => {
  it("holds every semantic token to a step, a mix, an alias or transparent", () => {
    for (const [name, value] of declarations) {
      if (scale.has(name) || aliases.has(name) || mixes.has(name)) continue;
      if (overlays.has(name)) continue;
      expect(value, `--${name} is a raw value, not a step`).toBe("transparent");
    }
  });

  it("keeps raw colour out of everything but the named primitives", () => {
    for (const name of scale.keys()) {
      expect(name, `--${name} is a raw colour outside the scale`).toMatch(
        /^(n|sunk|line|ink|accent-fill|red-fill|white)(-|$)/,
      );
    }
  });

  it("derives every hover and active state rather than naming a rung", () => {
    /* A state bound to a rung is right at one depth and wrong at every other.
       Expressed as a mix, it follows whatever it lands on. */
    const states = [...declarations.keys()].filter((n) => /^(hover|active)$/.test(n));
    expect(states.length).toBeGreaterThan(0);
    for (const name of states) {
      const overlay = overlays.get(name);
      expect(overlay, `--${name} is not a wash`).toBeDefined();
      expect(overlay?.ink, `--${name} washes with the wrong pole`).toBe("ink-3");
    }
  });

  it("darkens to make a state, the mirror of the dark theme lightening", () => {
    expect(overlays.get("active")!.alpha).toBeGreaterThan(overlays.get("hover")!.alpha);
  });

  it("lifts each fill toward white for its hover", () => {
    for (const [fill, hover] of [
      ["primary", "primary-hover"],
      ["destructive", "destructive-hover"],
    ] as const) {
      expect(mixes.get(hover)?.toward, `--${hover}`).toBe("white");
      expect(step(hover).L).toBeGreaterThan(step(fill).L);
    }
  });
});

describe("colour means one thing", () => {
  it("spends the accent on anything you act on", () => {
    /* One hue, one meaning: this is interactive. A primary button, a focus
       ring, and a row still waiting on you are all the same invitation. */
    expect(aliases.get("primary")).toBe("accent-fill");
    expect(aliases.get("ring")).toBe("accent-fill");
    expect(aliases.get("status-pending")).toBe("accent-fill");
  });

  it("reserves red for destructive and nothing else", () => {
    const red = [...declarations].filter(([, v]) => v === "var(--red-fill)").map(([n]) => n);
    expect(red.sort()).toEqual(["destructive", "status-error"]);
  });

  it("keeps the accent to interactive things and nothing else", () => {
    const accented = [...declarations]
      .filter(([, v]) => v === "var(--accent-fill)")
      .map(([n]) => n)
      .sort();
    expect(accented).toContain("primary");
    expect(accented).toContain("ring");
    expect(accented).toContain("status-pending");
  });

  it("states a fact in ink, not in green", () => {
    for (const s of ["status-booked", "status-confirmed"]) {
      expect(step(s)).toEqual(step("ink-3"));
    }
  });
});

describe("contrast floors", () => {
  it("clears AAA for body ink on every surface", () => {
    for (const n of SURFACES) {
      expect(contrast("ink-3", n), `ink-3 on ${n}`).toBeGreaterThanOrEqual(7);
    }
  });

  it("clears AA for muted ink on every surface", () => {
    for (const n of SURFACES) {
      expect(contrast("ink-1", n), `ink-1 on ${n}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("clears AA for a fill against the text it carries", () => {
    expect(contrast("primary-foreground", "primary")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("destructive-foreground", "destructive")).toBeGreaterThanOrEqual(4.5);
  });

  it("clears AA for the accent wherever it is read", () => {
    for (const n of SURFACES) {
      expect(contrast("accent-fill", n), `accent on ${n}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps a hairline visible but calm", () => {
    /* Between 1.2 and 3: below that an edge vanishes, above it the page turns
       into a wireframe. */
    for (const line of LINES) {
      const c = contrast(line, "n-3");
      expect(c, `${line} on a card`).toBeGreaterThan(1.2);
      expect(c, `${line} on a card`).toBeLessThan(3);
    }
  });
});

describe("type and depth", () => {
  const theme = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

  it("puts nothing below the 14px floor", () => {
    const sizes = [...theme.matchAll(/--text-(?!.*line-height)[a-z0-9]+:\s*(\d+)px/g)].map(
      (m) => +m[1]!,
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(14);
  });

  it("carries two radii, not five", () => {
    const radii = new Set(
      [...theme.matchAll(/--radius-[a-z0-9]+:\s*(\d+)px/g)].map((m) => m[1]!),
    );
    expect([...radii].sort()).toEqual(["12", "8"]);
  });

  it("clears the default shadow scale and declares only edge and raised", () => {
    expect(css).toMatch(/--shadow-\*:\s*initial/);
    const declared = [...css.matchAll(/--shadow-([a-z]+):/g)].map((m) => m[1]!);
    expect(declared.sort()).toEqual(["edge", "raised"]);
  });

  it("draws the hairline as a spread, not a blur", () => {
    /* A 0.5px spread at low alpha darkens the surface exactly at the edge.
       A blurred drop would be a second depth cue arguing with the ladder. */
    expect(css).toMatch(/--shadow-edge:\s*0 0 0 0\.5px/);
  });
});
