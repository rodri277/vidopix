import { unpackRgba, type Color } from './color.js';
import { colorToOklch, oklchToColor, type Oklch } from './oklch.js';
import { opaque } from './palette.js';

export const HARMONY_KINDS = [
  'analogous',
  'complementary',
  'triadic',
  'tetradic',
  'monochromatic',
] as const;

export type HarmonyKind = (typeof HARMONY_KINDS)[number];

// ---- Contrast (WCAG 2.x) ----

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance as defined by WCAG 2.x, from 0 (black) to 1 (white). Alpha is ignored. */
export function relativeLuminance(color: Color): number {
  const { r, g, b } = unpackRgba(color);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: Color, b: Color): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface WcagLevels {
  /** Normal-size text, AA. */
  readonly aaNormal: boolean;
  /** Large text, AA. */
  readonly aaLarge: boolean;
  readonly aaaNormal: boolean;
  readonly aaaLarge: boolean;
}

export function wcagLevels(ratio: number): WcagLevels {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

// ---- Harmonies ----

const HUE_OFFSETS: Readonly<Record<Exclude<HarmonyKind, 'monochromatic'>, readonly number[]>> = {
  analogous: [-30, 0, 30],
  complementary: [0, 180],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
};

const MONOCHROME_LIGHTNESS: readonly number[] = [0.25, 0.4, 0.55, 0.7, 0.85];

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/** Colors that relate to `base` on the OKLCH hue wheel. The result is opaque. */
export function harmony(base: Color, kind: HarmonyKind): Color[] {
  const lch = colorToOklch(base);
  if (kind === 'monochromatic') {
    return MONOCHROME_LIGHTNESS.map((l) => oklchToColor({ ...lch, l, alpha: 1 }));
  }
  return HUE_OFFSETS[kind].map((offset) =>
    offset === 0 ? opaque(base) : oklchToColor({ ...lch, h: wrapHue(lch.h + offset), alpha: 1 }),
  );
}

// ---- Shade ramps ----

export interface RampOptions {
  /** How far, in degrees, the extreme shades move toward blue-purple and yellow. Default 25. */
  readonly hueShift?: number;
  /** How far lightness moves from the base at each end (OKLCH L). Default 0.3. */
  readonly lightnessSpread?: number;
}

const MIN_RAMP_STEPS = 2;
const MAX_RAMP_STEPS = 15;
const COOL_HUE = 270;
const WARM_HUE = 90;
const MIN_L = 0.08;
const MAX_L = 0.97;
const GREY_CHROMA = 0.01;

/** Moves `hue` toward `target` along the shorter arc by at most `degrees`. */
function shiftToward(hue: number, target: number, degrees: number): number {
  const delta = wrapHue(target - hue + 180) - 180;
  const move = Math.max(-degrees, Math.min(degrees, delta));
  return wrapHue(hue + move);
}

/**
 * A ramp from dark to light around `base`, the way pixel artists shade: shadows get darker and
 * drift toward blue-purple, highlights get lighter and drift toward yellow, and the most extreme
 * shades lose a little chroma. With an odd number of steps the middle one is the base color.
 */
export function shadeRamp(base: Color, steps: number, options: RampOptions = {}): Color[] {
  const count = Math.min(MAX_RAMP_STEPS, Math.max(MIN_RAMP_STEPS, Math.round(steps)));
  const hueShift = options.hueShift ?? 25;
  const spread = options.lightnessSpread ?? 0.3;
  const lch = colorToOklch(base);
  const darkest = Math.max(MIN_L, lch.l - spread);
  const lightest = Math.min(MAX_L, lch.l + spread);
  const shifts = lch.c >= GREY_CHROMA;

  const result: Color[] = [];
  for (let i = 0; i < count; i++) {
    const t = -1 + (2 * i) / (count - 1);
    if (Math.abs(t) < 1e-9) {
      result.push(opaque(base));
      continue;
    }
    const l = t < 0 ? lch.l + t * (lch.l - darkest) : lch.l + t * (lightest - lch.l);
    const hue = shifts
      ? shiftToward(lch.h, t < 0 ? COOL_HUE : WARM_HUE, Math.abs(t) * hueShift)
      : lch.h;
    const next: Oklch = { l, c: lch.c * (1 - 0.3 * t * t), h: hue, alpha: 1 };
    result.push(oklchToColor(next));
  }
  return result;
}
