import { packRgba, unpackRgba, type Color } from './color.js';

export interface Oklch {
  /** Perceptual lightness, 0 (black) to 1 (white). */
  readonly l: number;
  /** Chroma, 0 for greys; sRGB colors stay below about 0.32. */
  readonly c: number;
  /** Hue angle in degrees, [0, 360). */
  readonly h: number;
  /** Opacity, 0 to 1. */
  readonly alpha: number;
}

export function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

interface Triple {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// Matrices from Bjorn Ottosson's OKLab definition (https://bottosson.github.io/posts/oklab/).
function linearRgbToOklab(r: number, g: number, b: number): Triple {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    x: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    y: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    z: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb(lightness: number, a: number, b: number): Triple {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    x: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    y: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    z: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

const ACHROMATIC_CHROMA = 1e-4;
const GAMUT_EPSILON = 1e-6;

export function colorToOklch(color: Color): Oklch {
  const { r, g, b, a } = unpackRgba(color);
  const lab = linearRgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  const chroma = Math.hypot(lab.y, lab.z);
  const hue =
    chroma < ACHROMATIC_CHROMA ? 0 : ((Math.atan2(lab.z, lab.y) * 180) / Math.PI + 360) % 360;
  return { l: lab.x, c: chroma < ACHROMATIC_CHROMA ? 0 : chroma, h: hue, alpha: a / 255 };
}

function inGamut(rgb: Triple): boolean {
  const within = (v: number): boolean => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON;
  return within(rgb.x) && within(rgb.y) && within(rgb.z);
}

function toByte(linear: number): number {
  const encoded = linearToSrgb(Math.min(1, Math.max(0, linear)));
  return Math.round(encoded * 255);
}

/** Converts OKLCH to a packed color. Colors outside sRGB are brought in by lowering chroma. */
export function oklchToColor({ l, c, h, alpha }: Oklch): Color {
  const alphaByte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  if (l >= 1) return packRgba(255, 255, 255, alphaByte);
  if (l <= 0) return packRgba(0, 0, 0, alphaByte);

  const radians = (h * Math.PI) / 180;
  const at = (chroma: number): Triple =>
    oklabToLinearRgb(l, chroma * Math.cos(radians), chroma * Math.sin(radians));

  let chroma = Math.max(0, c);
  let rgb = at(chroma);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = chroma;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (inGamut(at(mid))) low = mid;
      else high = mid;
    }
    chroma = low;
    rgb = at(chroma);
  }
  return packRgba(toByte(rgb.x), toByte(rgb.y), toByte(rgb.z), alphaByte);
}
