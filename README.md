# Vidopix

[Español](README.es.md)

A pixel art editor that runs in your browser: no install, no account, and a built-in palette generator.

> **Status:** v1.1.0. The live demo link and screenshots are added once the app is deployed.

## Goals

- A portfolio piece that shows architecture, algorithms, performance and product design.
- Genuinely usable: an artist should be able to make a 64×64 sprite from start to finish and export it.
- Fast to load and, from Phase 4, usable offline.

## What it does today

- Pencil, eraser (1 to 16 px), fill (contiguous or global, with tolerance), eyedropper, line, rectangle and ellipse. Shift constrains lines to 0/45/90 degrees and shapes to squares and circles.
- Integer zoom from 1x to 64x anchored on the pointer, panning, pixel grid, transparency checkerboard.
- Primary and secondary colors with hex and OKLCH sliders.
- Undo and redo that never run out of steps, only out of a memory budget (64 MB by default).
- Layers (add, duplicate, delete, rename, reorder, hide, lock, opacity, merge down, flatten), all undoable.
- Rectangular selection, move, copy, cut, paste and delete; every tool respects the selection.
- A palette per sprite with six presets, import and export (`.gpl`, `.hex`, JSON), extraction from any image (median cut, in a worker), OKLCH harmonies, hue-shifted shade ramps, a WCAG contrast checker and replace color.
- Symmetry, ordered dithering, a pixel-perfect pencil, pen pressure, and touch gestures (pinch to zoom, two fingers to pan).
- Saved automatically in your browser (nothing is uploaded), recent projects, `.vidopix` files and share links that carry the sprite inside the URL.
- Installable and usable offline.
- The interface in English and Spanish.
- Animation: a timeline with frames of any duration, looping playback, onion skin, and export as animated GIF or as a spritesheet with a JSON file of coordinates.
- PNG export at 1x to 32x.
- Fully usable from the keyboard: arrow keys move a pixel cursor, hold Enter to draw.

## Measured performance

Numbers from this repository's own benchmarks and E2E run on the author's machine (Apple silicon Mac, headless Chromium). They are not estimates; run `pnpm bench` and `pnpm e2e` to reproduce them on yours.

| Metric                                         | Target       | Measured                              |
| ---------------------------------------------- | ------------ | ------------------------------------- |
| Flood fill 1024×1024, algorithm only           | < 50 ms      | about 12 ms                           |
| Flood fill 1024×1024, including the undo patch | < 50 ms      | about 34 ms                           |
| Frame time while drawing on 256×256            | 60 fps       | 16.7 ms mean (vsync-limited)          |
| 500 strokes undone and redone on 256×256       | within 64 MB | passes (unit test)                    |
| Playing 32 frames of 64×64                     | 60 fps       | 16.7 ms mean (vsync-limited)          |
| GIF of 32 frames of 64×64, in a worker         | responsive   | about 50 ms to encode (exact palette) |
| Initial JavaScript (gzip)                      | < 150 kB     | 128 kB                                |

Lighthouse was measured with `pnpm lighthouse` on the production build with the desktop preset. The page is designed for screens at least 768 px wide, so a phone-sized mobile run is not a target.

## Known limits

- The layout needs at least 768 px of width; phones are not supported, tablets are.
- Only Chromium is covered by the automated tests. Safari and Firefox need a manual check, especially for installing the app, the system clipboard, `CompressionStream` links and touch.
- A project can be at most 1024×1024 pixels, 64 layers, 128 frames and 20 MB (and 256 MB of pixels in memory). A link can carry about 6000 characters, which is plenty for flat-color pixel art and not enough for large or noisy sprites.
- A GIF has a single palette of 256 colors and no partial transparency, so an image with more colors is reduced and pixels more than half transparent become opaque or transparent. Quantizing thousands of colors takes about half a second.
- Details of errors that come from reading palette or project files are technical and stay in English.

## Stack

TypeScript (strict), React, Vite, pnpm workspaces, Vitest + fast-check, Playwright + axe-core, ESLint, Prettier, dependency-cruiser, GitHub Actions and Vercel. See [SPEC.md](SPEC.md) section 3 for the reasoning.

## Architecture

A pure TypeScript engine (`packages/core`, no DOM) and a React app (`apps/web`) that only paints and translates events. The boundary is enforced in CI. See [docs/architecture.md](docs/architecture.md) and the [ADRs](docs/adr).

## Getting started

Requires Node 24 LTS (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev
```

Useful scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.

## How this was built

Developed with Claude Code from a written specification ([SPEC.md](SPEC.md)). This section will cover what was asked, what was reviewed and decided by the author, and what was corrected, once there is more to tell.

## Palette credits

The preset palettes use the color values published on [Lospec](https://lospec.com/palette-list). They belong to their authors:

- **PICO-8**: Lexaloffle Games.
- **DawnBringer 16** and **DawnBringer 32**: Richard "DawnBringer" Fhager.
- **Sweetie 16**: GrafxKid.
- **Endesga 32**: ENDESGA.
- **Resurrect 64**: Kerrie Lake.

## Credits and license

By vidotho. MIT licensed, see [LICENSE](LICENSE).
