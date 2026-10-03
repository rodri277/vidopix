# ADR 006: OKLCH for palette generation

- Status: Accepted
- Phase: 3

## Context

Palette tools (harmonies, shade ramps) need to change hue, lightness or chroma on their own. In sRGB or HSL a step of the same size looks very different depending on the color, so a "complementary" or "10% darker" color comes out uneven.

## Decision

- Harmonies and ramps are built in **OKLCH**, a perceptually uniform space: hue steps are rotations of the hue angle, shading changes lightness `L`.
- Conversions (`sRGB` ↔ linear ↔ OKLab ↔ OKLCH) live in the core and are tested against published reference values and with round trips over every 8-bit color.
- Colors that fall outside sRGB after a change are **gamut mapped by lowering chroma** at the same lightness and hue, never by clipping channels, which would shift the hue.
- Shade ramps follow pixel art practice: shadows get darker and drift toward blue-purple (hue 270), highlights get lighter and drift toward yellow (hue 90), and the extremes lose a little chroma. With an odd number of steps the middle one is exactly the base color.
- Contrast uses the **WCAG 2.x** relative luminance and ratio, since that is what accessibility guidelines require, even though OKLCH lightness is the better perceptual measure. Values are checked against well-known pairs (black on white 21:1, `#767676` on white 4.54:1, and so on).

## Alternatives considered

- **HSL.** Familiar, but unevenly bright across hues; a complementary pair has visibly different lightness.
- **CIELAB.** Better than HSL, but known hue shifts in blues; OKLab fixes them and is simpler to convert.

## Consequences

- Palette colors are stored as plain sRGB; OKLCH is only used while computing.
- Greys have no meaningful hue, so ramps do not shift their hue and harmonies of a grey return greys.
